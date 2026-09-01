'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/language-context'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { SignInButtons } from './_landing/SignInButtons'
import {
  AssetMockup,
  BlogMockup,
  DayMockup,
  PalaceMockup,
  QuoteMockup,
  StockMockup,
} from './_landing/Mockup'
import { HeroField } from './_landing/HeroField'
import { BLOCKS, COUNTS, type Block } from './_landing/blocks'

/**
 * Public landing page (feature 012, design revision 2).
 * Design: docs/DESIGN.md § Public Landing Page — "the instrument panel at night".
 *
 * Two accents, each with one meaning: emerald is money-you-own, gold is metal and the
 * tử vi block. Emerald fills the primary button and carries text, which only works
 * because the ground is dark — the reverse was true of revision 1, and reverting the
 * ground without reverting the button would break contrast (see DESIGN.md Tokens).
 *
 * The page's copy comes entirely from `landing.*` keys and its capability lists from
 * `_landing/blocks.ts`, so what the page claims is reviewable in one place (FR-019/025).
 */

const SECTION = 'border-t border-[#1E2B22]'
const SHELL = 'mx-auto w-full max-w-[1120px] px-5 sm:px-8'
const EYEBROW = 'font-poppins text-[11px] uppercase leading-relaxed tracking-[0.2em]'

/** The emerald tick that opens every capability line. Decorative — the text is the item. */
function Tick() {
  return (
    <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#34D399]" />
  )
}

function CapabilityList({
  caps,
  layout = 'inline',
}: {
  caps: readonly string[]
  /**
   * 'inline' sits inside the prose column at its normal reading width. 'columns'
   * and 'list' both run full width below it (see Entry) — 'columns' balances an
   * odd item count across up to three columns by height instead of a grid's
   * row-major fill (which left a near-empty final row when the count didn't
   * divide evenly); 'list' keeps that same full-width row a single column for a
   * short list that reads better stacked than spread sideways.
   */
  layout?: 'inline' | 'columns' | 'list'
}) {
  const { t } = useLanguage()
  const wide = layout !== 'inline'
  return (
    <ul
      className={
        layout === 'columns'
          ? 'mt-8 columns-2 gap-x-8 sm:columns-3'
          : layout === 'list'
            ? 'mt-8 space-y-3'
            : 'mt-6 space-y-2.5'
      }
    >
      {caps.flatMap((cap) =>
        // A capability's copy may hold multiple `\n`-joined lines when one dashboard
        // area bundles distinct features — each line gets its own bullet so the list
        // reads naturally, without inflating the underlying capability count (which
        // COUNTS.dashboardAreas ties to the real number of dashboard tabs).
        t(`landing.cap.${cap}`)
          .split('\n')
          .map((line, i) => (
            <li
              key={`${cap}-${i}`}
              className={`flex gap-2.5 break-inside-avoid ${wide ? 'mb-3' : ''}`}
            >
              <Tick />
              <span
                className={`font-tuvi-sans leading-relaxed text-[#C6D3C8] ${
                  wide ? 'text-[13px]' : 'text-[14px]'
                }`}
              >
                {line}
              </span>
            </li>
          )),
      )}
    </ul>
  )
}

// A Record keyed by the full union, not a chain of `if`s with a catch-all —
// adding a mockup kind to `Block['mockup']` without adding it here fails to
// compile instead of silently falling through to whatever the last branch was.
const MOCKUP_COMPONENTS: Record<NonNullable<Block['mockup']>, () => React.JSX.Element> = {
  asset: AssetMockup,
  stock: StockMockup,
  day: DayMockup,
  blog: BlogMockup,
  quote: QuoteMockup,
  palace: PalaceMockup,
}

function Mockup({ kind }: { kind: NonNullable<Block['mockup']> }) {
  const Component = MOCKUP_COMPONENTS[kind]
  return <Component />
}

/**
 * One ledger entry. Blocks with a mockup are a two-column band that alternates side by
 * index, so the eye does not fall straight down one column; blocks without one run to a
 * single readable measure rather than stretching a list across 1120px.
 */
function Entry({ block, flip }: { block: Block; flip: boolean }) {
  const { t } = useLanguage()
  const gold = block.accent === 'gold'
  const big = block.emphasis === true

  const prose = (
    <div>
      <p className={`${EYEBROW} text-[#8FA394]`}>
        <span className={gold ? 'text-[#E3B04B]' : 'text-[#34D399]'}>{block.index}</span>{' '}
        {t(`landing.block.${block.id}.eyebrow`)}
      </p>
      <h2
        className={`mt-4 font-tuvi-serif font-semibold leading-snug tracking-tight text-[#EAF2EC] ${
          big ? 'text-[30px] sm:text-[40px]' : 'text-[26px] sm:text-[32px]'
        }`}
      >
        {t(`landing.block.${block.id}.title`)}
      </h2>
      <p
        className={`mt-4 font-tuvi-sans leading-relaxed ${
          big ? 'text-[16px] text-[#C6D3C8] sm:text-[17px]' : 'text-[15px] text-[#8FA394]'
        }`}
      >
        {t(`landing.block.${block.id}.body`)}
      </p>
      {/* The emphasised block's list runs full width below this row instead — see the
          `big &&` branch below — so its four columns have the whole shell to fan into,
          not just the half this prose column occupies. */}
      {!big && <CapabilityList caps={block.caps} />}
    </div>
  )

  return (
    <section className={big ? 'border-t border-[#34D399]/35' : SECTION}>
      <div className={`${SHELL} ${big ? 'py-16 sm:py-24' : 'py-14 sm:py-20'}`}>
        {block.mockup ? (
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Mockup last in the DOM on every block, so reading order never depends on
                which side the card is drawn — `order` only moves it visually at lg. */}
            <div className={flip ? 'lg:order-2' : ''}>{prose}</div>
            <div className={flip ? 'lg:order-1' : ''}>
              <Mockup kind={block.mockup} />
            </div>
          </div>
        ) : (
          <div className="max-w-[680px]">{prose}</div>
        )}
        {big && <CapabilityList caps={block.caps} layout={block.capsLayout ?? 'columns'} />}
      </div>
    </section>
  )
}

/** Four countable facts. Every number is derived in blocks.ts, never typed here. */
function CountStrip() {
  const { t } = useLanguage()
  const items = [
    { value: String(COUNTS.areas), label: t('landing.countAreasLabel') },
    { value: String(COUNTS.dashboardAreas), label: t('landing.countDashboardLabel') },
    { value: String(COUNTS.aiFeatures), label: t('landing.countAiLabel') },
    { value: t('landing.countPriceValue'), label: t('landing.countPriceLabel') },
  ]
  return (
    <section className={SECTION}>
      <div className={`${SHELL} py-7`}>
        <dl className="grid grid-cols-2 gap-y-6 sm:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="flex items-baseline gap-2.5">
              <dt className="sr-only">{item.label}</dt>
              <dd className="flex items-baseline gap-2.5">
                <span className="font-poppins tabular-nums text-[22px] text-[#34D399]">
                  {item.value}
                </span>
                <span className="font-tuvi-sans text-[13px] text-[#8FA394]">{item.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

export default function LandingClient() {
  const { t } = useLanguage()

  return (
    <main className="min-h-screen bg-[#080D0A] text-[#EAF2EC]">
      {/* Written out rather than derived from SECTION: Tailwind scans source text, so a
          class name built at runtime is never generated. */}
      <div className="border-b border-[#1E2B22]">
        <div className={`${SHELL} flex items-center justify-between gap-4 py-3.5`}>
          <span className={`${EYEBROW} text-[#EAF2EC]`}>{t('landing.brand')}</span>
          <div className="flex items-center gap-4">
            <LanguageSwitch tone="dark" />
            {/* `/login` is the sign-in route and is public — the one destination FR-013
                allows in the page chrome. */}
            <Link
              href="/login"
              className="rounded-xl border border-[#2A382E] px-3.5 py-2 font-tuvi-sans text-[13px] text-[#EAF2EC] transition-colors hover:border-[#34D399] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34D399]"
            >
              {t('landing.signIn')}
            </Link>
          </div>
        </div>
      </div>

      <section className="relative isolate overflow-hidden">
        <HeroField />
        {/* Tighter top on mobile so BOTH provider buttons clear a 360x640 fold, which is
            what DESIGN.md promises. At sm and up there is room to spare, so it is unchanged. */}
        <div className={`${SHELL} relative pt-11 pb-16 sm:py-24`}>
          <div className="max-w-[760px]">
            <h1 className="font-tuvi-serif text-[32px] font-semibold leading-[1.12] tracking-tight sm:text-[58px] sm:leading-[1.1]">
              {t('landing.heroLine')}
            </h1>
            <p className="mt-6 max-w-[700px] font-tuvi-sans text-[15px] leading-relaxed text-[#C6D3C8] sm:text-base">
              {t('landing.heroBody')}
            </p>
            {/* The two questions every visitor has, answered before the ask: what does
                it cost, and who can see what I put in. Both carry an emerald tick so
                they read as commitments rather than as more body copy. */}
            <ul className="mt-6 space-y-2.5">
              {(['heroPrice', 'heroPrivacy'] as const).map((key) => (
                <li key={key} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#34D399]"
                  />
                  <span className="font-tuvi-sans text-[15px] leading-relaxed text-[#EAF2EC] sm:text-base">
                    {t(`landing.${key}`)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-9">
              <SignInButtons />
            </div>
          </div>
        </div>
      </section>

      <CountStrip />

      {BLOCKS.map((block, i) => (
        <Entry key={block.id} block={block} flip={i % 2 === 1} />
      ))}

      <section className={SECTION}>
        <div className={`${SHELL} py-14 sm:py-16`}>
          <h2 className="max-w-[520px] font-tuvi-serif text-[24px] font-semibold leading-snug tracking-tight sm:text-[28px]">
            {t('landing.footerCta')}
          </h2>
          <div className="mt-7">
            <SignInButtons size="sm" />
          </div>
          <nav className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 font-tuvi-sans text-[13px]">
            <Link
              href="/blog"
              className="text-[#C6D3C8] underline decoration-[#2A382E] underline-offset-4 transition-colors hover:decoration-[#34D399]"
            >
              {t('landing.footerBlog')}
            </Link>
            <Link
              href="/privacy"
              className="text-[#C6D3C8] underline decoration-[#2A382E] underline-offset-4 transition-colors hover:decoration-[#34D399]"
            >
              {t('landing.footerPrivacy')}
            </Link>
          </nav>
        </div>
      </section>
    </main>
  )
}
