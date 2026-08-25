'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useInterpretation } from '@/hooks/useInterpretation'
import { fetchHoroscopeProfile } from '@/lib/horoscope-profile-client'
import type { HoroscopeProfile } from '@/lib/horoscope-profile'
import { buildReading } from '@/lib/tuvi/reading'
import { vietnamTodaySolar } from '@/lib/horoscope-interpretation'
import { LaSoFull, LaSoMini } from '@/components/tu-vi/LaSoGrid'
import { ChartOverlay } from '@/components/tu-vi/ChartOverlay'
import { ReadingSections } from '@/components/tu-vi/ReadingSections'

export default function TuViOverviewPage() {
  const router = useRouter()
  const { t, lang } = useLanguage()
  const { user, loading: authLoading } = useRequireAuth()
  const [profile, setProfile] = useState<HoroscopeProfile | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [chartOpen, setChartOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const interpretation = useInterpretation(lang)

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

  if (authLoading || checkingProfile) {
    return (
      <main className="min-h-svh bg-[#f7fef9] pt-24">
        <p className="text-center text-sm text-[#52525b]">{t('common.loading')}</p>
      </main>
    )
  }

  if (loadFailed || !reading) {
    return (
      <main className="min-h-svh bg-[#f7fef9] px-4 pb-16 pt-24 sm:px-6">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-[#e4e4e7] bg-[#ffffff] p-6 text-center">
          <p className="text-sm text-[#52525b]">{t('tuVi.loadError')}</p>
          <button
            type="button"
            onClick={() => {
              setCheckingProfile(true)
              setReloadKey((key) => key + 1)
            }}
            className="mt-3 rounded-lg border border-[#047857] px-3 py-1.5 text-sm font-medium text-[#047857] transition-all hover:bg-[#ecfdf5] active:scale-[0.98]"
          >
            {t('tuVi.loadRetry')}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-[#f7fef9] px-4 pb-16 pt-24 sm:px-6">
      {/* Below md this stays the single mobile card it always was. From md up
          it widens into a two-column spread — chart rail beside the reading —
          instead of stretching the same phone-width card across a wide viewport. */}
      <div className="animate-fade-in-up mx-auto w-full max-w-md rounded-2xl border border-[#e4e4e7] bg-[#ffffff] p-5 shadow-[0_20px_42px_-32px_rgba(24,24,27,0.35)] motion-reduce:animate-none sm:p-6 md:max-w-4xl md:p-8 lg:max-w-5xl lg:p-10">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-tuvi-serif text-[11px] tracking-[0.2em] text-[#047857]">
              {t('tuVi.overviewHeading')}
            </p>
            <h1 className="mt-1 font-tuvi-serif text-lg leading-tight text-[#18181b] md:text-2xl">
              {reading.yearName}
            </h1>
            {/* One middle dot on this line, which is the ration (taste-skill 9.F). */}
            <p className="font-tuvi-sans text-sm text-[#52525b]">
              {reading.napAm.name} · {t('tuVi.zodiacPrefix')} {reading.zodiac}
            </p>
            <Link
              href="/tu-vi/edit"
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-[#52525b] underline-offset-2 transition-transform hover:underline active:scale-[0.98]"
            >
              <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              {t('tuVi.editTitle')}
            </Link>
          </div>
          {/* The chart is reachable even without a birth hour: the branches,
              their Can Chi and the year-placed stars do not need it (FR-016).
              Hidden at md+ — the rail below shows a larger version instead of
              this repeating next to it. */}
          <div className="md:hidden">
            <LaSoMini chart={reading.chart} onOpen={() => setChartOpen(true)} />
          </div>
        </header>

        <div className="mt-5 md:grid md:grid-cols-[minmax(0,260px)_1fr] md:items-start md:gap-8 lg:grid-cols-[minmax(0,320px)_1fr] lg:gap-12">
          {/* Full chart, not the mini icon: at rail width there's room to actually
              show palace names/Can Chi/stars, so a blown-up blank mini would just
              read as empty cells. Any palace click still opens the same overlay —
              the rail is a preview, not a second place to open a palace sheet. */}
          <div className="hidden md:block">
            <LaSoFull
              chart={reading.chart}
              onSelectPalace={() => setChartOpen(true)}
              identity={
                <>
                  <span className="font-tuvi-serif text-sm text-[#18181b]">{reading.yearName}</span>
                  {reading.chart.cuc && (
                    <span className="font-tuvi-sans text-[10px] text-[#047857]">{reading.chart.cuc.name}</span>
                  )}
                </>
              }
            />
            <p className="mt-2 text-center font-tuvi-sans text-xs text-[#52525b]">{t('tuVi.openChart')}</p>
          </div>
          <div>
            <ReadingSections reading={reading} interpretation={interpretation} />
          </div>
        </div>

        <p className="mt-6 border-t border-[#e4e4e7] pt-4 text-xs leading-relaxed text-[#52525b]">
          {t('tuVi.disclaimer')}
        </p>
      </div>

      {chartOpen && <ChartOverlay reading={reading} onClose={() => setChartOpen(false)} />}
    </main>
  )
}
