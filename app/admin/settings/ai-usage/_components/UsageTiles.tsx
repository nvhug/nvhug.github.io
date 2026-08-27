'use client'

import { formatUsdAggregate } from '@/lib/ai-pricing'
import { useLanguage } from '@/lib/i18n/language-context'
import { formatTokens, formatVnd, isLowerBound } from '../_lib/format'
import { totalTokens, type UsageSummary } from '../_lib/types'

/**
 * The lower-bound marker.
 *
 * A superscript rather than a tooltip, so the tile reads as "at least" with no interaction
 * at all — the cost sum excludes calls whose model has no price, and a bare figure would
 * under-report real spend while looking authoritative (FR-010a).
 *
 * aria-hidden with an sr-only prefix: a lone "⁺" glyph reads as "plus" or is skipped, and
 * the count in the footer below already carries the detail in text.
 */
function LowerBound({ show }: { show: boolean }) {
  const { t } = useLanguage()
  if (!show) return null
  return (
    <>
      <span className="sr-only">{t('admin.settings.aiUsage.unpricedMin')} </span>
      <sup aria-hidden className="text-[#a8542a]">⁺</sup>
    </>
  )
}

function Tile({
  label,
  value,
  sub,
  accent,
  span,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  accent?: boolean
  span?: boolean
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-100 bg-white p-4 ${span ? 'col-span-2 md:col-span-1' : ''}`}
    >
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      <p
        // tabular-nums is the difference between a scannable column of figures and a
        // ragged one; on the cost tile it also keeps the marker from shifting the digits.
        className={`mt-1 font-poppins tabular-nums ${
          accent ? 'text-3xl font-semibold text-[#a8542a]' : 'text-xl font-semibold text-zinc-900'
        }`}
      >
        {value}
      </p>
      {sub ? <div className="mt-1 text-xs text-zinc-400">{sub}</div> : null}
    </div>
  )
}

export function UsageTiles({ summary }: { summary: UsageSummary }) {
  const { t } = useLanguage()
  const bounded = isLowerBound(summary.unpriced_calls)

  // Named rather than a bare count: `count(distinct user_id)` drops NULLs, so the deleted
  // cohort and the system actor would silently vanish from a figure the by-user table is
  // required to reconcile with.
  const usersDetail = t('admin.settings.aiUsage.tileUsersDetail', {
    n: summary.active_users,
    deleted: '',
    system: '',
  })

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {/* Cost first, largest, and full width on a phone: it is the question the page
          exists to answer, and on mobile it should not share a row with a call count. */}
      <Tile
        span
        accent
        label={t('admin.settings.aiUsage.tileCost')}
        value={
          <>
            {formatUsdAggregate(summary.cost_usd)}
            <LowerBound show={bounded} />
          </>
        }
        sub={
          <>
            <span className="tabular-nums">
              {formatVnd(summary.cost_usd)}
              <LowerBound show={bounded} />
            </span>
            {bounded ? (
              <p className="mt-1 text-[#a8542a]">
                {t('admin.settings.aiUsage.unpricedNote', {
                  n: summary.unpriced_calls,
                  models: summary.unpriced_models.join(', '),
                })}
              </p>
            ) : null}
          </>
        }
      />
      <Tile label={t('admin.settings.aiUsage.tileCalls')} value={summary.calls.toLocaleString('en-US')} />
      <Tile
        label={t('admin.settings.aiUsage.tileTokens')}
        value={formatTokens(totalTokens(summary))}
        sub={`${formatTokens(summary.cached_input_tokens)} cached`}
      />
      <Tile
        span
        label={t('admin.settings.aiUsage.tileUsers')}
        value={summary.active_users.toLocaleString('en-US')}
        sub={usersDetail}
      />
    </div>
  )
}
