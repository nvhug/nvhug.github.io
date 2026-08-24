'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/language-context'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { fetchHoroscopeProfile } from '@/lib/horoscope-profile-client'
import { HoroscopeOnboardingForm } from '@/components/tu-vi/HoroscopeOnboardingForm'
import type { HoroscopeProfile } from '@/lib/horoscope-profile'

export default function TuViEditPage() {
  const { t } = useLanguage()
  const { user, loading: authLoading } = useRequireAuth()
  const [initialProfile, setInitialProfile] = useState<HoroscopeProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  useEffect(() => {
    if (!user) return
    const userId = user.id
    async function loadProfile() {
      const { profile } = await fetchHoroscopeProfile(userId)
      setInitialProfile(profile)
      setLoadingProfile(false)
    }
    void loadProfile()
  }, [user])

  if (authLoading || loadingProfile || !user) {
    return (
      <main className="min-h-svh bg-[#f7fef9] pt-24">
        <p className="text-center text-sm text-zinc-500">{t('common.loading')}</p>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-[#f7fef9] px-4 pb-16 pt-24 sm:px-6">
      <h1 className="mx-auto mb-4 max-w-md text-center text-lg font-semibold text-zinc-900">
        {t('tuVi.editTitle')}
      </h1>
      <HoroscopeOnboardingForm
        userId={user.id}
        initialProfile={initialProfile}
        onSaved={(profile) => setInitialProfile(profile)}
      />
    </main>
  )
}
