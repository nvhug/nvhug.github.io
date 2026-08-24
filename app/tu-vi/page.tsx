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

  useEffect(() => {
    if (!user) return
    const userId = user.id
    async function checkExistingProfile() {
      const { profile } = await fetchHoroscopeProfile(userId)
      // On a fetch error, `profile` is null the same as "not onboarded yet" —
      // showing the onboarding form again is the safe default (annoying at
      // worst), unlike the overview page where the same ambiguity must not
      // bounce an already-onboarded user back into onboarding.
      if (profile) { router.replace('/tu-vi/overview'); return }
      setCheckingProfile(false)
    }
    void checkExistingProfile()
  }, [user, router])

  if (authLoading || checkingProfile || !user) {
    return (
      <main className="min-h-svh bg-[#f7fef9] pt-24">
        <p className="text-center text-sm text-zinc-500">{t('common.loading')}</p>
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
