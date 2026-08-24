'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/lib/i18n/language-context'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { getTodayLocalISODate } from '@/lib/date'
import {
  buildHoroscopeProfile,
  isValidSolarBirthDate,
  type Gender,
  type HoroscopeProfile,
} from '@/lib/horoscope-profile'

const GENDER_OPTIONS: Gender[] = ['nam', 'nu', 'khac']
const GENDER_LABEL_KEY: Record<Gender, string> = {
  nam: 'tuVi.genderNam',
  nu: 'tuVi.genderNu',
  khac: 'tuVi.genderKhac',
}

export function HoroscopeOnboardingForm({
  userId,
  initialProfile,
  onSaved,
}: {
  userId: string
  initialProfile: HoroscopeProfile | null
  onSaved: (profile: HoroscopeProfile) => void
}) {
  const { t } = useLanguage()
  const [birthDateSolar, setBirthDateSolar] = useState(initialProfile?.birthDateSolar ?? getTodayLocalISODate())
  const [gender, setGender] = useState<Gender | null>(initialProfile?.gender ?? null)
  const [birthTimeUnknown, setBirthTimeUnknown] = useState(initialProfile?.birthTimeUnknown ?? true)
  const [birthTime, setBirthTime] = useState(initialProfile?.birthTime ?? '00:00')
  const [dateError, setDateError] = useState(false)
  const [genderError, setGenderError] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    const validDate = isValidSolarBirthDate(birthDateSolar, new Date())
    setDateError(!validDate)
    setGenderError(gender === null)
    if (!validDate || gender === null) return

    setSaving(true)
    try {
      const profile = buildHoroscopeProfile({
        birthDateSolar,
        birthTime,
        birthTimeUnknown,
        gender,
        now: new Date(),
      })

      const supabase = getSupabaseBrowserClient()
      const { data: existing, error: fetchError } = await supabase
        .from('user_profiles')
        .select('profile_data')
        .eq('id', userId)
        .single()
      if (fetchError) throw fetchError

      const mergedProfileData = { ...(existing?.profile_data ?? {}), horoscope: profile }
      const { error } = await supabase
        .from('user_profiles')
        .update({ profile_data: mergedProfileData })
        .eq('id', userId)
      if (error) throw error

      toast.success(t('tuVi.saveSuccess'))
      onSaved(profile)
    } catch {
      toast.error(t('tuVi.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-emerald-200/70 bg-white/85 p-6 shadow-[0_20px_42px_-32px_rgba(16,185,129,0.28)]">
      <p className="text-xs text-zinc-500">{t('tuVi.disclaimer')}</p>

      <div className="mt-5 space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700">{t('tuVi.birthDateLabel')}</label>
        <DatePicker value={birthDateSolar} onChange={(v) => { setBirthDateSolar(v); setDateError(false) }} />
        {dateError && (
          <p className="text-xs text-red-500" aria-live="polite">
            {t('tuVi.errorDate')}
          </p>
        )}
      </div>

      <div className="mt-5 space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700">{t('tuVi.genderLabel')}</label>
        <div className="flex gap-1.5">
          {GENDER_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={gender === option}
              onClick={() => { setGender(option); setGenderError(false) }}
              className={`flex-1 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                gender === option
                  ? 'border-emerald-400 bg-emerald-500 text-white'
                  : 'border-emerald-200 bg-white text-zinc-700 hover:bg-emerald-50/50'
              }`}
            >
              {t(GENDER_LABEL_KEY[option])}
            </button>
          ))}
        </div>
        {genderError && (
          <p className="text-xs text-red-500" aria-live="polite">
            {t('tuVi.errorGender')}
          </p>
        )}
      </div>

      <div className="mt-5 space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700">{t('tuVi.birthTimeLabel')}</label>
        <TimePicker value={birthTime} onChange={setBirthTime} disabled={birthTimeUnknown} />
        <label className="flex items-center gap-1.5 pt-1 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={birthTimeUnknown}
            onChange={(e) => setBirthTimeUnknown(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-emerald-300 text-emerald-500 focus:ring-emerald-400"
          />
          {t('tuVi.birthTimeUnknown')}
        </label>
      </div>

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={saving}
        className="mt-6 w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:opacity-50"
      >
        {saving ? t('tuVi.submitSaving') : t('tuVi.submit')}
      </button>
    </div>
  )
}
