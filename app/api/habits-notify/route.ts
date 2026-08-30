import { NextResponse } from 'next/server'
import {
  getServiceSupabaseClient,
  sendTeamsCard,
  notifyMealRows,
  type MealNotifyRow,
} from '@/lib/notify'

export const dynamic = 'force-dynamic'

type HabitRow = { content: string; notify_times: string[] | null }

function withinWindow(time: string, curMinutes: number) {
  const [h, m] = time.split(':').map(Number)
  const diff = curMinutes - (h * 60 + m)
  return diff >= 0 && diff < 14 // 14-minute window: safe for two cron runs 30 min apart
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const vietnamDateTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
  const currentTime = vietnamDateTime.slice(11, 16) // "07:30"
  const today = vietnamDateTime.slice(0, 10) // "2026-07-22"
  const [curH, curM] = currentTime.split(':').map(Number)
  const curMinutes = curH * 60 + curM

  const client = getServiceSupabaseClient()

  const { data: habits, error: habitsError } = await client
    .from('notes')
    .select('content, notify_times')
    .eq('pinned', true)
    .order('created_at', { ascending: true })

  if (habitsError) {
    return NextResponse.json({ error: habitsError.message }, { status: 500 })
  }

  const { data: meals, error: mealsError } = await client
    .from('meals')
    .select('user_id, time, name, target_calories, foods')
    .eq('date', today)

  if (mealsError) {
    return NextResponse.json({ error: mealsError.message }, { status: 500 })
  }

  const scheduledHabits = ((habits || []) as HabitRow[]).filter((h) =>
    (h.notify_times || []).some((t) => withinWindow(t, curMinutes))
  )
  const scheduledMeals = ((meals || []) as MealNotifyRow[]).filter((m) => withinWindow(m.time, curMinutes))

  const todayLabel = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date())

  let habitsSent = 0
  if (scheduledHabits.length > 0) {
    const teamsPayload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '10b981',
      summary: scheduledHabits.map((h) => h.content).join(' | '),
      sections: [{
        activityTitle: `🌿 Nhắc nhở lúc ${currentTime}`,
        activitySubtitle: todayLabel,
        facts: scheduledHabits.map((h) => ({ name: '✅', value: h.content })),
      }],
    }
    const ok = await sendTeamsCard(teamsPayload)
    if (ok) habitsSent++
  }

  const mealsSent = await notifyMealRows(client, scheduledMeals)

  return NextResponse.json({
    ok: true,
    time: currentTime,
    habitsCount: scheduledHabits.length,
    habitsSent,
    mealsCount: scheduledMeals.length,
    mealsSent,
  })
}
