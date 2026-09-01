/**
 * Illustrative figures for the landing page mockups.
 *
 * Every number here is invented. FR-021 requires a visitor to be unable to
 * mistake a mockup for live data, and 2-plan.md R4 rules out calling the real
 * gold-price endpoint from a public page: it takes no auth, so every stranger's
 * page view would trigger an upstream fetch for a number that must not look real
 * anyway. So the gold holding is a constant priced by a constant.
 */

/** Money the way this app writes it: dot-grouped thousands, đồng suffix. */
export function formatDong(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} ₫`
}

const GOLD_CHI = 6.2

/**
 * Price of one chỉ, in đồng.
 *
 * This must stay in the same order of magnitude the app's own converter produces:
 * `usdOunceToVndChi` divides by ~8.29 chỉ per troy ounce, so a chỉ is roughly a
 * tenth of a lượng and lands near ten million đồng, not near a hundred million.
 * The first version of this file was off by ~9x — it had priced a *lượng* and
 * labelled it a chỉ. `figures.test.ts` pins the magnitude against the real converter.
 */
const PRICE_PER_CHI = 10_300_000

/**
 * The illustrative gold holding, in the unit this product is named for.
 *
 * It used to drive a hero row that repriced itself once on load, to demonstrate the
 * chỉ→đồng arithmetic. That row is gone: the page now leads with daily notes and
 * calories, so opening on a gold figure argued for the wrong thing. The holding
 * survives because block 03's asset card still needs a gold line, and it reads it
 * from here rather than copying the number.
 */
export const GOLD_HOLDING = {
  chi: GOLD_CHI,
  pricePerChi: PRICE_PER_CHI,
  amount: Math.round(GOLD_CHI * PRICE_PER_CHI),
} as const

export type AssetRow = {
  /** i18n key suffix under `landing.assets.*` — never a literal label. */
  key: 'gold' | 'bank' | 'cash'
  amount: number
  /** Gold wears the ochre figure treatment; nothing else on the page does. */
  gold?: true
}

/**
 * Block 01, largest first so the bars descend.
 *
 * The gold line is read from `GOLD_HOLDING` rather than copied, so the weight, the
 * price and the đồng figure can never drift apart. A mockup whose total is not the sum
 * of its rows would contradict the one thing this page argues — that the app does real
 * arithmetic — fake figures or not.
 *
 * The totals describe a plausible individual rather than a large fortune: the page is
 * addressed to someone deciding whether to keep a notebook, not to a private bank.
 */
export const ASSET_ROWS: readonly AssetRow[] = [
  { key: 'bank', amount: 210_000_000 },
  { key: 'cash', amount: 70_000_000 },
  { key: 'gold', amount: GOLD_HOLDING.amount, gold: true },
] as const

export const ASSET_TOTAL = ASSET_ROWS.reduce((sum, row) => sum + row.amount, 0)

/**
 * Block 02. The target sits ABOVE intake on purpose — this owner is gaining weight.
 * The weight figures follow the same story: current sits below target, not above.
 */
export const DAY = {
  journal: ['good', 'good', 'bad'] as const,
  caloriesEaten: 1_840,
  caloriesTarget: 2_400,
  gymSessionsDone: 3,
  gymSessionsTotal: 4,
  weightCurrent: 62.4,
  weightTarget: 65,
  goalPct: 68,
  aiInsightCount: 5,
} as const

export type StockRow = {
  /** i18n key suffix under `landing.stockCode*`. Never a real ticker — see below. */
  key: 'A' | 'B' | 'C'
  /** Share of the illustrative portfolio, in percent. */
  sharePct: number
  /** Session change, in percent. Signed. */
  changePct: number
}

/**
 * Block 02. The holdings are deliberately unnamed.
 *
 * Any three-letter code is a real security on HNX or HOSE, and a landing page showing a
 * named ticker beside a green number is a recommendation whether or not it is labelled
 * illustrative (FR-021). So the rows are `mã 1 / mã 2 / mã 3` and the figures below are
 * invented.
 */
export const STOCK_ROWS: readonly StockRow[] = [
  { key: 'A', sharePct: 46, changePct: 2.4 },
  { key: 'B', sharePct: 33, changePct: -1.1 },
  { key: 'C', sharePct: 21, changePct: 0.6 },
] as const

/** Illustrative count of armed price alerts, for the block's second row. */
export const ALERTS_ARMED = 4

export type AreaScoreRow = {
  /** i18n key suffix under `landing.area*` — never a literal label. */
  key: 'Love' | 'Family' | 'Career' | 'Health'
  /** Illustrative score, 0-100 — mirrors the real app's 0-100% scale (ADR-012). */
  scorePct: number
}

/**
 * Block 03 (fate) mockup. Four of the real app's eight scored life areas
 * (ADR-012) — a number and a bar per area, never narrative interpretation text,
 * so the card cannot be mistaken for an actual AI reading (FR-021) the same way
 * `BLOG_ROWS` avoids inventing post titles.
 */
export const AREA_SCORE_ROWS: readonly AreaScoreRow[] = [
  { key: 'Love', scorePct: 82 },
  { key: 'Family', scorePct: 74 },
  { key: 'Career', scorePct: 65 },
  { key: 'Health', scorePct: 58 },
] as const
