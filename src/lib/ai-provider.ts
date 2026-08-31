// The one provider call all 6 AI features make: Gemini first, DeepSeek only when the
// Gemini attempt fails at the transport level (spec 010, FR-003/FR-004/FR-005).
//
// Classification is by HTTP status, network error or timeout — never by what the model
// wrote. A 200 carrying empty or schema-invalid text is returned as a success with that
// text, because every caller already validates (and refunds) its own content, and moving
// that decision here would change five routes' refund semantics for no requirement.

import { servedModel } from '@/lib/ai-usage'
import { parseSseFrame, splitSseFrames, type SseFrame } from '@/lib/sse'

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

/**
 * How to stop each Gemini model thinking before it answers. This is a per-MODEL table,
 * not one setting, because the parameter itself changed between generations and the old
 * one is a hard error on the new models — measured 2026-08-31 against the live API:
 *
 *   gemini-3.1-flash-lite   thinkingBudget: 0        -> 200, thoughts=0
 *   gemini-3.5-flash        thinkingBudget: 0        -> 200, thoughts=0
 *   gemini-3.5-flash-lite   thinkingBudget: 0        -> 400 "invalid argument"
 *   gemini-3.6-flash        thinkingBudget: 0        -> 400 "invalid argument"
 *   gemini-3.6-flash        (no thinkingConfig)      -> 200, thoughts=193
 *   gemini-3.5-flash-lite   thinkingLevel: 'minimal' -> 200, thoughts=0
 *   gemini-3.6-flash        thinkingLevel: 'minimal' -> 200, thoughts=0
 *
 * A model with no entry here would be sent no thinkingConfig at all and would think by
 * default, so `ai-provider.test.ts` fails if any model in GEMINI_CASCADE is missing one.
 */
const GEMINI_THINKING: Record<string, Record<string, unknown>> = {
  'gemini-3.1-flash-lite': { thinkingBudget: 0 },
  'gemini-3.5-flash-lite': { thinkingLevel: 'minimal' },
  'gemini-3.5-flash': { thinkingBudget: 0 },
}

/**
 * The Gemini models tried in order, cheapest-and-fastest first, before DeepSeek.
 *
 * Free-tier quota is per MODEL, not per key — observed directly on 2026-08-31, when
 * gemini-3.7-flash returned 429 while gemini-3.1-flash-lite kept serving on the same key.
 * That is the whole reason this is a chain: each rung is a separate allowance.
 *
 * Order is cost-first, not quality-first: the better models are reached only when the
 * cheap ones fail, so the DEFAULT answer is the first rung's. Measured on this codebase's
 * own prompts (prose length on the notes report, latency on the suggestions ranking):
 * 3.5-flash-lite 3088 chars at ~3-5s, 3.1-flash-lite 2682 chars at ~6s, 3.5-flash 3730
 * chars at ~12s. 3.5-flash-lite leads on both axes against 3.1-flash-lite, which is why
 * it goes first rather than the other way round.
 *
 * gemini-3.6-flash is deliberately ABSENT: same prompt, three runs, 6.8s / 64.7s / 73.2s.
 * The slow tail exceeds every route's maxDuration on its own, and its prose (3514 chars)
 * is no better than 3.5-flash's. gemini-2.5-flash and gemini-2.5-flash-lite are absent
 * because the API answers 404 "no longer available to new users" for this account.
 */
export const GEMINI_CASCADE = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
] as const

export interface ProviderCallOptions {
  /** Gemini models to try in order before DeepSeek. Defaults to GEMINI_CASCADE. */
  geminiModels?: readonly string[]
  /** Feature-specific model id for the DeepSeek fallback attempt. Always 'deepseek-v4-flash' today. */
  deepseekModel: string
  /** The full prompt text (every provider receives the same prompt). */
  prompt: string
  /** Passed through as-is to both providers' `temperature`. */
  temperature: number
  /** Passed through as each provider's max-output-tokens field. */
  maxTokens: number
  /**
   * Wall-clock budget for the WHOLE chain, not per attempt. With N rungs, per-attempt
   * timeouts could no longer be summed against a route's maxDuration — four rungs at 26s
   * each is 104s of a 60s function. A shared deadline is what makes the chain affordable:
   * a rung that fails fast (a 429 answers in under a second) costs almost none of it, and
   * only a genuine timeout is expensive.
   */
  budgetMs: number
  /**
   * Held back from every Gemini rung so the DeepSeek attempt is still reachable at the
   * end. Without it a slow Gemini rung eats the budget and the last resort never runs.
   */
  deepseekReserveMs: number
}

/** Below this there is no point starting an attempt — it cannot finish, and a started
 *  call that is aborted is still capable of being billed. */
const MIN_ATTEMPT_MS = 3_000

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

async function attemptGemini(
  apiKey: string,
  opts: ProviderCallOptions,
  model: string,
  timeoutMs: number,
): Promise<AttemptResult> {
  let res: Response
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
          generationConfig: {
            temperature: opts.temperature,
            maxOutputTokens: opts.maxTokens,
            responseMimeType: 'application/json',
            // Which key turns thinking off depends on the model — see GEMINI_THINKING.
            // Sending the wrong one is a hard 400, not a silently ignored field.
            thinkingConfig: GEMINI_THINKING[model],
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
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
    model: servedModel(data, model),
    text: Array.isArray(parts) ? parts.map((p) => p?.text ?? '').join('') : '',
    usage: (data as { usageMetadata?: unknown } | null)?.usageMetadata ?? null,
    truncated: candidate?.finishReason === 'MAX_TOKENS',
  }
}

async function attemptDeepSeek(
  apiKey: string,
  opts: ProviderCallOptions,
  timeoutMs: number,
): Promise<AttemptResult> {
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
      signal: AbortSignal.timeout(timeoutMs),
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
function remainingFor(deadline: number, reserveMs: number): number {
  return deadline - Date.now() - reserveMs
}

function logAttemptFailure(provider: string, failure: AttemptFailure): void {
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

  const deadline = Date.now() + opts.budgetMs
  // Set by the last attempt that ran, so the exhausted-chain return can report how it
  // actually failed instead of a hardcoded value.
  let lastFailure: AttemptFailure | null = null

  // No Gemini key configured is treated as an unavailable primary rather than an error:
  // there is nothing to classify, so the fallback is attempted directly.
  if (geminiKey) {
    for (const model of opts.geminiModels ?? GEMINI_CASCADE) {
      const timeoutMs = remainingFor(deadline, opts.deepseekReserveMs)
      if (timeoutMs < MIN_ATTEMPT_MS) break

      const attempt = await attemptGemini(geminiKey, opts, model, timeoutMs)
      if (attempt.ok) {
        return {
          ok: true,
          provider: 'gemini',
          model: attempt.model,
          text: attempt.text,
          usage: attempt.usage,
          truncated: attempt.truncated,
        }
      }
      logAttemptFailure(`gemini:${model}`, attempt)
      // A genuine 400 is the request's own fault. Another model would reject it
      // identically, so trying the rest of the chain only burns the budget.
      if (!isRetryable(attempt)) return { ok: false, network: false }
      lastFailure = attempt
    }
  }

  if (!deepseekKey) return { ok: false, network: lastFailure?.status === null }

  // The reserve exists precisely so there is something left here; spend all of it.
  const deepseekMs = remainingFor(deadline, 0)
  if (deepseekMs < MIN_ATTEMPT_MS) return { ok: false, network: true }

  const fallback = await attemptDeepSeek(deepseekKey, opts, deepseekMs)
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

// ─── Streaming ───────────────────────────────────────────────────────────────
//
// The same Gemini-then-DeepSeek router, reading the completion as it is generated instead
// of waiting for the whole body. Total time is unchanged — the model writes at the rate it
// writes — but the caller can act on the first sections while the rest is still coming,
// which is the entire point. Kept beside the buffered call rather than replacing it: the
// other five features have no use for partial output and must not inherit the extra
// failure mode below.

/** Receives each text delta, in order, as it arrives from whichever provider served it. */
export type ProviderDeltaHandler = (delta: string) => void

export interface ProviderStreamHandlers {
  onDelta: ProviderDeltaHandler

  /**
   * Called before the fallback's first delta, when the primary had already emitted.
   * Everything handed to `onDelta` so far belongs to an answer that was abandoned and
   * must be discarded — the fallback starts the document again from the beginning.
   *
   * Providing this is a claim about the CALLER, not a preference: that whatever it did
   * with those deltas can be taken back. A route that only moved a progress bar can.
   * One that has already handed text to a reader as final cannot, and must omit it —
   * without it the router keeps the stricter rule and gives up instead of splicing two
   * different answers together.
   */
  onRestart?: () => void
}

interface StreamAttemptSuccess extends AttemptSuccess { emitted: boolean }
interface StreamAttemptFailure extends AttemptFailure {
  /**
   * True when the stream broke AFTER some text had already been handed to the caller.
   * The fallback cannot rescue that: the caller has half a Gemini answer, and appending
   * half a DeepSeek one produces a document neither model wrote.
   */
  emitted: boolean
}

type StreamAttemptResult = StreamAttemptSuccess | StreamAttemptFailure

/**
 * Feeds every SSE frame in the response body to `onFrame`. Returns false when the read
 * itself failed — a network drop or a timeout firing mid-stream — which is a transport
 * failure, told apart here from a stream that simply ended.
 *
 * Note what this CANNOT tell you: a stream that closed cleanly half way through a
 * completion looks identical to one that finished. Only the provider's own stop reason
 * separates them, which is why both attempts below require one before reporting success.
 */
async function readSseBody(res: Response, onFrame: (frame: SseFrame) => void): Promise<boolean> {
  if (!res.body) return false
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const { frames, rest } = splitSseFrames(buffer)
      buffer = rest
      for (const raw of frames) {
        const frame = parseSseFrame(raw)
        if (frame) onFrame(frame)
      }
    }
  } catch {
    return false
  }
  // A final frame with no trailing blank line is still a frame.
  const trailing = parseSseFrame(buffer)
  if (trailing) onFrame(trailing)
  return true
}

interface GeminiStreamChunk {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  usageMetadata?: unknown
  modelVersion?: string
}

interface DeepSeekStreamChunk {
  choices?: { delta?: { content?: string }; finish_reason?: string }[]
  usage?: unknown
  model?: string
}

async function streamGemini(
  apiKey: string,
  opts: ProviderCallOptions,
  onDelta: ProviderDeltaHandler,
  model: string,
  timeoutMs: number,
): Promise<StreamAttemptResult> {
  let res: Response
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
          generationConfig: {
            temperature: opts.temperature,
            maxOutputTokens: opts.maxTokens,
            responseMimeType: 'application/json',
            // Per-model, same as the buffered attempt — see GEMINI_THINKING.
            thinkingConfig: GEMINI_THINKING[model],
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      }
    )
  } catch {
    return { ok: false, status: null, apiKeyInvalid: false, detail: null, emitted: false }
  }

  if (!res.ok) {
    const parsed = await readJson(res)
    const errorBody = parsed.ok ? parsed.data : null
    return {
      ok: false,
      status: res.status,
      apiKeyInvalid: res.status === 400 && isGeminiApiKeyInvalid(errorBody),
      detail: errorDetail(errorBody),
      emitted: false,
    }
  }

  let text = ''
  let usage: unknown = null
  let servedId = model
  let finishReason: string | undefined

  const complete = await readSseBody(res, (frame) => {
    const chunk = frame.data as GeminiStreamChunk | null
    if (!chunk || typeof chunk !== 'object') return
    const candidate = chunk.candidates?.[0]
    const delta = candidate?.content?.parts?.map((p) => p?.text ?? '').join('') ?? ''
    if (delta) { text += delta; onDelta(delta) }
    if (candidate?.finishReason) finishReason = candidate.finishReason
    // Every chunk may restate usage; the last one carries the final counts.
    if (chunk.usageMetadata) usage = chunk.usageMetadata
    if (chunk.modelVersion) servedId = servedModel(chunk, model)
  })

  // A stream that closed without ever saying why it stopped did not finish: the caller
  // would otherwise receive a valid JSON *prefix* as a complete answer. See streamEnded.
  if (!complete || !finishReason) {
    return { ok: false, status: null, apiKeyInvalid: false, detail: null, emitted: text.length > 0 }
  }
  return { ok: true, model: servedId, text, usage, truncated: finishReason === 'MAX_TOKENS', emitted: text.length > 0 }
}

async function streamDeepSeek(
  apiKey: string,
  opts: ProviderCallOptions,
  onDelta: ProviderDeltaHandler,
  timeoutMs: number,
): Promise<StreamAttemptResult> {
  let res: Response
  try {
    res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: opts.deepseekModel,
        messages: [{ role: 'user', content: opts.prompt }],
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        stream: true,
        // Without this the streamed response carries no usage at all, and the call would
        // be billed with nothing to file in ai_usage_log.
        stream_options: { include_usage: true },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    return { ok: false, status: null, apiKeyInvalid: false, detail: null, emitted: false }
  }

  if (!res.ok) {
    const parsed = await readJson(res)
    return {
      ok: false,
      status: res.status,
      apiKeyInvalid: false,
      detail: errorDetail(parsed.ok ? parsed.data : null),
      emitted: false,
    }
  }

  let text = ''
  let usage: unknown = null
  let model = opts.deepseekModel
  let finishReason: string | undefined

  const complete = await readSseBody(res, (frame) => {
    if (frame.data === '[DONE]') return
    const chunk = frame.data as DeepSeekStreamChunk | null
    if (!chunk || typeof chunk !== 'object') return
    const choice = chunk.choices?.[0]
    const delta = choice?.delta?.content ?? ''
    if (delta) { text += delta; onDelta(delta) }
    if (choice?.finish_reason) finishReason = choice.finish_reason
    if (chunk.usage) usage = chunk.usage
    if (chunk.model) model = servedModel(chunk, opts.deepseekModel)
  })

  // Same rule as the primary: no stop reason means the stream stopped, it did not finish.
  if (!complete || !finishReason) {
    return { ok: false, status: null, apiKeyInvalid: false, detail: null, emitted: text.length > 0 }
  }
  return { ok: true, model, text, usage, truncated: finishReason === 'length', emitted: text.length > 0 }
}

/**
 * Streaming twin of callGeminiWithDeepSeekFallback. Same providers, same retry
 * classification, same result shape — `text` is the whole completion, so a caller that
 * ignores the deltas gets exactly what the buffered call returns.
 *
 * One rule differs, and it is why this is a separate function: emitted output can block
 * the fallback. Splicing half a Gemini answer onto half a DeepSeek one produces a
 * document neither model wrote, so by default a failure after the first delta is final.
 * A caller that can discard what it was given says so with `onRestart`, and then the
 * fallback runs after all — see ProviderStreamHandlers.
 */
export async function streamGeminiWithDeepSeekFallback(
  opts: ProviderCallOptions,
  handlers: ProviderStreamHandlers
): Promise<ProviderCallResult> {
  const geminiKey = process.env.GEMINI_API_KEY
  const deepseekKey = process.env.DEEPSEEK_API_KEY

  const deadline = Date.now() + opts.budgetMs
  let lastFailure: StreamAttemptFailure | null = null

  if (geminiKey) {
    for (const model of opts.geminiModels ?? GEMINI_CASCADE) {
      const timeoutMs = remainingFor(deadline, opts.deepseekReserveMs)
      if (timeoutMs < MIN_ATTEMPT_MS) break

      // Every rung after the first starts a NEW document, so anything the previous one
      // emitted has to be withdrawn first — the same contract as the DeepSeek handover.
      if (lastFailure?.emitted) handlers.onRestart?.()

      const attempt = await streamGemini(geminiKey, opts, handlers.onDelta, model, timeoutMs)
      if (attempt.ok) {
        return {
          ok: true,
          provider: 'gemini',
          model: attempt.model,
          text: attempt.text,
          usage: attempt.usage,
          truncated: attempt.truncated,
        }
      }
      logAttemptFailure(`gemini:${model}`, attempt)
      const strandedOutput = attempt.emitted && !handlers.onRestart
      if (strandedOutput || !isRetryable(attempt)) {
        return { ok: false, network: attempt.emitted && attempt.status === null }
      }
      lastFailure = attempt
    }
  }

  if (!deepseekKey) return { ok: false, network: lastFailure?.status === null }

  const deepseekMs = remainingFor(deadline, 0)
  if (deepseekMs < MIN_ATTEMPT_MS) return { ok: false, network: true }

  // Before the fallback's first delta, never after: the caller has to be clear of the
  // abandoned answer before the replacement starts arriving.
  if (lastFailure?.emitted) handlers.onRestart?.()

  const fallback = await streamDeepSeek(deepseekKey, opts, handlers.onDelta, deepseekMs)
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
