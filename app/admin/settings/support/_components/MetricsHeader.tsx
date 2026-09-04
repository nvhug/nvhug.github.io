'use client'

// Renders the FR-070 metrics strip. All arithmetic already lives in
// src/lib/support/metrics.ts (computeSupportMetrics) — this component performs no
// calculation of its own (FR-071), it only formats the numbers it is handed. A null
// rate/median renders as an em dash, never NaN (FR-072).

import { useLanguage } from '@/lib/i18n/language-context'
import type { SupportMetrics } from '@/lib/support/types'
import { formatDurationMs, formatPercent } from '../_lib/format'

const EM_DASH = '—'

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex shrink-0 flex-col gap-0.5 rounded-xl border border-zinc-100 bg-white p-3">
      <span className="whitespace-nowrap text-[11px] font-medium text-zinc-400">{label}</span>
      <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-zinc-900">{value}</span>
    </div>
  )
}

export function MetricsHeader({
  metrics,
  loading,
  error,
  onRetry,
}: {
  metrics: SupportMetrics | null
  loading: boolean
  error: boolean
  onRetry: () => void
}) {
  const { t } = useLanguage()

  function durationOrDash(ms: number | null): string {
    if (ms === null) return EM_DASH
    const d = formatDurationMs(ms)
    return t(`support.admin.duration.${d.unit}`, { count: String(d.count) })
  }

  function rateOrDash(rate: number | null): string {
    return rate === null ? EM_DASH : formatPercent(rate)
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-white p-4">
        <p className="text-xs text-zinc-500">{t('support.admin.loadError')}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          {t('support.admin.retry')}
        </button>
      </div>
    )
  }

  if (loading || !metrics) {
    return (
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-[52px] w-24 shrink-0 animate-shimmer-sweep rounded-xl border border-zinc-100 bg-zinc-50"
          />
        ))}
      </div>
    )
  }

  const m = metrics

  return (
    <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
      <Tile label={t('support.admin.metrics.total')} value={String(m.totalConversations)} />
      <Tile label={t('support.admin.metrics.open')} value={String(m.open)} />
      <Tile label={t('support.admin.metrics.waiting')} value={String(m.waiting)} />
      <Tile label={t('support.admin.metrics.urgent')} value={String(m.urgent)} />
      <Tile label={t('support.admin.metrics.aiResolved')} value={String(m.aiResolved)} />
      <Tile label={t('support.admin.metrics.humanResolved')} value={String(m.humanResolved)} />
      {/* Beside the two resolution counts, not hidden away: the point of the
          number is that it used to be added to aiResolved. */}
      <Tile label={t('support.admin.metrics.abandoned')} value={String(m.abandoned)} />
      <Tile label={t('support.admin.metrics.escalationRate')} value={rateOrDash(m.escalationRate)} />
      <Tile label={t('support.admin.metrics.aiResolutionRate')} value={rateOrDash(m.aiResolutionRate)} />
      <Tile label={t('support.admin.metrics.medianFirstResponse')} value={durationOrDash(m.medianFirstResponseMs)} />
      <Tile label={t('support.admin.metrics.medianResolution')} value={durationOrDash(m.medianResolutionMs)} />
    </div>
  )
}
