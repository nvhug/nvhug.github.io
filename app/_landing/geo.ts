// Marketing-only decision — which visitors see the landing page's product pitch
// at `/` versus getting sent to /login. Kept out of src/lib/permissions.ts: it is
// not an RBAC rule, just a one-page geo target that would otherwise force every
// future market to edit the shared permissions module.
const HOME_COUNTRY = 'VN'

export function shouldRedirectRootForCountry(pathname: string, country: string | null): boolean {
  const code = country?.split(',')[0]?.trim().toUpperCase() ?? ''
  return pathname === '/' && code !== '' && code !== HOME_COUNTRY
}
