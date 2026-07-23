'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Home, LogOut, Quote, Settings, StickyNote, User as UserIcon, type LucideIcon } from 'lucide-react'
import { Toaster } from 'sonner'
import { useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/lib/i18n/language-context'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { BugReportButton } from '@/components/BugReportButton'
import { getAvatarLetter, getAvatarLabel } from '@/lib/avatar'
import type { User } from '@supabase/supabase-js'

function AccountMenu({
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
    <div ref={containerRef} className="relative ml-2">
      {/* Avatar trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white select-none ring-2 ring-transparent transition-all hover:ring-white hover:ring-offset-1 sm:h-8 sm:w-8"
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

            {/* Nav links — only needed on mobile, since desktop shows them in the header */}
            <div className="border-b border-zinc-100 p-1 font-poppins sm:hidden">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900'
                    }`}
                  >
                    <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-emerald-600' : 'text-zinc-400'}`} />
                    {item.label}
                  </Link>
                )
              })}
            </div>

            {/* Menu items */}
            <div className="p-1">
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
    </div>
  )
}

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage()
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')
  const isLogin = pathname === '/login'
  const hideSiteChrome = isAdmin || isLogin

  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => setUser(data.user))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user: User } | null) => {
        setUser(session?.user ?? null)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const navItems = [
    { href: '/notes', label: t('header.navNotes'), icon: Home },
    { href: '/blog', label: t('header.navBlog'), icon: BookOpen },
    { href: '/quotes', label: t('header.navQuotes'), icon: Quote },
  ]

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <>
      {!hideSiteChrome && (
        <header className="site-header fixed inset-x-0 top-0 z-50 border-b border-emerald-100/80 bg-white/88 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="font-poppins text-xl font-semibold tracking-tight text-zinc-900">
              nvhug
            </Link>

            <div className="flex items-center gap-1">
              <div className="hidden items-center gap-1 sm:flex">
                {navItems.map((item) => {
                  const isActive = pathname.startsWith(item.href)
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
              </div>

              <div className="ml-1">
                <LanguageSwitch />
              </div>

              {user ? (
                <AccountMenu user={user} onLogout={handleLogout} navItems={navItems} pathname={pathname} />
              ) : (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="ml-1 flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-emerald-50 hover:text-zinc-900 sm:h-auto sm:w-auto sm:p-1.5"
                  aria-label={t('header.logout')}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </header>
      )}
      {children}
      <Toaster position="top-right" richColors />
      <BugReportButton />
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
            <p className="text-xs text-zinc-500">{t('footer.copyright')}</p>
          </div>
        </div>
      )}
    </>
  )
}
