import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetUser,
  mockRpc,
  mockCreateSupabaseServerClient,
  mockGetServiceSupabaseClient,
  mockIsAIFreeModeEnabled,
} = vi.hoisted(() => {
  const mockGetUser = vi.fn(async () => ({ data: { user: { id: 'user-1' } } }))
  const mockRpc = vi.fn(async () => ({ data: true, error: null }))

  function makeProfileBuilder() {
    const builder = {
      select: () => builder,
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
  const mockGetServiceSupabaseClient = vi.fn(() => ({
    rpc: vi.fn(async () => ({ data: null, error: null })),
  }))
  const mockIsAIFreeModeEnabled = vi.fn(async () => false)

  return {
    mockGetUser,
    mockRpc,
    mockCreateSupabaseServerClient,
    mockGetServiceSupabaseClient,
    mockIsAIFreeModeEnabled,
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
  SECTIONS_TIMEOUT_MS: 1000,
  TUVI_DAILY_LIMIT: 6,
  vietnamTodaySolar: vi.fn(() => '2026-01-01'),
}))

import { POST } from './route'

function makeRequest() {
  return new Request('http://localhost/api/tu-vi/interpret', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lang: 'vi', cacheOnly: false }),
  })
}

describe('POST /api/tu-vi/interpret', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockRpc.mockResolvedValue({ data: true, error: null })
    process.env.DEEPSEEK_API_KEY = 'test-key'
    // The route's own DeepSeek call is unreachable in a unit test without a
    // real completion; making fetch fail lets the claim/free-mode logic run
    // to completion (and refundSlot() fire) without needing to fake a whole
    // generation. The assertions below only care what happened BEFORE this.
    global.fetch = vi.fn(async () => { throw new Error('network down in test') }) as unknown as typeof fetch
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
})
