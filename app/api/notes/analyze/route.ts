import { NextResponse } from 'next/server'
import { Note } from '@/types'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const CALORIE_TARGET = 2400
const WEIGHT_START   = 61
const WEIGHT_TARGET  = 75
const ANALYZE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

type Lang = 'vi' | 'en'

const USER_PROFILE: Record<Lang, string> = {
  vi: `- Giới tính: Nam, 34 tuổi
- Mục tiêu: Tăng cân từ ${WEIGHT_START}kg lên ${WEIGHT_TARGET}kg (lean bulk)
- Công việc: Văn phòng (ít vận động trong giờ làm)
- Nhu cầu calo: ${CALORIE_TARGET} kcal/ngày (surplus ~300–400 kcal cho lean bulk)
- Tốc độ tăng cân mục tiêu: 0.25–0.5 kg/tuần`,
  en: `- Gender: Male, 34 years old
- Goal: Gain weight from ${WEIGHT_START}kg to ${WEIGHT_TARGET}kg (lean bulk)
- Job: Office work (sedentary during work hours)
- Calorie needs: ${CALORIE_TARGET} kcal/day (surplus ~300–400 kcal for lean bulk)
- Target weight gain rate: 0.25–0.5 kg/week`,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STRIP_HTML = /<[^>]*>/g

function avg(arr: number[]) {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
}

function isoMonday(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dow  = date.getUTCDay() // 0=Sun … 6=Sat
  date.setUTCDate(d - ((dow + 6) % 7))
  return date.toISOString().slice(0, 10)
}

// ─── Notes summary (notes are pre-filtered by period) ────────────────────────

function buildNotesSummary(notes: Note[], habits: Note[]) {
  const total   = notes.length
  const goodAll = notes.filter(n => n.type === 'good').length
  const doneAll = notes.filter(n => n.status === 'done').length

  // Average priority (1–5)
  const withPriority = notes.filter(n => n.priority != null)
  const avgPriority  = withPriority.length > 0
    ? parseFloat((withPriority.reduce((s, n) => s + (n.priority ?? 0), 0) / withPriority.length).toFixed(1))
    : null

  // Average completion percentage (0–100) — field separate from status
  const withCompPct    = notes.filter(n => n.completion_percentage != null)
  const avgCompletePct = withCompPct.length > 0
    ? Math.round(withCompPct.reduce((s, n) => s + (n.completion_percentage ?? 0), 0) / withCompPct.length)
    : null

  // Top tags
  const tagCount: Record<string, number> = {}
  notes.forEach(n => n.tags?.forEach(t => { tagCount[t] = (tagCount[t] ?? 0) + 1 }))
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t, c]) => `${t}(${c})`)

  // Day-of-week distribution
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dowCount: Record<string, number> = {}
  notes.forEach(n => {
    const d = DOW[new Date(n.note_date).getDay()]
    dowCount[d] = (dowCount[d] ?? 0) + 1
  })

  // Weekly breakdown (good/bad per ISO week)
  const weeklyBreakdown: Record<string, { good: number; bad: number }> = {}
  notes.forEach(n => {
    const key = isoMonday(n.note_date)
    const s   = weeklyBreakdown[key] ?? { good: 0, bad: 0 }
    if (n.type === 'good') s.good++; else s.bad++
    weeklyBreakdown[key] = s
  })

  // Streak (consecutive days from most recent note backwards)
  const allDates = [...new Set(notes.map(n => n.note_date))].sort().reverse()
  let streak = 0
  if (allDates.length > 0) {
    const [ay, am, ad] = allDates[0].split('-').map(Number)
    for (let i = 0; i < allDates.length; i++) {
      const expected = new Date(Date.UTC(ay, am - 1, ad - i)).toISOString().slice(0, 10)
      if (allDates[i] === expected) streak++
      else break
    }
  }

  const sorted = [...notes].sort((a, b) => a.note_date.localeCompare(b.note_date))

  const recentSamples = [...notes]
    .sort((a, b) => b.note_date.localeCompare(a.note_date))
    .slice(0, 8)
    .map(n => n.content.replace(STRIP_HTML, '').slice(0, 120).trim())
    .filter(Boolean)

  // Habit details (what the user is actively tracking)
  const habitDetails = habits.map(h => ({
    name:         h.content.replace(STRIP_HTML, '').slice(0, 80).trim(),
    notify_times: h.notify_times ?? [],
  }))

  return {
    total_notes: total,
    date_range:  { from: sorted[0]?.note_date ?? '', to: sorted[sorted.length - 1]?.note_date ?? '' },
    good_pct:    total > 0 ? Math.round((goodAll / total) * 100) : 0,
    bad_pct:     total > 0 ? Math.round(((total - goodAll) / total) * 100) : 0,
    completion_rate_pct: total > 0 ? Math.round((doneAll / total) * 100) : 0,
    avg_priority:        avgPriority,
    avg_completion_pct:  avgCompletePct,
    top_tags:            topTags,
    day_of_week:         dowCount,
    weekly_breakdown:    weeklyBreakdown,
    streak_days:         streak,
    habits:              habitDetails,
    recent_content_samples: recentSamples,
  }
}

// ─── Weight summary ──────────────────────────────────────────────────────────

interface WeightLog { date: string; weight: number }

function buildWeightSummary(logs: WeightLog[]) {
  if (!logs.length) return null

  const sorted   = [...logs].sort((a, b) => a.date.localeCompare(b.date))
  const latest   = sorted[sorted.length - 1]
  const oldest   = sorted[0]
  const daysDiff = Math.max(
    1,
    (new Date(latest.date).getTime() - new Date(oldest.date).getTime()) / 86400000
  )
  const totalGain   = latest.weight - oldest.weight
  const gainPerWeek = (totalGain / daysDiff) * 7
  const progressPct = Math.round(
    ((latest.weight - WEIGHT_START) / (WEIGHT_TARGET - WEIGHT_START)) * 100
  )
  const logsPerWeek = parseFloat(((logs.length / daysDiff) * 7).toFixed(1))

  // Weekly average weight trend
  const weeklyMap: Record<string, number[]> = {}
  sorted.forEach(l => {
    const key = isoMonday(l.date)
    if (!weeklyMap[key]) weeklyMap[key] = []
    weeklyMap[key].push(l.weight)
  })
  const weeklyTrend = Object.entries(weeklyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, ws]) => ({
      week,
      avg_kg: parseFloat((ws.reduce((s, v) => s + v, 0) / ws.length).toFixed(1)),
    }))

  return {
    goal:              `${WEIGHT_START}kg → ${WEIGHT_TARGET}kg`,
    latest_weight_kg:  latest.weight,
    first_recorded_kg: oldest.weight,
    date_range:        { from: oldest.date, to: latest.date },
    total_gain_kg:     parseFloat(totalGain.toFixed(1)),
    gain_per_week_kg:  parseFloat(gainPerWeek.toFixed(2)),
    progress_pct:      Math.min(100, Math.max(0, progressPct)),
    total_logs:        logs.length,
    logs_per_week:     logsPerWeek,
    weekly_trend:      weeklyTrend,
  }
}

// ─── Calorie summary ─────────────────────────────────────────────────────────

interface DailyFood { date: string; total_calories: number }
interface MealRow   { date: string; meal_type: string; time: string; is_completed: boolean }

function buildCalorieSummary(foods: DailyFood[], meals: MealRow[]) {
  if (!foods.length && !meals.length) return null

  // Aggregate calories by date
  const byDate: Record<string, number> = {}
  foods.forEach(f => { byDate[f.date] = (byDate[f.date] ?? 0) + f.total_calories })

  const dailyEntries   = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))
  const dailyTotals    = dailyEntries.map(([, v]) => v)
  const trackedDays    = dailyEntries.length
  const avgCal         = Math.round(avg(dailyTotals))
  const totalActual    = dailyTotals.reduce((s, v) => s + v, 0)
  const totalDeficit   = Math.round(trackedDays * CALORIE_TARGET - totalActual) // >0=thiếu, <0=dư
  const daysMetTarget  = dailyTotals.filter(c => c >= CALORIE_TARGET).length
  const daysUnder      = dailyTotals.filter(c => c < CALORIE_TARGET * 0.9).length
  const daysOver       = dailyTotals.filter(c => c > CALORIE_TARGET * 1.15).length

  // Weekly average daily calories
  const weeklyCalMap: Record<string, number[]> = {}
  dailyEntries.forEach(([date, kcal]) => {
    const key = isoMonday(date)
    if (!weeklyCalMap[key]) weeklyCalMap[key] = []
    weeklyCalMap[key].push(kcal)
  })
  const weeklyCalTrend = Object.entries(weeklyCalMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, kcals]) => ({ week, avg_kcal: Math.round(avg(kcals)) }))

  // Average calories by day of week
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dowCalMap: Record<string, number[]> = {}
  dailyEntries.forEach(([date, kcal]) => {
    const d = DOW[new Date(date).getDay()]
    if (!dowCalMap[d]) dowCalMap[d] = []
    dowCalMap[d].push(kcal)
  })
  const dowAvgCalories: Record<string, number> = {}
  Object.entries(dowCalMap).forEach(([d, vals]) => {
    dowAvgCalories[d] = Math.round(avg(vals))
  })

  // Meal completion by type
  const mealTypes = ['breakfast', 'mid_morning', 'lunch', 'afternoon', 'dinner']
  const mealStats: Record<string, { total: number; done: number }> = {}
  meals.forEach(m => {
    const s = mealStats[m.meal_type] ?? { total: 0, done: 0 }
    s.total++
    if (m.is_completed) s.done++
    mealStats[m.meal_type] = s
  })

  const completionByMeal: Record<string, string> = {}
  mealTypes.forEach(t => {
    const s = mealStats[t]
    completionByMeal[t] = s ? `${Math.round((s.done / s.total) * 100)}%` : 'N/A'
  })

  const mostSkipped = mealTypes
    .filter(t => mealStats[t])
    .sort((a, b) => (mealStats[a].done / mealStats[a].total) - (mealStats[b].done / mealStats[b].total))[0] ?? null

  // Scheduled times per meal type
  const mealTimes: Record<string, string[]> = {}
  meals.forEach(m => {
    if (!mealTimes[m.meal_type]) mealTimes[m.meal_type] = []
    if (m.time && !mealTimes[m.meal_type].includes(m.time)) mealTimes[m.meal_type].push(m.time)
  })

  return {
    calorie_target_per_day:   CALORIE_TARGET,
    tracked_days:             trackedDays,
    avg_daily_calories:       avgCal,
    total_calorie_deficit_kcal: totalDeficit,
    days_met_target:          daysMetTarget,
    days_under_90pct:         daysUnder,
    days_over_115pct:         daysOver,
    meal_completion_by_type:  completionByMeal,
    most_skipped_meal:        mostSkipped,
    meal_scheduled_times:     mealTimes,
    weekly_calorie_trend:     weeklyCalTrend,
    dow_avg_calories:         dowAvgCalories,
  }
}

// ─── Gym summary ──────────────────────────────────────────────────────────────

interface GymLogRow { log_date: string; exercise: string; muscle_group: string | null; sets: number }

function buildGymSummary(logs: GymLogRow[]) {
  if (!logs.length) return null

  const workoutDays = new Set(logs.map(l => l.log_date))
  const totalSets   = logs.reduce((s, l) => s + l.sets, 0)

  // Exercise frequency
  const exCount: Record<string, { sessions: number; sets: number }> = {}
  logs.forEach(l => {
    const e = exCount[l.exercise] ?? { sessions: 0, sets: 0 }
    e.sessions++
    e.sets += l.sets
    exCount[l.exercise] = e
  })
  const topExercises = Object.entries(exCount)
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .slice(0, 6)
    .map(([name, { sessions, sets }]) => ({ name, sessions, total_sets: sets }))

  // Muscle group frequency
  const muscleCount: Record<string, number> = {}
  logs.forEach(l => {
    if (!l.muscle_group) return
    l.muscle_group.split(',').map(m => m.trim()).forEach(m => {
      muscleCount[m] = (muscleCount[m] ?? 0) + 1
    })
  })
  const topMuscles = Object.entries(muscleCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([m]) => m)

  // Weekly workout-day count
  const weeklyDaysMap: Record<string, Set<string>> = {}
  logs.forEach(l => {
    const w = isoMonday(l.log_date)
    if (!weeklyDaysMap[w]) weeklyDaysMap[w] = new Set()
    weeklyDaysMap[w].add(l.log_date)
  })
  const weeklyWorkoutDays = Object.fromEntries(
    Object.entries(weeklyDaysMap).map(([w, days]) => [w, days.size])
  )
  const totalWeeks           = Object.keys(weeklyDaysMap).length
  const weeksConsistent      = Object.values(weeklyDaysMap).filter(d => d.size >= 3).length
  const consistencyPct       = totalWeeks > 0 ? Math.round((weeksConsistent / totalWeeks) * 100) : 0

  const dateArr = [...workoutDays].sort()
  const spanDays = dateArr.length > 1
    ? Math.max(1, (new Date(dateArr.at(-1)!).getTime() - new Date(dateArr[0]).getTime()) / 86400000)
    : 1

  return {
    workout_days:            workoutDays.size,
    total_exercise_entries:  logs.length,
    total_sets:              totalSets,
    avg_sets_per_session:    parseFloat((totalSets / workoutDays.size).toFixed(1)),
    workout_days_per_week:   parseFloat(((workoutDays.size / spanDays) * 7).toFixed(1)),
    consistency_pct:         consistencyPct,
    top_exercises:           topExercises,
    top_muscle_groups:       topMuscles,
    weekly_workout_days:     weeklyWorkoutDays,
  }
}

// ─── Calendar summary ─────────────────────────────────────────────────────────

interface CalEventRow { date: string; start_time: string; is_recurring: boolean }

function buildCalendarSummary(events: CalEventRow[], periodFrom: string, periodTo: string) {
  if (!events.length) return null

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dowCount: Record<string, number> = {}
  const timeSlots = { morning: 0, afternoon: 0, evening: 0, night: 0 }

  events.forEach(e => {
    const [y, m, d] = e.date.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    dowCount[DOW[dow]] = (dowCount[DOW[dow]] ?? 0) + 1

    const hour = parseInt(e.start_time.split(':')[0])
    if      (hour >= 6  && hour < 12) timeSlots.morning++
    else if (hour >= 12 && hour < 17) timeSlots.afternoon++
    else if (hour >= 17 && hour < 22) timeSlots.evening++
    else timeSlots.night++
  })

  const busiestDay = Object.entries(dowCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const spanDays   = Math.max(1,
    (new Date(periodTo).getTime() - new Date(periodFrom).getTime()) / 86400000 + 1
  )

  return {
    total_events:        events.length,
    recurring_events:    events.filter(e => e.is_recurring).length,
    one_time_events:     events.filter(e => !e.is_recurring).length,
    events_per_week_avg: parseFloat(((events.length / spanDays) * 7).toFixed(1)),
    busiest_day_of_week: busiestDay,
    day_distribution:    dowCount,
    time_distribution:   timeSlots,
  }
}

// ─── Bowel/digestive summary ──────────────────────────────────────────────────

interface BowelLogRow { date: string; stool_type: string }

function buildBowelSummary(logs: BowelLogRow[]) {
  if (!logs.length) return null

  const trackedDays  = new Set(logs.map(l => l.date)).size
  const typeCount: Record<string, number> = {}
  logs.forEach(l => { typeCount[l.stool_type] = (typeCount[l.stool_type] ?? 0) + 1 })

  const normalPct    = Math.round(((typeCount.normal ?? 0) / logs.length) * 100)
  const abnormal     = Object.entries(typeCount)
    .filter(([t]) => t !== 'normal')
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `${t}(${c})`)

  return {
    tracked_days:      trackedDays,
    total_logs:        logs.length,
    avg_per_day:       parseFloat((logs.length / trackedDays).toFixed(1)),
    normal_pct:        normalPct,
    type_distribution: typeCount,
    abnormal_types:    abnormal.slice(0, 3),
  }
}

// ─── Goals summary ────────────────────────────────────────────────────────────

interface GoalRow { title: string; type: string; status: string; completion_percentage: number | null }

function buildGoalsSummary(goals: GoalRow[]) {
  if (!goals.length) return null

  const active    = goals.filter(g => g.status === 'active')
  const completed = goals.filter(g => g.status === 'completed')
  const withPct   = active.filter(g => g.completion_percentage != null)
  const avgPct    = withPct.length > 0
    ? Math.round(withPct.reduce((s, g) => s + (g.completion_percentage ?? 0), 0) / withPct.length)
    : null

  const typeCount: Record<string, number> = {}
  goals.forEach(g => { typeCount[g.type] = (typeCount[g.type] ?? 0) + 1 })

  return {
    total_goals:    goals.length,
    active_goals:   active.length,
    completed_goals: completed.length,
    avg_active_completion_pct: avgPct,
    goal_types:     Object.keys(typeCount),
    top_active_goals: active
      .sort((a, b) => (b.completion_percentage ?? 0) - (a.completion_percentage ?? 0))
      .slice(0, 5)
      .map(g => ({ title: g.title.slice(0, 60), type: g.type, pct: g.completion_percentage ?? 0 })),
  }
}

// ─── Route handler ───────────────────────────────────────────────────────────

interface Period { label: string; from: string; to: string }

export async function POST(request: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPSEEK_API_KEY not configured' }, { status: 500 })
  }

  const { notes, habits, period, lang } = (await request.json()) as {
    notes:   Note[]
    habits:  Note[]
    period:  Period
    lang?:   Lang
  }
  const activeLang: Lang = lang === 'en' ? 'en' : 'vi'

  // AI analysis is a paid feature — gate it server-side too, since the
  // client button can be bypassed by calling this route directly. Checked
  // against the same page_permissions matrix admins edit at
  // /admin/settings/pages, not a hardcoded role list, so it stays configurable.
  const supabaseAuth = await createSupabaseServerClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  const { data: profile } = user
    ? await supabaseAuth.from('user_profiles').select('role').eq('id', user.id).single()
    : { data: null }
  const role = profile?.role ?? 'user'
  const { data: permission } = await supabaseAuth
    .from('page_permissions')
    .select('allowed')
    .eq('page_key', 'notes.ai_analysis')
    .eq('role', role)
    .maybeSingle()
  if (!permission?.allowed) {
    return NextResponse.json({
      error: activeLang === 'en'
        ? 'AI analysis is a paid feature, available to Pro accounts only. Please contact the admin to upgrade.'
        : 'Phân tích AI là tính năng trả phí, chỉ dành cho tài khoản Pro. Vui lòng liên hệ admin để nâng cấp.',
    }, { status: 403 })
  }

  if (!period?.from || !period?.to || !period?.label) {
    return NextResponse.json({
      error: activeLang === 'en' ? 'Missing analysis period information.' : 'Thiếu thông tin kỳ phân tích.',
    }, { status: 400 })
  }
  if (!notes?.length) {
    return NextResponse.json({
      error: activeLang === 'en' ? 'No note data in this period.' : 'Không có dữ liệu ghi chú trong kỳ này.',
    }, { status: 400 })
  }

  const { data: latestAnalysis } = await supabaseAuth
    .from('ai_analysis_history')
    .select('created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestAnalysis?.created_at) {
    const lastAnalyzeAt = new Date(latestAnalysis.created_at).getTime()
    const remainingMs = lastAnalyzeAt + ANALYZE_COOLDOWN_MS - Date.now()

    if (remainingMs > 0) {
      const retryAfterSeconds = Math.ceil(remainingMs / 1000)
      return NextResponse.json(
        {
          error: activeLang === 'en'
            ? 'You can only run AI analysis once every 7 days.'
            : 'Bạn chỉ có thể phân tích AI 1 lần mỗi 7 ngày.',
          retryAfterSeconds,
          nextAnalyzeAt: new Date(lastAnalyzeAt + ANALYZE_COOLDOWN_MS).toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
          },
        }
      )
    }
  }

  const [weightRes, foodRes, mealRes, gymRes, calRes, bowelRes, goalsRes] = await Promise.all([
    supabaseAuth.from('weight_logs')
      .select('date, weight')
      .eq('user_id', user!.id)
      .gte('date', period.from).lte('date', period.to)
      .order('date', { ascending: true }),

    supabaseAuth.from('daily_foods')
      .select('date, total_calories')
      .eq('user_id', user!.id)
      .gte('date', period.from).lte('date', period.to)
      .order('date', { ascending: true }),

    supabaseAuth.from('meals')
      .select('date, meal_type, time, is_completed')
      .eq('user_id', user!.id)
      .gte('date', period.from).lte('date', period.to)
      .order('date', { ascending: true }),

    supabaseAuth.from('gym_logs')
      .select('log_date, exercise, muscle_group, sets')
      .eq('user_id', user!.id)
      .gte('log_date', period.from).lte('log_date', period.to)
      .order('log_date', { ascending: true }),

    supabaseAuth.from('calendar_events')
      .select('date, start_time, is_recurring')
      .eq('user_id', user!.id)
      .gte('date', period.from).lte('date', period.to)
      .order('date', { ascending: true }),

    supabaseAuth.from('bowel_logs')
      .select('date, stool_type')
      .eq('user_id', user!.id)
      .gte('date', period.from).lte('date', period.to)
      .order('date', { ascending: true }),

    supabaseAuth.from('goals')
      .select('title, type, status, completion_percentage')
      .eq('user_id', user!.id),
  ])

  const notesSummary    = buildNotesSummary(notes, habits ?? [])
  const weightSummary   = buildWeightSummary(weightRes.data ?? [])
  const calorieSummary  = buildCalorieSummary(foodRes.data ?? [], mealRes.data ?? [])
  const gymSummary      = buildGymSummary(gymRes.data ?? [])
  const calendarSummary = buildCalendarSummary(calRes.data ?? [], period.from, period.to)
  const bowelSummary    = buildBowelSummary(bowelRes.data ?? [])
  const goalsSummary    = buildGoalsSummary(goalsRes.data ?? [])

  const prompt = activeLang === 'en' ? `You are an expert personal health & productivity coach. Analyze all data for **${period.label}** (${period.from} → ${period.to}) and return a comprehensive in-depth review in English.

=== USER PROFILE ===
${USER_PROFILE.en}

=== NOTES & HABITS ===
${JSON.stringify(notesSummary, null, 2)}

=== WEIGHT TRACKING ===
${weightSummary ? JSON.stringify(weightSummary, null, 2) : 'No weight data this period.'}

=== NUTRITION & MEALS ===
${calorieSummary ? JSON.stringify(calorieSummary, null, 2) : 'No nutrition data this period.'}

=== GYM WORKOUTS ===
${gymSummary ? JSON.stringify(gymSummary, null, 2) : 'No gym data this period.'}

=== CALENDAR / SCHEDULE ===
${calendarSummary ? JSON.stringify(calendarSummary, null, 2) : 'No calendar data this period.'}

=== DIGESTIVE HEALTH ===
${bowelSummary ? JSON.stringify(bowelSummary, null, 2) : 'No digestive tracking data this period.'}

=== GOALS ===
${goalsSummary ? JSON.stringify(goalsSummary, null, 2) : 'No goals data.'}

FIELD GUIDE:
[NOTES] total_notes, good_pct/bad_pct, completion_rate_pct, avg_priority(1–5), weekly_breakdown, habits, recent_content_samples.
[WEIGHT] gain_per_week_kg (target 0.25–0.5), progress_pct (% to 75 kg), weekly_trend, logs_per_week.
[NUTRITION] deficit_kcal(>0=under), days_under_90pct, meal_completion_by_type, weekly_calorie_trend, dow_avg_calories.
[GYM] workout_days_per_week (ideal ≥3), consistency_pct (% weeks with ≥3 days), top_exercises, top_muscle_groups, avg_sets_per_session.
[CALENDAR] events_per_week_avg, busiest_day_of_week, time_distribution(morning/afternoon/evening/night), recurring_events.
[DIGESTIVE] normal_pct(target ≥80%), avg_per_day(ideal 1–2), abnormal_types.
[GOALS] active_goals, avg_active_completion_pct, top_active_goals with completion %.

Return ONLY valid JSON with exactly this structure (no extra fields, no markdown):
{
  "summary": "3-sentence overview: briefly mention progress across notes, weight, nutrition, gym, and scheduling this period",
  "weight": {
    "verdict": "On track | Too slow | Too fast | No data",
    "points": ["insight with numbers", "insight about trend or logging frequency"],
    "next_target": "concrete numeric target for next period"
  },
  "nutrition": {
    "verdict": "Sufficient calories | Calorie deficit | Calorie surplus | No data",
    "points": ["insight with kcal numbers", "insight about weekly/dow pattern"],
    "worst_day": "day of week with lowest avg calories + amount",
    "skip_habit": "most skipped meal + skip % + estimated kcal impact"
  },
  "gym": {
    "verdict": "Consistent | Inconsistent | Getting started | No data",
    "points": ["insight about workout frequency and volume (sets, days/week)", "insight about muscle balance or exercise variety"],
    "strongest_muscle": "most trained muscle group this period",
    "next_challenge": "one concrete gym challenge/target for next period"
  },
  "calendar": {
    "verdict": "Well scheduled | Lightly used | Not used",
    "points": ["insight about planning patterns (frequency, recurring events)", "insight about time-of-day or day-of-week concentration"],
    "busiest_day": "busiest day of week + event count",
    "tip": "one scheduling improvement tip based on the data"
  },
  "digestive": {
    "verdict": "Healthy | Needs attention | No data",
    "points": ["insight about stool type distribution and normal%", "link to nutrition/fiber intake if possible"],
    "tip": "one concrete diet or habit tip to improve digestive health"
  },
  "goals": {
    "verdict": "On track | Needs focus | No goals set",
    "points": ["insight about active goal count and avg completion %", "which goal type is most/least progressed"],
    "focus": "the single most important goal to accelerate next period"
  },
  "notes_habits": {
    "points": ["insight about productivity/note quality (ratio, completion, priority)", "insight about habit consistency — strongest vs weakest habit"],
    "habit_gap": "the most inconsistent habit + one practical improvement"
  },
  "pattern": "the most notable cross-domain correlation this period, with 2+ data points (1 sentence)",
  "recommendation": "3 prioritized action items for next period, each with a clear numeric target. Format: '1. ... 2. ... 3. ...'"
}` : `Bạn là chuyên gia huấn luyện sức khỏe và năng suất cá nhân. Phân tích toàn bộ dữ liệu kỳ **${period.label}** (${period.from} → ${period.to}) và trả về nhận xét chuyên sâu bằng tiếng Việt.

=== HỒ SƠ NGƯỜI DÙNG ===
${USER_PROFILE.vi}

=== GHI CHÚ & THÓI QUEN ===
${JSON.stringify(notesSummary, null, 2)}

=== THEO DÕI CÂN NẶNG ===
${weightSummary ? JSON.stringify(weightSummary, null, 2) : 'Chưa có dữ liệu cân nặng kỳ này.'}

=== DINH DƯỠNG & BỮA ĂN ===
${calorieSummary ? JSON.stringify(calorieSummary, null, 2) : 'Chưa có dữ liệu dinh dưỡng kỳ này.'}

=== TẬP GYM ===
${gymSummary ? JSON.stringify(gymSummary, null, 2) : 'Chưa có dữ liệu tập gym kỳ này.'}

=== LỊCH CÁ NHÂN ===
${calendarSummary ? JSON.stringify(calendarSummary, null, 2) : 'Chưa có dữ liệu lịch kỳ này.'}

=== SỨC KHỎE TIÊU HÓA ===
${bowelSummary ? JSON.stringify(bowelSummary, null, 2) : 'Chưa có dữ liệu tiêu hóa kỳ này.'}

=== MỤC TIÊU ===
${goalsSummary ? JSON.stringify(goalsSummary, null, 2) : 'Chưa có mục tiêu nào.'}

HƯỚNG DẪN TRƯỜNG DỮ LIỆU:
[GHI CHÚ] total_notes, good_pct/bad_pct, completion_rate_pct, avg_priority(1–5), weekly_breakdown, habits, recent_content_samples.
[CÂN NẶNG] gain_per_week_kg (mục tiêu 0.25–0.5), progress_pct (% đến 75 kg), weekly_trend, logs_per_week.
[DINH DƯỠNG] deficit_kcal(>0=thiếu), days_under_90pct, meal_completion_by_type, weekly_calorie_trend, dow_avg_calories.
[GYM] workout_days_per_week (lý tưởng ≥3), consistency_pct (% tuần có ≥3 ngày tập), top_exercises, top_muscle_groups, avg_sets_per_session.
[LỊCH] events_per_week_avg, busiest_day_of_week, time_distribution(morning/afternoon/evening/night), recurring_events.
[TIÊU HÓA] normal_pct(mục tiêu ≥80%), avg_per_day(lý tưởng 1–2 lần/ngày), abnormal_types.
[MỤC TIÊU] active_goals, avg_active_completion_pct, top_active_goals với % hoàn thành.

Trả về JSON hợp lệ với đúng cấu trúc sau (không thêm/bỏ field, không markdown):
{
  "summary": "3 câu tổng quan: đề cập tiến độ ghi chú, cân nặng, dinh dưỡng, gym và lập lịch trong kỳ này",
  "weight": {
    "verdict": "Đúng tiến độ | Quá chậm | Quá nhanh | Chưa có dữ liệu",
    "points": ["nhận xét có số liệu cụ thể", "nhận xét về xu hướng hoặc tần suất ghi cân"],
    "next_target": "mục tiêu số cụ thể cho kỳ tới"
  },
  "nutrition": {
    "verdict": "Đủ calo | Thiếu calo | Dư calo | Chưa có dữ liệu",
    "points": ["nhận xét có kcal cụ thể", "nhận xét về xu hướng tuần/ngày"],
    "worst_day": "ngày trong tuần calo thấp nhất + avg cụ thể",
    "skip_habit": "bữa hay bỏ nhất + % skip + kcal ảnh hưởng"
  },
  "gym": {
    "verdict": "Đều đặn | Chưa đều | Mới bắt đầu | Chưa có dữ liệu",
    "points": ["nhận xét về tần suất và khối lượng tập (số ngày/tuần, tổng hiệp)", "nhận xét về cân bằng nhóm cơ hoặc đa dạng bài tập"],
    "strongest_muscle": "nhóm cơ được tập nhiều nhất kỳ này",
    "next_challenge": "một thử thách/mục tiêu gym cụ thể cho kỳ tới"
  },
  "calendar": {
    "verdict": "Lập lịch tốt | Ít sử dụng | Chưa dùng",
    "points": ["nhận xét về tần suất lập kế hoạch (sự kiện/tuần, lặp lại)", "nhận xét về phân bố thời gian trong ngày hoặc ngày trong tuần"],
    "busiest_day": "ngày bận nhất trong tuần + số sự kiện",
    "tip": "một gợi ý cải thiện lịch trình dựa trên dữ liệu"
  },
  "digestive": {
    "verdict": "Bình thường | Cần chú ý | Chưa có dữ liệu",
    "points": ["nhận xét về tỉ lệ normal% và phân bố loại", "liên hệ với chế độ dinh dưỡng/chất xơ nếu phù hợp"],
    "tip": "một gợi ý chế độ ăn hoặc thói quen cụ thể để cải thiện tiêu hóa"
  },
  "goals": {
    "verdict": "Đang tốt | Cần tập trung | Chưa đặt mục tiêu",
    "points": ["nhận xét về số lượng mục tiêu đang hoạt động và % hoàn thành trung bình", "loại mục tiêu nào đang tiến nhanh/chậm nhất"],
    "focus": "mục tiêu quan trọng nhất cần tăng tốc kỳ tới"
  },
  "notes_habits": {
    "points": ["nhận xét năng suất/chất lượng ghi chú (tỉ lệ, completion rate, priority)", "nhận xét habit compliance — habit tốt nhất vs yếu nhất"],
    "habit_gap": "habit cụ thể chưa đều nhất + 1 gợi ý cải thiện thực tế"
  },
  "pattern": "tương quan nổi bật nhất xuyên nhiều domain kỳ này, dẫn ≥2 số liệu (1 câu)",
  "recommendation": "3 hành động ưu tiên cho kỳ tới, mỗi hành động có con số mục tiêu rõ. Format: '1. ... 2. ... 3. ...'"
}`

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `DeepSeek API error: ${err}` }, { status: 502 })
  }

  const data    = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    return NextResponse.json({ error: 'Empty response from DeepSeek' }, { status: 502 })
  }

  const insights         = JSON.parse(content)
  const promptTokens     = data.usage?.prompt_tokens     ?? 0
  const completionTokens = data.usage?.completion_tokens ?? 0
  const totalTokens      = data.usage?.total_tokens      ?? 0

  const { data: saved, error: saveErr } = await supabaseAuth
    .from('ai_analysis_history')
    .insert({
      user_id:           user!.id,
      result:            insights,
      prompt_tokens:     promptTokens,
      completion_tokens: completionTokens,
      total_tokens:      totalTokens,
      period_label:      period.label,
      period_from:       period.from,
      period_to:         period.to,
    })
    .select('id, created_at')
    .single()

  if (saveErr) console.error('[analyze] DB save failed:', saveErr.message)

  return NextResponse.json({
    ...insights,
    id:         saved?.id ?? null,
    analyzedAt: saved?.created_at ?? new Date().toISOString(),
    period,
    tokenUsage: {
      prompt:     promptTokens,
      completion: completionTokens,
      total:      totalTokens,
    },
  })
}
