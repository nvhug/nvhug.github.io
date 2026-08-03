import { describe, expect, it } from 'vitest'

import { isHealthTagAlias, normalizeHealthTagName } from './healthTags'

describe('healthTags helpers', () => {
  it('normalizes Vietnamese diacritics and casing', () => {
    expect(normalizeHealthTagName('  Sức Khỏe  ')).toBe('suc khoe')
  })

  it('matches known aliases', () => {
    expect(isHealthTagAlias('Sức Khỏe')).toBe(true)
    expect(isHealthTagAlias('health')).toBe(true)
    expect(isHealthTagAlias('SUC-KHOE')).toBe(true)
  })

  it('rejects non health tags', () => {
    expect(isHealthTagAlias('Tài Chính')).toBe(false)
  })
})
