'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/lib/i18n/language-context'
import { TimePicker } from '@/components/ui/time-picker'
import { daysInSolarMonth, getTodayLocalISODate, getYearOptions } from '@/lib/date'
import { lunarToSolar, solarToLunar, type LunarDate, type SolarDate } from '@/lib/lunar-calendar'
import { TUVI_CARD } from './shell'
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

// Fake steps over the same simulated ticker — the backend is one blocking completion with
// no real step signal, so this narrates plausible phases of it rather than claiming to know
// the model's actual progress. Thresholds must stay below the ticker's 88% cap.
const GENERATION_STEP_KEYS = ['tuVi.genStep1', 'tuVi.genStep2', 'tuVi.genStep3', 'tuVi.genStep4'] as const
const GENERATION_STEP_THRESHOLDS = [0, 30, 55, 80]

function parseSolarISO(iso: string): SolarDate {
  const [year, month, day] = iso.split('-').map(Number)
  return { day, month, year }
}

function toSolarISO({ day, month, year }: SolarDate): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const RANGE = (length: number) => Array.from({ length }, (_, i) => i + 1)

/**
 * One field of the form: a serif label over its control, with the error text
 * reserved to the same place every time so a message appearing never shifts the
 * fields below it.
 */
function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string | false
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="font-tuvi-serif text-sm text-[#3f3f46]">{label}</p>
      <div className="mt-2">{children}</div>
      {error && (
        <p className="mt-1.5 font-tuvi-sans text-xs text-[#dc2626]" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * The one control shape this form uses for every either/or choice — calendar and
 * gender both. A single inset track with the choice riding in it reads as "two
 * views of one field", which two separately outlined buttons did not.
 */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  invalid,
}: {
  options: Array<{ value: T; label: string }>
  value: T | null
  onChange: (value: T) => void
  invalid?: boolean
}) {
  return (
    <div
      className={`flex w-full gap-1 rounded-xl bg-emerald-50/70 p-1 ring-1 transition-colors ${
        invalid ? 'ring-red-300' : 'ring-emerald-100'
      }`}
    >
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-lg px-2 py-1.5 font-tuvi-sans text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#047857] ${
              active
                ? 'bg-white text-[#047857] shadow-[0_1px_2px_rgba(16,185,129,0.25)] ring-1 ring-emerald-200'
                : 'text-[#52525b] hover:text-[#047857]'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** A native select that matches the rest of the form; the chevron replaces the
    browser's own arrow, which differs on every platform. */
function Select({
  label,
  value,
  onChange,
  children,
  className = '',
}: {
  label: string
  value: number
  onChange: (value: number) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-emerald-200 bg-white pr-7 pl-3 font-tuvi-sans text-sm text-[#18181b] tabular-nums outline-none transition-colors hover:border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-[#a1a1aa]"
      />
    </div>
  )
}

export function HoroscopeOnboardingForm({
  userId,
  title,
  initialProfile,
  onSaved,
}: {
  userId: string
  title: string
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
  // No real progress signal from the server (a single ~20-33s blocking call), so this is a
  // simulated ticker like FoodPhotoAnalyzer's — it decelerates and caps below 100 until the
  // call actually resolves, so it never lies about being done.
  const [generationProgress, setGenerationProgress] = useState(0)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  }, [])

  function startProgressTicker() {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    setGenerationProgress(6)
    progressTimerRef.current = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 88) return prev
        const step = prev < 35 ? 8 : prev < 65 ? 5 : 2
        return Math.min(88, prev + step)
      })
    }, 400)
  }

  function stopProgressTicker(finalPercent = 100) {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    setGenerationProgress(finalPercent)
  }

  const solar = parseSolarISO(birthDateSolar)

  function setSolar(next: Partial<SolarDate>) {
    const merged = { ...solar, ...next }
    // Changing month or year can strand the selected day (31 → February), which
    // would otherwise be a date the reader can see but not save.
    merged.day = Math.min(merged.day, daysInSolarMonth(merged.month, merged.year))
    setBirthDateSolar(toSolarISO(merged))
    setDateError(false)
  }

  function setLunar(next: Partial<LunarDate>) {
    setLunarDate((current) => ({ ...current, ...next }))
    setDateError(false)
  }

  // The same date in the other calendar. This is what makes the two tabs one
  // field rather than two: whichever calendar the reader knows their birthday
  // in, they can see it land correctly in the other one before saving.
  const counterpart = useMemo(() => {
    if (calendar === 'solar') {
      if (!isValidSolarBirthDate(birthDateSolar, new Date())) return null
      const converted = solarToLunar(solar)
      const leap = converted.isLeapMonth ? ` (${t('tuVi.lunarLeapMonth').toLowerCase()})` : ''
      return t('tuVi.equivalentLunar', {
        date: `${converted.day}/${converted.month}${leap}/${converted.year}`,
      })
    }
    if (!isValidLunarBirthDate(lunarDate, new Date())) return null
    const converted = lunarToSolar(lunarDate)
    return t('tuVi.equivalentSolar', {
      date: `${converted.day}/${converted.month}/${converted.year}`,
    })
    // `solar` is derived from birthDateSolar, so it needs no separate entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar, birthDateSolar, lunarDate, t])

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
      startProgressTicker()
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
        stopProgressTicker(100)
      } catch {
        // Nothing to tell the reader: the screen they land on can generate on demand.
        stopProgressTicker(0)
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

  const busy = saving || generating

  return (
    <div className={`${TUVI_CARD} mx-auto w-full max-w-md p-6 sm:p-7`}>
      {/* The same flourish the reading screen carries, so the form reads as the
          first page of that document rather than a separate utility screen. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-10 size-44 rounded-full bg-emerald-300/20 blur-3xl"
      />

      <header className="relative">
        <p className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-0.5 font-tuvi-serif text-[11px] tracking-[0.22em] text-[#047857]">
          {t('tuVi.overviewHeading')}
        </p>
        <h1 className="mt-2 font-tuvi-serif text-2xl leading-tight text-[#18181b]">{title}</h1>
      </header>

      <div className="relative mt-6 space-y-5">
        <Field
          label={t('tuVi.birthDateFieldLabel')}
          error={dateError && t(calendar === 'solar' ? 'tuVi.errorDate' : 'tuVi.errorLunarDate')}
        >
          <Segmented
            value={calendar}
            onChange={(next) => { setCalendar(next); setDateError(false) }}
            options={[
              { value: 'solar' as Calendar, label: t('tuVi.calendarSolar') },
              { value: 'lunar' as Calendar, label: t('tuVi.calendarLunar') },
            ]}
          />

          {/* Both calendars use the same three selects in the same order, so
              switching between them moves nothing on screen. */}
          <div className="mt-2 flex gap-1.5">
            {calendar === 'solar' ? (
              <>
                <Select
                  label={t('tuVi.lunarDay')}
                  value={solar.day}
                  onChange={(day) => setSolar({ day })}
                  className="flex-1"
                >
                  {RANGE(daysInSolarMonth(solar.month, solar.year)).map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </Select>
                <Select
                  label={t('tuVi.lunarMonth')}
                  value={solar.month}
                  onChange={(month) => setSolar({ month })}
                  className="flex-1"
                >
                  {RANGE(12).map((month) => (
                    <option key={month} value={month}>{t('tuVi.lunarMonthOption', { month })}</option>
                  ))}
                </Select>
                <Select
                  label={t('tuVi.lunarYear')}
                  value={solar.year}
                  onChange={(year) => setSolar({ year })}
                  className="flex-1"
                >
                  {getYearOptions(new Date().getFullYear(), solar.year).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </Select>
              </>
            ) : (
              <>
                <Select
                  label={t('tuVi.lunarDay')}
                  value={lunarDate.day}
                  onChange={(day) => setLunar({ day })}
                  className="flex-1"
                >
                  {RANGE(30).map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </Select>
                <Select
                  label={t('tuVi.lunarMonth')}
                  value={lunarDate.month}
                  onChange={(month) => setLunar({ month })}
                  className="flex-1"
                >
                  {RANGE(12).map((month) => (
                    <option key={month} value={month}>{t('tuVi.lunarMonthOption', { month })}</option>
                  ))}
                </Select>
                <Select
                  label={t('tuVi.lunarYear')}
                  value={lunarDate.year}
                  onChange={(year) => setLunar({ year })}
                  className="flex-1"
                >
                  {getYearOptions(new Date().getFullYear(), lunarDate.year).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </Select>
              </>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            {counterpart ? (
              <p className="font-tuvi-sans text-xs text-[#52525b] tabular-nums">{counterpart}</p>
            ) : (
              <span />
            )}
            {calendar === 'lunar' && (
              <label className="flex items-center gap-1.5 font-tuvi-sans text-xs text-[#52525b]">
                <input
                  type="checkbox"
                  checked={lunarDate.isLeapMonth}
                  onChange={(event) => setLunar({ isLeapMonth: event.target.checked })}
                  className="size-4 rounded border-emerald-300 accent-emerald-600"
                />
                {t('tuVi.lunarLeapMonth')}
              </label>
            )}
          </div>
        </Field>

        <Field label={t('tuVi.genderLabel')} error={genderError && t('tuVi.errorGender')}>
          <Segmented
            value={gender}
            invalid={genderError}
            onChange={(next) => { setGender(next); setGenderError(false) }}
            options={GENDER_OPTIONS.map((option) => ({ value: option, label: t(GENDER_LABEL_KEY[option]) }))}
          />
        </Field>

        <Field label={t('tuVi.birthTimeLabel')}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <TimePicker value={birthTime} onChange={setBirthTime} disabled={birthTimeUnknown} />
            <label className="flex items-center gap-1.5 font-tuvi-sans text-sm text-[#52525b]">
              <input
                type="checkbox"
                checked={birthTimeUnknown}
                onChange={(event) => setBirthTimeUnknown(event.target.checked)}
                className="size-4 rounded border-emerald-300 accent-emerald-600"
              />
              {t('tuVi.birthTimeUnknown')}
            </label>
          </div>
          {/* Said here rather than only on the reading: without the hour, half the
              stars are never placed, and that is a choice worth making knowingly. */}
          {birthTimeUnknown && (
            <p className="mt-2 font-tuvi-sans text-xs leading-relaxed text-[#b45309]">
              {t('tuVi.birthTimeHint')}
            </p>
          )}
        </Field>
      </div>

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={busy}
        className="relative mt-6 w-full overflow-hidden rounded-xl bg-[#047857] px-4 py-3 font-tuvi-sans text-sm font-medium text-white shadow-[0_10px_24px_-14px_rgba(4,120,87,0.9)] transition-all hover:bg-[#065f46] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857] active:scale-[0.99] disabled:opacity-60"
      >
        {generating && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 bg-white/15 transition-all duration-300"
            style={{ width: `${generationProgress}%` }}
          />
        )}
        <span className="relative">
          {generating
            ? t('tuVi.submitGenerating', { percent: generationProgress })
            : saving
              ? t('tuVi.submitSaving')
              : t('tuVi.submit')}
        </span>
      </button>

      {generating && (
        <ul className="relative mt-3 space-y-1.5" aria-live="polite">
          {GENERATION_STEP_KEYS.map((key, index) => {
            const reached = generationProgress >= GENERATION_STEP_THRESHOLDS[index]
            const current =
              reached &&
              (index === GENERATION_STEP_KEYS.length - 1 ||
                generationProgress < GENERATION_STEP_THRESHOLDS[index + 1])
            if (!reached) return null
            return (
              <li
                key={key}
                className={`flex items-center gap-2 font-tuvi-sans text-xs transition-colors ${
                  current ? 'text-[#047857]' : 'text-[#a1a1aa]'
                }`}
              >
                {current ? (
                  <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                )}
                {t(key)}
              </li>
            )
          })}
        </ul>
      )}

      <p className="relative mt-5 border-t border-emerald-100/80 pt-4 font-tuvi-sans text-xs leading-relaxed text-[#52525b]">
        {t('tuVi.disclaimer')}
      </p>
    </div>
  )
}
