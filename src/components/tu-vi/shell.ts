/**
 * The ground and the card every Xem tử vi screen sits on.
 *
 * Shared rather than repeated so the form a reader fills in and the lá số it
 * produces are visibly the same document: the same mint ground, the same
 * emerald-lit card. They were drifting apart while these strings lived in one
 * page file.
 */
export const TUVI_PAGE_SHELL =
  'min-h-svh bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_38%),radial-gradient(circle_at_82%_12%,rgba(52,211,153,0.14),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f6fef9_100%)] px-4 pb-16 pt-24 sm:px-6'

export const TUVI_CARD =
  'relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-white/85 shadow-[0_30px_60px_-45px_rgba(16,185,129,0.45)] backdrop-blur'
