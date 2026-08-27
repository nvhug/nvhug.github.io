'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/language-context'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { fetchHoroscopeProfile } from '@/lib/horoscope-profile-client'
import { HoroscopeOnboardingForm } from '@/components/tu-vi/HoroscopeOnboardingForm'
import { TUVI_CARD, TUVI_PAGE_SHELL } from '@/components/tu-vi/shell'

export default function TuViOnboardingPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const { user, loading: authLoading } = useRequireAuth()
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!user) return
    const userId = user.id
    let cancelled = false

    async function checkExistingProfile() {
      const { profile, error } = await fetchHoroscopeProfile(userId)
      if (cancelled) return
      // A fetch error must NOT open a blank form: it would pre-fill today's date
      // and saving would overwrite the real birth date with it (spec FR-004).
      if (error) {
        setLoadFailed(true)
        setCheckingProfile(false)
        return
      }
      if (profile) { router.replace('/tu-vi/overview'); return }
      setLoadFailed(false)
      setCheckingProfile(false)
    }

    void checkExistingProfile()
    return () => {
      cancelled = true
    }
  }, [user, router, reloadKey])

  if (authLoading || checkingProfile || !user) {
    return (
      <main className={TUVI_PAGE_SHELL}>
        <p className="text-center font-tuvi-sans text-sm text-[#52525b]">{t('common.loading')}</p>
      </main>
    )
  }

  if (loadFailed) {
    return (
      <main className={TUVI_PAGE_SHELL}>
        <div className={`${TUVI_CARD} mx-auto w-full max-w-md p-6 text-center`}>
          <p className="font-tuvi-sans text-sm text-[#52525b]">{t('tuVi.loadError')}</p>
          <button
            type="button"
            onClick={() => {
              setCheckingProfile(true)
              setReloadKey((key) => key + 1)
            }}
            className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 font-tuvi-sans text-sm font-medium text-[#047857] transition-all hover:bg-emerald-100/70 active:scale-[0.98]"
          >
            {t('tuVi.loadRetry')}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className={TUVI_PAGE_SHELL}>
      <HoroscopeOnboardingForm
        userId={user.id}
        title={t('tuVi.onboardTitle')}
        initialProfile={null}
        onSaved={() => router.replace('/tu-vi/overview')}
      />
    </main>
  )
}
