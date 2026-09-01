/**
 * What the landing page claims the product does — as data, so the claims can be counted.
 *
 * FR-025 requires each block to enumerate the capabilities its area actually ships, and
 * FR-019 requires every claim to be true today. Keeping the enumeration here rather than
 * inline in JSX buys two things: the count strip can be derived from the lists instead of
 * being a hand-typed number that drifts (see `COUNTS` and blocks.test.ts), and adding a
 * capability is a one-line change in a place a reviewer can diff against PRODUCT.md.
 *
 * Every string below is an i18n key suffix under `landing.cap.*` — never display copy
 * (FR-015). The dictionary is typed, so a key added here without copy in both languages
 * fails the typecheck rather than shipping a blank line.
 */

export type BlockId =
  | 'life'
  | 'fate'
  | 'money'
  | 'invest'
  | 'blog'
  | 'quotes'
  | 'privacy'

export type Block = {
  id: BlockId
  /** Ledger entry number. The page is an ordered record of what the app holds. */
  index: string
  /** Key suffixes under `landing.cap`. Order is display order. */
  caps: readonly string[]
  /** Gold is restricted to metal and to the horoscope — DESIGN.md Tokens. */
  accent?: 'gold'
  /** Blocks with a schematic mockup card; the rest are prose plus list. */
  mockup?: 'asset' | 'stock' | 'day' | 'palace' | 'blog' | 'quote'
  /**
   * Emphasis treatment: bigger heading, an emerald rule above the block, and a
   * full-width capability list (see `capsLayout` for how that list is columned).
   * Spent on the two claims the page has to land — the thing a visitor opens every
   * day (daily notes and calories), and the promise that what they put in it stays
   * theirs. Nothing else gets it; three emphasised blocks would mean none.
   */
  emphasis?: true
  /**
   * How the emphasised block's full-width list is columned. 'columns' fans it
   * across up to three; 'list' keeps it a single column even at full width — used
   * where the items read better as a short vertical list than spread sideways.
   * Meaningless unless `emphasis` is true.
   */
  capsLayout?: 'columns' | 'list'
}

/**
 * The money block. Mirrors PRODUCT.md § "Sổ tài chính": assets by kind, cash flow,
 * conversions, receivables/debts, net worth with allocation, live gold price, shared fund.
 */
const MONEY_CAPS = [
  'goldUnit',
  'cashflow',
  'convert',
  'debts',
  'netWorth',
  'goldPrice',
  'sharedFund',
] as const

/** The investing block. PRODUCT.md § "Stocks". */
const INVEST_CAPS = ['portfolio', 'watchlist', 'stockAi', 'alerts'] as const

/**
 * The notes and health block — the dashboard's eight areas, in tab order.
 *
 * Eight, not nine: the five-meal daily plan is a sub-panel of calorie tracking rather
 * than its own tab (PRODUCT.md says so explicitly), so it is named inside the `calories`
 * line. The count strip's "8" is derived from this list, so the two cannot disagree —
 * which is also why the emphasis this block now carries had to be spent on copy and
 * layout rather than on splitting a line in two to make the list look longer.
 *
 * Habits are named inside `journal` because that is where they live: the `notes` tab
 * holds the good/bad entries AND the pinned habits with `notify_times` that
 * `/api/habits-notify` reminds on. Food-photo AI is named inside `calories` for the
 * same reason — it is a step in that flow, not a ninth area — and it also appears in
 * the AI block's roster, which is the one place the "N AI features" count comes from.
 */
const LIFE_CAPS = [
  'journal',
  'todos',
  'calories',
  'trackers',
  'goals',
  'calendar',
  'reading',
  'stats',
] as const

/** The horoscope block. Only what is live — nothing from the unbuilt roadmap (FR-019). */
const FATE_CAPS = ['lunar', 'palaces', 'scores', 'fateAi'] as const

/**
 * The AI feature count behind the count strip's "AI features" stat. Five, and
 * deliberately not six — no dedicated block names them (each already appears inside
 * its own area's capability list: `calories`, `stockAi`, `fateAi`, `stats`), but the
 * count itself still has to be real.
 *
 * `AI_TRIAL_LIMITS` holds four features and tử vi adds two readings, which is where
 * PRODUCT.md's "6 AI surfaces" comes from. `stock_suggestions` is admin-only, enforced
 * on the server (ADR-015), so a stranger who signed up could never reach it — listing it
 * would be a claim that is false for the reader (FR-019). It is left out.
 */
export const AI_FEATURE_COUNT = 5

/**
 * The blog block. Private per account since ADR-018 — that reversal is the interesting
 * part of the claim, so the copy leads with it rather than with "we have a blog".
 */
const BLOG_CAPS = ['blogPrivate', 'blogTags', 'blogMarkdown', 'blogSeeded', 'blogBilingual'] as const

/** The quotes block. `/quotes` is per-user CRUD over the `quotes` table. */
const QUOTES_CAPS = ['quoteOwn', 'quoteDaily', 'quoteAuthor'] as const

/** The privacy block. Claims here must match what RLS actually enforces. */
const PRIVACY_CAPS = ['ownAccount', 'noPeeking', 'noAds', 'inviteOnly'] as const

/**
 * Display order is FR-022's fixed block order — and the order is a priority claim, not
 * a tour of the schema. Daily notes, calories and the food-photo read come first and
 * carry the page's emphasis because that is the thing a visitor will open the app to do
 * every day; assets and investing are the deeper feature but the rarer visit. Investing
 * follows money rather than standing alone in the running order, because it is part of
 * `/finance` (see PRODUCT_AREA_IDS).
 */
export const BLOCKS: readonly Block[] = [
  { id: 'life', index: '01', caps: LIFE_CAPS, mockup: 'day', emphasis: true, capsLayout: 'columns' },
  { id: 'blog', index: '02', caps: BLOG_CAPS, mockup: 'blog' },
  { id: 'fate', index: '03', caps: FATE_CAPS, mockup: 'palace', accent: 'gold' },
  { id: 'money', index: '04', caps: MONEY_CAPS, mockup: 'asset' },
  { id: 'invest', index: '05', caps: INVEST_CAPS, mockup: 'stock' },
  { id: 'quotes', index: '06', caps: QUOTES_CAPS, mockup: 'quote' },
  { id: 'privacy', index: '07', caps: PRIVACY_CAPS, emphasis: true, capsLayout: 'list' },
] as const

/**
 * The product's distinct surfaces — the number the count strip claims — in the running
 * order, so the list reads the same way the page does.
 *
 * Investing has its own block because it deserves its own mockup and capability list,
 * but it is **not** a separate area: PRODUCT.md is explicit that Stocks is "part of
 * /finance". So the page shows six mockups and truthfully claims five areas. If stocks
 * ever becomes its own route, it joins this list and the strip follows on its own.
 */
export const PRODUCT_AREA_IDS: readonly BlockId[] = [
  'life',
  'blog',
  'fate',
  'money',
  'quotes',
] as const

/**
 * The count strip — four countable facts, every one derived rather than typed.
 *
 * This is the page's answer to "how much is in here", the question revision 1 of the
 * design failed. A hard-coded number here would be the first claim on the page to rot.
 */
export const COUNTS = {
  areas: PRODUCT_AREA_IDS.length,
  dashboardAreas: LIFE_CAPS.length,
  aiFeatures: AI_FEATURE_COUNT,
} as const

/** Every block, keyed, for the few places that need one by id. */
export function blockById(id: BlockId): Block {
  const block = BLOCKS.find((b) => b.id === id)
  if (!block) throw new Error(`unknown landing block: ${id}`)
  return block
}
