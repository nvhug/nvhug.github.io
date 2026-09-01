'use client'

import type { ReactNode } from 'react'
import { useLanguage } from '@/lib/i18n/language-context'
import {
  ALERTS_ARMED,
  AREA_SCORE_ROWS,
  ASSET_ROWS,
  ASSET_TOTAL,
  DAY,
  STOCK_ROWS,
  formatDong,
} from './figures'

/**
 * Shared card for the four schematic mockups.
 *
 * The `số liệu minh hoạ` caption is set INTO the card's top rule rather than placed
 * near it, so it cannot be separated from the figures by a later copy edit (FR-021).
 * The card is aria-hidden with one plain sentence beside it, so a screen-reader user
 * gets a single statement instead of a tour of fake numbers.
 */
function Card({ alt, children }: { alt: string; children: ReactNode }) {
  const { t } = useLanguage()
  return (
    <>
      <span className="sr-only">{alt}</span>
      <div
        aria-hidden
        className="rounded-2xl border border-[#1E2B22] bg-[#0F1712] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]"
      >
        <div className="flex items-center gap-3 border-b border-[#1E2B22] px-4 py-2.5">
          <span className="font-poppins text-[10px] uppercase tracking-[0.18em] text-[#5C7062]">
            {t('landing.illustrative')}
          </span>
          <span className="h-px flex-1 bg-[#1E2B22]" />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-70 px-4 py-4">{children}</div>
        </div>
      </div>
    </>
  )
}

const FIGURE = 'font-poppins tabular-nums text-[#EAF2EC]'
const LABEL = 'font-tuvi-sans text-[13px] text-[#8FA394]'
const TRACK = 'h-1.5 flex-1 rounded-full bg-[#16211A]'
const FILL = 'block h-full rounded-full bg-[#10B981]'

export function AssetMockup() {
  const { t } = useLanguage()
  return (
    <Card alt={t('landing.moneyMockupAlt')}>
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-[#16211A] pb-3">
        <span className="font-poppins text-[10px] uppercase tracking-[0.18em] text-[#8FA394]">
          {t('landing.assetsTotal')}
        </span>
        <span className={`${FIGURE} text-xl`}>{formatDong(ASSET_TOTAL)}</span>
      </div>
      <div className="space-y-2.5">
        {ASSET_ROWS.map((row) => (
          <div key={row.key} className="flex items-center gap-3">
            <span className={`${LABEL} w-20 shrink-0`}>
              {t(
                `landing.assets${row.key === 'gold' ? 'Gold' : row.key === 'bank' ? 'Bank' : 'Cash'}`,
              )}
            </span>
            <span className={TRACK}>
              <span
                className={FILL}
                style={{ width: `${Math.round((row.amount / ASSET_TOTAL) * 100)}%` }}
              />
            </span>
            <span
              className={`${FIGURE} w-32 shrink-0 text-right text-[13px] ${
                row.gold ? 'text-[#E3B04B]' : ''
              }`}
            >
              {formatDong(row.amount)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function StockMockup() {
  const { t } = useLanguage()
  return (
    <Card alt={t('landing.stockMockupAlt')}>
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-[#16211A] pb-3">
        <span className="font-poppins text-[10px] uppercase tracking-[0.18em] text-[#8FA394]">
          {t('landing.stockHeading')}
        </span>
        <span className="font-tuvi-sans text-[11px] text-[#5C7062]">{t('landing.stockShare')}</span>
      </div>
      <div className="space-y-2.5">
        {STOCK_ROWS.map((row) => (
          <div key={row.key} className="flex items-center gap-3">
            <span className={`${LABEL} w-16 shrink-0`}>{t(`landing.stockCode${row.key}`)}</span>
            <span className={TRACK}>
              <span className={FILL} style={{ width: `${row.sharePct}%` }} />
            </span>
            <span className={`${FIGURE} w-10 shrink-0 text-right text-[13px]`}>
              {row.sharePct}%
            </span>
            {/* A loss renders in Muted, not in a third accent. DESIGN.md allows two
                accents on this page; emerald would misread a fall as a gain and gold
                is reserved for metal, so "down" is simply un-accented. */}
            <span
              className={`font-poppins tabular-nums w-16 shrink-0 text-right text-[13px] ${
                row.changePct < 0 ? 'text-[#8FA394]' : 'text-[#34D399]'
              }`}
            >
              {row.changePct > 0 ? '+' : ''}
              {row.changePct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#16211A] pt-3">
        <span className={LABEL}>{t('landing.stockAlertLabel')}</span>
        <span className={`${FIGURE} text-[13px]`}>
          {t('landing.stockAlertValue', { count: ALERTS_ARMED })}
        </span>
        <span className="font-tuvi-sans text-[11px] text-[#5C7062]">
          {t('landing.stockDisclaimer')}
        </span>
      </div>
    </Card>
  )
}

export function DayMockup() {
  const { t } = useLanguage()
  const pct = Math.round((DAY.caloriesEaten / DAY.caloriesTarget) * 100)
  const weightPct = Math.round((DAY.weightCurrent / DAY.weightTarget) * 100)
  return (
    <Card alt={t('landing.lifeMockupAlt')}>
      <div className="space-y-3.5">
        <div className="flex items-center gap-3">
          <span className={`${LABEL} w-20 shrink-0`}>{t('landing.dayToday')}</span>
          <div className="flex flex-wrap gap-1.5">
            {DAY.journal.map((kind, i) => (
              <span
                key={i}
                className={`rounded-full px-2.5 py-0.5 font-tuvi-sans text-[12px] ${
                  kind === 'good'
                    ? 'bg-[#12271D] text-[#34D399]'
                    : 'bg-[#161D18] text-[#8FA394]'
                }`}
              >
                {t(kind === 'good' ? 'landing.dayGood' : 'landing.dayBad')}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`${LABEL} w-20 shrink-0`}>{t('landing.dayCalories')}</span>
          <span className={`${FIGURE} text-[13px]`}>
            {DAY.caloriesEaten.toLocaleString('vi-VN')} / {DAY.caloriesTarget.toLocaleString('vi-VN')}
          </span>
          <span className={TRACK}>
            <span className={FILL} style={{ width: `${pct}%` }} />
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`${LABEL} w-20 shrink-0`}>{t('landing.dayGym')}</span>
          <span className="flex gap-1.5">
            {Array.from({ length: DAY.gymSessionsTotal }, (_, i) => (
              <span
                key={i}
                className={`h-3.5 w-3.5 rounded-full border ${
                  i < DAY.gymSessionsDone ? 'border-[#10B981] bg-[#10B981]' : 'border-[#2A382E]'
                }`}
              />
            ))}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`${LABEL} w-20 shrink-0`}>{t('landing.dayGoal')}</span>
          <span className={`${FIGURE} text-[13px]`}>{DAY.goalPct}%</span>
          <span className={TRACK}>
            <span className={FILL} style={{ width: `${DAY.goalPct}%` }} />
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`${LABEL} w-20 shrink-0`}>{t('landing.dayWeight')}</span>
          <span className={`${FIGURE} text-[13px]`}>
            {DAY.weightCurrent.toLocaleString('vi-VN')} / {DAY.weightTarget.toLocaleString('vi-VN')} kg
          </span>
          <span className={TRACK}>
            <span className={FILL} style={{ width: `${weightPct}%` }} />
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`${LABEL} w-20 shrink-0`}>{t('landing.dayAi')}</span>
          <span className={`${FIGURE} text-[13px]`}>
            {t('landing.dayAiValue', { count: DAY.aiInsightCount })}
          </span>
        </div>
      </div>
    </Card>
  )
}

/**
 * Block 02. Titles are short, generic post ideas rather than a real diary entry —
 * illustrative example content, not a reproduction of anyone's actual posts (FR-021)
 * — so the card can show the shape it claims: a title, a shorter rendered-body bar,
 * a tag, a relative date, and the private mark on every row.
 */
const BLOG_ROWS = [
  { tag: 'Health', bodyWidth: '92%', daysAgo: 2 },
  { tag: 'Money', bodyWidth: '85%', daysAgo: 6 },
  { tag: 'Note', bodyWidth: '96%', daysAgo: 9 },
] as const

export function BlogMockup() {
  const { t } = useLanguage()
  return (
    <Card alt={t('landing.blogMockupAlt')}>
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-[#16211A] pb-3">
        <span className="font-poppins text-[10px] uppercase tracking-[0.18em] text-[#8FA394]">
          {t('landing.blogHeading')}
        </span>
        <span className="font-tuvi-sans text-[11px] text-[#5C7062]">
          {t('landing.blogBilingualBadge')}
        </span>
      </div>
      <div className="space-y-4">
        {BLOG_ROWS.map((row) => (
          <div key={row.tag} className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="flex-1 truncate font-tuvi-sans text-[13px] text-[#EAF2EC]">
                {t(`landing.blogTitle${row.tag}`)}
              </span>
              <span className="ml-auto shrink-0 rounded-full bg-[#12271D] px-2 py-0.5 font-tuvi-sans text-[11px] text-[#34D399]">
                {t(`landing.blogTag${row.tag}`)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="h-1.5 rounded-full bg-[#16211A]"
                style={{ width: row.bodyWidth }}
              />
              <span className="ml-auto flex shrink-0 items-center gap-2">
                <span className="font-poppins text-[10px] text-[#5C7062]">
                  {t('landing.blogDaysAgo', { count: row.daysAgo })}
                </span>
                <span className="font-poppins text-[10px] uppercase tracking-[0.14em] text-[#5C7062]">
                  {t('landing.blogPrivateBadge')}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Block 06. A real sample quote — the app's own, credited to Notez, not a placeholder. */
export function QuoteMockup() {
  const { t } = useLanguage()
  return (
    <Card alt={t('landing.quoteMockupAlt')}>
      <p className="font-poppins text-[10px] uppercase tracking-[0.18em] text-[#8FA394]">
        {t('landing.quoteDailyLabel')}
      </p>
      <p className="mt-3.5 font-tuvi-sans text-[15px] leading-relaxed text-[#EAF2EC]">
        {t('landing.quoteText')
          .split('\n')
          .map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
      </p>
      <p className="mt-4 font-tuvi-sans text-[13px] text-[#8FA394]">
        {t('landing.quoteAuthorLabel')}
      </p>
    </Card>
  )
}

/**
 * The twelve palaces ring an open 2x2 centre, the way the real lá số is laid out
 * at /tu-vi/overview. Positions are explicit (1-indexed row, col) rather than
 * left to grid auto-placement, which a row-spanning centre cell would shift.
 *
 * Row/col and name live in one row per palace — not two parallel arrays — so
 * reordering or editing one can never silently mislabel a grid cell the way two
 * same-length arrays lined up only by a comment could. Names are in the same
 * cyclic order `build-chart.ts` reads them (from Mệnh): real structure, not a
 * real reading — like `BLOG_ROWS`'s tags, this names the shape of the feature
 * without inventing content for it.
 */
const PALACE_CELLS: readonly { row: number; col: number; name: string }[] = [
  { row: 1, col: 1, name: 'Mệnh' },
  { row: 1, col: 2, name: 'Huynh Đệ' },
  { row: 1, col: 3, name: 'Phu Thê' },
  { row: 1, col: 4, name: 'Tử Tức' },
  { row: 2, col: 4, name: 'Tài Bạch' },
  { row: 3, col: 4, name: 'Tật Ách' },
  { row: 4, col: 4, name: 'Thiên Di' },
  { row: 4, col: 3, name: 'Nô Bộc' },
  { row: 4, col: 2, name: 'Quan Lộc' },
  { row: 4, col: 1, name: 'Điền Trạch' },
  { row: 3, col: 1, name: 'Phúc Đức' },
  { row: 2, col: 1, name: 'Phụ Mẫu' },
]

export function PalaceMockup() {
  const { t } = useLanguage()
  return (
    <Card alt={t('landing.fateMockupAlt')}>
      <div className="flex flex-wrap items-center gap-5">
        <div className="grid shrink-0 grid-cols-4 grid-rows-4 gap-px rounded-lg bg-[#26332A] p-px">
          {PALACE_CELLS.map(({ row, col, name }) => (
            <span
              key={`${row}-${col}`}
              style={{ gridRow: row, gridColumn: col }}
              className="flex h-9 w-9 items-center justify-center bg-[#0F1712] px-0.5 text-center font-tuvi-sans text-[6.5px] leading-[1.05] text-[#5C7062]"
            >
              {name}
            </span>
          ))}
          <span
            style={{ gridRow: '2 / span 2', gridColumn: '2 / span 2' }}
            className="grid place-items-center bg-[#151B14] font-poppins text-[10px] uppercase tracking-[0.14em] text-[#E3B04B]"
          >
            {t('landing.fatePalaces')}
          </span>
        </div>
        <div className="min-w-40 flex-1 space-y-2.5">
          {AREA_SCORE_ROWS.map((row) => (
            <div key={row.key} className="flex items-center gap-3">
              <span className={`${LABEL} w-16 shrink-0`}>{t(`landing.area${row.key}`)}</span>
              <span className={TRACK}>
                <span className={FILL} style={{ width: `${row.scorePct}%` }} />
              </span>
              <span className={`${FIGURE} w-9 shrink-0 text-right text-[13px]`}>
                {row.scorePct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
