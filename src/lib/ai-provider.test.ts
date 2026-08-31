import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  callGeminiWithDeepSeekFallback,
  isProviderConfigured,
  streamGeminiWithDeepSeekFallback,
  type ProviderCallOptions,
} from './ai-provider'

const OPTS: ProviderCallOptions = {
  geminiModel: 'gemini-3.7-flash',
  deepseekModel: 'deepseek-v4-flash',
  prompt: 'say something',
  temperature: 0.6,
  maxTokens: 1234,
  primaryTimeoutMs: 20_000,
  fallbackTimeoutMs: 12_000,
}

const GEMINI_BODY = {
  candidates: [{ content: { parts: [{ text: '{"from":' }, { text: '"gemini"}' }] } }],
  modelVersion: 'gemini-3.7-flash-002',
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4 },
}

const DEEPSEEK_BODY = {
  choices: [{ message: { content: '{"from":"deepseek"}' } }],
  model: 'deepseek-v4-flash-241226',
  usage: { prompt_tokens: 10, completion_tokens: 4 },
}

function httpResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

/** A 200 whose headers arrived but whose body read then stalls until the timeout fires. */
function abortedMidStream(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => {
      throw timeoutError()
    },
  } as unknown as Response
}

function networkError(): Error {
  return new Error('fetch failed')
}

function timeoutError(): Error {
  const err = new Error('The operation was aborted due to timeout')
  err.name = 'TimeoutError'
  return err
}

/** Each entry is one fetch outcome, consumed in order: a Response to resolve, or an Error to throw. */
function mockFetchSequence(outcomes: (Response | Error)[]) {
  const fetchMock = vi.fn(async () => {
    const outcome = outcomes.shift()
    if (!outcome) throw new Error('unexpected extra fetch call')
    if (outcome instanceof Error) throw outcome
    return outcome
  })
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function urlOf(call: unknown[]): string {
  return String(call[0])
}

function bodyOf(call: unknown[]): Record<string, unknown> {
  const init = call[1] as { body?: string }
  return JSON.parse(init?.body ?? '{}')
}

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key')
  vi.stubEnv('DEEPSEEK_API_KEY', 'deepseek-test-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('isProviderConfigured', () => {
  it('is true when only Gemini is set', () => {
    vi.stubEnv('GEMINI_API_KEY', 'key')
    vi.stubEnv('DEEPSEEK_API_KEY', '')
    expect(isProviderConfigured()).toBe(true)
  })

  it('is true when only DeepSeek is set', () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('DEEPSEEK_API_KEY', 'key')
    expect(isProviderConfigured()).toBe(true)
  })

  it('is false when neither is set', () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('DEEPSEEK_API_KEY', '')
    expect(isProviderConfigured()).toBe(false)
  })
})

describe('callGeminiWithDeepSeekFallback', () => {
  describe('a retryable Gemini failure falls back to DeepSeek', () => {
    const cases: [string, Response | Error][] = [
      ['429 rate limit', httpResponse(429, { error: 'rate limited' })],
      ['500 server error', httpResponse(500, { error: 'boom' })],
      ['503 unavailable', httpResponse(503, { error: 'unavailable' })],
      ['network error', networkError()],
      ['timeout', timeoutError()],
      ['401 invalid key', httpResponse(401, { error: 'invalid key' })],
      ['403 expired key', httpResponse(403, { error: 'forbidden' })],
      ['404 model unavailable', httpResponse(404, { error: 'model not found' })],
    ]

    it.each(cases)('falls back on %s and returns the DeepSeek result', async (_label, outcome) => {
      const fetchMock = mockFetchSequence([outcome, httpResponse(200, DEEPSEEK_BODY)])

      const result = await callGeminiWithDeepSeekFallback(OPTS)

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(urlOf(fetchMock.mock.calls[1])).toContain('api.deepseek.com')
      expect(result).toEqual({
        ok: true,
        provider: 'deepseek',
        model: 'deepseek-v4-flash-241226',
        text: '{"from":"deepseek"}',
        usage: DEEPSEEK_BODY.usage,
        truncated: false,
      })
    })

    it('sends the fallback the equivalent prompt, temperature and token ceiling', async () => {
      const fetchMock = mockFetchSequence([
        httpResponse(429, { error: 'rate limited' }),
        httpResponse(200, DEEPSEEK_BODY),
      ])

      await callGeminiWithDeepSeekFallback(OPTS)

      expect(bodyOf(fetchMock.mock.calls[1])).toMatchObject({
        model: OPTS.deepseekModel,
        messages: [{ role: 'user', content: OPTS.prompt }],
        temperature: OPTS.temperature,
        max_tokens: OPTS.maxTokens,
      })
    })
  })

  describe('a 400 from Gemini is not retryable', () => {
    it('returns the failure without attempting DeepSeek', async () => {
      const fetchMock = mockFetchSequence([httpResponse(400, { error: 'bad request' })])

      const result = await callGeminiWithDeepSeekFallback(OPTS)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ ok: false, network: false })
    })
  })

  describe('a 400 that is actually an invalid API key falls back to DeepSeek', () => {
    // Google reports "API key not valid" as HTTP 400 as often as 401/403 — status code
    // alone under-detects this real, common failure mode.
    it('falls back when the error body carries the API_KEY_INVALID reason', async () => {
      const fetchMock = mockFetchSequence([
        httpResponse(400, {
          error: {
            code: 400,
            message: 'API key not valid. Please pass a valid API key.',
            status: 'INVALID_ARGUMENT',
            details: [{ reason: 'API_KEY_INVALID' }],
          },
        }),
        httpResponse(200, DEEPSEEK_BODY),
      ])

      const result = await callGeminiWithDeepSeekFallback(OPTS)

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result).toEqual({
        ok: true,
        provider: 'deepseek',
        model: 'deepseek-v4-flash-241226',
        text: '{"from":"deepseek"}',
        usage: DEEPSEEK_BODY.usage,
        truncated: false,
      })
    })

    it('falls back when only the message text identifies it, with no details array', async () => {
      const fetchMock = mockFetchSequence([
        httpResponse(400, { error: { message: 'API key not valid.', status: 'INVALID_ARGUMENT' } }),
        httpResponse(200, DEEPSEEK_BODY),
      ])

      await callGeminiWithDeepSeekFallback(OPTS)

      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('still does not fall back on an ordinary 400 that merely happens to have an error object', async () => {
      const fetchMock = mockFetchSequence([
        httpResponse(400, { error: { message: 'Request contains an invalid argument.', status: 'INVALID_ARGUMENT' } }),
      ])

      const result = await callGeminiWithDeepSeekFallback(OPTS)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ ok: false, network: false })
    })
  })

  describe('a response that stalls mid-stream after a 200 header', () => {
    it('is treated as a transport failure, not a fabricated empty success', async () => {
      const fetchMock = mockFetchSequence([abortedMidStream(), httpResponse(200, DEEPSEEK_BODY)])

      const result = await callGeminiWithDeepSeekFallback(OPTS)

      // Falls back exactly like any other timeout — proves the router doesn't return
      // {ok:true, text:''} for a hang that happened to send headers first.
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result).toMatchObject({ ok: true, provider: 'deepseek' })
    })

    it('reports network:true when it is the only (or last) attempt', async () => {
      vi.stubEnv('DEEPSEEK_API_KEY', '')
      mockFetchSequence([abortedMidStream()])

      expect(await callGeminiWithDeepSeekFallback(OPTS)).toEqual({ ok: false, network: true })
    })
  })

  describe('a successful Gemini call', () => {
    it('never attempts the fallback', async () => {
      const fetchMock = mockFetchSequence([httpResponse(200, GEMINI_BODY)])

      const result = await callGeminiWithDeepSeekFallback(OPTS)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(urlOf(fetchMock.mock.calls[0])).toContain('generativelanguage.googleapis.com')
      expect(result).toEqual({
        ok: true,
        provider: 'gemini',
        model: 'gemini-3.7-flash-002',
        text: '{"from":"gemini"}',
        usage: GEMINI_BODY.usageMetadata,
        truncated: false,
      })
    })

    it('disables Gemini\'s internal reasoning tokens, matching the DeepSeek attempt already disabling its own', async () => {
      // Root cause of frequent real-world fallbacks (2026-08-30 investigation): gemini-3.7-flash
      // spends hundreds of tokens "thinking" before any output, which alone can push a call
      // past a 20s primary timeout even for a trivial prompt. thinkingBudget: 0 removes that
      // pass entirely — the same latency/cost tradeoff the DeepSeek attempt already makes via
      // `thinking: { type: 'disabled' }`.
      const fetchMock = mockFetchSequence([httpResponse(200, GEMINI_BODY)])

      await callGeminiWithDeepSeekFallback(OPTS)

      expect(bodyOf(fetchMock.mock.calls[0])).toMatchObject({
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
      })
    })

    it('reports truncated:true when the provider stopped at the token ceiling', async () => {
      const truncatedBody = {
        candidates: [{ content: { parts: [{ text: '{"partial":' }] }, finishReason: 'MAX_TOKENS' }],
        modelVersion: 'gemini-3.7-flash-002',
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4 },
      }
      mockFetchSequence([httpResponse(200, truncatedBody)])

      const result = await callGeminiWithDeepSeekFallback(OPTS)

      expect(result).toMatchObject({ ok: true, truncated: true })
    })
  })

  describe('no DeepSeek key configured — nothing to fall back to', () => {
    it('reports network:true when the only attempt (Gemini) failed with a network error', async () => {
      vi.stubEnv('DEEPSEEK_API_KEY', '')
      mockFetchSequence([networkError()])

      expect(await callGeminiWithDeepSeekFallback(OPTS)).toEqual({ ok: false, network: true })
    })

    it('reports network:false when the only attempt (Gemini) failed with a 5xx', async () => {
      vi.stubEnv('DEEPSEEK_API_KEY', '')
      mockFetchSequence([httpResponse(500, { error: 'boom' })])

      expect(await callGeminiWithDeepSeekFallback(OPTS)).toEqual({ ok: false, network: false })
    })
  })

  describe('failure logging', () => {
    it('logs the provider and status of every failed attempt', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockFetchSequence([httpResponse(500, {}), httpResponse(502, {})])

      await callGeminiWithDeepSeekFallback(OPTS)

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('gemini attempt failed: status=500'))
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('deepseek attempt failed: status=502'))
    })

    it('logs network/timeout, not a status number, for a non-HTTP failure', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      // A network error is retryable, so a real fallback attempt still follows — give it
      // an outcome too rather than asserting on the primary's log line in isolation.
      mockFetchSequence([networkError(), httpResponse(200, DEEPSEEK_BODY)])

      await callGeminiWithDeepSeekFallback(OPTS)

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('gemini attempt failed: status=network/timeout'))
    })
  })

  describe('both attempts failing', () => {
    it('reports network:true when the fallback failed with a network error', async () => {
      const fetchMock = mockFetchSequence([httpResponse(500, { error: 'boom' }), networkError()])

      const result = await callGeminiWithDeepSeekFallback(OPTS)

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ ok: false, network: true })
    })

    it('reports network:true when the fallback timed out', async () => {
      mockFetchSequence([networkError(), timeoutError()])

      expect(await callGeminiWithDeepSeekFallback(OPTS)).toEqual({ ok: false, network: true })
    })

    it('reports network:false when the fallback returned a non-2xx response', async () => {
      // The primary failed with a network error, so `network` must track the LAST attempt,
      // not the first — a caller keying its 504-vs-502 branch off this would otherwise
      // report a timeout for a request that actually got an HTTP answer.
      mockFetchSequence([networkError(), httpResponse(500, { error: 'boom' })])

      expect(await callGeminiWithDeepSeekFallback(OPTS)).toEqual({ ok: false, network: false })
    })
  })
})

// ─── Streaming ───────────────────────────────────────────────────────────────

/** A 200 whose body is a real SSE stream over the given frames. */
function sseResponse(...frames: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      for (const frame of frames) controller.enqueue(encoder.encode(`data: ${frame}\n\n`))
      controller.close()
    },
  })
  return { ok: true, status: 200, body } as unknown as Response
}

/**
 * A 200 that streams `frames`, then breaks — the mid-stream failure the fallback cannot fix.
 * Delivered one frame per pull: erroring the controller from `start` would discard the
 * queue, and the whole point of the fixture is that the reader HAS already seen them.
 */
function sseThenBreaks(...frames: string[]): Response {
  let next = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (next < frames.length) {
        controller.enqueue(new TextEncoder().encode(`data: ${frames[next++]}\n\n`))
        return
      }
      controller.error(timeoutError())
    },
  })
  return { ok: true, status: 200, body } as unknown as Response
}

function geminiFrame(text: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], ...extra })
}

function deepseekFrame(content: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ choices: [{ delta: { content } }], ...extra })
}

describe('streamGeminiWithDeepSeekFallback', () => {
  it('hands over each delta in order and returns the whole completion', async () => {
    mockFetchSequence([sseResponse(
      geminiFrame('{"from":'),
      geminiFrame('"gemini"}', { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4 } }),
    )])

    const deltas: string[] = []
    const result = await streamGeminiWithDeepSeekFallback(OPTS, d => deltas.push(d))

    expect(deltas).toEqual(['{"from":', '"gemini"}'])
    expect(result).toMatchObject({ ok: true, provider: 'gemini', text: '{"from":"gemini"}' })
  })

  it('asks Gemini for its SSE endpoint', async () => {
    const fetchMock = mockFetchSequence([sseResponse(geminiFrame('{}'))])

    await streamGeminiWithDeepSeekFallback(OPTS, () => {})

    expect(urlOf(fetchMock.mock.calls[0])).toContain(':streamGenerateContent?alt=sse')
  })

  it('falls back to DeepSeek when Gemini fails before any delta', async () => {
    mockFetchSequence([
      httpResponse(500, { error: 'boom' }),
      sseResponse(
        deepseekFrame('{"from":"deepseek"}'),
        JSON.stringify({ choices: [], usage: { prompt_tokens: 10, completion_tokens: 4 } }),
        '[DONE]',
      ),
    ])

    const result = await streamGeminiWithDeepSeekFallback(OPTS, () => {})

    expect(result).toMatchObject({ ok: true, provider: 'deepseek', text: '{"from":"deepseek"}' })
  })

  it('asks DeepSeek to stream, and to include usage — a billed call with no counts to file', async () => {
    const fetchMock = mockFetchSequence([
      httpResponse(500, { error: 'boom' }),
      sseResponse(deepseekFrame('{}'), '[DONE]'),
    ])

    await streamGeminiWithDeepSeekFallback(OPTS, () => {})

    expect(bodyOf(fetchMock.mock.calls[1])).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
    })
  })

  // The rule that makes this a separate function from the buffered call.
  it('does NOT fall back once Gemini has already emitted — half of two answers is neither', async () => {
    const fetchMock = mockFetchSequence([sseThenBreaks(geminiFrame('{"from":'))])

    const deltas: string[] = []
    const result = await streamGeminiWithDeepSeekFallback(OPTS, d => deltas.push(d))

    expect(deltas).toEqual(['{"from":'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: false, network: true })
  })

  it('still falls back when the stream breaks before a single delta', async () => {
    const fetchMock = mockFetchSequence([
      sseThenBreaks(),
      sseResponse(deepseekFrame('{"from":"deepseek"}'), '[DONE]'),
    ])

    const result = await streamGeminiWithDeepSeekFallback(OPTS, () => {})

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ ok: true, provider: 'deepseek' })
  })

  it('reports a truncated completion from the provider stop reason', async () => {
    mockFetchSequence([sseResponse(geminiFrame('cut off', { candidates: [{ finishReason: 'MAX_TOKENS' }] }))])

    const result = await streamGeminiWithDeepSeekFallback(OPTS, () => {})

    expect(result).toMatchObject({ ok: true, truncated: true })
  })
})
