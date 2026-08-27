'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Coins, X } from 'lucide-react'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/lib/i18n/language-context'
import { useUserRole } from '@/lib/useUserRole'
import { UsageTiles } from './_components/UsageTiles'
import { UsageTrend } from './_components/UsageTrend'
import { UsageBreakdown, type BreakdownRow } from './_components/UsageBreakdown'
import { LOG_PAGE_SIZE, UsageLog } from './_components/UsageLog'
import { formatTokens } from './_lib/format'
import {
  actorScopeOf,
  EMPTY_SUMMARY,
  PERIODS,
  sameScope,
  totalTokens,
  type ActorScope,
  type LogRow,
  type PeriodDays,
  type Surface,
  type UsageReport,
} from './_lib/types'

const SURFACE_LABELS: Record<Surface, string> = {
  notes_analyze: 'Notes AI Insights',
  food_analyze: 'Ảnh món ăn',
  stock_analyze: 'Phân tích cổ phiếu',
  stock_suggestions: 'Gợi ý cổ phiếu',
  tuvi_interpret: 'Tử vi — tổng quan',
  tuvi_palaces: 'Tử vi — 12 cung',
}

const TOP_USERS = 10

/**
 * Period bounds, resolved in Asia/Ho_Chi_Minh and pinned by the caller.
 *
 * Computed once per period change and reused for the report RPC AND the raw-log query.
 * That reuse is what lets the log reconcile with the aggregates: they are two separate
 * queries, and without a shared upper bound a row written between them appears in one and
 * not the other.
 */
function periodBounds(days: PeriodDays): { from: string; to: string } {
  const now = new Date()
  const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
  const to = new Date(vnNow)
  to.setHours(24, 0, 0, 0)
  const from = new Date(to)
  from.setDate(from.getDate() - days)
  // Offset back to real instants: the two Dates above are wall-clock in Vietnam.
  const offset = now.getTime() - vnNow.getTime()
  return {
    from: new Date(from.getTime() + offset).toISOString(),
    to: new Date(to.getTime() + offset).toISOString(),
  }
}

export default function AiUsagePage() {
  const { t } = useLanguage()
  const pathname = usePathname()
  const { role, loading: roleLoading } = useUserRole()

  const [days, setDays] = useState<PeriodDays>(30)
  const [scope, setScope] = useState<ActorScope | null>(null)
  const [report, setReport] = useState<UsageReport | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [logRows, setLogRows] = useState<LogRow[]>([])
  const [logTotal, setLogTotal] = useState(0)
  const [logPage, setLogPage] = useState(1)
  const [logError, setLogError] = useState(false)
  const [showAllUsers, setShowAllUsers] = useState(false)
  // Distinguishes the first load (skeletons) from a re-fetch (dim the previous figures).
  // Flashing back to skeletons on every filter change wipes exactly what the admin was
  // comparing against, and comparing periods is the main interaction here.
  const [firstLoad, setFirstLoad] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const bounds = useMemo(() => periodBounds(days), [days])

  // No setState before the first await: called from an effect, a synchronous one would
  // cascade a render. `refreshing` is turned ON by the handlers that cause a re-fetch,
  // which is where it belongs — it is a response to a user action, not to a lifecycle.
  const loadReport = useCallback(async () => {
    try {
      const { data, error } = await getSupabaseBrowserClient().rpc('ai_usage_report', {
        p_from: bounds.from,
        p_to: bounds.to,
        p_user: scope?.kind === 'user' ? scope.userId : null,
      })
      if (error) throw error
      setReport(data as UsageReport)
    } catch (err) {
      console.error('[ai-usage] report failed:', err)
      toast.error(t('admin.settings.aiUsage.loadError'))
    } finally {
      setRefreshing(false)
      setFirstLoad(false)
    }
  }, [bounds, scope, t])

  const loadLog = useCallback(async () => {
    try {
      let q = getSupabaseBrowserClient()
        .from('ai_usage_log')
        .select(
          'id, user_id, actor, surface, provider, model, input_tokens, cached_input_tokens, output_tokens, reasoning_tokens, cost_usd, outcome, created_at',
          { count: 'exact' }
        )
        .gte('created_at', bounds.from)
        .lt('created_at', bounds.to)
        // id is the tiebreaker, not decoration: the two horoscope palace batches and the
        // two food-photo stages are written in the same millisecond, and without it a row
        // can land on two pages or on neither.
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE - 1)

      if (scope?.kind === 'user') q = q.eq('user_id', scope.userId)
      else if (scope?.kind === 'deleted') q = q.is('user_id', null).eq('actor', 'user')
      else if (scope?.kind === 'system') q = q.eq('actor', 'system')

      const { data, error, count } = await q
      if (error) throw error
      setLogRows((data ?? []) as LogRow[])
      setLogTotal(count ?? 0)
      setLogError(false)
    } catch (err) {
      console.error('[ai-usage] log failed:', err)
      setLogError(true)
    }
  }, [bounds, scope, logPage])

  useEffect(() => {
    if (roleLoading || role !== 'admin') return
    void loadReport()
  }, [roleLoading, role, loadReport])

  useEffect(() => {
    if (roleLoading || role !== 'admin') return
    void loadLog()
  }, [roleLoading, role, loadLog])

  // Display names are resolved here rather than joined in the RPC, so the function needs no
  // access to profile data. Three cases, and the third is not an error.
  useEffect(() => {
    const ids = (report?.by_user ?? []).map((r) => r.user_id).filter((id): id is string => !!id)
    if (ids.length === 0) return
    void (async () => {
      const { data } = await getSupabaseBrowserClient()
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', ids)
      const next: Record<string, string> = {}
      for (const p of data ?? []) next[p.id as string] = (p.full_name as string) || (p.email as string)
      setNames(next)
    })()
  }, [report])

  function labelForScope(s: ActorScope): string {
    if (s.kind === 'deleted') return t('admin.settings.aiUsage.deletedUser')
    if (s.kind === 'system') return t('admin.settings.aiUsage.systemActor')
    // A missing profile is a data inconsistency, NOT a deleted account — those are
    // different states and must not share a label.
    return names[s.userId] ?? `${t('admin.settings.aiUsage.unknownUser')} (${s.userId.slice(0, 8)})`
  }

  /** Every re-fetch the user triggers dims the current figures instead of clearing them. */
  function refetch(apply: () => void) {
    setRefreshing(true)
    apply()
  }

  function selectScope(next: ActorScope) {
    refetch(() => {
      setScope((cur) => (cur && sameScope(cur, next) ? null : next))
      setLogPage(1)
    })
  }

  // Role must finish loading before anything role-dependent renders, or a genuine admin
  // gets the non-admin card flashed at them on every load.
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

  const summary = report?.summary ?? EMPTY_SUMMARY
  const totals = { cost: summary.cost_usd, tokens: totalTokens(summary) }
  const everRecorded = (report?.summary.calls ?? 0) > 0 || logTotal > 0
  const periodLabel = t(`admin.settings.aiUsage.period${days}` as 'admin.settings.aiUsage.period30')

  const surfaceRows: BreakdownRow[] = (report?.by_surface ?? []).map((r) => ({
    key: r.surface,
    label: SURFACE_LABELS[r.surface] ?? r.surface,
    figures: r,
  }))

  const modelRows: BreakdownRow[] = (report?.by_model ?? []).map((r) => ({
    key: `${r.provider}:${r.model}`,
    label: r.provider,
    detail: r.model,
    figures: r,
  }))

  const allUserRows = report?.by_user ?? []
  const userRows: BreakdownRow[] = (showAllUsers ? allUserRows : allUserRows.slice(0, TOP_USERS)).map((r) => {
    const s = actorScopeOf(r)
    return {
      key: `${r.actor}:${r.user_id ?? 'none'}`,
      label: labelForScope(s),
      detail:
        s.kind === 'deleted'
          ? t('admin.settings.aiUsage.deletedUserHint')
          : s.kind === 'system'
            ? t('admin.settings.aiUsage.systemActorHint')
            : undefined,
      figures: r,
      // The system row is not drill-down-able: "what is this person doing" is not a
      // question about a cron job. The deleted group is, because its history is exactly
      // what an admin wants after removing an account.
      onSelect: s.kind === 'system' ? undefined : () => selectScope(s),
      selected: scope ? sameScope(scope, s) : false,
    }
  })

  return (
    <div className={`space-y-4 transition-opacity ${refreshing && !firstLoad ? 'opacity-60' : ''}`}>
      <div className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-1 sm:mx-0 sm:inline-flex">
        {[
          ['/admin/settings', t('admin.settings.usersTab')],
          ['/admin/settings/pages', t('admin.settings.pagesTab')],
          ['/admin/settings/nutrition-qa', t('admin.settings.nutritionTab')],
          ['/admin/settings/ai-usage', t('admin.settings.aiUsage.tab')],
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]">
            <Coins className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-poppins text-base font-semibold leading-tight text-zinc-900">
              {t('admin.settings.aiUsage.heading')}
            </h2>
            <p className="text-xs text-zinc-400">{t('admin.settings.aiUsage.subtitle')}</p>
          </div>
        </div>

        {/* A real radio group, not a row of buttons: arrow keys move between periods and
            the active one is announced. Deliberately borderless so it does not read as a
            second row of tabs two lines below the first. */}
        <div role="radiogroup" aria-label={t('admin.settings.aiUsage.periodLabel')} className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={days === p}
              onClick={() =>
                refetch(() => {
                  setDays(p)
                  setLogPage(1)
                })
              }
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
                days === p ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'
              }`}
            >
              {t(`admin.settings.aiUsage.period${p}` as 'admin.settings.aiUsage.period30')}
            </button>
          ))}
        </div>
      </div>

      {scope ? (
        <div
          aria-live="polite"
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600"
        >
          {t('admin.settings.aiUsage.filteredBy', { name: labelForScope(scope) })}
          <button
            type="button"
            onClick={() =>
              refetch(() => {
                setScope(null)
                setLogPage(1)
              })
            }
            aria-label={t('admin.settings.aiUsage.clearFilter')}
            className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 sm:p-1"
          >
            <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          </button>
        </div>
      ) : null}

      {firstLoad ? (
        <div className="rounded-xl border border-zinc-100 bg-white p-6 text-sm text-zinc-400">
          {t('common.loading')}
        </div>
      ) : !everRecorded && !scope ? (
        // Names WHY it is empty. Without that, forward-only recording gets filed as a bug.
        <div className="rounded-xl border border-zinc-100 bg-white p-8 text-center">
          <p className="text-sm text-zinc-500">{t('admin.settings.aiUsage.emptyAll')}</p>
        </div>
      ) : (
        <>
          <UsageTiles summary={summary} />
          <UsageTrend daily={report?.daily ?? []} />

          {summary.calls === 0 ? (
            <div className="rounded-xl border border-zinc-100 bg-white p-8 text-center">
              <p className="text-sm text-zinc-500">
                {t('admin.settings.aiUsage.emptyPeriod', { period: periodLabel })}
              </p>
              {days !== 90 ? (
                <button
                  type="button"
                  // Moves the control's own selection rather than changing the data behind
                  // its back, so the segmented control never disagrees with what is shown.
                  onClick={() => refetch(() => setDays(90))}
                  className="mt-2 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  {t('admin.settings.aiUsage.emptyPeriodAction')}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <UsageBreakdown
              title={t('admin.settings.aiUsage.bySurface')}
              rows={surfaceRows}
              totals={totals}
              emptyText={t('admin.settings.aiUsage.emptyPeriod', { period: periodLabel })}
              animate={!firstLoad}
            />
            <UsageBreakdown
              title={t('admin.settings.aiUsage.byModel')}
              rows={modelRows}
              totals={totals}
              showShare
              emptyText={t('admin.settings.aiUsage.emptyModels')}
              animate={!firstLoad}
            />
          </div>

          <UsageBreakdown
            title={t('admin.settings.aiUsage.byUser')}
            rows={userRows}
            totals={totals}
            // A single cost bar, not the twin track: cost-per-token is a property of the
            // model, and a user did not choose it — they chose a feature.
            bar="single"
            emptyText={t('admin.settings.aiUsage.emptyPeriod', { period: periodLabel })}
            animate={!firstLoad}
            footer={
              allUserRows.length > TOP_USERS && !showAllUsers ? (
                <button
                  type="button"
                  onClick={() => setShowAllUsers(true)}
                  className="text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700"
                >
                  {t('admin.settings.aiUsage.viewAll')} ({allUserRows.length})
                </button>
              ) : null
            }
          />

          <UsageLog
            rows={logRows}
            total={logTotal}
            page={logPage}
            onPage={setLogPage}
            error={logError}
            onRetry={() => void loadLog()}
            userLabel={(row) => labelForScope(actorScopeOf(row))}
            surfaceLabel={(s) => SURFACE_LABELS[s] ?? s}
            emptyText={t('admin.settings.aiUsage.emptyPeriod', { period: periodLabel })}
          />

          <p className="text-center text-xs text-zinc-300">
            {formatTokens(totalTokens(summary))} tokens · {summary.failed_calls} lỗi
          </p>
        </>
      )}
    </div>
  )
}
