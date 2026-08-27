'use client'

import { formatUsdAggregate } from '@/lib/ai-pricing'
import { useLanguage } from '@/lib/i18n/language-context'
import { formatDayShort, formatTokens } from '../_lib/format'
import { totalTokens, type DayRow } from '../_lib/types'

const COPPER = '#a8542a'
const GRAPHITE = '#52525b'

// A fixed viewBox scaled by CSS. `meet` plus non-scaling strokes keeps the hairline and the
// area edge the same weight at every width; `none` would stretch them unevenly.
const VW = 720
const VH = 180
const PAD = { top: 16, right: 8, bottom: 20, left: 40 }

export function UsageTrend({ daily }: { daily: DayRow[] }) {
  const { t } = useLanguage()

  const maxCost = Math.max(...daily.map((d) => d.cost_usd), 0)
  const maxTokens = Math.max(...daily.map((d) => totalTokens(d)), 0)
  const hasData = daily.length > 0 && (maxCost > 0 || maxTokens > 0)

  const innerW = VW - PAD.left - PAD.right
  const innerH = VH - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (daily.length <= 1 ? innerW / 2 : (i / (daily.length - 1)) * innerW)

  // Both series are pinned at zero, never normalised to their own [min, max]. A period
  // where tokens vary by 2% would otherwise render as a full-height wiggle, which reads as
  // volatility that is not there — and the token line deliberately carries no axis for the
  // reader to check it against.
  const yCost = (v: number) => PAD.top + innerH - (maxCost > 0 ? v / maxCost : 0) * innerH
  const yTokens = (v: number) => PAD.top + innerH - (maxTokens > 0 ? v / maxTokens : 0) * innerH

  const costLine = daily.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${yCost(d.cost_usd)}`).join(' ')
  const costArea = `${costLine} L${x(daily.length - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`
  const tokenLine = daily.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${yTokens(totalTokens(d))}`).join(' ')

  const peakIdx = daily.reduce((best, d, i) => (totalTokens(d) > totalTokens(daily[best]) ? i : best), 0)

  // One label on the token series, not an axis. The unlabelled-line objection is that a
  // shape with no scale invites false precision; a single peak value answers it while
  // keeping the second axis off the chart, where it would license any correlation.
  const peakLabel = t('admin.settings.aiUsage.trendPeak', { n: formatTokens(totalTokens(daily[peakIdx] ?? { input_tokens: 0, output_tokens: 0 } as DayRow)) })

  // Roughly six ticks whatever the period, so 7/30/90 all stay readable.
  const tickEvery = Math.max(1, Math.ceil(daily.length / 6))

  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="font-poppins text-sm font-semibold text-zinc-900">
          {t('admin.settings.aiUsage.trend')}
        </h3>
        {hasData ? (
          <span className="text-xs tabular-nums text-zinc-400">{peakLabel}</span>
        ) : null}
      </div>

      {!hasData ? (
        // The axis and baseline are still drawn: a collapsed or zero-height chart reads as
        // broken, while an empty one with its frame intact reads as "nothing here yet".
        <div className="relative">
          <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" role="img" aria-label={t('admin.settings.aiUsage.emptyChart')}>
            <line x1={PAD.left} y1={PAD.top + innerH} x2={VW - PAD.right} y2={PAD.top + innerH} stroke="#e4e4e7" />
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} stroke="#e4e4e7" />
          </svg>
          <p className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
            {t('admin.settings.aiUsage.emptyChart')}
          </p>
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full"
            role="img"
            aria-label={`${t('admin.settings.aiUsage.trend')}: ${formatUsdAggregate(
              daily.reduce((s, d) => s + d.cost_usd, 0)
            )}`}
          >
            <line x1={PAD.left} y1={PAD.top + innerH} x2={VW - PAD.right} y2={PAD.top + innerH} stroke="#e4e4e7" />
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} stroke="#e4e4e7" />

            {/* Only the cost axis is labelled. Giving the token line a scale would invite
                reading a correlation into two series with unrelated magnitudes. */}
            <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end" fontSize="10" fill="#a1a1aa">
              {formatUsdAggregate(maxCost)}
            </text>
            <text x={PAD.left - 6} y={PAD.top + innerH} textAnchor="end" fontSize="10" fill="#a1a1aa">
              $0
            </text>

            <path d={costArea} fill={COPPER} fillOpacity="0.14" />
            <path d={costLine} fill="none" stroke={COPPER} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <path
              d={tokenLine}
              fill="none"
              stroke={GRAPHITE}
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />

            {daily.map((d, i) =>
              i % tickEvery === 0 ? (
                <text key={d.day} x={x(i)} y={VH - 4} textAnchor="middle" fontSize="10" fill="#a1a1aa">
                  {formatDayShort(d.day)}
                </text>
              ) : null
            )}
          </svg>

          {/* The accessible equivalent of the picture. A bare <svg> is invisible to a
              screen reader, and this is the only place the daily figures exist. */}
          <table className="sr-only">
            <caption>{t('admin.settings.aiUsage.trend')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('admin.settings.aiUsage.colTime')}</th>
                <th scope="col">{t('admin.settings.aiUsage.colCost')}</th>
                <th scope="col">{t('admin.settings.aiUsage.colTokens')}</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  <td>{formatUsdAggregate(d.cost_usd)}</td>
                  <td>{formatTokens(totalTokens(d))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
