import { describe, expect, it } from 'vitest'
import { parseLevelKey } from './level-key'

describe('parseLevelKey', () => {
  it('accepts the canonical decimal form of a level', () => {
    expect(parseLevelKey('1')).toBe(1)
    expect(parseLevelKey('100')).toBe(100)
    expect(parseLevelKey('1000')).toBe(1000)
  })

  it('rejects padded, fractional, exponent, negative and non-string forms', () => {
    expect(parseLevelKey('07')).toBeNull()
    expect(parseLevelKey('7.5')).toBeNull()
    expect(parseLevelKey('1e2')).toBeNull()
    expect(parseLevelKey('0')).toBeNull()
    expect(parseLevelKey('-3')).toBeNull()
    expect(parseLevelKey('classic')).toBeNull()
    expect(parseLevelKey(undefined)).toBeNull()
    expect(parseLevelKey(['1'])).toBeNull()
  })

  it('applies the upper bound when one is given', () => {
    expect(parseLevelKey('100', 100)).toBe(100)
    expect(parseLevelKey('101', 100)).toBeNull()
  })
})
