'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/language-context'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { fetchHoroscopeProfile } from '@/lib/horoscope-profile-client'
import { HoroscopeOnboardingForm } from '@/components/tu-vi/HoroscopeOnboardingForm'

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
      <main className="min-h-svh bg-[#f7fef9] pt-24">
        <p className="text-center text-sm text-zinc-500">{t('common.loading')}</p>
      </main>
    )
  }

  if (loadFailed) {
    return (
      <main className="min-h-svh bg-[#f7fef9] px-4 pb-16 pt-24 sm:px-6">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-emerald-200/70 bg-white/85 p-6 text-center">
          <p className="text-sm text-zinc-500">{t('tuVi.loadError')}</p>
          <button
            type="button"
            onClick={() => {
              setCheckingProfile(true)
              setReloadKey((key) => key + 1)
            }}
            className="mt-3 rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            {t('tuVi.loadRetry')}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-[#f7fef9] px-4 pb-16 pt-24 sm:px-6">
      <h1 className="mx-auto mb-4 max-w-md text-center text-lg font-semibold text-zinc-900">
        {t('tuVi.onboardTitle')}
      </h1>
      <HoroscopeOnboardingForm
        userId={user.id}
        initialProfile={null}
        onSaved={() => router.replace('/tu-vi/overview')}
      />
    </main>
  )
}
