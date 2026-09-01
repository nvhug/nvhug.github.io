import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_PATH,
  matchProtectedPage,
  shouldRedirectRootToDashboard,
} from './permissions'

describe('shouldRedirectRootToDashboard', () => {
  it('sends a signed-in visitor away from the public root', () => {
    expect(shouldRedirectRootToDashboard('/', true)).toBe(true)
  })

  it('lets an anonymous visitor see the root', () => {
    expect(shouldRedirectRootToDashboard('/', false)).toBe(false)
  })

  it('leaves every other path alone, session or not', () => {
    for (const pathname of ['/notes', '/finance', '/blog', '/login', '/about']) {
      expect(shouldRedirectRootToDashboard(pathname, true)).toBe(false)
      expect(shouldRedirectRootToDashboard(pathname, false)).toBe(false)
    }
  })

  it('matches the root exactly, never as a prefix', () => {
    // A `startsWith('/')` here would redirect the whole app to the dashboard.
    for (const pathname of ['/notes', '/n', '//', '/?tab=1']) {
      expect(shouldRedirectRootToDashboard(pathname, true)).toBe(false)
    }
  })

  it('still redirects a signed-in visitor arriving from a marketing link', () => {
    // Next.js gives `pathname` without the query string, so a UTM-tagged share
    // link is still the root and must not park a signed-in user on the pitch.
    expect(shouldRedirectRootToDashboard('/', true)).toBe(true)
  })
})

describe('DASHBOARD_PATH', () => {
  it('is a protected page, so the redirect target is still gated', () => {
    // The root redirect must not become a way to reach an ungated dashboard.
    expect(matchProtectedPage(DASHBOARD_PATH)).toBeDefined()
  })
})

describe('matchProtectedPage', () => {
  it('does not gate the post list at /blog', () => {
    // The list is the site's public blog: an anonymous visitor is served the
    // admin account's public posts, so a gate here would redirect them to
    // /login and there would be nothing public left to read (ADR-025).
    expect(matchProtectedPage('/blog')).toBeUndefined()
  })

  it('does not gate an individual post at /blog/<slug>', () => {
    // A public post is readable by the whole internet, and the page does its own
    // owner/public check instead of relying on this gate.
    expect(matchProtectedPage('/blog/my-post')).toBeUndefined()
  })

  it('does not gate anything deeper under /blog either', () => {
    // Nothing in the /blog tree is in PROTECTED_PAGES any more, so a future
    // sub-route that DOES need gating would need its own entry.
    expect(matchProtectedPage('/blog/a/b')).toBeUndefined()
  })

  it('does not match a path that merely starts with the same characters', () => {
    // Held while '/blog' was still gated too — matching appends '/' rather than
    // comparing raw prefixes, so '/blogger' was never '/blog'.
    expect(matchProtectedPage('/blogger')).toBeUndefined()
  })

  it('keeps prefix matching intact for every other protected key', () => {
    for (const pathname of ['/admin/create', '/admin/settings/pages', '/notes/anything', '/finance/x', '/quotes/x']) {
      expect(matchProtectedPage(pathname)).toBeDefined()
    }
  })

  it('resolves a nested admin path to the longest matching key', () => {
    // Sorting by key length is what stops '/admin' from swallowing a path that
    // '/admin/settings' owns — the two keys have different page_permissions rows.
    expect(matchProtectedPage('/admin/settings/pages')?.key).toBe('/admin/settings')
  })
})

describe('the public root', () => {
  // Regression guard, not a TDD cycle: this passes today and must keep passing.
  // Adding `{ key: '/' }` to PROTECTED_PAGES would gate the landing page behind a
  // session and a page_permissions row, which is exactly what FR-002 forbids —
  // and because matchProtectedPage also matches by prefix, it would gate the
  // entire app. See specs/012-public-landing-page/contracts/routing.md invariant 3.
  it('is never a protected page', () => {
    expect(matchProtectedPage('/')).toBeUndefined()
  })
})
