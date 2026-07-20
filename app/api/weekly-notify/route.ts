import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function vietnamNow() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
}

function isoDate(daysAgo: number): string {
  const d = new Date(vietnamNow().slice(0, 10))
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const webhookUrl = process.env.TEAMS_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ error: 'TEAMS_WEBHOOK_URL not set' }, { status: 500 })
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fromDate = isoDate(6) // 7 days including today
  const toDate = isoDate(0)

  // Notes stats
  const { data: notesData } = await client
    .from('notes')
    .select('type, status, note_date')
    .gte('note_date', fromDate)
    .lte('note_date', toDate)
    .eq('pinned', false)

  const notesTotal = notesData?.length ?? 0
  const notesDone = notesData?.filter((n) => n.status === 'done').length ?? 0
  const notesGood = notesData?.filter((n) => n.type === 'good').length ?? 0
  const activeDays = new Set(notesData?.map((n) => n.note_date)).size

  // Calorie stats
  const { data: caloData } = await client
    .from('daily_foods')
    .select('total_calories, date')
    .gte('date', fromDate)
    .lte('date', toDate)

  const totalCalo = caloData?.reduce((s, f) => s + (f.total_calories ?? 0), 0) ?? 0
  const avgCalo = activeDays > 0 ? Math.round(totalCalo / 7) : 0

  // Meal completion
  const { data: mealsData } = await client
    .from('meals')
    .select('is_completed')
    .gte('date', fromDate)
    .lte('date', toDate)

  const mealsTotal = mealsData?.length ?? 0
  const mealsDone = mealsData?.filter((m) => m.is_completed).length ?? 0
  const mealPct = mealsTotal > 0 ? Math.round((mealsDone / mealsTotal) * 100) : 0

  // Weight
  const { data: weightData } = await client
    .from('weight_logs')
    .select('weight, date')
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: false })
    .limit(1)

  const latestWeight = weightData?.[0]?.weight ?? null

  const today = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date())

  const payload = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: '10b981',
    summary: `📅 Tổng kết tuần — ${fromDate} → ${toDate}`,
    sections: [
      {
        activityTitle: `📅 Tổng kết tuần`,
        activitySubtitle: `${fromDate} → ${toDate} · ${today}`,
        facts: [
          { name: '📝 Notes ghi', value: `${notesTotal} ghi chú (${activeDays}/7 ngày)` },
          { name: '✅ Hoàn thành', value: `${notesDone}/${notesTotal} notes · ${notesTotal > 0 ? Math.round((notesDone / notesTotal) * 100) : 0}%` },
          { name: '😊 Ngày tốt', value: `${notesGood}/${notesTotal} ghi chú` },
          { name: '🔥 Calo trung bình', value: `${avgCalo} kcal/ngày (mục tiêu 2400)` },
          { name: '🍽️ Bữa ăn', value: `${mealsDone}/${mealsTotal} bữa hoàn thành (${mealPct}%)` },
          ...(latestWeight ? [{ name: '⚖️ Cân nặng', value: `${latestWeight} kg` }] : []),
        ],
      },
    ],
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Teams webhook failed', status: res.status }, { status: 500 })
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, period: `${fromDate} → ${toDate}`, notesTotal, avgCalo, mealPct })
}
