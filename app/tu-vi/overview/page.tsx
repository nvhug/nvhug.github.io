'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/language-context'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { fetchHoroscopeProfile } from '@/lib/horoscope-profile-client'

export default function TuViOverviewPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const { user, loading: authLoading } = useRequireAuth()
  const [checkingProfile, setCheckingProfile] = useState(true)

  useEffect(() => {
    if (!user) return
    const userId = user.id
    async function checkProfileExists() {
      const { profile, error } = await fetchHoroscopeProfile(userId)
      // A fetch error must NOT be treated as "no profile" — that would bounce an
      // already-onboarded user back into onboarding on a transient network blip.
      // Only redirect when we positively confirmed there is no saved profile.
      if (!error && !profile) { router.replace('/tu-vi'); return }
      setCheckingProfile(false)
    }
    void checkProfileExists()
  }, [user, router])

  if (authLoading || checkingProfile) {
    return (
      <main className="min-h-svh bg-[#f7fef9] pt-24">
        <p className="text-center text-sm text-zinc-500">{t('common.loading')}</p>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-[#f7fef9] px-4 pb-16 pt-24 sm:px-6">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-emerald-200/70 bg-white/85 p-6 text-center shadow-[0_20px_42px_-32px_rgba(16,185,129,0.28)]">
        <h1 className="text-lg font-semibold text-zinc-900">{t('tuVi.overviewTitle')}</h1>
        <p className="mt-2 text-sm text-zinc-500">{t('tuVi.overviewBody')}</p>
      </div>
    </main>
  )
}
