// Two-stage food analysis transport.
//   Stage 1 (vision):    Gemini / OpenAI / OpenRouter reads the photo -> structured observation.
//   Stage 2 (nutrition): DeepSeek turns that observation into kcal + macros.
// Both stages are env-driven, so swapping providers needs no code change:
//   FOOD_VISION_PROVIDER=gemini|openai|openrouter   (optional, otherwise auto-detected)
//   FOOD_VISION_MODEL=<model id>                    (optional, overrides the default)
//   GEMINI_API_KEY | OPENAI_API_KEY | OPENROUTER_API_KEY
//   DEEPSEEK_API_KEY, DEEPSEEK_MODEL

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
  if (!text) throw new Error('Empty response from Gemini')
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
  if (!text) throw new Error(`Empty response from ${label}`)
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

/** Stage 2 — nutrition reasoning on DeepSeek, falling back to the vision provider when no key is set. */
export async function requestTextJSON(prompt: string): Promise<ProviderResult> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (deepseekKey) {
    return callOpenAICompatible(
      'https://api.deepseek.com/v1',
      'DeepSeek',
      'deepseek',
      deepseekKey,
      process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-v4-flash',
      prompt
    )
  }

  const config = resolveVisionConfig()
  if (!config) {
    throw new Error(
      `No AI provider configured. Set DEEPSEEK_API_KEY or one of: ${visionProviderNames().join(', ')}`
    )
  }
  if (config.provider === 'gemini') return callGemini(config, prompt)
  const baseUrl = config.provider === 'openai' ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1'
  return callOpenAICompatible(
    baseUrl,
    config.provider,
    config.provider,
    config.apiKey,
    config.model,
    prompt
  )
}
