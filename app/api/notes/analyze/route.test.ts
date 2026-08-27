import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetUser,
  mockCreateSupabaseServerClient,
  mockCheckAITrialQuota,
  mockIncrementAITrialUsage,
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

  return {
    mockGetUser,
    mockCreateSupabaseServerClient,
    mockCheckAITrialQuota,
    mockIncrementAITrialUsage,
  }
})

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}))

vi.mock('@/lib/ai-trial', () => ({
  checkAITrialQuota: mockCheckAITrialQuota,
  incrementAITrialUsage: mockIncrementAITrialUsage,
  trialExhaustedBody: vi.fn((feature: string, used: number, limit: number) => ({
    error: `Trial exhausted (${used}/${limit})`,
    trialExhausted: true,
    feature,
    used,
    limit,
  })),
}))

vi.mock('@/lib/ai-usage', () => ({
  logAiUsage: vi.fn(async () => 'usage-log-id'),
  normalizeUsage: vi.fn(() => ({
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_tokens: 0,
  })),
  servedModel: vi.fn((_raw: unknown, requested: string) => requested),
}))

import { POST } from './route'

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

describe('POST /api/notes/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    process.env.DEEPSEEK_API_KEY = 'test-key'
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ summary: 'ok' }) } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200 })) as unknown as typeof fetch
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
    expect(mockIncrementAITrialUsage).toHaveBeenCalledWith(expect.anything(), 'user-1', 'notes_analyze')
  })

  it('blocks the request and never calls incrementAITrialUsage when trial quota is exhausted', async () => {
    mockCheckAITrialQuota.mockResolvedValue({ allowed: false, used: 12, limit: 12 })

    const response = await POST(makeRequest())
    expect(response.status).toBe(402)
    expect(mockIncrementAITrialUsage).not.toHaveBeenCalled()
  })
})
