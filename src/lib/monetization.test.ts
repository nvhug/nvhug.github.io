import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The switch is read once at module load, so each case reloads the module under a
 * stubbed env. These tests are the guard against the app quietly starting to sell
 * something again — see ADR-017.
 */
async function load(value?: string) {
  vi.resetModules()
  if (value === undefined) vi.stubEnv('NEXT_PUBLIC_MONETIZATION', '')
  else vi.stubEnv('NEXT_PUBLIC_MONETIZATION', value)
  return {
    monetization: await import('./monetization'),
    aiTrial: await import('./ai-trial'),
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('MONETIZATION_ENABLED', () => {
  it('is off when the env var is absent — the shipped default', async () => {
    const { monetization } = await load()
    expect(monetization.MONETIZATION_ENABLED).toBe(false)
  })

  it('is on only for the exact string "on"', async () => {
    expect((await load('on')).monetization.MONETIZATION_ENABLED).toBe(true)
    expect((await load('ON')).monetization.MONETIZATION_ENABLED).toBe(false)
    expect((await load('true')).monetization.MONETIZATION_ENABLED).toBe(false)
    expect((await load('1')).monetization.MONETIZATION_ENABLED).toBe(false)
    expect((await load('off')).monetization.MONETIZATION_ENABLED).toBe(false)
  })
})

describe('quota exhaustion response', () => {
  it('answers 429 with no upgrade wording while monetization is off', async () => {
    const { aiTrial } = await load('off')
    expect(aiTrial.QUOTA_EXHAUSTED_STATUS).toBe(429)

    const vi_ = aiTrial.trialExhaustedBody('food_analyze', 270, 270, 'vi')
    expect(vi_.error).not.toMatch(/nâng cấp|Pro/i)
    const en = aiTrial.trialExhaustedBody('food_analyze', 270, 270, 'en')
    expect(en.error).not.toMatch(/upgrade|pro/i)
  })

  it('answers 402 and offers Pro while monetization is on', async () => {
    const { aiTrial } = await load('on')
    expect(aiTrial.QUOTA_EXHAUSTED_STATUS).toBe(402)
    expect(aiTrial.trialExhaustedBody('food_analyze', 270, 270, 'vi').error).toMatch(/nâng cấp/i)
    expect(aiTrial.trialExhaustedBody('food_analyze', 270, 270, 'en').error).toMatch(/upgrade/i)
  })

  it('keeps the machine-readable shape identical in both modes', async () => {
    const off = (await load('off')).aiTrial.trialExhaustedBody('notes_analyze', 12, 12)
    const on  = (await load('on')).aiTrial.trialExhaustedBody('notes_analyze', 12, 12)
    expect(Object.keys(off).sort()).toEqual(Object.keys(on).sort())
    expect(off.trialExhausted).toBe(true)
    expect(off.feature).toBe('notes_analyze')
    expect(off.used).toBe(12)
    expect(off.limit).toBe(12)
  })
})
