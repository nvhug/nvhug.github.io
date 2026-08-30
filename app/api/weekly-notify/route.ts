import { NextResponse } from 'next/server'
import {
  getServiceSupabaseClient,
  getProfilesByIds,
  resolveNotifyProfile,
  dispatchByRole,
  buildNotifyEmailHtml,
} from '@/lib/notify'

// Fallback only. `user_profiles.daily_calorie_goal` is per account, and this
// email is sent per user, so each recipient's own goal is used when they have
// set one. Keep the fallback in step with src/lib/useCalorieGoal.ts.
const CALORIE_TARGET = 1800

export const dynamic = 'force-dynamic'

function vietnamNow() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
}

function isoDate(daysAgo: number): string {
  const d = new Date(`${vietnamNow().slice(0, 10)}T00:00:00`)
  d.setDate(d.getDate() - daysAgo)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type UserStats = {
  notesTotal: number
  notesDone: number
  notesGood: number
  activeDays: number
  avgCalo: number
  mealsTotal: number
  mealsDone: number
  mealPct: number
  latestWeight: number | null
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = getServiceSupabaseClient()
  const fromDate = isoDate(6) // 7 days including today
  const toDate = isoDate(0)

  const [{ data: notesData }, { data: caloData }, { data: mealsData }, { data: weightData }] = await Promise.all([
    client.from('notes').select('user_id, type, status, note_date').gte('note_date', fromDate).lte('note_date', toDate).eq('pinned', false),
    client.from('daily_foods').select('user_id, total_calories, date').gte('date', fromDate).lte('date', toDate),
    client.from('meals').select('user_id, is_completed, date').gte('date', fromDate).lte('date', toDate),
    client.from('weight_logs').select('user_id, weight, date').gte('date', fromDate).lte('date', toDate).order('date', { ascending: false }),
  ])

  const statsByUser = new Map<string | null, UserStats>()
  function stats(userId: string | null): UserStats {
    let s = statsByUser.get(userId)
    if (!s) {
      s = { notesTotal: 0, notesDone: 0, notesGood: 0, activeDays: 0, avgCalo: 0, mealsTotal: 0, mealsDone: 0, mealPct: 0, latestWeight: null }
      statsByUser.set(userId, s)
    }
    return s
  }

  const activeDaysByUser = new Map<string | null, Set<string>>()
  for (const n of (notesData ?? []) as { user_id: string | null; type: string; status: string; note_date: string }[]) {
    const s = stats(n.user_id)
    s.notesTotal++
    if (n.status === 'done') s.notesDone++
    if (n.type === 'good') s.notesGood++
    const days = activeDaysByUser.get(n.user_id) ?? new Set<string>()
    days.add(n.note_date)
    activeDaysByUser.set(n.user_id, days)
  }
  for (const [userId, days] of activeDaysByUser) {
    stats(userId).activeDays = days.size
  }

  const caloTotalByUser = new Map<string | null, number>()
  for (const f of (caloData ?? []) as { user_id: string | null; total_calories: number | null }[]) {
    caloTotalByUser.set(f.user_id, (caloTotalByUser.get(f.user_id) ?? 0) + (f.total_calories ?? 0))
  }
  for (const [userId, total] of caloTotalByUser) {
    stats(userId).avgCalo = Math.round(total / 7)
  }

  for (const m of (mealsData ?? []) as { user_id: string | null; is_completed: boolean }[]) {
    const s = stats(m.user_id)
    s.mealsTotal++
    if (m.is_completed) s.mealsDone++
  }
  for (const s of statsByUser.values()) {
    s.mealPct = s.mealsTotal > 0 ? Math.round((s.mealsDone / s.mealsTotal) * 100) : 0
  }

  const seenWeightUser = new Set<string | null>()
  for (const w of (weightData ?? []) as { user_id: string | null; weight: number }[]) {
    if (seenWeightUser.has(w.user_id)) continue // rows already ordered by date desc — first hit per user is latest
    seenWeightUser.add(w.user_id)
    stats(w.user_id).latestWeight = w.weight
  }

  const userIds = [...statsByUser.keys()].filter((id): id is string => !!id)
  const profiles = await getProfilesByIds(client, userIds)

  const todayLabel = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date())

  let sent = 0
  for (const [userId, s] of statsByUser) {
    const profile = resolveNotifyProfile(userId, profiles)
    const facts = [
      { name: '📝 Notes ghi', value: `${s.notesTotal} ghi chú (${s.activeDays}/7 ngày)` },
      { name: '✅ Hoàn thành', value: `${s.notesDone}/${s.notesTotal} notes · ${s.notesTotal > 0 ? Math.round((s.notesDone / s.notesTotal) * 100) : 0}%` },
      { name: '😊 Ngày tốt', value: `${s.notesGood}/${s.notesTotal} ghi chú` },
      { name: '🔥 Calo trung bình', value: `${s.avgCalo} kcal/ngày (mục tiêu ${profile.calorieGoal ?? CALORIE_TARGET})` },
      { name: '🍽️ Bữa ăn', value: `${s.mealsDone}/${s.mealsTotal} bữa hoàn thành (${s.mealPct}%)` },
      ...(s.latestWeight ? [{ name: '⚖️ Cân nặng', value: `${s.latestWeight} kg` }] : []),
    ]

    const teamsPayload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '10b981',
      summary: `📅 Tổng kết tuần — ${fromDate} → ${toDate}`,
      sections: [{
        activityTitle: '📅 Tổng kết tuần',
        activitySubtitle: `${fromDate} → ${toDate} · ${todayLabel}`,
        facts,
      }],
    }
    const emailHtml = buildNotifyEmailHtml({
      title: '📅 Tổng kết tuần',
      subtitle: `${fromDate} → ${toDate} · ${todayLabel}`,
      bodyHtml: `<table style="width:100%;border-collapse:collapse;">${facts.map((f) => `
        <tr><td style="padding:8px 0;border-top:1px solid #f0f0f0;font-size:13px;color:#71717a;">${f.name}</td>
        <td style="padding:8px 0;border-top:1px solid #f0f0f0;font-size:14px;color:#18181b;text-align:right;">${f.value}</td></tr>`).join('')}</table>`,
    })

    const ok = await dispatchByRole({
      profile,
      teamsPayload,
      emailSubject: `Tổng kết tuần ${fromDate} → ${toDate}`,
      emailHtml,
    })
    if (ok) sent++
  }

  return NextResponse.json({ ok: true, period: `${fromDate} → ${toDate}`, usersNotified: sent })
}
