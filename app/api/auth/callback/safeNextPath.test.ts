import { describe, expect, it } from 'vitest'
import { DASHBOARD_PATH, safeNextPath } from '@/lib/permissions'

describe('safeNextPath', () => {
  it('keeps an ordinary internal destination', () => {
    expect(safeNextPath('/finance')).toBe('/finance')
    expect(safeNextPath('/blog/some-post?tab=1')).toBe('/blog/some-post?tab=1')
  })

  it('falls back to the dashboard when no destination was asked for', () => {
    // '/' is the public landing page now, so a callback with no `next` must not park a
    // freshly signed-in user on the product pitch.
    expect(safeNextPath(null)).toBe(DASHBOARD_PATH)
    expect(safeNextPath('')).toBe(DASHBOARD_PATH)
  })

  it('refuses a destination that leaves this site', () => {
    // The value is concatenated onto `origin`, so anything that can terminate the
    // authority component redirects off-site: '@evil.com' makes the real host evil.com
    // and reads the site's own domain as userinfo.
    expect(safeNextPath('@evil.com')).toBe(DASHBOARD_PATH)
    expect(safeNextPath('https://evil.com')).toBe(DASHBOARD_PATH)
    expect(safeNextPath('//evil.com')).toBe(DASHBOARD_PATH)
    // Built from a char code rather than written as an escape: a lone backslash in a
    // JS string literal is silently dropped, which would make this assertion test
    // the harmless path '/evil.com' instead of the protocol-relative one.
    const backslash = String.fromCharCode(92)
    expect(safeNextPath(`/${backslash}evil.com`)).toBe(DASHBOARD_PATH)
    expect(safeNextPath('javascript:alert(1)')).toBe(DASHBOARD_PATH)
  })
})
