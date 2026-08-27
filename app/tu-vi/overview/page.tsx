'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useInterpretation } from '@/hooks/useInterpretation'
import { usePalaceReadings } from '@/hooks/usePalaceReadings'
import { fetchHoroscopeProfile } from '@/lib/horoscope-profile-client'
import type { HoroscopeProfile } from '@/lib/horoscope-profile'
import type { Palace } from '@/lib/tuvi/types'
import { buildReading } from '@/lib/tuvi/reading'
import { birthFacts } from '@/lib/tuvi/birth-facts'
import { vietnamTodaySolar } from '@/lib/horoscope-interpretation'
import { westernZodiacSign } from '@/lib/western-zodiac'
import { LaSoFull, LaSoLegend } from '@/components/tu-vi/LaSoGrid'
import { PalaceDetail } from '@/components/tu-vi/PalaceDetail'
import { ReadingSections } from '@/components/tu-vi/ReadingSections'
import { TUVI_CARD, TUVI_PAGE_SHELL } from '@/components/tu-vi/shell'

// The page ground and the document card are shared by the loading, error and
// loaded states, so a retry or a slow profile fetch never changes the shape of
// the screen under the reader — and by the birth-data form, so filling it in and
// reading the result look like one document.
const PAGE_SHELL = TUVI_PAGE_SHELL
const CARD = TUVI_CARD

const GENDER_LABEL: Record<string, string> = {
  nam: 'tuVi.genderNam',
  nu: 'tuVi.genderNu',
  khac: 'tuVi.genderKhac',
}

/** A layout-shaped placeholder bar, so the wait reads as this page arriving
    rather than as a spinner on an empty screen. */
function Skeleton({ className }: { className: string }) {
  return (
    <span className={`inline-block overflow-hidden rounded-lg bg-emerald-50 ${className}`}>
      <span className="relative block h-full w-1/3 animate-shimmer-sweep bg-white/70 motion-reduce:hidden" />
    </span>
  )
}

/**
 * The birth data the chart was built from, under the chart it explains.
 *
 * The lunar date is derived rather than read back from storage, so what is on
 * screen is always the date the reading used. A missing hour is called out in
 * amber rather than left blank: without it a good half of the stars are omitted
 * (FR-016), and a reader who cannot see that has no way to know why their chart
 * looks sparse.
 */
function BirthFacts({ facts }: { facts: NonNullable<ReturnType<typeof birthFacts>> }) {
  const { t } = useLanguage()
  return (
    <dl className="mt-3 space-y-1 rounded-xl border border-emerald-100 bg-emerald-50/30 px-3 py-2.5 font-tuvi-sans text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-[#52525b]">{t('tuVi.birthDateLabel')}</dt>
        <dd className="font-medium tabular-nums text-[#18181b]">{facts.solar}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-[#52525b]">{t('tuVi.birthDateLunarLabel')}</dt>
        <dd className="font-medium tabular-nums text-[#18181b]">{facts.lunar}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-[#52525b]">{t('tuVi.birthTimeLabel')}</dt>
        {facts.hour ? (
          <dd className="font-medium text-[#18181b]">
            <span className="tabular-nums">{facts.hour.clock}</span>{' '}
            <span className="text-[#52525b]">
              ({t('tuVi.birthHourOf', { branch: facts.hour.branch })})
            </span>
          </dd>
        ) : (
          <dd className="font-medium text-[#b45309]">{t('tuVi.birthTimeUnknownValue')}</dd>
        )}
      </div>
    </dl>
  )
}

export default function TuViOverviewPage() {
  const router = useRouter()
  const { t, lang } = useLanguage()
  const { user, loading: authLoading } = useRequireAuth()
  const [profile, setProfile] = useState<HoroscopeProfile | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [openPalace, setOpenPalace] = useState<Palace | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const interpretation = useInterpretation(lang)
  // Loaded separately from the sections: twelve palaces is a much larger
  // generation, and one failing must not take the other down.
  const palaceReadings = usePalaceReadings(lang)

  useEffect(() => {
    if (!user) return
    const userId = user.id
    // A retry must not be overwritten by a slower earlier attempt resolving late.
    let cancelled = false

    async function loadProfile() {
      const { profile: saved, error } = await fetchHoroscopeProfile(userId)
      if (cancelled) return
      // A fetch error must NOT be treated as "no profile" — that would bounce an
      // already-onboarded user back into onboarding on a transient network blip.
      if (error) {
        setLoadFailed(true)
        setCheckingProfile(false)
        return
      }
      if (!saved) {
        router.replace('/tu-vi')
        return
      }
      setProfile(saved)
      setLoadFailed(false)
      setCheckingProfile(false)
    }

    void loadProfile()
    return () => {
      cancelled = true
    }
  }, [user, router, reloadKey])

  // The whole computed layer is local and synchronous — it never waits on the
  // network, so the reading is on screen as soon as the profile is.
  // Same Vietnam clock the interpretation route uses, so the cycles on screen and
  // the AI text beside them always describe the same day. Read on every render as
  // a plain string, so the memo re-runs once the Vietnam date rolls over instead
  // of freezing the date it first saw.
  const today = vietnamTodaySolar(new Date())
  const todayKey = `${today.year}-${today.month}-${today.day}`

  const reading = useMemo(() => {
    if (!profile) return null
    const [year, month, day] = todayKey.split('-').map(Number)
    return buildReading(profile, { day, month, year })
  }, [profile, todayKey])

  const displayName = (user?.user_metadata?.full_name as string | undefined)?.trim()

  // What the reader actually entered. Nothing else on this screen shows it, so
  // a mistyped birth hour — which silently changes every palace — was until now
  // only discoverable by opening the edit form.
  const facts = useMemo(() => (profile ? birthFacts(profile) : null), [profile])

  const westernSign = useMemo(() => {
    if (!profile) return null
    const [, month, day] = profile.birthDateSolar.split('-').map(Number)
    return westernZodiacSign({ month, day })
  }, [profile])

  if (authLoading || checkingProfile) {
    return (
      <main className={PAGE_SHELL}>
        <div className={`${CARD} mx-auto w-full max-w-md p-5 sm:p-6 md:max-w-3xl md:p-8 lg:max-w-6xl lg:p-10 xl:max-w-7xl`}>
          <p className="sr-only" aria-live="polite">
            {t('common.loading')}
          </p>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-6 w-44 max-w-full" />
              <Skeleton className="h-4 w-52 max-w-full" />
            </div>
            <Skeleton className="size-16 shrink-0 sm:size-20" />
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </main>
    )
  }

  if (loadFailed || !profile || !reading) {
    return (
      <main className={PAGE_SHELL}>
        <div className={`${CARD} mx-auto w-full max-w-md p-6 text-center`}>
          <p className="text-sm text-[#52525b]">{t('tuVi.loadError')}</p>
          <button
            type="button"
            onClick={() => {
              setCheckingProfile(true)
              setReloadKey((key) => key + 1)
            }}
            className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 text-sm font-medium text-[#047857] transition-all hover:bg-emerald-100/70 active:scale-[0.98]"
          >
            {t('tuVi.loadRetry')}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className={PAGE_SHELL}>
      {/* Below md this stays the single mobile card it always was. From md up
          it widens into a two-column spread — chart rail beside the reading —
          instead of stretching the same phone-width card across a wide viewport. */}
      <div
        className={`${CARD} animate-fade-in-up mx-auto w-full max-w-md p-5 motion-reduce:animate-none sm:p-6 md:max-w-3xl md:p-8 lg:max-w-6xl lg:p-10 xl:max-w-7xl`}
      >
        {/* One decorative flourish, behind the header, so the card has depth
            without any second accent colour entering the page. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-12 size-56 rounded-full bg-emerald-300/20 blur-3xl"
        />

        <header className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-0.5 font-tuvi-serif text-[11px] tracking-[0.22em] text-[#047857]">
              {t('tuVi.overviewHeading')}
            </p>
            <h1 className="mt-2 font-tuvi-serif text-3xl leading-tight text-[#18181b] md:text-4xl">
              {reading.yearName}
            </h1>
            {/* One middle dot on this line, which is the ration (taste-skill 9.F);
                the Western sign is parenthetical rather than a second dot. */}
            <p className="mt-1 font-tuvi-sans text-base text-[#52525b]">
              {/* Nạp âm is not repeated here: it sits in the thiên bàn at the
                  centre of the chart, which is where a lá số traditionally
                  carries it, and printing it twice on one screen said nothing
                  the second time. */}
              {t('tuVi.zodiacPrefix')} {reading.zodiac}
              {westernSign && ` (${westernSign})`}
            </p>
            <Link
              href="/tu-vi/edit"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white/70 px-2.5 py-1 text-sm text-[#047857] transition-all hover:bg-emerald-50 active:scale-[0.98]"
            >
              <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              {t('tuVi.editTitle')}
            </Link>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2.5">
            <dl className="font-tuvi-sans text-xs leading-relaxed text-[#52525b] sm:text-sm">
              {displayName && (
                <div className="flex items-baseline justify-end gap-1.5">
                  <dt>{t('tuVi.identityNameLabel')}:</dt>
                  <dd className="max-w-28 truncate font-medium text-[#18181b] sm:max-w-40">
                    {displayName}
                  </dd>
                </div>
              )}
              <div className="flex items-baseline justify-end gap-1.5">
                <dt>{t('tuVi.identityAgeLabel')}:</dt>
                <dd className="font-medium tabular-nums text-[#18181b]">{reading.age}</dd>
              </div>
              <div className="flex items-baseline justify-end gap-1.5">
                <dt>{t('tuVi.genderLabel')}:</dt>
                <dd className="font-medium text-[#18181b]">{t(GENDER_LABEL[profile.gender])}</dd>
              </div>
            </dl>
          </div>
        </header>

        <div className="relative mt-6 lg:grid lg:grid-cols-[minmax(0,440px)_1fr] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,480px)_1fr] xl:gap-12">
          {/* Sticky at lg+, which is what keeps the two columns from producing a
              tall dead space: the reading column is far longer than the chart can
              ever be, so instead of trying to balance their heights the chart
              stays in view while the reading scrolls past it.
              Reachable even without a birth hour — the branches, their Can Chi
              and the year-placed stars do not need it (FR-016). */}
          <section className="border-t border-emerald-100/80 pt-5 lg:sticky lg:top-24 lg:border-t-0 lg:pt-0">
            <h2 className="sr-only">{t('tuVi.openChart')}</h2>
            <div className="rounded-2xl border border-emerald-100 bg-white p-2 shadow-[0_18px_36px_-30px_rgba(16,185,129,0.4)] sm:p-3">
              <LaSoFull
                chart={reading.chart}
                onSelectPalace={(palace) =>
                  setOpenPalace((current) => (current?.index === palace.index ? null : palace))
                }
                selectedIndex={openPalace?.index ?? null}
                identity={
                  <>
                    <span className="font-tuvi-serif text-lg text-[#18181b] sm:text-2xl">
                      {reading.yearName}
                    </span>
                    <span className="font-tuvi-sans text-[11px] text-[#52525b] sm:text-sm">
                      {reading.napAm.name}
                    </span>
                    {reading.chart.cuc && (
                      <span className="font-tuvi-sans text-[11px] text-[#047857] sm:text-sm">
                        {reading.chart.cuc.name}
                      </span>
                    )}
                  </>
                }
              />
            </div>
            <p className="mt-2.5 text-center font-tuvi-sans text-sm text-[#52525b]">
              {t('tuVi.chartHint')}
            </p>
            <LaSoLegend />
            {facts && <BirthFacts facts={facts} />}
            {openPalace && (
              <PalaceDetail
                palace={openPalace}
                readings={palaceReadings}
                onClose={() => setOpenPalace(null)}
              />
            )}
          </section>

          <div className="mt-5 lg:mt-0">
            {/* No refresh offer, deliberately. A reading is bought once when birth data is
                saved, and after that this screen only reads the database. The ten chart
                sections never age; the eleventh carries a Lưu nguyệt line that goes a month
                out of date, which is not worth a button — the reading is context, not a
                record anyone acts on. Nothing here can spend money. */}
            <ReadingSections reading={reading} interpretation={interpretation} />
          </div>
        </div>

        <p className="relative mt-6 border-t border-emerald-100/80 pt-4 text-sm leading-relaxed text-[#52525b]">
          {t('tuVi.disclaimer')}
        </p>
      </div>

    </main>
  )
}
