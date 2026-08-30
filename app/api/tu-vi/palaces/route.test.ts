import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  const mockServiceRpc = vi.fn(async () => ({ data: null, error: null }))

  function makeProfileBuilder() {
    const builder = {
      select: () => builder,
      // The cache write is `.update({...}).eq(...)` and is awaited for its `error`
      // field — a plain object without one reads as a successful write.
      update: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({
        data: {
          role: 'user',
          profile_data: { horoscope: { birthDateSolar: '2000-01-01' }, horoscopePalaces: {} },
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
  const mockGetServiceSupabaseClient = vi.fn(() => ({ rpc: mockServiceRpc }))
  const mockIsAIFreeModeEnabled = vi.fn(async () => false)
  // Typed on the one field these tests read, so `mock.calls[n][0].provider` type-checks.
  const mockLogAiUsage = vi.fn<(params: { provider: string }) => Promise<string>>(
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

// Only the writer is stubbed. `normalizeUsage`/`servedModel` stay real because the
// provider router uses them too, and the point of these tests is that the DeepSeek
// payload is mapped as DeepSeek's — not that a stub echoes what we told it.
vi.mock('@/lib/ai-usage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai-usage')>('@/lib/ai-usage')
  return { ...actual, logAiUsage: mockLogAiUsage }
})

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
  buildPalacePrompt: vi.fn(() => 'prompt'),
  canReadPalaces: vi.fn(() => true),
  // Real logic (not a fixed stub): the route combines this with the new AI
  // Free Mode flag, so keeping it real is what lets these tests prove the
  // combination, not just that a stub returns what we told it to.
  isUnlimitedTuviRole: (role: string | null | undefined) => role === 'admin' || role === 'paid',
  lunarDayKey: vi.fn(() => 'lunarday-1'),
  // Two batches, as in production: the route bills, records and refunds them
  // independently, so a single-batch stub could not show a partial result.
  PALACE_BATCHES: [[0, 1, 2], [3, 4, 5]],
  palaceReadingsToList: vi.fn(() => []),
  PALACE_VERSION: 1,
  parsePalaceReadings: vi.fn(() => ({})),
  profileFingerprint: vi.fn(() => 'fp-1'),
  readCachedPalaces: vi.fn(() => null),
  vietnamTodaySolar: vi.fn(() => '2026-01-01'),
}))

import {
  buildPalacePrompt,
  palaceReadingsToList,
  parsePalaceReadings,
  type PalaceReading,
} from '@/lib/horoscope-interpretation'
import { PALACE_FALLBACK_TIMEOUT_MS, PALACE_MAX_TOKENS, POST } from './route'

function makeRequest() {
  return new Request('http://localhost/api/tu-vi/palaces', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lang: 'vi', cacheOnly: false }),
  })
}

/** The first of the two batches; anything else in a stub below is the second. */
const BATCH_A = 'prompt-0-1-2'

/** Both providers carry the prompt in their body, which is how a stub tells the batches apart. */
function isBatch(init: RequestInit | undefined, prompt: string): boolean {
  return String(init?.body ?? '').includes(prompt)
}

function isGemini(url: string): boolean {
  return url.includes('generativelanguage.googleapis.com')
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** input + output must equal the reported total, or normalizeUsage warns about a bad mapping. */
function geminiOk(palacesJson: string): Response {
  return jsonResponse({
    modelVersion: 'gemini-3.1-flash-lite',
    candidates: [{ content: { parts: [{ text: palacesJson }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200, totalTokenCount: 300 },
  })
}

function deepseekOk(palacesJson: string): Response {
  return jsonResponse({
    model: 'deepseek-v4-flash',
    choices: [{ message: { content: palacesJson }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  })
}

type FetchStub = (url: string, init: RequestInit | undefined) => Response

function setFetch(stub: FetchStub) {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    stub(String(input), init),
  ) as unknown as typeof fetch
}

function loggedProviders(): string[] {
  return mockLogAiUsage.mock.calls.map((call) => call[0].provider)
}

async function palaceNames(response: Response): Promise<string[]> {
  const body = (await response.json()) as { palaces: { ten: string }[] }
  return body.palaces.map((palace) => palace.ten)
}

describe('POST /api/tu-vi/palaces', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockRpc.mockResolvedValue({ data: true, error: null })
    process.env.GEMINI_API_KEY = 'test-gemini-key'
    process.env.DEEPSEEK_API_KEY = 'test-key'
    // A distinct prompt per batch, so a provider stub can answer them differently.
    vi.mocked(buildPalacePrompt).mockImplementation(
      (_reading, _lang, indexes: readonly number[] = []) => `prompt-${indexes.join('-')}`,
    )
    // Pass-through: the completion text IS the palace map, which keeps these tests
    // about the provider wiring rather than about the parser's own rules.
    vi.mocked(parsePalaceReadings).mockImplementation(
      (raw) => (raw ?? {}) as Record<string, PalaceReading>,
    )
    vi.mocked(palaceReadingsToList).mockImplementation((palaces) =>
      Object.keys(palaces).map((ten) => ({ ten, sao: [], tongQuan: '' })),
    )
    // Failing fetch lets the claim/free-mode logic (and each batch's own
    // failure/refund path) run to completion without faking a real generation.
    setFetch(() => {
      throw new Error('network down in test')
    })
  })

  it('does not claim a daily generation slot when AI Free Mode is on', async () => {
    mockIsAIFreeModeEnabled.mockResolvedValue(true)

    await POST(makeRequest())

    expect(mockRpc).not.toHaveBeenCalledWith('claim_tuvi_generation', expect.anything())
  })

  it('still claims a daily generation slot as usual when AI Free Mode is off', async () => {
    mockIsAIFreeModeEnabled.mockResolvedValue(false)

    await POST(makeRequest())

    expect(mockRpc).toHaveBeenCalledWith('claim_tuvi_generation', { p_lunar_day: 'lunarday-1:palaces' })
  })

  it('is unavailable only when neither provider key is configured', async () => {
    delete process.env.GEMINI_API_KEY
    delete process.env.DEEPSEEK_API_KEY

    const response = await POST(makeRequest())

    expect(response.status).toBe(503)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('falls back to DeepSeek for a batch whose Gemini attempt returns 5xx', async () => {
    setFetch((url, init) => {
      if (isGemini(url)) return jsonResponse({ error: 'overloaded' }, 500)
      if (isBatch(init, BATCH_A)) return deepseekOk('{"tu-vi":{}}')
      return deepseekOk('{"phuc-duc":{}}')
    })

    const response = await POST(makeRequest())

    expect(response.status).toBe(200)
    expect((await palaceNames(response)).sort()).toEqual(['phuc-duc', 'tu-vi'])
    expect(loggedProviders()).toEqual(['deepseek', 'deepseek'])
  })

  it('serves one batch from Gemini and the 5xx batch from DeepSeek', async () => {
    setFetch((url, init) => {
      if (isGemini(url)) {
        return isBatch(init, BATCH_A)
          ? jsonResponse({ error: 'overloaded' }, 500)
          : geminiOk('{"phuc-duc":{}}')
      }
      return deepseekOk('{"tu-vi":{}}')
    })

    const response = await POST(makeRequest())

    expect(response.status).toBe(200)
    expect((await palaceNames(response)).sort()).toEqual(['phuc-duc', 'tu-vi'])
    expect(loggedProviders().sort()).toEqual(['deepseek', 'gemini'])
  })

  it('returns the surviving batch when the other fails at both providers', async () => {
    setFetch((url, init) => {
      if (isBatch(init, BATCH_A)) return jsonResponse({ error: 'overloaded' }, 500)
      if (isGemini(url)) return geminiOk('{"phuc-duc":{}}')
      return deepseekOk('{"phuc-duc":{}}')
    })

    const response = await POST(makeRequest())

    expect(response.status).toBe(200)
    expect(await palaceNames(response)).toEqual(['phuc-duc'])
    // The dead batch was never billed, so nothing is recorded for it — and the slot
    // still stands, because the other batch did produce a billed completion.
    expect(loggedProviders()).toEqual(['gemini'])
    expect(mockServiceRpc).not.toHaveBeenCalled()
  })

  it('spends exactly one daily slot when Gemini serves both batches', async () => {
    setFetch((url, init) =>
      isBatch(init, BATCH_A) ? geminiOk('{"tu-vi":{}}') : geminiOk('{"phuc-duc":{}}'),
    )

    await POST(makeRequest())

    // One claim for the two batches — the fuse is per generation, not per provider call.
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('claim_tuvi_generation', { p_lunar_day: 'lunarday-1:palaces' })
    // Spent, not returned: no refund_tuvi_generation through the service role.
    expect(mockServiceRpc).not.toHaveBeenCalled()
  })

  it('spends exactly one daily slot when DeepSeek serves both batches', async () => {
    setFetch((url, init) => {
      if (isGemini(url)) return jsonResponse({ error: 'overloaded' }, 500)
      return isBatch(init, BATCH_A) ? deepseekOk('{"tu-vi":{}}') : deepseekOk('{"phuc-duc":{}}')
    })

    await POST(makeRequest())

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('claim_tuvi_generation', { p_lunar_day: 'lunarday-1:palaces' })
    expect(mockServiceRpc).not.toHaveBeenCalled()
  })
})

describe('DeepSeek fallback timeout budget', () => {
  it('waits longer than a genuinely long batch takes to produce', async () => {
    // The REAL export, not this file's module-level mock of '@/lib/horoscope-interpretation'.
    const { MEASURED_TOKENS_PER_SECOND } = await vi.importActual<
      typeof import('@/lib/horoscope-interpretation')
    >('@/lib/horoscope-interpretation')
    const worstCaseMs = (PALACE_MAX_TOKENS / MEASURED_TOKENS_PER_SECOND) * 1000
    expect(PALACE_FALLBACK_TIMEOUT_MS).toBeGreaterThan(worstCaseMs)
  })
})
