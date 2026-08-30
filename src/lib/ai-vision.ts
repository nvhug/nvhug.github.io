// Food-photo vision stage: Gemini / OpenAI / OpenRouter reads the photo -> structured
// observation. Env-driven, so swapping providers needs no code change:
//   FOOD_VISION_PROVIDER=gemini|openai|openrouter   (optional, otherwise auto-detected)
//   FOOD_VISION_MODEL=<model id>                    (optional, overrides the default)
//   GEMINI_API_KEY | OPENAI_API_KEY | OPENROUTER_API_KEY
//
// The nutrition stage that used to live here (DeepSeek) now goes through the shared
// Gemini-primary/DeepSeek-fallback router in `src/lib/ai-provider.ts` (spec 010) — this
// file is vision-only.

export type VisionProvider = 'gemini' | 'openai' | 'openrouter'

const KEY_ENV: Record<VisionProvider, string> = {
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
}

// Google retires older ids for new keys, so pin a current one and override via FOOD_VISION_MODEL.
const DEFAULT_MODEL: Record<VisionProvider, string> = {
  gemini: 'gemini-3.6-flash',
  openai: 'gpt-4o-mini',
  openrouter: 'google/gemini-3.6-flash',
}

export interface VisionConfig {
  provider: VisionProvider
  apiKey: string
  model: string
}

export interface ImageInput {
  /** Raw base64 payload, without the `data:...;base64,` prefix. */
  data: string
  mimeType: string
}

// Two calls run back to back, so each must finish well inside the route's maxDuration.
const REQUEST_TIMEOUT_MS = 25_000

/**
 * What one provider call returned. The raw `usage` payload and the served model travel
 * with the text because the caller has to record what the call cost, and this function is
 * the only place they exist — returning the text alone would throw them away here, where
 * no caller can recover them. Shapes differ per provider, so `usage` stays unparsed and
 * is normalized by `normalizeUsage()` in `ai-usage.ts`.
 */
/**
 * Thrown when a provider answered but the answer is unusable — an empty completion, a
 * response cut off at the token ceiling, a safety block.
 *
 * It carries the usage payload because **that call was billed**. A 200 with populated
 * `usageMetadata` and no text parts is a real and ordinary Gemini outcome, and throwing a
 * bare Error here would destroy the only record of what it cost: `data` goes out of scope
 * and no caller can recover it. That is the exact failure this module's return type was
 * widened to prevent, so the error path has to carry the same information as the happy one.
 *
 * A non-2xx is different and stays a plain Error: nothing was generated, so there is nothing
 * to cost.
 */
export class ProviderCallError extends Error {
  constructor(
    message: string,
    readonly result: Pick<ProviderResult, 'usage' | 'model' | 'provider'>
  ) {
    super(message)
    this.name = 'ProviderCallError'
  }
}

export interface ProviderResult {
  text: string
  usage: unknown
  /** The model the provider reports having served, when it reports one. */
  model: string | null
  provider: UsageProviderName
}

/** Matches the provider values recorded in ai_usage_log. */
export type UsageProviderName = 'deepseek' | 'gemini' | 'openai' | 'openrouter'

export function resolveVisionConfig(): VisionConfig | null {
  const forced = process.env.FOOD_VISION_PROVIDER?.trim().toLowerCase() as VisionProvider | undefined
  const candidates: VisionProvider[] =
    forced && forced in KEY_ENV ? [forced] : ['gemini', 'openai', 'openrouter']

  for (const provider of candidates) {
    const apiKey = process.env[KEY_ENV[provider]]
    if (apiKey) {
      return {
        provider,
        apiKey,
        model: process.env.FOOD_VISION_MODEL?.trim() || DEFAULT_MODEL[provider],
      }
    }
  }
  return null
}

export function visionProviderNames(): string[] {
  return Object.values(KEY_ENV)
}

async function callGemini(config: VisionConfig, prompt: string, image?: ImageInput): Promise<ProviderResult> {
  const parts: Record<string, unknown>[] = [{ text: prompt }]
  if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  )

  if (!res.ok) throw new Error(`Gemini API error (${res.status}): ${(await res.text()).slice(0, 300)}`)

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? '')
    .join('')
  if (!text) {
    // Billed and unusable — MAX_TOKENS, a safety block, or a thinking-only turn.
    throw new ProviderCallError('Empty response from Gemini', {
      usage: data?.usageMetadata ?? null,
      model: typeof data?.modelVersion === 'string' ? data.modelVersion : null,
      provider: 'gemini',
    })
  }
  return {
    text,
    usage: data?.usageMetadata ?? null,
    model: typeof data?.modelVersion === 'string' ? data.modelVersion : null,
    provider: 'gemini',
  }
}

async function callOpenAICompatible(
  baseUrl: string,
  label: string,
  provider: UsageProviderName,
  apiKey: string,
  model: string,
  prompt: string,
  image?: ImageInput
): Promise<ProviderResult> {
  const content: Record<string, unknown>[] = [{ type: 'text', text: prompt }]
  if (image) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.data}`, detail: 'high' },
    })
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: image ? content : prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!res.ok) throw new Error(`${label} API error (${res.status}): ${(await res.text()).slice(0, 300)}`)

  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) {
    // Same shape as the Gemini case: a DeepSeek turn that emitted only reasoning_content,
    // or stopped at the token ceiling, was billed and has usage worth recording.
    throw new ProviderCallError(`Empty response from ${label}`, {
      usage: data?.usage ?? null,
      model: typeof data?.model === 'string' ? data.model : null,
      provider,
    })
  }
  return {
    text,
    usage: data?.usage ?? null,
    model: typeof data?.model === 'string' ? data.model : null,
    provider,
  }
}

/** Stage 1 — reads the photo with the configured vision provider. */
export async function requestVisionJSON(prompt: string, image: ImageInput): Promise<ProviderResult> {
  const config = resolveVisionConfig()
  if (!config) {
    throw new Error(`No vision provider configured. Set one of: ${visionProviderNames().join(', ')}`)
  }

  if (config.provider === 'gemini') return callGemini(config, prompt, image)
  const baseUrl = config.provider === 'openai' ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1'
  return callOpenAICompatible(
    baseUrl,
    config.provider,
    config.provider,
    config.apiKey,
    config.model,
    prompt,
    image
  )
}

