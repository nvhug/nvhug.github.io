import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockInsert,
  mockFrom,
  mockGetUser,
  mockCreateSupabaseServerClient,
  mockRequestTextJSON,
} = vi.hoisted(() => {
  const mockInsert = vi.fn(async () => ({ error: null }))
  // Support both .insert() and .select().eq().eq().maybeSingle() chains
  const mockQueryBuilder = {
    insert: mockInsert,
    select: () => mockQueryBuilder,
    eq: () => mockQueryBuilder,
    maybeSingle: async () => ({ data: { role: 'user' }, error: null }),
    rpc: async () => ({ error: null }),
  }
  const mockFrom = vi.fn(() => mockQueryBuilder)
  const mockGetUser = vi.fn(async () => ({ data: { user: { id: 'user-1' } } }))
  const mockCreateSupabaseServerClient = vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: vi.fn(async () => ({ error: null })),
  }))
  const mockRequestTextJSON = vi.fn<(
    prompt: string
  ) => Promise<string>>()

  return {
    mockInsert,
    mockFrom,
    mockGetUser,
    mockCreateSupabaseServerClient,
    mockRequestTextJSON,
  }
})

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}))

// ai-vision now returns { text, usage, model, provider } rather than a bare string, so the
// food photo path can record what each of its two provider calls cost. Wrapping here keeps
// every mockResolvedValueOnce below returning a plain JSON string.
vi.mock('@/lib/ai-vision', () => ({
  requestVisionJSON: vi.fn(),
  requestTextJSON: async (prompt: string) => ({
    text: await mockRequestTextJSON(prompt),
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    model: 'deepseek-v4-flash',
    provider: 'deepseek' as const,
  }),
  resolveVisionConfig: vi.fn(() => true),
  visionProviderNames: vi.fn(() => []),
}))

// Usage recording owns a service-role client of its own; stubbed so these tests exercise
// the route rather than the log.
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

// Trial quota: default to unlimited (simulates admin/paid) so existing tests are unaffected
vi.mock('@/lib/ai-trial', () => ({
  resolveAIAccess: vi.fn(async () => ({ allowed: true, used: 0, limit: 270, unlimited: true })),
  incrementAITrialUsage: vi.fn(async () => {}),
  trialExhaustedBody: vi.fn((feature: string, used: number, limit: number) => ({
    error: `Trial exhausted (${used}/${limit})`,
    trialExhausted: true,
    feature,
    used,
    limit,
  })),
}))

import { POST } from './route'

describe('POST /api/notes/analyze-food', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns normalized metadata for explicit ml item and writes match-applied telemetry', async () => {
    mockRequestTextJSON.mockResolvedValueOnce(JSON.stringify({
      is_food: true,
      overall_confidence: 0.9,
      needs_more_detail: false,
      questions: [],
      notes: 'ok',
      items: [
        {
          name: 'Sua tuoi',
          portion: '250ml',
          calories: 90,
          protein_g: 2,
          carbs_g: 8,
          fat_g: 3,
          confidence: 0.8,
          assumptions: '',
        },
      ],
    }))

    const request = new Request('http://localhost/api/notes/analyze-food', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'text', description: 'Sua tuoi 250ml' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0].normalized_table_key).toBe('whole_milk')
    expect(payload.items[0].normalization_confidence).toBe(0.86)
    expect(payload.items[0]).not.toHaveProperty('normalization_warning')

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockInsert).toHaveBeenCalledWith([
      {
        event_name: 'internal_table_match_applied',
        normalized_table_key: 'whole_milk',
        normalized_source: 'internal_table',
        normalization_version: '2026-08-10.v5',
        normalization_confidence: 0.86,
      },
    ])
  })

  it('records no-match telemetry when an item is intentionally excluded from normalization', async () => {
    mockRequestTextJSON.mockResolvedValueOnce(JSON.stringify({
      is_food: true,
      overall_confidence: 0.8,
      needs_more_detail: false,
      questions: [],
      notes: 'ok',
      items: [
        {
          name: 'Milkshake',
          portion: '300ml',
          calories: 330,
          protein_g: 7,
          carbs_g: 45,
          fat_g: 13,
          confidence: 0.8,
          assumptions: '',
        },
      ],
    }))

    const request = new Request('http://localhost/api/notes/analyze-food', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'text', description: 'Milkshake 300ml' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0]).not.toHaveProperty('normalized_table_key')

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockInsert).toHaveBeenCalledWith([
      {
        event_name: 'internal_table_no_match',
        normalized_table_key: null,
        normalized_source: null,
        normalization_version: null,
        normalization_confidence: null,
      },
    ])
  })

  it('records ambiguous-match telemetry when matcher confidence is below normalize threshold', async () => {
    mockRequestTextJSON.mockResolvedValueOnce(JSON.stringify({
      is_food: true,
      overall_confidence: 0.8,
      needs_more_detail: false,
      questions: [],
      notes: 'ok',
      items: [
        {
          name: 'Tofu',
          portion: '100g',
          calories: 99,
          protein_g: 7,
          carbs_g: 4,
          fat_g: 5,
          confidence: 0.8,
          assumptions: '',
        },
      ],
    }))

    const request = new Request('http://localhost/api/notes/analyze-food', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'text', description: 'Tofu 100g' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0].normalized_table_key).toBe('tofu_plain')
    expect(payload.items[0]).not.toHaveProperty('normalized_by_internal_table')
    expect(payload.items[0].normalization_warning).toBe('ambiguous_match')
    expect(payload.items[0].normalization_confidence).toBe(0.59)

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockInsert).toHaveBeenCalledWith([
      {
        event_name: 'internal_table_match_ambiguous',
        normalized_table_key: 'tofu_plain',
        normalized_source: null,
        normalization_version: '2026-08-10.v5',
        normalization_confidence: 0.59,
      },
    ])
  })
})
