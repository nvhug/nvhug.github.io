'use client'

// FR-062/063/064/068: the conversation list, its filters/search, and pagination.
// Sort order is whatever the server returned (FR-064) — this component never
// re-sorts client-side. Pagination follows the UsageLog.tsx manual page/range()
// pattern at 30 rows/page (DESIGN.md "Content and interaction range check").

import { useEffect, useState } from 'react'
import { Filter, Search } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import type { ConversationStatus, Priority } from '@/lib/support/types'
import type { AdminConversationSummary, SupportInboxCounts } from '@/lib/support/service'
import type { UserProfile } from '@/types'
import { isUnreadForAdmin } from '@/lib/support/unread'
import { relativeTimeFrom } from '../_lib/format'

const PAGE_SIZE = 30
const SEARCH_DEBOUNCE_MS = 300

const STATUS_FILTERS: readonly (ConversationStatus | 'all')[] = [
  'all',
  'waiting_admin',
  'admin_active',
  'ai_active',
  'resolved',
  'closed',
]
const PRIORITY_FILTERS: readonly (Priority | 'all')[] = ['all', 'low', 'normal', 'high', 'urgent']
const ASSIGNMENT_FILTERS: readonly ('all' | 'mine' | 'unassigned')[] = ['all', 'mine', 'unassigned']

const STATUS_CHIP_CLASS: Record<ConversationStatus, string> = {
  ai_active: 'bg-zinc-100 text-zinc-600',
  waiting_admin: 'bg-amber-50 text-amber-700',
  admin_active: 'bg-emerald-50 text-emerald-700',
  resolved: 'bg-zinc-100 text-zinc-500',
  closed: 'bg-zinc-100 text-zinc-400',
}

const PRIORITY_DOT_CLASS: Record<Priority, string> = {
  urgent: 'bg-rose-500',
  high: 'bg-amber-500',
  normal: 'bg-zinc-300',
  low: 'bg-zinc-200',
}

function statusOptionKey(status: ConversationStatus): 'waitingAdmin' | 'adminActive' | 'aiActive' | 'resolved' | 'closed' {
  if (status === 'waiting_admin') return 'waitingAdmin'
  if (status === 'admin_active') return 'adminActive'
  if (status === 'ai_active') return 'aiActive'
  return status
}

export function InboxList({
  selectedId,
  onSelect,
  admins,
  currentAdminId,
  onCounts,
  refreshToken,
  className,
}: {
  selectedId: string | null
  onSelect: (row: AdminConversationSummary) => void
  admins: UserProfile[]
  currentAdminId: string | null
  onCounts: (counts: SupportInboxCounts) => void
  refreshToken: number
  className?: string
}) {
  const { t } = useLanguage()

  const [status, setStatus] = useState<ConversationStatus | 'all'>('all')
  const [priority, setPriority] = useState<Priority | 'all'>('all')
  const [assignment, setAssignment] = useState<'all' | 'mine' | 'unassigned'>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [retryToken, setRetryToken] = useState(0)

  const [rows, setRows] = useState<AdminConversationSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Free-text search is debounced locally; every other filter re-fetches immediately.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page) })
        if (status !== 'all') params.set('status', status)
        if (priority !== 'all') params.set('priority', priority)
        if (assignment !== 'all') params.set('assignment', assignment)
        if (search.trim()) params.set('search', search.trim())

        const res = await fetch(`/api/admin/support/conversations?${params.toString()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { rows: AdminConversationSummary[]; total: number; counts: SupportInboxCounts }
        if (cancelled) return
        setRows(data.rows)
        setTotal(data.total)
        onCounts(data.counts)
        setError(false)
      } catch (err) {
        if (cancelled) return
        console.error('[support-inbox] list load failed:', err)
        setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, priority, assignment, search, page, refreshToken, retryToken])

  function changeStatus(v: ConversationStatus | 'all') {
    setStatus(v)
    setPage(1)
  }
  function changePriority(v: Priority | 'all') {
    setPriority(v)
    setPage(1)
  }
  function changeAssignment(v: 'all' | 'mine' | 'unassigned') {
    setAssignment(v)
    setPage(1)
  }

  function assigneeLabel(row: AdminConversationSummary): string {
    if (!row.assignedAdminId) return t('support.admin.assignmentOptions.unassigned')
    if (row.assignedAdminId === currentAdminId) return t('support.admin.list.you')
    const admin = admins.find((a) => a.id === row.assignedAdminId)
    return admin?.full_name || admin?.email || t('support.admin.assignmentOptions.unassigned')
  }

  function previewFor(row: AdminConversationSummary): string {
    return row.lastMessagePreview || t('support.admin.list.noPreview')
  }

  function relativeLabel(iso: string): string {
    const r = relativeTimeFrom(iso, new Date())
    if (r.unit === 'justNow') return t('support.admin.time.justNow')
    return t(`support.admin.time.${r.unit}Ago`, { count: String(r.count) })
  }

  function isUnread(row: AdminConversationSummary): boolean {
    return isUnreadForAdmin(row.lastMessageAt, row.adminLastReadAt)
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Three selects plus a search input never fit one row inside a 320-380px
  // column, so they're laid out as a fixed grid (selects, one row each equal
  // width via min-w-0 so a long selected label can't force the column wider)
  // with the search box on its own full-width row underneath. This is the
  // one layout that cannot overflow the list column regardless of viewport
  // width or which option happens to be selected.
  const filterControls = (
    <div className="space-y-1.5 px-3 py-2">
      <div className="grid grid-cols-3 gap-1.5">
        <select
          value={status}
          onChange={(e) => changeStatus(e.target.value as ConversationStatus | 'all')}
          aria-label={t('support.admin.filters.status')}
          className="w-full min-w-0 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 outline-none focus-visible:border-emerald-400"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? t('support.admin.statusOptions.all') : t(`support.admin.statusOptions.${statusOptionKey(s)}`)}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => changePriority(e.target.value as Priority | 'all')}
          aria-label={t('support.admin.filters.priority')}
          className="w-full min-w-0 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 outline-none focus-visible:border-emerald-400"
        >
          {PRIORITY_FILTERS.map((p) => (
            <option key={p} value={p}>
              {p === 'all' ? t('support.admin.statusOptions.all') : t(`support.admin.priorityOptions.${p}`)}
            </option>
          ))}
        </select>
        <select
          value={assignment}
          onChange={(e) => changeAssignment(e.target.value as 'all' | 'mine' | 'unassigned')}
          aria-label={t('support.admin.filters.assignment')}
          className="w-full min-w-0 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 outline-none focus-visible:border-emerald-400"
        >
          {ASSIGNMENT_FILTERS.map((a) => (
            <option key={a} value={a}>
              {t(`support.admin.assignmentOptions.${a}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-300" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('support.admin.filters.search')}
          aria-label={t('support.admin.filters.search')}
          className="w-full rounded-md border border-zinc-200 bg-white py-1 pl-7 pr-2 text-xs text-zinc-600 outline-none focus-visible:border-emerald-400"
        />
      </div>
    </div>
  )

  return (
    <div className={`flex min-h-0 min-w-0 flex-col ${className ?? ''}`}>
      <div className="hidden border-b border-zinc-100 md:block">{filterControls}</div>
      <div className="border-b border-zinc-100 md:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen((v) => !v)}
          aria-label={t('support.admin.filtersButton')}
          aria-expanded={mobileFiltersOpen}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600"
        >
          <Filter className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          {t('support.admin.filtersButton')}
        </button>
        {mobileFiltersOpen ? filterControls : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-zinc-500">{t('support.admin.loadError')}</p>
            <button
              type="button"
              onClick={() => setRetryToken((n) => n + 1)}
              className="mt-2 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              {t('support.admin.retry')}
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-shimmer-sweep rounded-lg bg-zinc-50" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-zinc-400">{t('support.admin.list.empty')}</p>
        ) : (
          <ul>
            {rows.map((row) => {
              const unread = isUnread(row)
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row)}
                    className={`flex w-full flex-col gap-1 border-b border-zinc-50 px-3 py-2.5 text-left transition-colors ${
                      selectedId === row.id ? 'bg-emerald-50' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT_CLASS[row.priority]}`}
                        aria-label={t(`support.admin.priorityOptions.${row.priority}`)}
                      />
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_CHIP_CLASS[row.status]}`}
                      >
                        {t(`support.admin.statusOptions.${statusOptionKey(row.status)}`)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-900">
                        {row.userEmail || row.userId}
                      </span>
                      {unread ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                          aria-label={t('support.admin.list.unread')}
                        />
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-zinc-500">{previewFor(row)}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-zinc-400">{relativeLabel(row.lastMessageAt)}</span>
                      <span className="truncate text-[11px] text-zinc-400">{assigneeLabel(row)}</span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!error && pages > 1 ? (
        <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-3 py-2">
          <span className="text-xs tabular-nums text-zinc-400">
            {page} / {pages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label={t('support.admin.pagePrev')}
              className="min-h-9 rounded-lg border border-zinc-200 px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ←
            </button>
            <button
              type="button"
              disabled={page === pages}
              onClick={() => setPage((p) => p + 1)}
              aria-label={t('support.admin.pageNext')}
              className="min-h-9 rounded-lg border border-zinc-200 px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
