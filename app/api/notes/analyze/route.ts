import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Note } from '@/types'

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

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: latestAnalysis } = await db
    .from('ai_analysis_history')
    .select('created_at')
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

  const [weightRes, foodRes, mealRes] = await Promise.all([
    db.from('weight_logs')
      .select('date, weight')
      .gte('date', period.from).lte('date', period.to)
      .order('date', { ascending: true }),

    db.from('daily_foods')
      .select('date, total_calories')
      .gte('date', period.from).lte('date', period.to)
      .order('date', { ascending: true }),

    db.from('meals')
      .select('date, meal_type, time, is_completed')
      .gte('date', period.from).lte('date', period.to)
      .order('date', { ascending: true }),
  ])

  const notesSummary   = buildNotesSummary(notes, habits ?? [])
  const weightSummary  = buildWeightSummary(weightRes.data ?? [])
  const calorieSummary = buildCalorieSummary(foodRes.data ?? [], mealRes.data ?? [])

  const prompt = activeLang === 'en' ? `You are an expert in personal productivity and health analytics. Analyze the data for period **${period.label}** (${period.from} → ${period.to}) and give an in-depth review in English.

=== USER PROFILE ===
${USER_PROFILE.en}

=== NOTES DATA ===
${JSON.stringify(notesSummary, null, 2)}

=== WEIGHT DATA ===
${weightSummary ? JSON.stringify(weightSummary, null, 2) : 'No weight data in this period.'}

=== NUTRITION DATA ===
${calorieSummary ? JSON.stringify(calorieSummary, null, 2) : 'No nutrition data in this period.'}

Field explanations:
[NOTES] total_notes, good_pct/bad_pct, completion_rate_pct (done), avg_priority (1–5), avg_completion_pct (0–100), weekly_breakdown (good/bad per week), habits (name + reminder times), recent_content_samples.
[WEIGHT] gain_per_week_kg (target 0.25–0.5 kg/week), progress_pct (% towards 75 kg), weekly_trend, logs_per_week (should be ≥3/week).
[NUTRITION] total_calorie_deficit_kcal (>0=deficit), days_under_90pct (<2160 kcal), meal_completion_by_type, most_skipped_meal, weekly_calorie_trend, dow_avg_calories.

Return JSON with exactly this structure (do not add or omit any field):
{
  "summary": "2-3 sentence overview of period ${period.label}, covering notes, weight, and nutrition",
  "weight": {
    "verdict": "One of: On track | Too slow | Too fast | No data",
    "points": [
      "Observation 1 with concrete numbers (e.g. gained 0.3 kg/week, on track for lean bulk)",
      "Observation 2 about weekly trend or logging frequency"
    ],
    "next_target": "Concrete numeric target for next period (e.g. reach 62.5 kg, log weight ≥3 times/week)"
  },
  "nutrition": {
    "verdict": "One of: Sufficient calories | Calorie deficit | Calorie surplus | No data",
    "points": [
      "Observation 1 with numbers (e.g. avg 2200 kcal/day, 92% of the 2400 kcal target)",
      "Observation 2 about weekly trend or best/worst calorie days"
    ],
    "worst_day": "Day of week with lowest calories + avg (e.g. Monday — avg 1950 kcal)",
    "skip_habit": "Most-skipped meal + skip % + estimated missed kcal (e.g. mid_morning 60% → ~300 kcal/day)"
  },
  "notes_habits": {
    "points": [
      "Observation about productivity/note quality (completion rate, good/bad ratio)",
      "Observation about habit compliance — which habits are strong, which are inconsistent"
    ],
    "habit_gap": "The most inconsistent habit + one practical improvement suggestion"
  },
  "pattern": "The most notable correlation this period, with numbers (1 sentence)",
  "recommendation": "3 action suggestions for next period, each with a clear numeric target"
}` : `Bạn là chuyên gia phân tích năng suất và sức khỏe cá nhân. Phân tích dữ liệu kỳ **${period.label}** (${period.from} → ${period.to}) và đưa ra nhận xét chuyên sâu bằng tiếng Việt.

=== HỒ SƠ NGƯỜI DÙNG ===
${USER_PROFILE.vi}

=== DỮ LIỆU GHI CHÚ ===
${JSON.stringify(notesSummary, null, 2)}

=== DỮ LIỆU CÂN NẶNG ===
${weightSummary ? JSON.stringify(weightSummary, null, 2) : 'Chưa có dữ liệu cân nặng trong kỳ này.'}

=== DỮ LIỆU DINH DƯỠNG ===
${calorieSummary ? JSON.stringify(calorieSummary, null, 2) : 'Chưa có dữ liệu dinh dưỡng trong kỳ này.'}

Giải thích trường dữ liệu:
[GHI CHÚ] total_notes, good_pct/bad_pct, completion_rate_pct (done), avg_priority (1–5), avg_completion_pct (0–100), weekly_breakdown (good/bad theo tuần), habits (tên + giờ nhắc), recent_content_samples.
[CÂN NẶNG] gain_per_week_kg (mục tiêu 0.25–0.5 kg/tuần), progress_pct (% đến 75 kg), weekly_trend, logs_per_week (nên ≥3/tuần).
[DINH DƯỠNG] total_calorie_deficit_kcal (>0=thiếu), days_under_90pct (<2160 kcal), meal_completion_by_type, most_skipped_meal, weekly_calorie_trend, dow_avg_calories.

Trả về JSON với đúng cấu trúc sau (không thêm field nào, không bỏ field nào):
{
  "summary": "2-3 câu tổng quan kỳ ${period.label}, đề cập cả ghi chú, cân nặng, dinh dưỡng",
  "weight": {
    "verdict": "Một trong: Đúng tiến độ | Quá chậm | Quá nhanh | Chưa có dữ liệu",
    "points": [
      "Nhận xét 1 có số liệu cụ thể (VD: tăng 0.3 kg/tuần, đúng mục tiêu lean bulk)",
      "Nhận xét 2 về xu hướng tuần hoặc tần suất ghi cân"
    ],
    "next_target": "Mục tiêu số cụ thể kỳ tới (VD: đạt 62.5 kg, ghi cân ≥3 lần/tuần)"
  },
  "nutrition": {
    "verdict": "Một trong: Đủ calo | Thiếu calo | Dư calo | Chưa có dữ liệu",
    "points": [
      "Nhận xét 1 có số liệu (VD: avg 2200 kcal/ngày, đạt 92% mục tiêu 2400 kcal)",
      "Nhận xét 2 về xu hướng tuần hoặc ngày calo tốt/tệ nhất"
    ],
    "worst_day": "Ngày trong tuần calo thấp nhất + avg (VD: Thứ 2 — avg 1950 kcal)",
    "skip_habit": "Bữa hay bỏ nhất + % skip + ước kcal thiếu (VD: mid_morning 60% → ~300 kcal/ngày)"
  },
  "notes_habits": {
    "points": [
      "Nhận xét về năng suất/chất lượng ghi chú (completion rate, tỉ lệ good/bad)",
      "Nhận xét về habit compliance — habit nào tốt, habit nào chưa đều"
    ],
    "habit_gap": "Habit cụ thể chưa đều nhất + 1 gợi ý cải thiện thực tế"
  },
  "pattern": "Tương quan nổi bật nhất kỳ này, dẫn số liệu (1 câu)",
  "recommendation": "3 gợi ý hành động cho kỳ tới, mỗi gợi ý có con số mục tiêu rõ ràng"
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

  const { data: saved, error: saveErr } = await db
    .from('ai_analysis_history')
    .insert({
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
