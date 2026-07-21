'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Settings, User as UserIcon } from 'lucide-react'
import { Toaster } from 'sonner'
import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/lib/i18n/language-context'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import type { User } from '@supabase/supabase-js'

const AVATAR_COLORS = [
  'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-lime-600',
  'bg-emerald-500', 'bg-teal-500', 'bg-cyan-600', 'bg-blue-500',
  'bg-violet-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500',
]

function avatarColor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function avatarLetter(user: User) {
  const name = user.user_metadata?.full_name as string | undefined
  if (name?.trim()) return name.trim()[0].toUpperCase()
  return (user.email ?? '?')[0].toUpperCase()
}

function avatarLabel(user: User) {
  const name = user.user_metadata?.full_name as string | undefined
  return name?.trim() || user.email || ''
}

function AccountMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { t } = useLanguage()
  const letter = avatarLetter(user)
  const color = avatarColor(user.email ?? user.id)
  const label = avatarLabel(user)

  return (
    <div className="group relative ml-2">
      {/* Avatar trigger */}
      <button
        type="button"
        className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-sm font-semibold text-white select-none ring-2 ring-transparent transition-all group-hover:ring-white group-hover:ring-offset-1 ${color}`}
        aria-label={t('header.accountLabel')}
      >
        {letter}
      </button>

      {/* Dropdown — visible on group hover, with pointer-events gap bridged by pt-2 */}
      <div className="invisible absolute right-0 top-full z-50 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100">
        <div className="w-52 overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-lg shadow-zinc-200/60">

          {/* User info */}
          <div className="border-b border-zinc-100 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${color}`}>
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
            <Link
              href="/admin"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              <Settings className="h-4 w-4 shrink-0 text-zinc-400" />
              {t('header.admin')}
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              <UserIcon className="h-4 w-4 shrink-0 text-zinc-400" />
              {t('header.profile')}
            </Link>

            <div className="my-1 h-px bg-zinc-100" />

            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {t('header.logout')}
            </button>
          </div>

        </div>
      </div>
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
    { href: '/', label: t('header.navHome') },
    { href: '/notes', label: t('header.navNotes') },
    { href: '/quotes', label: t('header.navQuotes') },
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

              <div className="ml-1">
                <LanguageSwitch />
              </div>

              {user ? (
                <AccountMenu user={user} onLogout={handleLogout} />
              ) : (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="ml-1 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-emerald-50 hover:text-zinc-900"
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
