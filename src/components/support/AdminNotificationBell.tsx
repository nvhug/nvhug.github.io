'use client'

// Admin notification bell (spec 014 WP-6) — the in-app signal the admin inbox never
// had: today only the *initial* escalation pages Teams (notifyEscalation in
// app/api/support/conversations/[id]/messages/route.ts); a user message landing in a
// conversation that is already `waiting_admin` tells nobody. This bell closes that gap
// without any Realtime or new schema — it just polls the derived-unread endpoint.
//
// Rendered from AdminLayout's AdminTopBar so it is visible on every admin page, not
// just the support inbox itself.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLanguage } from '@/lib/i18n/language-context'
import { useUserRole } from '@/lib/useUserRole'
import type { AdminNotification } from '@/lib/support/service'
import type { Priority } from '@/lib/support/types'
import { relativeTimeFrom } from '../../../app/admin/settings/support/_lib/format'

const POLL_INTERVAL_MS = 60_000

const PRIORITY_DOT_CLASS: Record<Priority, string> = {
  urgent: 'bg-rose-500',
  high: 'bg-amber-500',
  normal: 'bg-zinc-300',
  low: 'bg-zinc-200',
}

export function AdminNotificationBell() {
  const { t } = useLanguage()
  const { role } = useUserRole()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState(false)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/support/notifications')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { notifications: AdminNotification[]; total: number }
      if (!mountedRef.current) return
      setNotifications(data.notifications)
      setTotal(data.total)
      setError(false)
    } catch (err) {
      console.error('[admin-notifications] load failed:', err)
      if (mountedRef.current) setError(true)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Poll every 60s, but only while this tab is visible — no point spending a request
  // (and the round trip through the service role) on a page nobody is looking at, and
  // a background tab must never be the reason many admin tabs hammer the endpoint.
  useEffect(() => {
    if (role !== 'admin') return
    void load()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [role, load])

  function relativeLabel(iso: string): string {
    const r = relativeTimeFrom(iso, new Date())
    if (r.unit === 'justNow') return t('support.admin.time.justNow')
    return t(`support.admin.time.${r.unit}Ago`, { count: String(r.count) })
  }

  function handleSelect(id: string) {
    setOpen(false)
    router.push(`/admin/settings/support?conversationId=${id}`)
  }

  if (role !== 'admin') return null

  const badgeCount = total > 9 ? '9+' : String(total)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={t('support.admin.notifications.buttonLabel')}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-white text-zinc-600 transition-colors hover:bg-emerald-50 hover:text-zinc-900 sm:h-7 sm:w-7"
      >
        <Bell className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        {total > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-semibold text-white ring-2 ring-white">
            {badgeCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 border border-emerald-100 bg-white p-0 text-zinc-900">
        <p className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">
          {t('support.admin.notifications.title')}
        </p>
        {error ? (
          <p className="px-3 py-6 text-center text-xs text-zinc-400">{t('support.admin.notifications.loadError')}</p>
        ) : notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-zinc-400">{t('support.admin.notifications.empty')}</p>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => handleSelect(n.id)}
              className="flex flex-col items-stretch gap-0.5 rounded-md px-3 py-2"
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT_CLASS[n.priority]}`} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-900">{n.userEmail || '—'}</span>
                <span className="shrink-0 text-[11px] text-zinc-400">{relativeLabel(n.lastMessageAt)}</span>
              </div>
              <p className="truncate text-xs text-zinc-500">{n.preview || t('support.admin.notifications.noPreview')}</p>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
