'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Coins, X } from 'lucide-react'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useLanguage } from '@/lib/i18n/language-context'
import { useUserRole } from '@/lib/useUserRole'
import { UsageTiles } from './_components/UsageTiles'
import { UsageTrend } from './_components/UsageTrend'
import { UsageBreakdown, type BreakdownRow } from './_components/UsageBreakdown'
import { UsageLog } from './_components/UsageLog'
import { LogFilters } from './_components/LogFilters'
import { formatDateTime, formatTokens, formatUserIdentity } from './_lib/format'
import { modelChipsFromLog, intersectLogDateBounds, isFullySelected, modelFilterPattern } from './_lib/filters'
import {
  actorScopeOf,
  EMPTY_SUMMARY,
  LOG_PAGE_SIZE,
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
 * How many log rows the chip lookup reads to find the distinct models in view. This app
 * writes single-digit AI calls a day, so this covers years; the cap is here so the page
 * can never pull an unbounded table into the browser just to build a filter row.
 */
const MODEL_OPTION_SCAN_LIMIT = 2_000

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
  const { t, lang } = useLanguage()
  const pathname = usePathname()
  const { role, loading: roleLoading } = useUserRole()

  const [days, setDays] = useState<PeriodDays>(30)
  const [scope, setScope] = useState<ActorScope | null>(null)
  const [report, setReport] = useState<UsageReport | null>(null)
  const [profiles, setProfiles] = useState<Record<string, { fullName: string | null; email: string | null }>>({})
  const [logRows, setLogRows] = useState<LogRow[]>([])
  // Chips come from what the log actually holds, not from the price table — see
  // modelChipsFromLog. Deliberately NOT narrowed by modelFilter: the chip row has to keep
  // offering the other models once one is selected, or the filter would be a one-way door.
  const [modelOptions, setModelOptions] = useState<string[]>([])
  const [logTotal, setLogTotal] = useState(0)
  const [logPage, setLogPage] = useState(1)
  const [logError, setLogError] = useState(false)
  const [showAllUsers, setShowAllUsers] = useState(false)
  // Distinguishes the first load (skeletons) from a re-fetch (dim the previous figures).
  // Flashing back to skeletons on every filter change wipes exactly what the admin was
  // comparing against, and comparing periods is the main interaction here.
  const [firstLoad, setFirstLoad] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LogRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Log-only filters (FR-002 through FR-006) — independent of, but composable with,
  // `scope`/`days` above. Reset `logPage` and clear `selectedIds` on any change (FR-008,
  // FR-010).
  const [modelFilter, setModelFilter] = useState<string | null>(null)
  const [surfaceFilter, setSurfaceFilter] = useState<Surface | null>(null)
  const [dateFrom, setDateFrom] = useState<string | null>(null)
  const [dateTo, setDateTo] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const bounds = useMemo(() => periodBounds(days), [days])
  const logBounds = useMemo(() => intersectLogDateBounds(bounds, { dateFrom, dateTo }), [bounds, dateFrom, dateTo])

  // No setState before the first await: called from an effect, a synchronous one would
  // cascade a render. `refreshing` is turned ON by the handlers that cause a re-fetch,
  // which is where it belongs — it is a response to a user action, not to a lifecycle.
  const loadReport = useCallback(async () => {
    try {
      const { data, error } = await getSupabaseBrowserClient().rpc('ai_usage_report', {
        p_from: bounds.from,
        p_to: bounds.to,
        p_user: scope?.kind === 'user' ? scope.userId : null,
        // p_user alone cannot say "the deleted accounts": null already means unscoped, so
        // sending it for that drill-down would return the global report and label it as one
        // group's spend. The scope kind is what carries the distinction.
        p_scope: scope?.kind ?? 'all',
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
        .gte('created_at', logBounds.from)
        .lt('created_at', logBounds.to)
        // id is the tiebreaker, not decoration: the two horoscope palace batches and the
        // two food-photo stages are written in the same millisecond, and without it a row
        // can land on two pages or on neither.
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE - 1)

      if (scope?.kind === 'user') q = q.eq('user_id', scope.userId)
      else if (scope?.kind === 'deleted') q = q.is('user_id', null).eq('actor', 'user')
      else if (scope?.kind === 'system') q = q.eq('actor', 'system')
      // Not .eq(): a served model id can carry a point-release suffix the chip's
      // canonical name doesn't have (see modelFilterPattern's doc comment).
      if (modelFilter) q = q.filter('model', 'match', modelFilterPattern(modelFilter))
      if (surfaceFilter) q = q.eq('surface', surfaceFilter)

      const { data, error, count } = await q
      if (error) throw error
      const rows = (data ?? []) as LogRow[]
      setLogRows(rows)
      setLogTotal(count ?? 0)
      setLogError(false)
      return rows
    } catch (err) {
      console.error('[ai-usage] log failed:', err)
      setLogError(true)
      return undefined
    }
  }, [logBounds, scope, logPage, modelFilter, surfaceFilter])

  useEffect(() => {
    if (roleLoading || role !== 'admin') return
    void loadReport()
  }, [roleLoading, role, loadReport])

  const loadModelOptions = useCallback(async () => {
    try {
      // Only the one column, and bounded: this is a distinct-values lookup, not a second
      // copy of the log. PostgREST has no DISTINCT, so the dedupe happens in
      // modelChipsFromLog. The cap is far above this app's volume (single-digit AI calls a
      // day) and exists so the page can never pull an unbounded table into the browser.
      let q = getSupabaseBrowserClient()
        .from('ai_usage_log')
        .select('model')
        .gte('created_at', logBounds.from)
        .lt('created_at', logBounds.to)
        .limit(MODEL_OPTION_SCAN_LIMIT)

      if (scope?.kind === 'user') q = q.eq('user_id', scope.userId)
      else if (scope?.kind === 'deleted') q = q.is('user_id', null).eq('actor', 'user')
      else if (scope?.kind === 'system') q = q.eq('actor', 'system')

      const { data, error } = await q
      if (error) throw error
      const rows = (data ?? []) as { model: string }[]
      setModelOptions(modelChipsFromLog(rows.map((r) => r.model)))
    } catch (err) {
      // A chip row that fails to load is worth nothing to shout about — the log itself
      // still renders, and every row shows its own model.
      console.error('[ai-usage] model options failed:', err)
      setModelOptions([])
    }
  }, [logBounds, scope])

  useEffect(() => {
    if (roleLoading || role !== 'admin') return
    void loadLog()
  }, [roleLoading, role, loadLog])

  useEffect(() => {
    if (roleLoading || role !== 'admin') return
    void loadModelOptions()
  }, [roleLoading, role, loadModelOptions])

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
      const next: Record<string, { fullName: string | null; email: string | null }> = {}
      for (const p of data ?? []) {
        next[p.id as string] = { fullName: p.full_name as string | null, email: p.email as string | null }
      }
      setProfiles(next)
    })()
  }, [report])

  /**
   * `full` spells the account out as "name - email". The raw log gets it, because a row
   * there is evidence about one specific account; the breakdown and the filter chip keep
   * the short form, where the email would crowd out the figures beside it.
   */
  function labelForScope(s: ActorScope, full = false): string {
    if (s.kind === 'deleted') return t('admin.settings.aiUsage.deletedUser')
    if (s.kind === 'system') return t('admin.settings.aiUsage.systemActor')
    const p = profiles[s.userId]
    const label = p ? (full ? formatUserIdentity(p.fullName, p.email) : p.fullName || p.email) : null
    // A missing profile is a data inconsistency, NOT a deleted account — those are
    // different states and must not share a label.
    return label || `${t('admin.settings.aiUsage.unknownUser')} (${s.userId.slice(0, 8)})`
  }

  /** Every re-fetch the user triggers dims the current figures instead of clearing them. */
  function refetch(apply: () => void) {
    setRefreshing(true)
    apply()
  }

  function selectScope(next: ActorScope) {
    refetch(() => {
      setScope((cur) => (cur && sameScope(cur, next) ? null : next))
      resetLogView()
    })
  }

  function changeLogPage(p: number) {
    setLogPage(p)
    setSelectedIds(new Set())
  }

  // Every control that changes which rows the log query can return shares this: back to
  // page 1, and drop a selection that may no longer point at rows the admin can see.
  // Pulled out after two separate review rounds each caught a different handler that had
  // been written by hand and forgot one half of it.
  function resetLogView() {
    setLogPage(1)
    setSelectedIds(new Set())
  }

  function selectModelFilter(model: string | null) {
    setModelFilter(model)
    resetLogView()
  }

  function selectSurfaceFilter(surface: Surface | null) {
    setSurfaceFilter(surface)
    resetLogView()
  }

  function changeDateFrom(v: string | null) {
    // Swap rather than let the two fields visibly disagree with the (already-normalized)
    // query: an admin who sets "From" after "To" should see the fields reflect what the
    // table actually shows, not a pair of values that look backwards forever.
    if (v && dateTo && v > dateTo) {
      setDateFrom(dateTo)
      setDateTo(v)
    } else {
      setDateFrom(v)
    }
    resetLogView()
  }

  function changeDateTo(v: string | null) {
    if (v && dateFrom && v < dateFrom) {
      setDateTo(dateFrom)
      setDateFrom(v)
    } else {
      setDateTo(v)
    }
    resetLogView()
  }

  function toggleRow(id: string) {
    setSelectedIds((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllRows() {
    setSelectedIds(
      isFullySelected(logRows.map((r) => r.id), selectedIds) ? new Set() : new Set(logRows.map((r) => r.id))
    )
  }

  /**
   * Deletes every selected row in one request (POST /bulk-delete), through the same
   * admin-only, service-role-backed path as the single-row delete. Rows Postgres actually
   * removed clear from the table and from selection; ids it didn't find stay selected so
   * the admin can immediately see and retry just those (FR-013).
   */
  async function confirmBulkDelete() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBulkDeleting(true)
    try {
      const res = await fetch('/api/admin/ai-usage/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { deletedIds, failedIds } = (await res.json()) as { deletedIds: string[]; failedIds: string[] }

      setBulkDeleteConfirm(false)
      setSelectedIds(new Set(failedIds))

      if (failedIds.length === 0) {
        toast.success(t('admin.settings.aiUsage.bulkDeleteSuccess', { count: String(deletedIds.length) }))
      } else if (deletedIds.length > 0) {
        toast.error(
          t('admin.settings.aiUsage.bulkDeletePartial', {
            deleted: String(deletedIds.length),
            total: String(ids.length),
            failed: String(failedIds.length),
          })
        )
      } else {
        toast.error(t('admin.settings.aiUsage.bulkDeleteError'))
      }

      // Always refresh, even on a full failure: a failedId can mean the row was already
      // removed by someone/something else (a per-row delete, another admin), not that
      // nothing changed — skipping the refresh would leave an already-gone row rendered
      // as a live, selectable table row indefinitely.
      if (deletedIds.length > 0 && deletedIds.length === logRows.length && logPage > 1) {
        // Same last-page guard as the single-row delete: leaving the admin on a page that
        // just lost every one of its rows means they have to click their own way out of it.
        // Every failedId is already empty in this branch (deletedIds accounts for the
        // whole page), so there is nothing left to prune from selection.
        setLogPage(logPage - 1)
        await loadReport()
      } else {
        // Independent reads, run together rather than back to back.
        const [freshRows] = await Promise.all([loadLog(), loadReport()])
        // A partial failure's retained ids (failedIds, still in selectedIds) can land on
        // a different page once the successfully-deleted rows shift everything after
        // them — prune to whatever this page actually still shows, so the bulk bar's
        // count never outlives the rows it's counting.
        if (freshRows) {
          const freshIds = new Set(freshRows.map((r) => r.id))
          setSelectedIds((cur) => new Set([...cur].filter((id) => freshIds.has(id))))
        }
      }
    } catch (err) {
      console.error('[ai-usage] bulk delete failed:', err)
      toast.error(t('admin.settings.aiUsage.bulkDeleteError'))
    } finally {
      setBulkDeleting(false)
    }
  }

  /**
   * Removes one row from the log, through the admin route rather than the browser client:
   * the RLS policy on ai_usage_log denies every write, and it stays that way.
   *
   * Both queries are re-run afterwards. The tiles and the chart are computed from these
   * same rows, so refreshing only the table would leave the page disagreeing with itself.
   */
  async function confirmDelete() {
    const row = deleteTarget
    if (!row) return
    setDeletingId(row.id)
    try {
      const res = await fetch(`/api/admin/ai-usage/${row.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDeleteTarget(null)
      toast.success(t('admin.settings.aiUsage.deleteRowSuccess'))
      // Otherwise a row deleted through its own per-row button (not bulk-delete) lingers
      // in the selection forever, over-counting the bulk bar and breaking "select all".
      setSelectedIds((cur) => {
        if (!cur.has(row.id)) return cur
        const next = new Set(cur)
        next.delete(row.id)
        return next
      })
      // Deleting the last row of a page other than the first would otherwise leave the
      // admin on an empty page they have to click their own way out of.
      if (logRows.length === 1 && logPage > 1) setLogPage(logPage - 1)
      else await loadLog()
      await loadReport()
    } catch (err) {
      console.error('[ai-usage] delete failed:', err)
      toast.error(t('admin.settings.aiUsage.deleteRowError'))
    } finally {
      setDeletingId(null)
    }
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

  const surfaceFilterOptions = (Object.keys(SURFACE_LABELS) as Surface[]).map((key) => ({
    key,
    label: SURFACE_LABELS[key],
  }))

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
      // Every kind is drill-down-able now that the RPC can express all three. The system
      // group earns it too: "which feature is the cron spending on" is a real question,
      // even though "what is this person doing" is not.
      onSelect: () => selectScope(s),
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
                  resetLogView()
                  // The explicit date range narrows *within* the active period
                  // (intersectLogDateBounds) — carrying it across a period change can
                  // leave it entirely outside the new period, producing an inverted
                  // from > to query range that silently returns zero rows.
                  setDateFrom(null)
                  setDateTo(null)
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
                resetLogView()
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
            onPage={changeLogPage}
            error={logError}
            onRetry={() => void loadLog()}
            onDelete={setDeleteTarget}
            deletingId={deletingId}
            userLabel={(row) => labelForScope(actorScopeOf(row), true)}
            surfaceLabel={(s) => SURFACE_LABELS[s] ?? s}
            emptyText={t('admin.settings.aiUsage.emptyPeriod', { period: periodLabel })}
            filters={
              <LogFilters
                models={modelOptions}
                selectedModel={modelFilter}
                onSelectModel={selectModelFilter}
                surfaces={surfaceFilterOptions}
                selectedSurface={surfaceFilter}
                onSelectSurface={selectSurfaceFilter}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={changeDateFrom}
                onDateToChange={changeDateTo}
                onSelectUser={(userId) => selectScope({ kind: 'user', userId })}
                onSelectDeleted={() => selectScope({ kind: 'deleted' })}
                onSelectSystem={() => selectScope({ kind: 'system' })}
                isDeletedActive={scope?.kind === 'deleted'}
                isSystemActive={scope?.kind === 'system'}
              />
            }
            selectedIds={selectedIds}
            onToggleRow={toggleRow}
            onToggleAll={toggleAllRows}
            onBulkDelete={() => setBulkDeleteConfirm(true)}
            bulkDeleting={bulkDeleting}
          />

          <p className="text-center text-xs text-zinc-300">
            {formatTokens(totalTokens(summary))} tokens · {summary.failed_calls} lỗi
          </p>
        </>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        itemContent={
          deleteTarget
            ? `${SURFACE_LABELS[deleteTarget.surface] ?? deleteTarget.surface} · ${deleteTarget.model}`
            : undefined
        }
        itemMeta={
          deleteTarget
            ? `${formatDateTime(deleteTarget.created_at, lang)} · ${labelForScope(actorScopeOf(deleteTarget), true)} — ${t('admin.settings.aiUsage.deleteRowHint')}`
            : undefined
        }
        loading={!!deletingId}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={bulkDeleteConfirm}
        itemContent={t('admin.settings.aiUsage.bulkSelectedCount', { count: String(selectedIds.size) })}
        itemMeta={t('admin.settings.aiUsage.bulkDeleteConfirmHint')}
        loading={bulkDeleting}
        onConfirm={() => void confirmBulkDelete()}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
    </div>
  )
}
