'use client'

// Admin support inbox (spec 014, WP-5, FR-060..068/070..072).
//
// FR-060: this route rides the existing /admin/settings role gate in proxy.ts —
// no new PROTECTED_PAGES entry, no page_permissions row. The role check below is
// therefore defence-in-depth only (a non-admin should never reach this page at
// all), not the actual gate.
//
// There is no dedicated "list admins" API route (out of scope for this work
// package — app/api/** is owned elsewhere). Admin display names for the assignee
// picker and the metrics/list header are resolved with a direct browser read of
// `user_profiles`, the same pattern app/admin/settings/page.tsx and
// app/admin/settings/ai-usage/page.tsx already use for the identical purpose.

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { LifeBuoy } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/lib/i18n/language-context'
import { useUserRole } from '@/lib/useUserRole'
import type { UserProfile } from '@/types'
import type { Conversation, SupportMetrics } from '@/lib/support/types'
import type { AdminConversationSummary, SupportInboxCounts } from '@/lib/support/service'
import { MetricsHeader } from './_components/MetricsHeader'
import { InboxList } from './_components/InboxList'
import { InboxThread } from './_components/InboxThread'

const EMPTY_COUNTS: SupportInboxCounts = { waitingAdmin: 0, urgent: 0, unassigned: 0 }

function SupportInboxContent() {
  const { t } = useLanguage()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { role, loading: roleLoading } = useUserRole()

  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null)
  const [admins, setAdmins] = useState<UserProfile[]>([])

  const [metrics, setMetrics] = useState<SupportMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState(false)

  const [counts, setCounts] = useState<SupportInboxCounts>(EMPTY_COUNTS)
  const [selected, setSelected] = useState<AdminConversationSummary | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true)
    try {
      const res = await fetch('/api/admin/support/metrics')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { metrics: SupportMetrics }
      setMetrics(data.metrics)
      setMetricsError(false)
    } catch (err) {
      console.error('[support-inbox] metrics load failed:', err)
      setMetricsError(true)
    } finally {
      setMetricsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (roleLoading || role !== 'admin') return
    void loadMetrics()
  }, [roleLoading, role, loadMetrics])

  useEffect(() => {
    if (roleLoading || role !== 'admin') return
    void (async () => {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setCurrentAdminId(user?.id ?? null)

      const { data, error } = await supabase.from('user_profiles').select('id, email, full_name, avatar_url, role, created_at').eq('role', 'admin')
      if (error) {
        console.error('[support-inbox] admin list load failed:', error)
        return
      }
      setAdmins((data ?? []) as UserProfile[])
    })()
  }, [roleLoading, role])

  // Deep link from the admin notification bell (AdminNotificationBell), which can only
  // pass a conversation id via the URL — it lives in the global admin chrome, outside
  // this page's own state. Resolve it into the same AdminConversationSummary shape a
  // list click produces (email + preview) and consume the param so a refresh doesn't
  // re-trigger it.
  useEffect(() => {
    if (roleLoading || role !== 'admin') return
    const conversationId = searchParams.get('conversationId')
    if (!conversationId) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/admin/support/conversations/${conversationId}`)
        if (!res.ok) return
        const data = (await res.json()) as { conversation: Conversation }
        if (cancelled) return
        const supabase = getSupabaseBrowserClient()
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('id', data.conversation.userId)
          .maybeSingle()
        if (cancelled) return
        setSelected({ ...data.conversation, userEmail: profile?.email ?? null, lastMessagePreview: null })
      } catch (err) {
        console.error('[support-inbox] deep link load failed:', err)
      } finally {
        if (!cancelled) router.replace(pathname)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, role, searchParams])

  function handleSelect(row: AdminConversationSummary) {
    setSelected(row)
  }

  function handleChanged() {
    setRefreshToken((n) => n + 1)
    void loadMetrics()
  }

  if (roleLoading) {
    return <div className="rounded-xl border border-zinc-100 bg-white p-6 text-sm text-zinc-400">{t('common.loading')}</div>
  }

  if (role !== 'admin') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-800">{t('admin.settings.aiUsage.nonAdminTitle')}</p>
        <p className="mt-1 text-sm text-amber-700">{t('admin.settings.aiUsage.nonAdminHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-1 sm:mx-0 sm:inline-flex">
        {[
          ['/admin/settings', t('admin.settings.usersTab')],
          ['/admin/settings/pages', t('admin.settings.pagesTab')],
          ['/admin/settings/nutrition-qa', t('admin.settings.nutritionTab')],
          ['/admin/settings/ai-usage', t('admin.settings.aiUsage.tab')],
          ['/admin/settings/support', t('support.admin.pageTitle')],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              pathname === href ? 'bg-emerald-500 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]">
          <LifeBuoy className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="font-poppins text-base font-semibold leading-tight text-zinc-900">{t('support.admin.pageTitle')}</h2>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            {t('support.admin.metrics.waiting')}: {counts.waitingAdmin}
          </span>
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600">
            {t('support.admin.metrics.urgent')}: {counts.urgent}
          </span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
            {t('support.admin.assignmentOptions.unassigned')}: {counts.unassigned}
          </span>
        </div>
      </div>

      <MetricsHeader metrics={metrics} loading={metricsLoading} error={metricsError} onRetry={() => void loadMetrics()} />

      <div className="h-[calc(100svh-20rem)] min-h-105 overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm">
        <div className="flex h-full">
          {/* Display (hidden/flex) is owned by these outer wrappers only, so it never
              competes with the base `flex` each component's own root already carries
              (two unscoped display utilities on the same element is a specificity tie,
              not a left-to-right override — `hidden md:flex` is only safe because the
              base class and the responsive override are the only two, and never both
              apply to a bare unprefixed state at once). */}
          <div className={`w-full overflow-hidden border-r border-zinc-100 md:flex md:w-96 md:shrink-0 ${selected ? 'hidden' : 'flex'}`}>
            <InboxList
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
              admins={admins}
              currentAdminId={currentAdminId}
              onCounts={setCounts}
              refreshToken={refreshToken}
              className="min-h-0 flex-1"
            />
          </div>
          <div className={`min-w-0 flex-1 md:flex ${selected ? 'flex' : 'hidden'}`}>
            <InboxThread
              conversationId={selected?.id ?? null}
              fallbackSummary={selected}
              admins={admins}
              currentAdminId={currentAdminId}
              onBack={() => setSelected(null)}
              onChanged={handleChanged}
              className="min-h-0 flex-1"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SupportInboxPage() {
  // useSearchParams (the notification bell's ?conversationId deep link) requires a
  // Suspense boundary — same pattern as app/admin/create/page.tsx.
  return (
    <Suspense>
      <SupportInboxContent />
    </Suspense>
  )
}
