import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeCostUsd } from '@/lib/ai-pricing'
import type { LogAiUsageParams } from '@/lib/ai-usage'

const {
  mockGetUser,
  mockRpc,
  mockServiceRpc,
  mockCreateSupabaseServerClient,
  mockGetServiceSupabaseClient,
  mockIsAIFreeModeEnabled,
  mockLogAiUsage,
} = vi.hoisted(() => {
  const mockGetUser = vi.fn(async () => ({ data: { user: { id: 'user-1' } } }))
  const mockRpc = vi.fn(async () => ({ data: true, error: null }))

  function makeProfileBuilder() {
    const builder = {
      select: () => builder,
      update: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({
        data: {
          role: 'user',
          profile_data: { horoscope: { birthDateSolar: '2000-01-01' }, horoscopeReading: {} },
        },
        error: null,
      }),
    }
    return builder
  }
  const mockFrom = vi.fn(() => makeProfileBuilder())
  const mockCreateSupabaseServerClient = vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  }))
  // One stable spy, not a fresh vi.fn() per call: refundSlot() goes through this
  // client, so the tests below can only assert a slot was NOT refunded if the
  // same function object survives between the route's call and the assertion.
  const mockServiceRpc = vi.fn(async () => ({ data: null, error: null }))
  const mockGetServiceSupabaseClient = vi.fn(() => ({ rpc: mockServiceRpc }))
  const mockIsAIFreeModeEnabled = vi.fn(async () => false)
  const mockLogAiUsage = vi.fn<(params: LogAiUsageParams) => Promise<string | null>>(
    async () => 'usage-row-1',
  )

  return {
    mockGetUser,
    mockRpc,
    mockServiceRpc,
    mockCreateSupabaseServerClient,
    mockGetServiceSupabaseClient,
    mockIsAIFreeModeEnabled,
    mockLogAiUsage,
  }
})

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}))

vi.mock('@/lib/supabase-admin', () => ({
  getServiceSupabaseClient: mockGetServiceSupabaseClient,
}))

vi.mock('@/lib/ai-free-mode', () => ({
  isAIFreeModeEnabled: mockIsAIFreeModeEnabled,
}))

// Only the recorder is faked. normalizeUsage stays real so the token values
// asserted below are the ones the shipped mapping produces, not ones a stub was
// told to return.
vi.mock('@/lib/ai-usage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai-usage')>()),
  logAiUsage: mockLogAiUsage,
}))

vi.mock('@/lib/horoscope-profile', () => ({
  parseHoroscopeProfile: vi.fn(() => ({
    birthDateSolar: '2000-01-01',
    birthDateLunar: { day: 1, month: 1, year: 2000, isLeapMonth: false },
    birthTime: null,
    birthTimeUnknown: true,
    gender: 'nam',
    updatedAt: '',
  })),
}))

vi.mock('@/lib/tuvi/reading', () => ({
  buildReading: vi.fn(() => ({})),
}))

vi.mock('@/lib/horoscope-interpretation', () => ({
  buildInterpretationPrompt: vi.fn(() => 'prompt'),
  INTERPRETATION_VERSION: 1,
  // Real logic (not a fixed stub): the route combines this with the new AI
  // Free Mode flag, so keeping it real is what lets these tests prove the
  // combination, not just that a stub returns what we told it to.
  isUnlimitedTuviRole: (role: string | null | undefined) => role === 'admin' || role === 'paid',
  lunarDayKey: vi.fn(() => 'lunarday-1'),
  lunarMonthKey: vi.fn(() => 'lunarmonth-1'),
  missingRequiredSections: vi.fn(() => []),
  parseInterpretationSections: vi.fn(() => ({})),
  profileFingerprint: vi.fn(() => 'fp-1'),
  readCachedInterpretation: vi.fn(() => null),
  SECTIONS_MAX_TOKENS: 1000,
  TUVI_DAILY_LIMIT: 6,
  vietnamTodaySolar: vi.fn(() => '2026-01-01'),
}))

import { POST, SECTIONS_FALLBACK_TIMEOUT_MS } from './route'

function makeRequest() {
  return new Request('http://localhost/api/tu-vi/interpret', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lang: 'vi', cacheOnly: false }),
  })
}

// The reading itself: parseInterpretationSections is stubbed above, so this only
// has to be JSON the route can parse.
const READING_JSON = '{"tongQuan":"..."}'

const GEMINI_MODEL = 'gemini-3.1-flash-lite-002'
const GEMINI_TOKENS = { promptTokenCount: 900, candidatesTokenCount: 600, totalTokenCount: 1500 }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function geminiSuccess() {
  return jsonResponse({
    modelVersion: GEMINI_MODEL,
    candidates: [{ content: { parts: [{ text: READING_JSON }] }, finishReason: 'STOP' }],
    usageMetadata: GEMINI_TOKENS,
  })
}

function deepseekSuccess() {
  return jsonResponse({
    model: 'deepseek-v4-flash',
    choices: [{ message: { content: READING_JSON }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 900, completion_tokens: 600, total_tokens: 1500 },
  })
}

/**
 * The route now calls the shared router, which does the HTTP itself — so the seam
 * these tests drive is still `fetch`, one handler per provider host.
 */
function mockProviders(handlers: { gemini: () => Response; deepseek?: () => Response }) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.includes('generativelanguage.googleapis.com')) return handlers.gemini()
    if (url.includes('api.deepseek.com')) {
      if (!handlers.deepseek) throw new Error('unexpected DeepSeek call')
      return handlers.deepseek()
    }
    throw new Error(`unexpected fetch to ${url}`)
  }) as unknown as typeof fetch
}

describe('POST /api/tu-vi/interpret', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockRpc.mockResolvedValue({ data: true, error: null })
    process.env.GEMINI_API_KEY = 'test-gemini-key'
    process.env.DEEPSEEK_API_KEY = 'test-key'
    // Gemini serves by default, so DeepSeek is never reached unless a test says so.
    mockProviders({ gemini: geminiSuccess })
  })

  it('does not claim a daily generation slot when AI Free Mode is on', async () => {
    mockIsAIFreeModeEnabled.mockResolvedValue(true)

    await POST(makeRequest())

    expect(mockRpc).not.toHaveBeenCalledWith('claim_tuvi_generation', expect.anything())
  })

  it('still claims a daily generation slot as usual when AI Free Mode is off', async () => {
    mockIsAIFreeModeEnabled.mockResolvedValue(false)

    await POST(makeRequest())

    expect(mockRpc).toHaveBeenCalledWith('claim_tuvi_generation', { p_lunar_day: 'lunarday-1' })
  })

  it('serves the reading from DeepSeek when Gemini fails with a retryable status', async () => {
    mockProviders({
      gemini: () => jsonResponse({ error: 'upstream boom' }, 500),
      deepseek: deepseekSuccess,
    })

    const response = await POST(makeRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ sections: {}, cached: false })
    expect(mockLogAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: 'tuvi_interpret',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        outcome: 'success',
      }),
    )
  })

  it('spends exactly one generation slot whichever provider serves the reading', async () => {
    await POST(makeRequest())

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('claim_tuvi_generation', { p_lunar_day: 'lunarday-1' })
    expect(mockServiceRpc).not.toHaveBeenCalled()

    vi.clearAllMocks()
    mockProviders({
      gemini: () => jsonResponse({ error: 'upstream boom' }, 500),
      deepseek: deepseekSuccess,
    })

    await POST(makeRequest())

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('claim_tuvi_generation', { p_lunar_day: 'lunarday-1' })
    // Falling back must not hand the slot back — the reading was still produced.
    expect(mockServiceRpc).not.toHaveBeenCalled()
  })

  it('records a Gemini-served reading as a free-tier call', async () => {
    await POST(makeRequest())

    expect(mockLogAiUsage).toHaveBeenCalledTimes(1)
    const logged = mockLogAiUsage.mock.calls[0][0]
    expect(logged.provider).toBe('gemini')
    expect(logged.model).toBe(GEMINI_MODEL)
    expect(logged.usage).toEqual({
      input_tokens: 900,
      cached_input_tokens: 0,
      output_tokens: 600,
      reasoning_tokens: 0,
    })

    // The real pricing table, not a restatement of it: gemini-3.1-flash-lite is on
    // Google's free tier, so a served point-release of it must cost exactly $0 —
    // not null, which would mean "unpriced".
    const cost = computeCostUsd(
      {
        input: logged.usage.input_tokens,
        cached: logged.usage.cached_input_tokens,
        output: logged.usage.output_tokens,
      },
      logged.model,
      new Date('2026-08-30T02:00:00Z'),
    )
    expect(cost).toBe(0)
  })
})

describe('DeepSeek fallback timeout budget', () => {
  it('waits longer than a genuinely long completion takes to produce', async () => {
    // The REAL exports, not this file's module-level mock of '@/lib/horoscope-interpretation'
    // (which stubs SECTIONS_MAX_TOKENS down to 1000 for the other tests above) — this
    // assertion is meaningless against a stub, it has to check the production numbers.
    const { SECTIONS_MAX_TOKENS, MEASURED_TOKENS_PER_SECOND } =
      await vi.importActual<typeof import('@/lib/horoscope-interpretation')>(
        '@/lib/horoscope-interpretation'
      )
    // Raising SECTIONS_MAX_TOKENS without raising this only turns a slow-but-healthy
    // fallback completion into a timeout that refunds the user's daily slot for nothing —
    // see the code-review finding this test locks in.
    const worstCaseMs = (SECTIONS_MAX_TOKENS / MEASURED_TOKENS_PER_SECOND) * 1000
    expect(SECTIONS_FALLBACK_TIMEOUT_MS).toBeGreaterThan(worstCaseMs)
  })
})
