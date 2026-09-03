import { describe, expect, it } from 'vitest'
import { canPostBePublic, clamp } from './utils'

describe('canPostBePublic', () => {
  it('forbids a seeded starter copy from going public', () => {
    expect(canPostBePublic({ is_seeded_copy: true })).toBe(false)
  })

  it('allows an account\'s own post to go public', () => {
    expect(canPostBePublic({ is_seeded_copy: false })).toBe(true)
  })

  it('treats a missing flag as not seeded', () => {
    expect(canPostBePublic({ is_seeded_copy: undefined })).toBe(true)
  })
})

describe('clamp', () => {
  it('returns the value when it is already in range', () => {
    expect(clamp(5, 1, 10)).toBe(5)
  })

  it('pulls a value back to the nearest bound', () => {
    expect(clamp(-4, 1, 10)).toBe(1)
    expect(clamp(40, 1, 10)).toBe(10)
  })

  it('keeps the bounds themselves', () => {
    expect(clamp(1, 1, 10)).toBe(1)
    expect(clamp(10, 1, 10)).toBe(10)
  })
})
