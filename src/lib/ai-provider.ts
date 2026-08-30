// The one provider call all 6 AI features make: Gemini first, DeepSeek only when the
// Gemini attempt fails at the transport level (spec 010, FR-003/FR-004/FR-005).
//
// Classification is by HTTP status, network error or timeout — never by what the model
// wrote. A 200 carrying empty or schema-invalid text is returned as a success with that
// text, because every caller already validates (and refunds) its own content, and moving
// that decision here would change five routes' refund semantics for no requirement.

import { servedModel } from '@/lib/ai-usage'

export type ProviderName = 'gemini' | 'deepseek'

export interface ProviderCallSuccess {
  ok: true
  /** Which provider actually served the request — the primary, or the fallback. */
  provider: ProviderName
  /** servedModel()-ready: the id the provider reports having served, or the requested id. */
  model: string
  /** Raw completion text. May be empty — callers validate content themselves. */
  text: string
  /** Raw usage payload, shape depends on `provider` — pass to normalizeUsage(usage, provider). */
  usage: unknown
  /**
   * Whether the provider's own stop reason was "hit the token ceiling" (Gemini
   * `finishReason: 'MAX_TOKENS'`, DeepSeek `finish_reason: 'length'`) — not content
   * inspection, the same kind of transport/generation metadata as `usage`. Callers that
   * refund a quota slot for a truncated-but-billed completion (distinct from one that
   * arrived whole and was simply rejected) need this signal; the router does not decide
   * what to do with it.
   */
  truncated: boolean
}

export interface ProviderCallFailure {
  ok: false
  /**
   * true = the failure was a network error or a timeout on every attempted provider.
   * false = every attempted provider returned a non-2xx HTTP response.
   */
  network: boolean
}

export type ProviderCallResult = ProviderCallSuccess | ProviderCallFailure

export interface ProviderCallOptions {
  /** Feature-specific model id for the Gemini primary attempt, e.g. 'gemini-3.7-flash'. */
  geminiModel: string
  /** Feature-specific model id for the DeepSeek fallback attempt. Always 'deepseek-v4-flash' today. */
  deepseekModel: string
  /** The full prompt text (both providers receive the same prompt). */
  prompt: string
  /** Passed through as-is to both providers' `temperature`. */
  temperature: number
  /** Passed through as each provider's max-output-tokens field. */
  maxTokens: number
  /** Per-ATTEMPT timeout, not a shared budget. */
  primaryTimeoutMs: number
  fallbackTimeoutMs: number
}

interface AttemptSuccess {
  ok: true
  model: string
  text: string
  usage: unknown
  truncated: boolean
}

interface AttemptFailure {
  ok: false
  /** null when nothing came back at all — a network error or a timeout. */
  status: number | null
  /**
   * True when Gemini's own error body identifies the failure as an invalid/expired key.
   * Google reports this as HTTP 400 as often as 401/403 (its `error.status` stays
   * `INVALID_ARGUMENT` either way) — status code alone under-detects this real, common
   * failure mode, so isRetryable() also checks this flag rather than 400 always winning.
   * Always false for DeepSeek attempts (nothing reads its error body for this).
   */
  apiKeyInvalid: boolean
  /** A short diagnostic slice of the provider's error body, for logAttemptFailure only —
   * never the prompt or completion, same no-content rule ai-usage.ts follows. */
  detail: string | null
}

type AttemptResult = AttemptSuccess | AttemptFailure

interface GeminiResponseBody {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
}

interface DeepSeekResponseBody {
  choices?: { message?: { content?: string }; finish_reason?: string }[]
}

interface GeminiErrorBody {
  error?: { message?: string; status?: string; details?: { reason?: string }[] }
}

/**
 * Google returns "API key not valid" both as HTTP 400 (`INVALID_ARGUMENT`, sometimes with
 * an `API_KEY_INVALID` reason in `error.details`) and as 401/403 — the message/reason is
 * the only reliable signal, the status code alone is not. This reads the ERROR body's
 * status/reason/message fields, not the completion — the same category of transport
 * metadata as an HTTP status, not the content-inspection this module otherwise avoids.
 */
function isGeminiApiKeyInvalid(body: unknown): boolean {
  const err = (body as GeminiErrorBody | null)?.error
  if (!err) return false
  if (err.details?.some((d) => d?.reason === 'API_KEY_INVALID')) return true
  return typeof err.message === 'string' && /api key not valid/i.test(err.message)
}

/** A short, bounded slice of an error body's message for logging — never the full body. */
function errorDetail(body: unknown): string | null {
  const message = (body as { error?: { message?: string } } | null)?.error?.message
  return typeof message === 'string' ? message.slice(0, 200) : null
}

/**
 * Falls back to DeepSeek on quota (429), provider-side errors (5xx), a model that is not
 * available (404 — FR-004), and an invalid/expired key (401/403, or a 400 whose body
 * identifies it as the same thing — see isGeminiApiKeyInvalid).
 */
function isRetryable(failure: AttemptFailure): boolean {
  if (failure.status === null) return true
  if (failure.apiKeyInvalid) return true
  return (
    failure.status === 429 ||
    failure.status === 401 ||
    failure.status === 403 ||
    failure.status === 404 ||
    failure.status >= 500
  )
}

/**
 * A 200 whose body will not parse is a content problem, not a transport one, so it must
 * not trigger a fallback — `{ok:true, data:null}` reaches the caller as an empty
 * completion. But `AbortSignal.timeout` can fire while `res.json()` is still reading a
 * body that only sent its headers before stalling — the earlier `fetch()` try/catch never
 * sees that, since headers already resolved it successfully. That IS a transport failure,
 * not content: `{ok:false}` here is what tells attemptGemini/attemptDeepSeek to report a
 * real timeout instead of fabricating a successful-but-empty completion for a hang, which
 * would otherwise skip the fallback the timeout exists to trigger.
 */
async function readJson(res: Response): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    return { ok: true, data: await res.json() }
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      return { ok: false }
    }
    return { ok: true, data: null }
  }
}

async function attemptGemini(apiKey: string, opts: ProviderCallOptions): Promise<AttemptResult> {
  let res: Response
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.geminiModel)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
          generationConfig: {
            temperature: opts.temperature,
            maxOutputTokens: opts.maxTokens,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(opts.primaryTimeoutMs),
      }
    )
  } catch {
    return { ok: false, status: null, apiKeyInvalid: false, detail: null }
  }

  if (!res.ok) {
    const parsed = await readJson(res)
    const errorBody = parsed.ok ? parsed.data : null
    return {
      ok: false,
      status: res.status,
      apiKeyInvalid: res.status === 400 && isGeminiApiKeyInvalid(errorBody),
      detail: errorDetail(errorBody),
    }
  }

  const parsed = await readJson(res)
  if (!parsed.ok) return { ok: false, status: null, apiKeyInvalid: false, detail: null }
  const data = parsed.data
  const candidate = (data as GeminiResponseBody | null)?.candidates?.[0]
  const parts = candidate?.content?.parts
  return {
    ok: true,
    model: servedModel(data, opts.geminiModel),
    text: Array.isArray(parts) ? parts.map((p) => p?.text ?? '').join('') : '',
    usage: (data as { usageMetadata?: unknown } | null)?.usageMetadata ?? null,
    truncated: candidate?.finishReason === 'MAX_TOKENS',
  }
}

async function attemptDeepSeek(apiKey: string, opts: ProviderCallOptions): Promise<AttemptResult> {
  let res: Response
  try {
    res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: opts.deepseekModel,
        messages: [{ role: 'user', content: opts.prompt }],
        response_format: { type: 'json_object' },
        // Reasoning tokens come out of max_tokens before any content, and every caller's
        // token ceiling was measured against a non-reasoning completion.
        thinking: { type: 'disabled' },
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
      }),
      signal: AbortSignal.timeout(opts.fallbackTimeoutMs),
    })
  } catch {
    return { ok: false, status: null, apiKeyInvalid: false, detail: null }
  }

  if (!res.ok) {
    const parsed = await readJson(res)
    return {
      ok: false,
      status: res.status,
      apiKeyInvalid: false,
      detail: errorDetail(parsed.ok ? parsed.data : null),
    }
  }

  const parsed = await readJson(res)
  if (!parsed.ok) return { ok: false, status: null, apiKeyInvalid: false, detail: null }
  const data = parsed.data
  const choice = (data as DeepSeekResponseBody | null)?.choices?.[0]
  return {
    ok: true,
    model: servedModel(data, opts.deepseekModel),
    text: choice?.message?.content ?? '',
    usage: (data as { usage?: unknown } | null)?.usage ?? null,
    truncated: choice?.finish_reason === 'length',
  }
}

/**
 * Whether either provider this router can call is configured. Every one of the 6 call
 * sites needs this same check before doing any of the work (quota claims, cache reads)
 * that precedes the actual provider call — shared here so a renamed/added env var only
 * has to change in one place instead of five.
 */
export function isProviderConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.DEEPSEEK_API_KEY)
}

/**
 * The only place either attempt's failure is logged. Without this, a 400 caused by a bug
 * in what this router sent looks identical in logs to a legitimate bad request from the
 * caller — spec 010's own Edge Cases require the provider name and raw status be
 * recoverable for exactly this reason. Deliberately just `provider`/`status`, never the
 * prompt: the same no-content rule `ai-usage.ts` follows.
 */
function logAttemptFailure(provider: ProviderName, failure: AttemptFailure): void {
  const status = failure.status ?? 'network/timeout'
  const detail = failure.detail ? ` detail=${JSON.stringify(failure.detail)}` : ''
  console.error(`[ai-provider] ${provider} attempt failed: status=${status}${detail}`)
}

/**
 * Tries Gemini (`geminiModel`) first. Falls back to DeepSeek (`deepseekModel`) only when
 * the Gemini attempt fails with HTTP 429, any HTTP 5xx, HTTP 404 (model-unavailable), a
 * network error/timeout, or an invalid/expired key — HTTP 401/403, or HTTP 400 whose body
 * identifies the same thing (Google reports "API key not valid" as 400 as often as
 * 401/403). Never falls back on any other HTTP 400 — that failure is returned immediately
 * as `{ ok: false, network: false }`.
 */
export async function callGeminiWithDeepSeekFallback(
  opts: ProviderCallOptions
): Promise<ProviderCallResult> {
  const geminiKey = process.env.GEMINI_API_KEY
  const deepseekKey = process.env.DEEPSEEK_API_KEY

  // Set only when Gemini was actually attempted and failed retryably — carried past the
  // `if (geminiKey)` block so the no-fallback-configured path below can still report how
  // the one attempt that DID run actually failed, instead of a hardcoded false.
  let primaryFailure: AttemptFailure | null = null

  // No Gemini key configured is treated as an unavailable primary rather than an error:
  // there is nothing to classify, so the fallback is attempted directly.
  if (geminiKey) {
    const primary = await attemptGemini(geminiKey, opts)
    if (primary.ok) {
      return {
        ok: true,
        provider: 'gemini',
        model: primary.model,
        text: primary.text,
        usage: primary.usage,
        truncated: primary.truncated,
      }
    }
    logAttemptFailure('gemini', primary)
    if (!isRetryable(primary)) return { ok: false, network: false }
    primaryFailure = primary
  }

  if (!deepseekKey) return { ok: false, network: primaryFailure?.status === null }

  const fallback = await attemptDeepSeek(deepseekKey, opts)
  if (fallback.ok) {
    return {
      ok: true,
      provider: 'deepseek',
      model: fallback.model,
      text: fallback.text,
      usage: fallback.usage,
      truncated: fallback.truncated,
    }
  }
  logAttemptFailure('deepseek', fallback)
  return { ok: false, network: fallback.status === null }
}
