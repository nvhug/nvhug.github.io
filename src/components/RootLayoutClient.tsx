'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, CircleDollarSign, Coffee, Home, LogIn, LogOut, NotebookPen, Quote, Settings, Sparkles, User as UserIcon, type LucideIcon } from 'lucide-react'
import { Toaster } from 'sonner'
import { useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/lib/i18n/language-context'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { BugReportButton } from '@/components/BugReportButton'
import { DonateModal } from '@/components/DonateModal'
import { getAvatarLetter, getAvatarLabel } from '@/lib/avatar'
import type { User } from '@supabase/supabase-js'

export function AccountMenu({
  user,
  onLogout,
  navItems,
  pathname,
}: {
  user: User
  onLogout: () => void
  navItems: { href: string; label: string; icon: LucideIcon }[]
  pathname: string
}) {
  const { t } = useLanguage()
  const letter = getAvatarLetter(user)
  const label = getAvatarLabel(user)
  const [open, setOpen] = useState(false)
  const [showDonate, setShowDonate] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative ml-1 sm:ml-2">
      {/* Avatar trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 shrink-0 touch-manipulation cursor-pointer items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white select-none ring-2 ring-transparent transition-all hover:ring-white hover:ring-offset-1 active:ring-white active:ring-offset-1 sm:h-8 sm:w-8"
        aria-label={t('header.accountLabel')}
        aria-expanded={open}
      >
        {letter}
      </button>

      {/* Dropdown — toggled by click/tap so it works on touch devices */}
      {open && (
        <div className="absolute right-0 top-full z-50 pt-2">
          <div className="w-52 overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-lg shadow-zinc-200/60">

            {/* User info */}
            <div className="border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white">
                  {letter}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">{label}</p>
                  {user.email && label !== user.email && (
                    <p className="truncate text-xs text-zinc-500">{user.email}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="p-1">
              <div className="px-3 py-2 sm:hidden">
                <LanguageSwitch />
              </div>

              <div className="my-1 h-px bg-zinc-100 sm:hidden" />

              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
              >
                <Settings className="h-4 w-4 shrink-0 text-zinc-400" />
                {t('header.admin')}
              </Link>
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
              >
                <UserIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                {t('header.profile')}
              </Link>
              {/* Tip jar — grants nothing, see ADR-017 */}
              <button
                type="button"
                onClick={() => { setOpen(false); setShowDonate(true) }}
                className="flex w-full items-center gap-2.5 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100"
              >
                <Coffee className="h-4 w-4 shrink-0 text-amber-500" />
                {t('donate.menuLabel')}
              </button>

              <div className="my-1 h-px bg-zinc-100" />

              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onLogout()
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {t('header.logout')}
              </button>
            </div>

          </div>
        </div>
      )}
      <DonateModal open={showDonate} onClose={() => setShowDonate(false)} />
    </div>
  )
}

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage()
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')
  const isLogin = pathname === '/login'
  // `/` is the public landing page and brings its own header and footer. The
  // authenticated chrome must not render there: every link in it needs a session
  // a stranger does not have (FR-013).
  const isLanding = pathname === '/'
  // A single post at /blog/<slug> is reachable by an anonymous visitor when it
  // is public (sql/28), and the global nav's every item is a protected route —
  // clicking one would bounce a stranger straight to /login. The template
  // already renders its own back link (`backHref`), so it does not depend on
  // this chrome for navigation.
  const isBlogPost = pathname.startsWith('/blog/')
  const hideSiteChrome = isAdmin || isLogin || isLanding || isBlogPost

  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    // `user` only ever renders inside the AccountMenu in the header below, and
    // that header is skipped entirely whenever hideSiteChrome is true — most
    // consequentially on `/`, the site's highest-traffic anonymous page, where
    // this would otherwise be a real network round-trip to Supabase Auth for a
    // value nothing on the page can read.
    if (hideSiteChrome) return

    const supabase = getSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => setUser(data.user))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user: User } | null) => {
        setUser(session?.user ?? null)
      }
    )
    return () => subscription.unsubscribe()
  }, [hideSiteChrome])

  const navItems = [
    { href: '/notes', label: t('header.navNotes'), icon: NotebookPen },
    { href: '/blog', label: t('header.navBlog'), icon: BookOpen },
    { href: '/quotes', label: t('header.navQuotes'), icon: Quote },
    { href: '/finance', label: t('header.navFinance'), icon: CircleDollarSign },
    { href: '/tu-vi', label: t('header.navTuVi'), icon: Sparkles },
  ]

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <>
      {!hideSiteChrome && (
        <header className="site-header fixed inset-x-0 top-0 z-50 border-b border-emerald-100/80 bg-white/88 backdrop-blur-md">
          <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                <Link
                  href="/"
                  className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg text-zinc-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-50 active:text-emerald-700 sm:h-auto sm:w-auto sm:rounded-none sm:font-poppins sm:text-xl sm:font-semibold sm:tracking-tight sm:text-zinc-900"
                  aria-label="Home"
                >
                  <Home className="h-5 w-5 sm:hidden" />
                  <span className="hidden sm:inline">Notez</span>
                </Link>

                <div className="flex min-w-0 flex-1 items-stretch sm:hidden">
                  {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-label={item.label}
                        className={`relative flex h-11 min-w-0 flex-1 touch-manipulation items-center justify-center transition-colors ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'text-zinc-500 hover:text-zinc-900 active:bg-emerald-50 active:text-zinc-900'
                        }`}
                      >
                        <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-emerald-600' : 'text-zinc-400'}`} />
                        <span
                          aria-hidden
                          className={`absolute bottom-0 left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-emerald-500 transition-all ${
                            isActive ? 'w-5 opacity-100' : 'w-0 opacity-0'
                          }`}
                        />
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <div className="hidden items-center gap-1 sm:flex">
                  {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`relative px-3 py-2 text-base font-medium transition-colors ${
                          isActive
                            ? 'text-emerald-700'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        {item.label}
                        <span
                          aria-hidden
                          className={`absolute bottom-0 left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-emerald-500 transition-all ${
                            isActive ? 'w-10 opacity-100' : 'w-0 opacity-0'
                          }`}
                        />
                      </Link>
                    )
                  })}
                </div>

                <div className="ml-1 hidden sm:block">
                  <LanguageSwitch />
                </div>

                {user ? (
                  <AccountMenu user={user} onLogout={handleLogout} navItems={navItems} pathname={pathname} />
                ) : (
                  // Sign in, not sign out. The landing page sends strangers to /privacy,
                  // which keeps this chrome — and a Logout control offered to
                  // someone who has never had a session is nonsense to them and, worse,
                  // hits /api/logout for nothing.
                  <Link
                    href="/login"
                    className="ml-1 flex h-11 w-11 touch-manipulation items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-emerald-50 hover:text-zinc-900 active:bg-emerald-50 active:text-zinc-900 sm:h-auto sm:w-auto sm:p-1.5"
                    aria-label={t('header.login')}
                  >
                    <LogIn className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>
      )}
      {children}
      <Toaster position="top-right" richColors />
      {/* Not on the landing page: a stranger who has never used the app should not
          be invited to report a bug in it. */}
      {!isLanding && <BugReportButton />}
      {!hideSiteChrome && (
        <div className="border-t border-emerald-100 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <Link href="/" className="font-poppins text-xl font-semibold text-zinc-900">
                Notez
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
            <p className="text-xs text-zinc-500">{t('footer.copyright')}</p>
          </div>
        </div>
      )}
    </>
  )
}
