'use client'

import { formatUsdAggregate } from '@/lib/ai-pricing'
import { useLanguage } from '@/lib/i18n/language-context'
import { formatPercent, formatTokens, isLowerBound, share } from '../_lib/format'
import { totalTokens, type UsageFigures } from '../_lib/types'

const COPPER = '#a8542a'
const COPPER_TINT = '#f5e9e1'
const GRAPHITE = '#52525b'

/**
 * The twin-track rate bar.
 *
 * Two tracks of the same full width and origin: the row's share of total COST above, its
 * share of total TOKENS below. When they disagree the geometry says which way, with no
 * legend needed — a long cost track over a short token track means expensive per token.
 *
 * That comparison is the whole point, and it is why this appears on by-surface and by-model
 * only. Cost-per-token is a property of the model, which is chosen by the feature, not by
 * the person; on a by-user table the same bar would imply a user did something when all
 * they did was open the food photo screen.
 *
 * aria-hidden: it is reinforcement, never the only carrier. Every row states both figures
 * as text, including at widths where the token column is dropped.
 */
function TwinTrack({
  costShare,
  tokenShare,
  unpriced,
  animate,
}: {
  costShare: number
  tokenShare: number
  unpriced: boolean
  animate: boolean
}) {
  return (
    <div aria-hidden className="mt-1.5 space-y-1">
      <div className="h-1 w-full rounded-full" style={{ background: COPPER_TINT }}>
        {unpriced ? (
          // A row with no priced calls has a cost share of zero, and a zero-width copper
          // track would read as "cheap per token" when the truth is "unknown" — the exact
          // claim FR-010 forbids, reproduced in the element the page is remembered by.
          // A dashed outline at the token width says "unknown at this volume" instead.
          <div
            className="h-1 rounded-full border border-dashed"
            style={{ width: `${tokenShare * 100}%`, borderColor: COPPER }}
          />
        ) : (
          <div
            className="h-1 rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${(animate ? costShare : 0) * 100}%`, background: COPPER }}
          />
        )}
      </div>
      <div className="h-1 w-full rounded-full bg-zinc-100">
        <div
          className="h-1 rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${(animate ? tokenShare : 0) * 100}%`, background: GRAPHITE }}
        />
      </div>
    </div>
  )
}

/** A single copper bar. Used where "how much" is the question and rate is not. */
function CostBar({ costShare, animate }: { costShare: number; animate: boolean }) {
  return (
    <div aria-hidden className="mt-1.5 h-1 w-full rounded-full" style={{ background: COPPER_TINT }}>
      <div
        className="h-1 rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${(animate ? costShare : 0) * 100}%`, background: COPPER }}
      />
    </div>
  )
}

export interface BreakdownRow {
  key: string
  label: React.ReactNode
  /** Second identity line — an email, a model id. Truncates. */
  detail?: string
  figures: UsageFigures
  onSelect?: () => void
  selected?: boolean
}

export function UsageBreakdown({
  title,
  rows,
  totals,
  /** Twin-track compares cost share against token share; single shows cost only. */
  bar = 'twin',
  showShare = false,
  emptyText,
  animate,
  footer,
}: {
  title: string
  rows: BreakdownRow[]
  totals: { cost: number; tokens: number }
  bar?: 'twin' | 'single'
  showShare?: boolean
  emptyText: string
  animate: boolean
  footer?: React.ReactNode
}) {
  const { t } = useLanguage()

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-100 bg-white">
      <div className="border-b border-zinc-100 px-4 py-2.5">
        <h3 className="font-poppins text-sm font-semibold text-zinc-900">{title}</h3>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-zinc-400">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-zinc-50">
          {rows.map((row) => {
            const costShare = share(row.figures.cost_usd, totals.cost)
            const tokenShare = share(totalTokens(row.figures), totals.tokens)
            const unpriced = isLowerBound(row.figures.unpriced_calls)
            const priceless = row.figures.unpriced_calls >= row.figures.calls

            const body = (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-zinc-900">{row.label}</p>
                    {row.detail ? (
                      <p className="truncate text-xs text-zinc-400" title={row.detail}>
                        {row.detail}
                      </p>
                    ) : null}
                    {/* Tokens stay readable as text at every width. The bar is aria-hidden,
                        so dropping this line below sm: would leave token data existing only
                        where assistive tech cannot reach it. */}
                    <p className="text-xs tabular-nums text-zinc-400 sm:hidden">
                      {formatTokens(totalTokens(row.figures))} tok · {row.figures.calls}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-poppins text-[13px] font-semibold tabular-nums text-zinc-900">
                      {priceless ? (
                        <span className="font-normal text-zinc-400">
                          {t('admin.settings.aiUsage.costUnknown')}
                        </span>
                      ) : (
                        <>
                          {formatUsdAggregate(row.figures.cost_usd)}
                          {unpriced ? <sup aria-hidden style={{ color: COPPER }}>⁺</sup> : null}
                        </>
                      )}
                    </p>
                    <p className="hidden text-xs tabular-nums text-zinc-400 sm:block">
                      {formatTokens(totalTokens(row.figures))} tok · {row.figures.calls}
                      {showShare && !priceless ? ` · ${formatPercent(costShare)}` : ''}
                    </p>
                  </div>
                </div>

                {bar === 'twin' ? (
                  <TwinTrack
                    costShare={costShare}
                    tokenShare={tokenShare}
                    unpriced={priceless}
                    animate={animate}
                  />
                ) : (
                  <CostBar costShare={costShare} animate={animate} />
                )}
              </>
            )

            return (
              <li key={row.key}>
                {row.onSelect ? (
                  <button
                    type="button"
                    onClick={row.onSelect}
                    // 44px minimum via py-3 plus two text lines; a real button so it is
                    // focusable and announced, never a clickable div.
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-zinc-50 ${
                      row.selected ? 'bg-zinc-50' : ''
                    }`}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="px-4 py-3">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {footer ? <div className="border-t border-zinc-100 px-4 py-2">{footer}</div> : null}
    </div>
  )
}
