'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Trash2, Users } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/lib/i18n/language-context'
import { getIntlLocale } from '@/lib/i18n/locale'
import { APP_ROLES, type AppRole } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import type { UserProfile } from '@/types'

const PAGE_SIZE = 10

const ROLE_STYLE: Record<AppRole, { badge: string; dot: string }> = {
  admin: { badge: 'bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-800 border border-emerald-300 shadow-[0_2px_4px_rgba(16,185,129,0.15)]', dot: 'bg-emerald-500' },
  paid:  { badge: 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-800 border border-amber-300 shadow-[0_2px_4px_rgba(245,158,11,0.15)]', dot: 'bg-amber-400' },
  user:  { badge: 'bg-slate-100 text-slate-600 border border-slate-200', dot: 'bg-slate-400' },
}

function RoleDropdown({
  profile, isSelf, busy, roleLabels, onChange,
}: {
  profile: UserProfile
  isSelf: boolean
  busy: boolean
  roleLabels: Record<AppRole, string>
  onChange: (role: AppRole) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const role = profile.role as AppRole
  const style = ROLE_STYLE[role] ?? ROLE_STYLE.user
  const disabled = isSelf || busy

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all hover:-translate-y-px hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 ${style.badge} ${open ? 'ring-2 ring-emerald-400/30' : ''}`}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
        {roleLabels[role] ?? role}
        <ChevronDown className={`h-3 w-3 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 top-[calc(100%+5px)] z-50 min-w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.04)] animate-in fade-in slide-in-from-top-1 duration-100">
          {APP_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => { onChange(r); setOpen(false) }}
              className={`flex w-full items-center gap-2 border-b border-slate-50 px-3 py-2 text-left text-xs last:border-0 transition-colors hover:bg-slate-50 ${r === role ? 'font-semibold text-slate-800' : 'font-medium text-slate-500'}`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ROLE_STYLE[r].dot}`} />
              {roleLabels[r] ?? r}
              {r === role && <Check className="ml-auto h-3 w-3 text-emerald-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null

  const pages: (number | '…')[] = []
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(total - 1, page + 1); i++) pages.push(i)
    if (page < total - 2) pages.push('…')
    pages.push(total)
  }

  const btn = 'flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex items-center gap-1">
      <button type="button" disabled={page === 1} onClick={() => onChange(page - 1)} className={`${btn} border-zinc-200 text-zinc-500 hover:border-emerald-300 hover:text-emerald-600`}>
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="flex h-7 w-7 items-center justify-center text-xs text-zinc-400">…</span>
        ) : (
          <button key={p} type="button" onClick={() => onChange(p as number)} className={`${btn} ${p === page ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-zinc-200 text-zinc-600 hover:border-emerald-300 hover:text-emerald-600'}`}>
            {p}
          </button>
        )
      )}
      <button type="button" disabled={page === total} onClick={() => onChange(page + 1)} className={`${btn} border-zinc-200 text-zinc-500 hover:border-emerald-300 hover:text-emerald-600`}>
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export default function AdminUsersPage() {
  const { t, lang } = useLanguage()
  const pathname = usePathname()
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, avatar_url, role, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching user profiles:', error)
      } else {
        setProfiles((data ?? []) as UserProfile[])
      }
      setLoading(false)
    }
    void load()
  }, [])

  async function changeRole(profile: UserProfile, role: AppRole) {
    if (role === profile.role) return
    setBusyId(profile.id)
    try {
      const { error } = await getSupabaseBrowserClient()
        .from('user_profiles')
        .update({ role })
        .eq('id', profile.id)
      if (error) throw error
      setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, role } : p)))
      toast.success(t('admin.settings.users.updateSuccess'))
    } catch (err) {
      console.error('Error updating role:', err)
      toast.error(t('admin.settings.users.updateError'))
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      setProfiles((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      toast.success(t('admin.settings.users.deleteSuccess'))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting user:', err)
      toast.error(t('admin.settings.users.deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  const roleLabels: Record<AppRole, string> = {
    admin: t('admin.settings.users.roleAdmin'),
    paid:  t('admin.settings.users.rolePaid'),
    user:  t('admin.settings.users.roleUser'),
  }

  const totalPages = Math.max(1, Math.ceil(profiles.length / PAGE_SIZE))
  const paged = profiles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
    <div className="space-y-4">
      {/* Scrolls itself rather than the page: four Vietnamese labels overflow a 375px
          content box, and a body that scrolls sideways is the one thing this page's
          responsive rule forbids. */}
      <div className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-1 sm:mx-0 sm:inline-flex">
        <Link
          href="/admin/settings"
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            pathname === '/admin/settings'
              ? 'bg-emerald-500 text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          {t('admin.settings.usersTab')}
        </Link>
        <Link
          href="/admin/settings/pages"
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            pathname === '/admin/settings/pages'
              ? 'bg-emerald-500 text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          {t('admin.settings.pagesTab')}
        </Link>
        <Link
          href="/admin/settings/nutrition-qa"
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            pathname === '/admin/settings/nutrition-qa'
              ? 'bg-emerald-500 text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          {t('admin.settings.nutritionTab')}
        </Link>
        <Link
          href="/admin/settings/ai-usage"
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            pathname === '/admin/settings/ai-usage'
              ? 'bg-emerald-500 text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          {t('admin.settings.aiUsage.tab')}
        </Link>
      </div>

      {/* Compact header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-poppins text-base font-semibold leading-tight text-zinc-900">{t('admin.settings.usersTab')}</h2>
            <p className="text-xs text-zinc-400">{t('admin.settings.subtitle')}</p>
          </div>
        </div>
        {!loading && profiles.length > 0 && (
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            {profiles.length}
          </span>
        )}
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-400">{t('common.loading')}</div>
        ) : profiles.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">{t('admin.settings.users.empty')}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <th className="px-4 py-2.5">{t('admin.settings.users.colUser')}</th>
                    <th className="px-4 py-2.5">{t('admin.settings.users.colRole')}</th>
                    <th className="hidden px-4 py-2.5 md:table-cell">{t('admin.settings.users.colJoined')}</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {paged.map((profile) => {
                    const letter = (profile.full_name?.trim()[0] ?? profile.email?.[0] ?? '?').toUpperCase()
                    const isSelf = profile.id === currentUserId
                    return (
                      <tr key={profile.id} className="border-b border-zinc-50 last:border-0 transition-colors hover:bg-zinc-50/60">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-white">
                              {letter}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium text-zinc-900">{profile.full_name || profile.email}</p>
                              {profile.full_name && profile.email && (
                                <p className="truncate text-xs text-zinc-400">{profile.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <RoleDropdown
                            profile={profile}
                            isSelf={isSelf}
                            busy={busyId === profile.id}
                            roleLabels={roleLabels}
                            onChange={(role) => changeRole(profile, role)}
                          />
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-2.5 text-xs text-zinc-400 md:table-cell">
                          {new Intl.DateTimeFormat(getIntlLocale(lang), {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }).format(new Date(profile.created_at))}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={isSelf || busyId === profile.id}
                            onClick={() => setDeleteTarget(profile)}
                            title={t('admin.settings.users.deleteTitle')}
                            className="text-rose-300 hover:bg-rose-500/15"
                          >
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2.5">
                <p className="text-xs text-zinc-400">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, profiles.length)} / {profiles.length}
                </p>
                <Pagination page={page} total={totalPages} onChange={(p) => setPage(p)} />
              </div>
            )}
          </>
        )}
      </div>
    </div>

    <ConfirmModal
      open={!!deleteTarget}
      itemContent={deleteTarget?.full_name || deleteTarget?.email || undefined}
      loading={deleting}
      onConfirm={() => void confirmDelete()}
      onCancel={() => setDeleteTarget(null)}
    />
    </>
  )
}
