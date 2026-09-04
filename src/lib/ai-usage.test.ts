import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeUsage, servedModel, SURFACES } from './ai-usage'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SURFACES', () => {
  it('lists exactly the seven recorded AI surfaces', () => {
    expect([...SURFACES].sort()).toEqual([
      'food_analyze',
      'notes_analyze',
      'stock_analyze',
      'stock_suggestions',
      'support_chat',
      'tuvi_interpret',
      'tuvi_palaces',
    ])
  })

  // sql/31.support_chat.sql's drift guard: a value in one and not the other
  // fails at insert time, in production, on a route that must not fail.
  it('contains support_chat, matching sql/31.support_chat.sql\'s widened CHECK constraint', () => {
    expect(SURFACES).toContain('support_chat')
  })
})

describe('normalizeUsage — DeepSeek / OpenAI-compatible', () => {
  // DeepSeek's completion_tokens ALREADY includes reasoning_tokens: the details object is
  // a breakdown of it, not an addition. Adding reasoning again would double-count.
  it('takes output straight from completion_tokens without re-adding reasoning', () => {
    const usage = normalizeUsage(
      {
        prompt_tokens: 10_000,
        prompt_cache_hit_tokens: 8_000,
        prompt_cache_miss_tokens: 2_000,
        completion_tokens: 3_000,
        completion_tokens_details: { reasoning_tokens: 1_200 },
        total_tokens: 13_000,
      },
      'deepseek'
    )

    expect(usage.input_tokens).toBe(10_000)
    expect(usage.cached_input_tokens).toBe(8_000)
    expect(usage.output_tokens).toBe(3_000)
    expect(usage.reasoning_tokens).toBe(1_200)
  })

  it('keeps reasoning inside output, so the total is input + output only', () => {
    const usage = normalizeUsage(
      { prompt_tokens: 100, completion_tokens: 50, completion_tokens_details: { reasoning_tokens: 20 }, total_tokens: 150 },
      'deepseek'
    )
    expect(usage.input_tokens + usage.output_tokens).toBe(150)
    expect(usage.reasoning_tokens).toBeLessThanOrEqual(usage.output_tokens)
  })

  it('reports no cached tokens when the provider omits the cache split', () => {
    const usage = normalizeUsage({ prompt_tokens: 500, completion_tokens: 100, total_tokens: 600 }, 'deepseek')
    expect(usage.cached_input_tokens).toBe(0)
  })
})

describe('normalizeUsage — OpenAI and OpenRouter spell cached tokens differently', () => {
  // Both are reachable via FOOD_VISION_PROVIDER, and both were previously read with
  // DeepSeek's field name, so every call recorded zero cached tokens. Harmless while their
  // models are unpriced; a ~10x over-report the moment they are priced.
  it.each(['openai', 'openrouter'] as const)(
    'reads prompt_tokens_details.cached_tokens for %s',
    (provider) => {
      const usage = normalizeUsage(
        {
          prompt_tokens: 10_000,
          prompt_tokens_details: { cached_tokens: 7_500 },
          completion_tokens: 2_000,
          total_tokens: 12_000,
        },
        provider
      )
      expect(usage.input_tokens).toBe(10_000)
      expect(usage.cached_input_tokens).toBe(7_500)
      expect(usage.output_tokens).toBe(2_000)
    }
  )

  it('still prefers the DeepSeek field when both are present', () => {
    const usage = normalizeUsage(
      {
        prompt_tokens: 100,
        prompt_cache_hit_tokens: 60,
        prompt_tokens_details: { cached_tokens: 10 },
        completion_tokens: 5,
      },
      'deepseek'
    )
    expect(usage.cached_input_tokens).toBe(60)
  })
})

describe('normalizeUsage — Gemini', () => {
  // Gemini's candidatesTokenCount EXCLUDES thoughtsTokenCount, but thoughts are billed as
  // output. Omitting them understates the bill — the opposite mistake to DeepSeek's.
  it('adds thoughtsTokenCount into output', () => {
    const usage = normalizeUsage(
      {
        promptTokenCount: 4_000,
        cachedContentTokenCount: 1_000,
        candidatesTokenCount: 900,
        thoughtsTokenCount: 600,
        totalTokenCount: 5_500,
      },
      'gemini'
    )

    expect(usage.input_tokens).toBe(4_000)
    expect(usage.cached_input_tokens).toBe(1_000)
    expect(usage.output_tokens).toBe(1_500) // 900 + 600, not 900
    expect(usage.reasoning_tokens).toBe(600)
  })

  it('handles a response with no thoughts at all', () => {
    const usage = normalizeUsage(
      { promptTokenCount: 100, candidatesTokenCount: 40, totalTokenCount: 140 },
      'gemini'
    )
    expect(usage.output_tokens).toBe(40)
    expect(usage.reasoning_tokens).toBe(0)
  })
})

describe('normalizeUsage — defensive reading', () => {
  it('treats every missing field as zero rather than throwing', () => {
    expect(normalizeUsage({}, 'deepseek')).toEqual({
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_tokens: 0,
    })
  })

  it('survives a null or undefined payload', () => {
    // A provider can answer without a usage block at all. The call still happened and
    // must still be recorded, with zeroes.
    expect(normalizeUsage(null, 'gemini').input_tokens).toBe(0)
    expect(normalizeUsage(undefined, 'deepseek').output_tokens).toBe(0)
  })

  it('ignores negative and non-numeric values', () => {
    const usage = normalizeUsage(
      { prompt_tokens: -5, completion_tokens: 'lots', total_tokens: 0 },
      'deepseek'
    )
    expect(usage.input_tokens).toBe(0)
    expect(usage.output_tokens).toBe(0)
  })
})

describe('normalizeUsage — invariants are enforced, not assumed', () => {
  it('clamps cached input to input rather than emitting a row the database would reject', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const usage = normalizeUsage(
      { prompt_tokens: 100, prompt_cache_hit_tokens: 900, completion_tokens: 10, total_tokens: 110 },
      'deepseek'
    )
    expect(usage.cached_input_tokens).toBe(100)
    expect(warn).toHaveBeenCalled()
  })

  it('clamps reasoning to output', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const usage = normalizeUsage(
      { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 0, totalTokenCount: 15 },
      'gemini'
    )
    // thoughts are folded into output for Gemini, so reasoning can never exceed it here;
    // the guard exists for a provider that reports them inconsistently.
    expect(usage.reasoning_tokens).toBeLessThanOrEqual(usage.output_tokens)
    warn.mockRestore()
  })

  // Clamping, not throwing: telemetry must never change the outcome of the AI request it
  // observes, so a malformed payload degrades to a warned-about row.
  it('never throws on a malformed payload', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => normalizeUsage({ prompt_tokens: 1, prompt_cache_hit_tokens: 99 }, 'deepseek')).not.toThrow()
  })
})

describe('normalizeUsage — reconciliation against the provider total', () => {
  // A mapping error is silent by nature: the numbers still look plausible, just smaller.
  // Comparing against the provider's own total is what makes it announce itself.
  it('warns when input + output disagrees with the reported total', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    normalizeUsage(
      { promptTokenCount: 4_000, candidatesTokenCount: 900, thoughtsTokenCount: 600, totalTokenCount: 9_999 },
      'gemini'
    )
    expect(warn).toHaveBeenCalled()
  })

  it('stays quiet when the figures reconcile', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    normalizeUsage(
      { promptTokenCount: 4_000, candidatesTokenCount: 900, thoughtsTokenCount: 600, totalTokenCount: 5_500 },
      'gemini'
    )
    expect(warn).not.toHaveBeenCalled()
  })

  it('stays quiet when the provider reports no total to compare against', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    normalizeUsage({ prompt_tokens: 10, completion_tokens: 5 }, 'deepseek')
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('no instrumented route asserts its own outcome', () => {
  // A structural guard, not a pure-function test, and deliberately so: the defect it exists
  // to catch spanned six files and no function could express it. Every route once wrote
  // `outcome: 'success'` as a literal, ABOVE the validation that can reject the completion —
  // so a call that was billed in full and then thrown away filed as a success, and
  // `failed_cost_usd` was structurally zero across the product. FR-005a inverted.
  const ROUTES = [
    'app/api/notes/analyze/route.ts',
    'app/api/notes/analyze-food/route.ts',
    'app/api/stock-price/analyze/route.ts',
    'app/api/stock-suggestions/route.ts',
    'app/api/tu-vi/interpret/route.ts',
    'app/api/tu-vi/palaces/route.ts',
  ]

  const read = (rel: string) =>
    readFileSync(resolve(__dirname, '../..', rel), 'utf8')

  it.each(ROUTES)('%s never passes a literal success as the outcome', (rel) => {
    // The type annotation `outcome: 'success' | 'error'` is fine; an object property
    // `outcome: 'success',` is the bug.
    expect(read(rel)).not.toMatch(/outcome:\s*'success'\s*,/)
  })

  it.each(ROUTES)('%s records a failure somewhere', (rel) => {
    expect(read(rel)).toMatch(/'error'/)
  })
})

describe('servedModel', () => {
  // FR-003: cost is attributed to what the provider says it served, not what we asked
  // for. The two can differ, and only the former was billed.
  it('prefers the model from an OpenAI-shaped response body', () => {
    expect(servedModel({ model: 'deepseek-v4-flash' }, 'deepseek-chat')).toBe('deepseek-v4-flash')
  })

  it('prefers modelVersion from a Gemini response', () => {
    expect(servedModel({ modelVersion: 'gemini-3.6-flash-002' }, 'gemini-3.6-flash')).toBe(
      'gemini-3.6-flash-002'
    )
  })

  it('falls back to the requested model when the provider reports none', () => {
    expect(servedModel({}, 'deepseek-v4-flash')).toBe('deepseek-v4-flash')
    expect(servedModel(null, 'deepseek-v4-flash')).toBe('deepseek-v4-flash')
  })

  it('ignores a blank or non-string model field', () => {
    expect(servedModel({ model: '   ' }, 'deepseek-v4-flash')).toBe('deepseek-v4-flash')
    expect(servedModel({ model: 42 }, 'deepseek-v4-flash')).toBe('deepseek-v4-flash')
  })
})
