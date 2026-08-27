'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/lib/i18n/language-context'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { getTodayLocalISODate, getYearOptions } from '@/lib/date'
import { solarToLunar, type LunarDate } from '@/lib/lunar-calendar'
import {
  buildHoroscopeProfile,
  isValidLunarBirthDate,
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

type Calendar = 'solar' | 'lunar'

function parseSolarISO(iso: string): { day: number; month: number; year: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { day, month, year }
}

const TOGGLE_ACTIVE = 'border-emerald-400 bg-emerald-500 text-white'
const TOGGLE_INACTIVE = 'border-emerald-200 bg-white text-zinc-700 hover:bg-emerald-50/50'
const SELECT_CLASS =
  'h-9 flex-1 rounded-lg border border-emerald-200 bg-white px-2 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-500'

export function HoroscopeOnboardingForm({
  userId,
  initialProfile,
  onSaved,
}: {
  userId: string
  initialProfile: HoroscopeProfile | null
  onSaved: (profile: HoroscopeProfile) => void
}) {
  const { t, lang } = useLanguage()
  const [calendar, setCalendar] = useState<Calendar>('solar')
  const [birthDateSolar, setBirthDateSolar] = useState(initialProfile?.birthDateSolar ?? getTodayLocalISODate())
  const [lunarDate, setLunarDate] = useState<LunarDate>(
    initialProfile?.birthDateLunar ?? solarToLunar(parseSolarISO(birthDateSolar)),
  )
  const [gender, setGender] = useState<Gender | null>(initialProfile?.gender ?? null)
  const [birthTimeUnknown, setBirthTimeUnknown] = useState(initialProfile?.birthTimeUnknown ?? true)
  const [birthTime, setBirthTime] = useState(initialProfile?.birthTime ?? '00:00')
  const [dateError, setDateError] = useState(false)
  const [genderError, setGenderError] = useState(false)
  const [saving, setSaving] = useState(false)
  // Separate from `saving` so the button can say what it is actually waiting for. The save
  // itself takes milliseconds; the reading takes half a minute, and a reader watching a
  // button that still says "Đang lưu" after twenty seconds assumes it has hung.
  const [generating, setGenerating] = useState(false)

  async function handleSubmit() {
    const validDate =
      calendar === 'solar'
        ? isValidSolarBirthDate(birthDateSolar, new Date())
        : isValidLunarBirthDate(lunarDate, new Date())
    setDateError(!validDate)
    setGenderError(gender === null)
    if (!validDate || gender === null) return

    setSaving(true)
    try {
      const profile = buildHoroscopeProfile(
        calendar === 'solar'
          ? { birthDateSolar, birthTime, birthTimeUnknown, gender, now: new Date() }
          : { birthDateLunar: lunarDate, birthTime, birthTimeUnknown, gender, now: new Date() },
      )

      const supabase = getSupabaseBrowserClient()
      // maybeSingle + upsert: a user whose user_profiles row does not exist yet
      // must still be able to save, and every other column has a default.
      const { data: existing, error: fetchError } = await supabase
        .from('user_profiles')
        .select('profile_data')
        .eq('id', userId)
        .maybeSingle()
      if (fetchError) throw fetchError

      const mergedProfileData = { ...(existing?.profile_data ?? {}), horoscope: profile }
      const { error } = await supabase
        .from('user_profiles')
        .upsert({ id: userId, profile_data: mergedProfileData })
      if (error) throw error

      toast.success(t('tuVi.saveSuccess'))

      // Saving the birth data is what buys the reading — the one explicit moment where the
      // reader has asked for it. The reading screen itself only loads from the database, so
      // without this step it would open to an empty state and a button.
      //
      // Both run concurrently: the wall time is one generation, not two.
      //
      // Failures are swallowed on purpose. The profile IS saved by this point, and the
      // reading screen offers its own generate button, so a provider hiccup must not turn a
      // successful save into an error the reader has to act on.
      setGenerating(true)
      try {
        await Promise.all([
          fetch('/api/tu-vi/interpret', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang }),
          }),
          fetch('/api/tu-vi/palaces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang }),
          }),
        ])
      } catch {
        // Nothing to tell the reader: the screen they land on can generate on demand.
      } finally {
        setGenerating(false)
      }

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
        <label className="block text-sm font-medium text-zinc-700">
          {calendar === 'solar' ? t('tuVi.birthDateLabel') : t('tuVi.birthDateLunarLabel')}
        </label>
        <div className="flex gap-1.5">
          {(['solar', 'lunar'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={calendar === option}
              onClick={() => { setCalendar(option); setDateError(false) }}
              className={`flex-1 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                calendar === option ? TOGGLE_ACTIVE : TOGGLE_INACTIVE
              }`}
            >
              {t(option === 'solar' ? 'tuVi.calendarSolar' : 'tuVi.calendarLunar')}
            </button>
          ))}
        </div>

        {calendar === 'solar' ? (
          <DatePicker value={birthDateSolar} onChange={(v) => { setBirthDateSolar(v); setDateError(false) }} />
        ) : (
          <>
            <div className="flex gap-1.5">
              <select
                aria-label={t('tuVi.lunarDay')}
                value={lunarDate.day}
                onChange={(e) => { setLunarDate((d) => ({ ...d, day: Number(e.target.value) })); setDateError(false) }}
                className={SELECT_CLASS}
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
              <select
                aria-label={t('tuVi.lunarMonth')}
                value={lunarDate.month}
                onChange={(e) => { setLunarDate((d) => ({ ...d, month: Number(e.target.value) })); setDateError(false) }}
                className={SELECT_CLASS}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>{t('tuVi.lunarMonthOption', { month })}</option>
                ))}
              </select>
              <select
                aria-label={t('tuVi.lunarYear')}
                value={lunarDate.year}
                onChange={(e) => { setLunarDate((d) => ({ ...d, year: Number(e.target.value) })); setDateError(false) }}
                className={SELECT_CLASS}
              >
                {getYearOptions(new Date().getFullYear(), lunarDate.year).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 pt-1 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={lunarDate.isLeapMonth}
                onChange={(e) => { setLunarDate((d) => ({ ...d, isLeapMonth: e.target.checked })); setDateError(false) }}
                className="h-3.5 w-3.5 rounded border-emerald-300 text-emerald-500 focus:ring-emerald-400"
              />
              {t('tuVi.lunarLeapMonth')}
            </label>
          </>
        )}

        {dateError && (
          <p className="text-xs text-red-500" aria-live="polite">
            {t(calendar === 'solar' ? 'tuVi.errorDate' : 'tuVi.errorLunarDate')}
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
        disabled={saving || generating}
        className="mt-6 w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:opacity-50"
      >
        {generating ? t('tuVi.submitGenerating') : saving ? t('tuVi.submitSaving') : t('tuVi.submit')}
      </button>
    </div>
  )
}
