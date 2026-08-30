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

function geminiResponse() {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: ANALYSIS }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
  }), { status: 200 })
}

function deepseekResponse() {
  return new Response(JSON.stringify({
    choices: [{ message: { content: ANALYSIS }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }), { status: 200 })
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
    expect(response.status).toBe(200)
    expect(mockIncrementAITrialUsage).not.toHaveBeenCalled()
  })

  it('still consumes trial usage as usual when AI Free Mode is off', async () => {
    mockCheckAITrialQuota.mockResolvedValue({ allowed: true, used: 1, limit: 12, remaining: 11 })

    const response = await POST(makeRequest())
    expect(response.status).toBe(200)
    expect(mockIncrementAITrialUsage).toHaveBeenCalledTimes(1)
    expect(mockIncrementAITrialUsage).toHaveBeenCalledWith(expect.anything(), 'notes_analyze')
  })

  it('blocks the request and never calls incrementAITrialUsage when trial quota is exhausted', async () => {
    mockCheckAITrialQuota.mockResolvedValue({ allowed: false, used: 12, limit: 12 })

    const response = await POST(makeRequest())
    expect(response.status).toBe(429)
    expect(mockIncrementAITrialUsage).not.toHaveBeenCalled()
  })

  it('falls back to DeepSeek when Gemini fails, and logs the provider that served it', async () => {
    mockCheckAITrialQuota.mockResolvedValue({ allowed: true, used: 1, limit: 12, remaining: 11 })
    mockProviders(() => new Response('upstream boom', { status: 500 }))

    const response = await POST(makeRequest())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ summary: 'ok' })
    expect(mockLogAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'deepseek', model: 'deepseek-v4-flash', outcome: 'success' }),
    )
  })

  it('returns 502 without logging usage when neither provider serves the request', async () => {
    mockCheckAITrialQuota.mockResolvedValue({ allowed: true, used: 1, limit: 12, remaining: 11 })
    mockProviders(
      () => new Response('boom', { status: 500 }),
      () => new Response('boom', { status: 500 }),
    )

    const response = await POST(makeRequest())
    expect(response.status).toBe(502)
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
    expect(response.status).toBe(200)
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
