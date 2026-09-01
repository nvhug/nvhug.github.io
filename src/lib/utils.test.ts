import { describe, expect, it } from 'vitest'
import { canPostBePublic } from './utils'

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
