import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetUser,
  mockCreateSupabaseServerClient,
  mockCheckAITrialQuota,
  mockIncrementAITrialUsage,
  mockLogAiUsage,
} = vi.hoisted(() => {
  const mockGetUser = vi.fn(async () => ({ data: { user: { id: 'user-1' } } }))

  const listResult = { data: [], error: null }
  function makeListBuilder() {
    const builder = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      lte: () => builder,
      lt: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({ data: null, error: null }),
      then: (resolve: (v: typeof listResult) => void, reject: (r: unknown) => void) =>
        Promise.resolve(listResult).then(resolve, reject),
    }
    return builder
  }
  function makeUserProfileBuilder() {
    const builder = {
      select: () => builder,
      eq: () => builder,
      single: async () => ({ data: { role: 'user' }, error: null }),
    }
    return builder
  }
  function makeAnalysisHistoryBuilder() {
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({ data: null, error: null }),
      insert: () => builder,
      single: async () => ({ data: { id: 'a1', created_at: '2026-01-01T00:00:00.000Z' }, error: null }),
    }
    return builder
  }
  const mockFrom = vi.fn((table: string) => {
    if (table === 'user_profiles') return makeUserProfileBuilder()
    if (table === 'ai_analysis_history') return makeAnalysisHistoryBuilder()
    return makeListBuilder()
  })
  const mockCreateSupabaseServerClient = vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }))

  const mockCheckAITrialQuota = vi.fn()
  const mockIncrementAITrialUsage = vi.fn(async () => {})
  const mockLogAiUsage = vi.fn(async () => 'usage-log-id')

  return {
    mockGetUser,
    mockCreateSupabaseServerClient,
    mockCheckAITrialQuota,
    mockIncrementAITrialUsage,
    mockLogAiUsage,
  }
})

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}))

vi.mock('@/lib/ai-trial', () => ({
  checkAITrialQuota: mockCheckAITrialQuota,
  incrementAITrialUsage: mockIncrementAITrialUsage,
  QUOTA_EXHAUSTED_STATUS: 429, // monetization off — see ADR-017
  trialExhaustedBody: vi.fn((feature: string, used: number, limit: number) => ({
    error: `Trial exhausted (${used}/${limit})`,
    trialExhausted: true,
    feature,
    used,
    limit,
  })),
}))

vi.mock('@/lib/ai-usage', () => ({
  logAiUsage: mockLogAiUsage,
  normalizeUsage: vi.fn(() => ({
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_tokens: 0,
  })),
  // Not called by route.ts directly any more — but ai-provider.ts (exercised for real by
  // this file's fetch-level provider mocking) imports it from this same module, and
  // vi.mock replaces the whole module for every importer, not just route.ts's own.
  servedModel: vi.fn((_raw: unknown, requested: string) => requested),
}))

import { ANALYZE_FALLBACK_TIMEOUT_MS, ANALYZE_MAX_TOKENS, POST } from './route'
import { MEASURED_TOKENS_PER_SECOND } from '@/lib/horoscope-interpretation'
import { parseSseFrame } from '@/lib/sse'

function makeRequest() {
  return new Request('http://localhost/api/notes/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      notes: [{
        id: 'n1', type: 'good', status: 'done', priority: 3, completion_percentage: 100,
        tags: [], note_date: '2026-01-01', content: 'did the thing',
      }],
      habits: [],
      period: { label: 'This week', from: '2026-01-01', to: '2026-01-07' },
      lang: 'vi',
    }),
  })
}

const ANALYSIS = JSON.stringify({ summary: 'ok' })

/** Both providers answer in SSE now — one `data:` line per frame. */
function sse(...frames: string[]) {
  return frames.map(f => `data: ${f}\n\n`).join('')
}

/** Wraps completion text as the Gemini chunks that would carry it. */
function geminiChunks(...deltas: string[]) {
  return sse(
    ...deltas.map(text => JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })),
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: '' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    }),
  )
}

function geminiResponse() {
  return new Response(geminiChunks(ANALYSIS), { status: 200 })
}

function deepseekResponse() {
  return new Response(sse(
    JSON.stringify({ choices: [{ delta: { content: ANALYSIS }, finish_reason: 'stop' }] }),
    JSON.stringify({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }),
    '[DONE]',
  ), { status: 200 })
}

interface ReadStream {
  events: { event: string; data: unknown }[]
  sections: { key: string; value: unknown }[]
  done: Record<string, unknown> | undefined
  error: { error?: string } | undefined
}

/**
 * Drains the SSE response and sorts its frames. Awaiting the body is also what makes the
 * assertions safe: the route's DB writes happen inside the stream, so a test that asserted
 * before reading it would race the work it is checking.
 */
async function readStream(response: Response): Promise<ReadStream> {
  const events = (await response.text())
    .split('\n\n')
    .filter(raw => raw.trim() !== '')
    .map(parseSseFrame)
    .filter((f): f is { event: string; data: unknown } => f !== null)

  return {
    events,
    sections: events.filter(e => e.event === 'section').map(e => e.data as { key: string; value: unknown }),
    done: events.find(e => e.event === 'done')?.data as Record<string, unknown> | undefined,
    error: events.find(e => e.event === 'error')?.data as { error?: string } | undefined,
  }
}

/** Routes each provider URL to its own reply, so tests only state what differs. */
function mockProviders(gemini: () => Response, deepseek: () => Response = deepseekResponse) {
  const fetchMock = vi.fn(async (url: string | URL | Request) =>
    String(url).includes('googleapis.com') ? gemini() : deepseek()
  )
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

describe('POST /api/notes/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    process.env.GEMINI_API_KEY = 'test-gemini-key'
    process.env.DEEPSEEK_API_KEY = 'test-key'
    mockProviders(geminiResponse)
  })

  it('does not consume trial usage when AI Free Mode is on', async () => {
    mockCheckAITrialQuota.mockResolvedValue({ allowed: true, unlimited: true })

    const response = await POST(makeRequest())
    await readStream(response)
    expect(response.status).toBe(200)
    expect(mockIncrementAITrialUsage).not.toHaveBeenCalled()
  })

  it('still consumes trial usage as usual when AI Free Mode is off', async () => {
    mockCheckAITrialQuota.mockResolvedValue({ allowed: true, used: 1, limit: 12, remaining: 11 })

    const response = await POST(makeRequest())
    await readStream(response)
    expect(response.status).toBe(200)
    expect(mockIncrementAITrialUsage).toHaveBeenCalledTimes(1)
    expect(mockIncrementAITrialUsage).toHaveBeenCalledWith(expect.anything(), 'notes_analyze')
  })

  // The gates run before a single byte is streamed, so they can still answer with a status
  // code — which is the only reason the client can tell a quota block from a failure.
  it('blocks the request with a status code, not a stream, when trial quota is exhausted', async () => {
    mockCheckAITrialQuota.mockResolvedValue({ allowed: false, used: 12, limit: 12 })

    const response = await POST(makeRequest())
    expect(response.status).toBe(429)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toMatchObject({ trialExhausted: true })
    expect(mockIncrementAITrialUsage).not.toHaveBeenCalled()
  })

  it('streams each finished section before the completed analysis', async () => {
    mockCheckAITrialQuota.mockResolvedValue({ allowed: true, used: 1, limit: 12, remaining: 11 })
    mockProviders(() => new Response(geminiChunks('{"summary": "ok",', ' "pattern": "p"}'), { status: 200 }))

    const response = await POST(makeRequest())
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const { sections, done, events } = await readStream(response)

    expect(sections).toEqual([
      { key: 'summary', value: 'ok' },
      { key: 'pattern', value: 'p' },
    ])
    expect(done).toMatchObject({ summary: 'ok', pattern: 'p', id: 'a1' })
    // A preview is only a preview if it lands first.
    expect(events.findIndex(e => e.event === 'section'))
      .toBeLessThan(events.findIndex(e => e.event === 'done'))
  })

  it('falls back to DeepSeek when Gemini fails, and logs the provider that served it', async () => {
    mockCheckAITrialQuota.mockResolvedValue({ allowed: true, used: 1, limit: 12, remaining: 11 })
    mockProviders(() => new Response('upstream boom', { status: 500 }))

    const response = await POST(makeRequest())
    const { done } = await readStream(response)
    expect(done).toMatchObject({ summary: 'ok' })
    expect(mockLogAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'deepseek', model: 'deepseek-v4-flash', outcome: 'success' }),
    )
  })

  it('reports an error event without logging usage when neither provider serves the request', async () => {
    mockCheckAITrialQuota.mockResolvedValue({ allowed: true, used: 1, limit: 12, remaining: 11 })
    mockProviders(
      () => new Response('boom', { status: 500 }),
      () => new Response('boom', { status: 500 }),
    )

    const response = await POST(makeRequest())
    const { error, done } = await readStream(response)
    expect(error).toEqual({ error: 'AI analysis unavailable' })
    expect(done).toBeUndefined()
    expect(mockLogAiUsage).not.toHaveBeenCalled()
  })

  // T015 — quota parity: which provider served the call must not change what it costs.
  it.each([
    ['Gemini', geminiResponse],
    ['DeepSeek', () => new Response('boom', { status: 500 })],
  ])('counts trial usage exactly once when %s serves the request', async (_name, gemini) => {
    mockCheckAITrialQuota.mockResolvedValue({ allowed: true, used: 1, limit: 12, remaining: 11 })
    mockProviders(gemini)

    const response = await POST(makeRequest())
    await readStream(response)
    expect(mockCheckAITrialQuota).toHaveBeenCalledTimes(1)
    expect(mockIncrementAITrialUsage).toHaveBeenCalledTimes(1)
  })
})

describe('DeepSeek fallback timeout budget', () => {
  it('waits longer than a genuinely long analysis takes to produce', () => {
    const worstCaseMs = (ANALYZE_MAX_TOKENS / MEASURED_TOKENS_PER_SECOND) * 1000
    expect(ANALYZE_FALLBACK_TIMEOUT_MS).toBeGreaterThan(worstCaseMs)
  })
})
