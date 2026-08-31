import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const {
  mockInsert,
  mockFrom,
  mockGetUser,
  mockCreateSupabaseServerClient,
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

  return {
    mockInsert,
    mockFrom,
    mockGetUser,
    mockCreateSupabaseServerClient,
  }
})

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}))

// Stage 1 (vision) still goes through ai-vision.ts and keeps its own provider chain; only
// stage 2 (nutrition) moved to the shared router, and the router is exercised for real here
// against a stubbed fetch so the Gemini -> DeepSeek fallback is actually covered.
vi.mock('@/lib/ai-vision', () => ({
  requestVisionJSON: vi.fn(),
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
  QUOTA_EXHAUSTED_STATUS: 429, // monetization off — see ADR-017
  trialExhaustedBody: vi.fn((feature: string, used: number, limit: number) => ({
    error: `Trial exhausted (${used}/${limit})`,
    trialExhausted: true,
    feature,
    used,
    limit,
  })),
}))

import { NUTRITION_FALLBACK_TIMEOUT_MS, NUTRITION_MAX_TOKENS, POST } from './route'
import { MEASURED_TOKENS_PER_SECOND } from '@/lib/horoscope-interpretation'
import { requestVisionJSON } from '@/lib/ai-vision'
import { logAiUsage } from '@/lib/ai-usage'
import { GEMINI_CASCADE } from '@/lib/ai-provider'
import { resolveAIAccess, incrementAITrialUsage } from '@/lib/ai-trial'

const NUTRITION_JSON = JSON.stringify({
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
})

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const geminiOk = (text: string) =>
  jsonResponse({
    candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
    modelVersion: 'gemini-3.1-flash-lite',
  })

const deepseekOk = (text: string) =>
  jsonResponse({
    choices: [{ message: { content: text }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    model: 'deepseek-v4-flash',
  })

const mockFetch = vi.fn<typeof fetch>()

const textRequest = (description: string) =>
  new Request('http://localhost/api/notes/analyze-food', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'text', description }),
  })

const imageRequest = () =>
  new Request('http://localhost/api/notes/analyze-food', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      mode: 'image',
      image: { data: 'aGVsbG8=', mimeType: 'image/jpeg' },
      description: 'Sua tuoi 250ml',
    }),
  })

/** The nutrition stage's log row, told apart from the vision stage's by its model. */
const nutritionLogCall = () =>
  vi.mocked(logAiUsage).mock.calls
    .map(([entry]) => entry)
    .find((entry) => entry.model !== 'gemini-3.6-flash')

describe('POST /api/notes/analyze-food', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key')
    vi.stubEnv('DEEPSEEK_API_KEY', 'deepseek-test-key')
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns normalized metadata for explicit ml item and writes match-applied telemetry', async () => {
    mockFetch.mockResolvedValueOnce(geminiOk(NUTRITION_JSON))

    const response = await POST(textRequest('Sua tuoi 250ml'))
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
    mockFetch.mockResolvedValueOnce(geminiOk(JSON.stringify({
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
    })))

    const response = await POST(textRequest('Milkshake 300ml'))
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
    mockFetch.mockResolvedValueOnce(geminiOk(JSON.stringify({
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
    })))

    const response = await POST(textRequest('Tofu 100g'))
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

  it('records the nutrition stage against gemini when the primary serves it', async () => {
    mockFetch.mockResolvedValueOnce(geminiOk(NUTRITION_JSON))

    const response = await POST(textRequest('Sua tuoi 250ml'))
    expect(response.status).toBe(200)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(nutritionLogCall()).toMatchObject({
      surface: 'food_analyze',
      provider: 'gemini',
      outcome: 'success',
    })
  })

  it('falls back to deepseek for the nutrition stage when gemini returns 500, leaving the vision stage on its own provider', async () => {
    vi.mocked(requestVisionJSON).mockResolvedValueOnce({
      text: JSON.stringify({ is_food: true, focus_box: [10, 10, 900, 900], items: [] }),
      usage: null,
      model: 'gemini-3.6-flash',
      provider: 'gemini',
    })
    // Every rung of GEMINI_CASCADE has to fail before DeepSeek is reached — one 500 only
    // moves to the next model now, it no longer hands over to the fallback.
    mockFetch
      .mockResolvedValueOnce(new Response('upstream error', { status: 500 }))
      .mockResolvedValueOnce(new Response('upstream error', { status: 500 }))
      .mockResolvedValueOnce(new Response('upstream error', { status: 500 }))
      .mockResolvedValueOnce(deepseekOk(NUTRITION_JSON))

    const response = await POST(imageRequest())
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0].normalized_table_key).toBe('whole_milk')
    expect(payload.focusBox).toEqual([10, 10, 900, 900])

    expect(mockFetch).toHaveBeenCalledTimes(GEMINI_CASCADE.length + 1)
    expect(String(mockFetch.mock.calls[0][0])).toContain('generativelanguage.googleapis.com')
    expect(String(mockFetch.mock.calls.at(-1)![0])).toContain('api.deepseek.com')

    // Two rows: the vision stage on its own provider, the nutrition stage on the fallback.
    expect(vi.mocked(logAiUsage)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(logAiUsage).mock.calls[0][0]).toMatchObject({ model: 'gemini-3.6-flash' })
    expect(nutritionLogCall()).toMatchObject({
      surface: 'food_analyze',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      outcome: 'success',
    })
  })

  it.each([
    ['gemini', () => mockFetch.mockResolvedValueOnce(geminiOk(NUTRITION_JSON))],
    [
      'deepseek',
      () => {
        // One 500 per Gemini rung, then the fallback — the chain has to be exhausted.
        GEMINI_CASCADE.forEach(() => mockFetch.mockResolvedValueOnce(new Response('upstream error', { status: 500 })))
        return mockFetch.mockResolvedValueOnce(deepseekOk(NUTRITION_JSON))
      },
    ],
  ])('checks and increments the food_analyze trial quota exactly once when %s serves', async (_provider, arrange) => {
    vi.mocked(resolveAIAccess).mockResolvedValueOnce({
      allowed: true,
      used: 1,
      limit: 270,
      unlimited: false,
    })
    arrange()

    const response = await POST(textRequest('Sua tuoi 250ml'))
    expect(response.status).toBe(200)

    expect(vi.mocked(resolveAIAccess)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(resolveAIAccess).mock.calls[0][2]).toBe('food_analyze')
    expect(vi.mocked(incrementAITrialUsage)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(incrementAITrialUsage).mock.calls[0][1]).toBe('food_analyze')
  })
})

describe('DeepSeek fallback timeout budget', () => {
  it('waits longer than a genuinely long completion takes to produce', () => {
    const worstCaseMs = (NUTRITION_MAX_TOKENS / MEASURED_TOKENS_PER_SECOND) * 1000
    expect(NUTRITION_FALLBACK_TIMEOUT_MS).toBeGreaterThan(worstCaseMs)
  })
})
