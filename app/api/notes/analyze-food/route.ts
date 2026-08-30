import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { requestVisionJSON, requestTextJSON, resolveVisionConfig, visionProviderNames } from '@/lib/ai-vision'
import { ProviderCallError, type ProviderResult } from '@/lib/ai-vision'
import { logAiUsage, normalizeUsage, servedModel } from '@/lib/ai-usage'
import { normalizeItemsWithInternalTable } from './nutrition-normalizer'
import { resolveAIAccess, incrementAITrialUsage, trialExhaustedBody, QUOTA_EXHAUSTED_STATUS } from '@/lib/ai-trial'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Vercel caps request bodies at 4.5 MB and base64 inflates by ~4/3, so keep the
// decoded image below that. The client downscales to ~1024 px first.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

type Lang = 'vi' | 'en'

const requestSchema = z.object({
  mode: z.enum(['image', 'text']),
  image: z
    .object({
      data: z.string().min(1),
      mimeType: z.string().min(1),
    })
    .optional(),
  description: z.string().max(2000).optional(),
  lang: z.enum(['vi', 'en']).optional(),
})

// The model is asked for exact keys, but stays a language model — coerce and
// default everything so one sloppy field does not fail the whole analysis.

/** Accepts 0..1 ratios and 0..100 percentages, which models use interchangeably. */
const confidence = (fallback: number) =>
  z.coerce
    .number()
    .catch(fallback)
    .transform((n) => (n > 1 ? Math.min(n / 100, 1) : Math.max(n, 0)))

/** `z.coerce.boolean()` turns the string "false" into true, so parse strings explicitly. */
const looseBool = (fallback: boolean) =>
  z
    .preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() === 'true' : v), z.boolean())
    .catch(fallback)

const itemSchema = z.object({
  name: z.string().min(1).catch('?'),
  portion: z.string().catch(''),
  calories: z.coerce.number().min(0).catch(0),
  protein_g: z.coerce.number().min(0).catch(0),
  carbs_g: z.coerce.number().min(0).catch(0),
  fat_g: z.coerce.number().min(0).catch(0),
  confidence: confidence(0.5),
  assumptions: z.string().catch(''),
})

const resultSchema = z.object({
  is_food: looseBool(true),
  overall_confidence: confidence(0.5),
  needs_more_detail: looseBool(false),
  questions: z.array(z.string()).catch([]),
  notes: z.string().catch(''),
  items: z.array(itemSchema).catch([]),
})

const JSON_SHAPE = `{
  "is_food": boolean,
  "overall_confidence": number 0..1,
  "needs_more_detail": boolean,
  "questions": string[],
  "notes": string,
  "items": [
    {
      "name": string,
      "portion": string,
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "confidence": number 0..1,
      "assumptions": string
    }
  ]
}`

const OBSERVATION_SHAPE = `{
  "is_food": boolean,
  "image_quality": "clear" | "blurry" | "dark" | "cropped" | "far",
  "focus_box": [ymin, xmin, ymax, xmax],
  "scale_reference": string,
  "overall_confidence": number 0..1,
  "questions": string[],
  "items": [
    {
      "name": string,
      "description": string,
      "estimated_portion": string,
      "cooking_method": string,
      "visible_fat_sauce": string,
      "confidence": number 0..1
    }
  ]
}`

/** Stage 1 — vision model only observes; it must not guess calories. */
function buildVisionPrompt(lang: Lang, detail?: string): string {
  return `You are a food photo analyst for a nutrition app. Look at the attached photo and report ONLY what you can actually see. Do NOT estimate calories or macronutrients — a nutrition model does that in the next step.
${detail ? `\nThe user added these details — trust them over your visual guess when they conflict:\n"""${detail}"""\n` : ''}
Return ONLY valid JSON, no markdown fence, exactly this shape:
${OBSERVATION_SHAPE}

RULES:
1. One entry in "items" per distinct dish, side or drink. Separate components that can be weighed separately (rice, meat, vegetables, broth, sauce, drink).
2. "name": the specific dish name, not a generic category. Vietnamese dishes are common (com tam, pho, bun bo Hue, banh mi, xoi, che, ca kho to, canh chua, goi cuon).
3. "description": visible ingredients, colour, texture, garnish, and anything that hints at richness.
4. "estimated_portion": derive scale from reference objects — bowl or plate diameter, chopsticks, spoon, can, bottle, hand — and give a weight or household measure, e.g. "1 rice bowl, ~200 g cooked rice". State the reference you used in "scale_reference".
5. "cooking_method": deep-fried / stir-fried / grilled / steamed / boiled / raw / braised, plus anything visible such as charring or breading.
6. "visible_fat_sauce": oil sheen, fat trim, mayonnaise, condensed milk, syrup, dipping sauce, broth level.
7. "confidence": 0.85+ only when both the dish and its portion are unambiguous; 0.5-0.85 when the dish is clear but the portion is inferred; below 0.5 when the dish itself is uncertain.
8. "questions": 2-4 SHORT, SPECIFIC questions, only for facts the photo cannot show (portion weight, oil used, sugar in the sauce, whether the broth was drunk). Never ask "what did you eat". Leave empty when the photo is self-explanatory.
9. If there is no food in the photo, return "is_food": false with an empty "items" array.
10. "focus_box" must tightly cover the main plated food area as [ymin, xmin, ymax, xmax] normalized to 0..1000.
11. Write "name", "description", "estimated_portion", "scale_reference" and "questions" in ${lang === 'en' ? 'English' : 'Vietnamese'}.`
}

/** Stage 2 — nutrition model converts observations (or a written description) into kcal + macros. */
function buildNutritionPrompt(lang: Lang, source: { observation?: string; description?: string }): string {
  const role =
    lang === 'en'
      ? 'You are a clinical dietitian specialising in Vietnamese cuisine, portion estimation and macronutrients.'
      : 'Ban la chuyen gia dinh duong lam sang, chuyen sau ve am thuc Viet Nam, uoc luong khau phan va macro.'

  const input = source.observation
    ? `A vision model examined the user's meal photo and reported these observations:
"""${source.observation}"""

Treat those observations as the ground truth about what is on the plate. Your job is the nutrition maths.${
        source.description
          ? `\n\nThe user also described the meal in their own words. Trust this over the vision model wherever the two conflict:\n"""${source.description}"""`
          : ''
      }`
    : `There is no photo. Estimate from this written description only:
"""${source.description ?? ''}"""

Rely on typical serving sizes for the dish and say so in "assumptions".`

  return `${role}

${input}

OUTPUT FORMAT — return ONLY valid JSON, no markdown fence, no commentary, exactly this shape:
${JSON_SHAPE}

HARD RULES:
1. Keep one "items" entry per dish reported above. Do not merge or drop items, and do not invent items that were not reported.
2. "portion" must state the serving with a weight or household measure, e.g. "1 bowl (~200 g cooked rice)", "2 pieces (~120 g)".
3. If the user explicitly gave amounts (for example "154g", "75 g", "1 bowl", "2 pieces"), treat those amounts as ground truth. Do not upscale to a typical serving and do not replace them with larger defaults.
4. When an explicit amount is present, calculate calories and macros from that exact amount only.
5. Macro consistency is mandatory: calories MUST equal protein_g*4 + carbs_g*4 + fat_g*9 within +/-10%. Recompute and adjust before answering.
6. Round calories to the nearest 5 kcal and macros to 1 decimal place.
6.1. Anchor each estimate to a known nutrition reference density (USDA/FoodData Central or equivalent Vietnamese food tables) for the same cooked state. Avoid unusually low outputs; if your estimate is below a plausible lower bound for that food and portion, raise it to the nearest plausible value.
7. Apply the cooking method carefully: estimate added oil per 100 g edible finished food (deep-fried ~4-10 g fat/100 g, stir-fried ~2-6 g fat/100 g, grilled/steamed/boiled ~0-3 g fat/100 g).
8. Avoid double counting oil: if the dish is already identified as a cooked fried dish and the portion refers to the final cooked weight, use realistic cooked-food nutrition density and do not add a second generic oil surcharge.
9. Count only the edible portion — exclude bones, shells and inedible garnish — but include sauces, broth actually consumed, toppings, condensed milk and syrup.
10. "confidence": start from the confidence the vision model gave each item, then lower it further when the portion weight or cooking fat is still unknown.
11. Set "needs_more_detail": true when overall_confidence < 0.6, when image quality was poor, or when an unknown (portion weight, oil, sugar, broth) materially changes the estimate. When true, carry over and sharpen the vision model's questions into 2-4 SHORT, SPECIFIC questions in "questions".
12. "assumptions" states what you assumed for that item (cooking oil, sauce, container size, doneness).
13. "notes": one sentence on the overall reliability of this estimate.
14. Write "name", "portion", "questions", "notes" and "assumptions" in ${lang === 'en' ? 'English' : 'Vietnamese'}.`
}

function extractJSON(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error('Model did not return JSON')
    return JSON.parse(trimmed.slice(start, end + 1))
  }
}

const MSG = {
  unauthorized: { vi: 'Vui lòng đăng nhập.', en: 'Please sign in.' },
  badBody: { vi: 'Dữ liệu gửi lên không hợp lệ.', en: 'Invalid request body.' },
  noImage: { vi: 'Thiếu ảnh để phân tích.', en: 'Missing image to analyse.' },
  badMime: { vi: 'Định dạng ảnh không được hỗ trợ.', en: 'Unsupported image format.' },
  tooLarge: { vi: 'Ảnh quá lớn, vui lòng chụp lại.', en: 'Image is too large, please retake it.' },
  noDescription: { vi: 'Vui lòng mô tả món ăn.', en: 'Please describe the food.' },
  noProvider: {
    vi: 'Chưa cấu hình AI đọc ảnh trên máy chủ.',
    en: 'Image AI is not configured on the server.',
  },
  aiFailed: { vi: 'AI không phân tích được, vui lòng thử lại.', en: 'AI analysis failed, please try again.' },
} as const

const observationSchema = z.object({
  focus_box: z
    .tuple([z.coerce.number(), z.coerce.number(), z.coerce.number(), z.coerce.number()])
    .transform(([yMin, xMin, yMax, xMax]) => [
      Math.max(0, Math.min(Math.round(yMin), 1000)),
      Math.max(0, Math.min(Math.round(xMin), 1000)),
      Math.max(0, Math.min(Math.round(yMax), 1000)),
      Math.max(0, Math.min(Math.round(xMax), 1000)),
    ] as [number, number, number, number])
    .catch([0, 0, 1000, 1000] as [number, number, number, number]),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: MSG.badBody.vi }, { status: 400 })
  }

  // Read the language before validation so even a rejection is localised.
  const lang: Lang = (body as { lang?: unknown } | null)?.lang === 'en' ? 'en' : 'vi'

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: MSG.badBody[lang] }, { status: 400 })
  }
  const { mode, image, description } = parsed.data

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: MSG.unauthorized[lang] }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = profile?.role ?? 'user'

  const access = await resolveAIAccess(supabase, user.id, 'food_analyze', role)
  if (!access.allowed) {
    return NextResponse.json(
      trialExhaustedBody('food_analyze', access.used, access.limit, lang),
      { status: QUOTA_EXHAUSTED_STATUS },
    )
  }

  if (mode === 'image') {
    if (!image) return NextResponse.json({ error: MSG.noImage[lang] }, { status: 400 })
    if (!ALLOWED_MIME.includes(image.mimeType.toLowerCase())) {
      return NextResponse.json({ error: MSG.badMime[lang] }, { status: 400 })
    }
    // base64 inflates by ~4/3; compare against the decoded size.
    if ((image.data.length * 3) / 4 > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: MSG.tooLarge[lang] }, { status: 413 })
    }
    if (!resolveVisionConfig()) {
      return NextResponse.json(
        { error: MSG.noProvider[lang], missingEnv: visionProviderNames() },
        { status: 500 }
      )
    }
  } else if (!description?.trim()) {
    return NextResponse.json({ error: MSG.noDescription[lang] }, { status: 400 })
  }

  // One usage entry per PROVIDER call, not per user action: the image path calls a vision
  // provider and then a text provider, so it records two rows against the same surface and
  // user. Collapsing them would under-report call volume and make per-model cost wrong.
  // `at` is when the provider call STARTED, not when this runs. The two stages are seconds
  // apart and DeepSeek's peak windows turn on the hour, so pricing either off the logging
  // instant can charge it at the wrong rate — and the nutrition stage is recorded well
  // after it returned, once its output has been validated.
  async function record(
    call: Pick<ProviderResult, 'usage' | 'model' | 'provider'>,
    outcome: 'success' | 'error',
    at: Date
  ) {
    await logAiUsage({
      surface: 'food_analyze',
      provider: call.provider,
      model: servedModel({ model: call.model }, call.model ?? 'unknown'),
      usage: normalizeUsage(call.usage, call.provider),
      outcome,
      userId: user!.id,
      actor: 'user',
      at,
    })
  }

  let raw: string
  // Held back deliberately. The vision stage is recorded the moment it returns, because its
  // output is consumed straight away and nothing later can invalidate it. The nutrition
  // stage is not recorded until its output has been through resultSchema, because that
  // parse is what decides whether the completion we paid for was usable — and a billed
  // completion the app then rejects is the failure FR-005a exists to make visible.
  let nutritionCall: Pick<ProviderResult, 'usage' | 'model' | 'provider'>
  let nutritionStart = new Date()
  let stageStart = new Date()
  let focusBox: [number, number, number, number] | null = null
  try {
    if (mode === 'image' && image) {
      // Stage 1: vision model describes the plate. Stage 2: DeepSeek does the nutrition maths.
      stageStart = new Date()
      const vision = await requestVisionJSON(buildVisionPrompt(lang, description), image)
      await record(vision, 'success', stageStart)
      try {
        focusBox = observationSchema.parse(extractJSON(vision.text)).focus_box
      } catch {
        focusBox = null
      }
      nutritionStart = new Date()
      stageStart = nutritionStart
      const nutrition = await requestTextJSON(
        buildNutritionPrompt(lang, { observation: vision.text, description })
      )
      nutritionCall = nutrition
      raw = nutrition.text
    } else {
      nutritionStart = new Date()
      stageStart = nutritionStart
      const nutrition = await requestTextJSON(buildNutritionPrompt(lang, { description }))
      nutritionCall = nutrition
      raw = nutrition.text
    }
  } catch (err) {
    // A ProviderCallError means the provider answered, was paid, and the answer was
    // unusable — record it with its real tokens and cost. Any other error means nothing
    // was generated and there is nothing to cost. Stages that already returned were
    // recorded above: a later stage failing does not make an earlier billed call free.
    if (err instanceof ProviderCallError) await record(err.result, 'error', stageStart)
    console.error('[analyze-food] provider call failed:', err)
    return NextResponse.json({ error: MSG.aiFailed[lang] }, { status: 502 })
  }

  let result: z.infer<typeof resultSchema>
  try {
    result = resultSchema.parse(extractJSON(raw))
  } catch (err) {
    // Billed and unusable — the expensive kind of failure, and the one FR-005a is about.
    await record(nutritionCall, 'error', nutritionStart)
    console.error('[analyze-food] unparsable model output:', err, raw.slice(0, 300))
    return NextResponse.json({ error: MSG.aiFailed[lang] }, { status: 502 })
  }
  await record(nutritionCall, 'success', nutritionStart)

  const normalizedItems = normalizeItemsWithInternalTable(result.items)

  const items = normalizedItems.map((item) => ({
    ...item,
    calories: Math.round(item.calories),
    protein_g: Math.round(item.protein_g * 10) / 10,
    carbs_g: Math.round(item.carbs_g * 10) / 10,
    fat_g: Math.round(item.fat_g * 10) / 10,
  }))

  const telemetryRows = items.map((item) => ({
    event_name: item.normalized_table_key
      ? (item.normalized_by_internal_table
        ? 'internal_table_match_applied'
        : 'internal_table_match_ambiguous')
      : 'internal_table_no_match',
    normalized_table_key: item.normalized_table_key ?? null,
    normalized_source: item.normalized_source ?? null,
    normalization_version: item.normalization_version ?? null,
    normalization_confidence: item.normalization_confidence ?? null,
  }))

  if (telemetryRows.length > 0) {
    const { error: telemetryError } = await supabase.from('nutrition_normalization_metrics').insert(telemetryRows)
    if (telemetryError) {
      // Telemetry is best-effort only.
      console.warn('[analyze-food] telemetry insert skipped:', telemetryError.message)
    }
  }

  // Increment trial usage counter (no-op for admin/paid since quota check returned unlimited)
  if (!access.unlimited) {
    await incrementAITrialUsage(supabase, 'food_analyze')
  }

  return NextResponse.json({
    items,
    confidence: result.overall_confidence,
    needsDetail: result.needs_more_detail || !result.is_food || items.length === 0,
    questions: result.questions.slice(0, 4),
    notes: result.notes,
    focusBox,
  })
}

/**
 * Quota status only — lets the UI grey out the capture buttons before the user
 * spends time on a photo, without duplicating the role + bypass logic that
 * actually gates the POST above. Same resolveAIAccess call, same verdict.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = profile?.role ?? 'user'

  const access = await resolveAIAccess(supabase, user.id, 'food_analyze', role)
  return NextResponse.json({ allowed: access.allowed, used: access.used, limit: access.limit })
}
