'use client'

import { Trash2 } from 'lucide-react'
import { formatUsd } from '@/lib/ai-pricing'
import { useLanguage } from '@/lib/i18n/language-context'
import { formatDateTime, formatTokens } from '../_lib/format'
import { totalTokens, type LogRow } from '../_lib/types'

const COPPER = '#a8542a'

export const LOG_PAGE_SIZE = 15

export function UsageLog({
  rows,
  total,
  page,
  onPage,
  userLabel,
  surfaceLabel,
  error,
  onRetry,
  onDelete,
  deletingId,
  emptyText,
}: {
  rows: LogRow[]
  total: number
  page: number
  onPage: (p: number) => void
  userLabel: (row: LogRow) => string
  surfaceLabel: (s: LogRow['surface']) => string
  error: boolean
  onRetry: () => void
  onDelete: (row: LogRow) => void
  /** The row whose delete is in flight, so only its own button goes quiet. */
  deletingId: string | null
  emptyText: string
}) {
  const { t, lang } = useLanguage()
  const pages = Math.max(1, Math.ceil(total / LOG_PAGE_SIZE))

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-100 bg-white">
      <div className="flex items-baseline justify-between gap-3 border-b border-zinc-100 px-4 py-2.5">
        <h3 className="font-poppins text-sm font-semibold text-zinc-900">
          {t('admin.settings.aiUsage.recentCalls')}
        </h3>
        {total > 0 ? <span className="text-xs tabular-nums text-zinc-400">{total}</span> : null}
      </div>

      {error ? (
        // Scoped to this card on purpose. The aggregates above came from a different query
        // and are still correct; a full-bleed error block would blank them for no reason.
        <div className="px-4 py-8 text-center">
          <p className="text-xs text-zinc-500">{t('admin.settings.aiUsage.logLoadError')}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            {t('admin.settings.aiUsage.retry')}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-zinc-400">{emptyText}</p>
      ) : (
        <>
          {/* The one genuinely wide table on this page. It scrolls inside its own
              container so the page body never does, and the timestamp column stays put:
              scroll right without it and a row loses the only thing identifying it. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-170 text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <th scope="col" className="sticky left-0 bg-zinc-50 px-3 py-2">
                    {t('admin.settings.aiUsage.colTime')}
                  </th>
                  <th scope="col" className="px-3 py-2">{t('admin.settings.aiUsage.colUser')}</th>
                  <th scope="col" className="px-3 py-2">{t('admin.settings.aiUsage.colSurface')}</th>
                  <th scope="col" className="px-3 py-2">{t('admin.settings.aiUsage.colModel')}</th>
                  <th scope="col" className="px-3 py-2 text-right">{t('admin.settings.aiUsage.colTokens')}</th>
                  <th scope="col" className="px-3 py-2 text-right">{t('admin.settings.aiUsage.colCost')}</th>
                  {/* Labelled for screen readers only: the column is one icon wide and a
                      visible header would be wider than the control it names. */}
                  <th scope="col" className="w-10 px-3 py-2">
                    <span className="sr-only">{t('admin.settings.aiUsage.colActions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-50 last:border-0">
                    <td className="sticky left-0 bg-white px-3 py-2 text-xs tabular-nums text-zinc-500">
                      {formatDateTime(row.created_at, lang)}
                    </td>
                    {/* Wider than the model column and carrying a title: the label is
                        "name - email" now, and a truncated one that hides the email is
                        exactly the half an admin came here to read. */}
                    <td className="max-w-[18rem] truncate px-3 py-2 text-xs text-zinc-600" title={userLabel(row)}>
                      {userLabel(row)}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-600">
                      <span className="block">{surfaceLabel(row.surface)}</span>
                      {row.outcome === 'error' ? (
                        // Text, not a colour dot, and neutral rather than red-filled: a
                        // rate limit is not an outage. The hint spells out FR-005a where
                        // the admin actually meets it.
                        <span
                          className="mt-0.5 inline-block rounded border border-zinc-200 px-1 text-[10px] font-medium text-zinc-500"
                          title={t('admin.settings.aiUsage.outcomeErrorHint')}
                        >
                          {t('admin.settings.aiUsage.outcomeError')}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2 text-xs text-zinc-500" title={row.model}>
                      {row.model}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-zinc-600">
                      {formatTokens(totalTokens(row))}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">
                      {row.cost_usd === null ? (
                        // Never "$0.00". A null cost means the model has no price, which
                        // is not the same claim as "this call was free" (FR-010).
                        <span className="text-zinc-400" title={t('admin.settings.aiUsage.costUnknownHint')}>
                          {t('admin.settings.aiUsage.costUnknown')}
                        </span>
                      ) : (
                        <span style={row.outcome === 'error' ? { color: COPPER } : undefined}>
                          {formatUsd(row.cost_usd)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onDelete(row)}
                        disabled={deletingId === row.id}
                        aria-label={t('admin.settings.aiUsage.deleteRow')}
                        title={t('admin.settings.aiUsage.deleteRow')}
                        className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40 sm:p-1"
                      >
                        <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 ? (
            <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-4 py-2">
              <span className="text-xs tabular-nums text-zinc-400">
                {page} / {pages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => onPage(page - 1)}
                  className="min-h-11 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:py-1.5"
                >
                  ←
                </button>
                <button
                  type="button"
                  disabled={page === pages}
                  onClick={() => onPage(page + 1)}
                  className="min-h-11 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:py-1.5"
                >
                  →
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
