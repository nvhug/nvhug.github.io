'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')
  const isLogin = pathname === '/login'
  const hideSiteChrome = isAdmin || isLogin

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/notes', label: 'Notes' },
    { href: '/quotes', label: 'Quotes' },
    { href: '/about', label: 'About' },
    { href: '/admin', label: 'Admin' },
  ]

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <>
      {!hideSiteChrome && (
        <header className="fixed inset-x-0 top-0 z-50 border-b border-emerald-100/80 bg-white/88 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="hidden font-poppins text-xl font-semibold tracking-tight text-zinc-900 sm:block">
              nvhug
            </Link>

            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'text-zinc-600 hover:bg-emerald-50 hover:text-zinc-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <button
                type="button"
                onClick={handleLogout}
                className="ml-1 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-50 hover:text-zinc-900"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </header>
      )}
      {children}
      {!hideSiteChrome && (
        <div className="border-t border-emerald-100 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <Link href="/" className="font-poppins text-xl font-semibold text-zinc-900">
                nvhug
              </Link>
              <div className="flex flex-wrap gap-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-emerald-50 hover:text-zinc-900"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <p className="text-xs text-zinc-500">© 2026 nvhug. Writing about code, ideas, and everyday learning.</p>
          </div>
        </div>
      )}
    </>
  )
}
