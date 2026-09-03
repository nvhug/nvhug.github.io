export const APP_ROLES = ['admin', 'paid', 'user'] as const
export type AppRole = (typeof APP_ROLES)[number]

type ProtectedPage = { key: string; exact?: boolean }

// Single source of truth for which route prefixes are gated by role.
// Keep in sync with the seed rows in sql/03.page_permissions.sql
// (sql/30.games.sql for '/games'). A key listed here without a matching
// allowed row sends every user to /403.
//
// Nothing under /blog is listed, deliberately: the post list is the site's
// public blog and serves the admin account's public posts to anyone (ADR-025),
// and /blog/<slug> does its own owner/public check and returns notFound()
// otherwise (ADR-024). A future sub-route under /blog that DOES need gating
// would have to add its own entry.
export const PROTECTED_PAGES: readonly ProtectedPage[] = [
  { key: '/admin' },
  { key: '/admin/settings' },
  { key: '/finance' },
  // One key for the whole games area: the hub, every game's map and every play
  // URL live under it, so a second game needs no new key (spec 013 FR-051).
  { key: '/games' },
  { key: '/notes' },
  { key: '/quotes' },
]

export function matchProtectedPage(pathname: string) {
  return [...PROTECTED_PAGES]
    .sort((a, b) => b.key.length - a.key.length)
    .find((page) => pathname === page.key || (!page.exact && pathname.startsWith(page.key + '/')))
}

// Where a signed-in visitor belongs. Shared by proxy.ts's root redirect and the
// OAuth callback's default destination so the two can never disagree.
export const DASHBOARD_PATH = '/notes'

/**
 * The post-sign-in destination, constrained to a path on this site.
 *
 * `raw` is attacker-controlled and is concatenated onto an origin by every
 * caller, so anything that can end the authority component turns the redirect
 * into an off-site one: `@evil.com` yields `https://site@evil.com`, where the
 * real host is evil.com and `site` is read as userinfo. `//evil.com` and
 * `/\evil.com` are protocol-relative and do the same. Anything that is not a
 * single-slash-rooted path falls back to the dashboard.
 *
 * Shared by the OAuth callback route (`app/api/auth/callback/route.ts`) and
 * the email/password login flow (`app/login/LoginForm.tsx`) — the two paths
 * a signed-in visitor's destination can come from, so a fix here closes both
 * at once instead of only the one it was first written for.
 */
export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/')) return DASHBOARD_PATH
  if (raw.startsWith('//') || raw.startsWith('/\\')) return DASHBOARD_PATH
  return raw
}

// `/` is PUBLIC (it renders the landing page) and deliberately has no
// PROTECTED_PAGES entry and no page_permissions row -- see
// specs/012-public-landing-page/contracts/routing.md. This is the inverse check:
// it fires only when a session EXISTS, to send that visitor to the dashboard
// instead of the product pitch. Exact match, never a prefix: startsWith('/')
// would redirect the entire app.
export function shouldRedirectRootToDashboard(pathname: string, hasSession: boolean): boolean {
  return hasSession && pathname === '/'
}

// Sub-features gated the same way as pages (role -> allowed, in page_permissions)
// but not tied to a route — checked from inside a component/API route instead
// of proxy.ts. Key format uses dots (not a leading '/') to stay unambiguous
// next to the route-based PROTECTED_PAGES keys above.
export const EXTRA_FEATURES = [
  { key: 'notes.ai_analysis' },
] as const
