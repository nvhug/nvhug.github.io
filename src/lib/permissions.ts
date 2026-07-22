export const APP_ROLES = ['admin', 'paid', 'user'] as const
export type AppRole = (typeof APP_ROLES)[number]

// Single source of truth for which route prefixes are gated by role.
// Keep in sync with the seed rows in sql/phase4_roles_permissions.sql.
export const PROTECTED_PAGES = [
  { key: '/admin' },
  { key: '/admin/settings' },
  { key: '/notes' },
  { key: '/quotes' },
] as const

export function matchProtectedPage(pathname: string) {
  return [...PROTECTED_PAGES]
    .sort((a, b) => b.key.length - a.key.length)
    .find((page) => pathname === page.key || pathname.startsWith(page.key + '/'))
}

// Sub-features gated the same way as pages (role -> allowed, in page_permissions)
// but not tied to a route — checked from inside a component/API route instead
// of proxy.ts. Key format uses dots (not a leading '/') to stay unambiguous
// next to the route-based PROTECTED_PAGES keys above.
export const EXTRA_FEATURES = [
  { key: 'notes.ai_analysis' },
] as const
