import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const webhookUrl = process.env.TEAMS_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ error: 'TEAMS_WEBHOOK_URL not set' }, { status: 500 })
  }

  // Current Vietnam time as "HH:MM"
  const vietnamDateTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
  const currentTime = vietnamDateTime.slice(11, 16) // "07:30"

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: habits, error } = await client
    .from('notes')
    .select('content, notify_times')
    .eq('pinned', true)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const [curH, curM] = currentTime.split(':').map(Number)
  const curMinutes = curH * 60 + curM

  // 30-minute window handles GitHub Actions delays up to 30 min.
  // Safe: cron fires every 60 min, so next run has diff=60 — never double-sends.
  // Also covers :30 scheduled times (e.g. "16:30" matched by 17:00 cron, diff=30).
  const scheduled = (habits || []).filter((h: { notify_times?: string[] }) =>
    (h.notify_times || []).some((t) => {
      const [tH, tM] = t.split(':').map(Number)
      const diff = curMinutes - (tH * 60 + tM)
      return diff >= 0 && diff <= 30
    })
  )

  if (scheduled.length === 0) {
    return NextResponse.json({ message: `No habits scheduled for ${currentTime}` })
  }

  const today = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date())

  const payload = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: '10b981',
    summary: 'Thói quen hằng ngày',
    sections: [
      {
        activityTitle: `🌿 Nhắc nhở lúc ${currentTime}`,
        activitySubtitle: today,
        facts: scheduled.map((h: { content: string }) => ({
          name: '✅',
          value: h.content,
        })),
      },
    ],
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const teamsBody = await res.text()

  if (!res.ok) {
    return NextResponse.json({ error: 'Teams webhook failed', teamsStatus: res.status, teamsBody }, { status: 500 })
  }

  return NextResponse.json({ ok: true, time: currentTime, count: scheduled.length, teamsStatus: res.status, teamsBody })
}
