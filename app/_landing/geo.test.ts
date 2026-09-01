import { describe, expect, it } from 'vitest'
import { shouldRedirectRootForCountry } from './geo'

describe('shouldRedirectRootForCountry', () => {
  it('sends a non-Vietnam visitor away from the Vietnamese-only landing page', () => {
    expect(shouldRedirectRootForCountry('/', 'US')).toBe(true)
  })

  it('lets a Vietnam visitor see the root', () => {
    expect(shouldRedirectRootForCountry('/', 'VN')).toBe(false)
  })

  it('does not block when the country header is missing (off-Vercel, e.g. local dev)', () => {
    expect(shouldRedirectRootForCountry('/', null)).toBe(false)
  })

  it('does not block on an empty header — unknown must not read as "not VN"', () => {
    expect(shouldRedirectRootForCountry('/', '')).toBe(false)
  })

  it('matches the country code case-insensitively', () => {
    expect(shouldRedirectRootForCountry('/', 'vn')).toBe(false)
    expect(shouldRedirectRootForCountry('/', 'us')).toBe(true)
  })

  it('reads only the first value of a multi-value header', () => {
    // `Headers.get()` joins repeated headers with ", " — take the first code,
    // the way a browser or proxy would set it.
    expect(shouldRedirectRootForCountry('/', 'VN, VN')).toBe(false)
    expect(shouldRedirectRootForCountry('/', 'US, VN')).toBe(true)
  })

  it('leaves every other path alone regardless of country', () => {
    for (const pathname of ['/notes', '/finance', '/blog', '/login', '/about']) {
      expect(shouldRedirectRootForCountry(pathname, 'US')).toBe(false)
      expect(shouldRedirectRootForCountry(pathname, null)).toBe(false)
    }
  })

  it('matches the root exactly, never as a prefix', () => {
    for (const pathname of ['/notes', '/n', '//', '/?tab=1']) {
      expect(shouldRedirectRootForCountry(pathname, 'US')).toBe(false)
    }
  })
})
