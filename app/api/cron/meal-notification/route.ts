import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabaseClient, notifyMealRows, type MealNotifyRow } from '@/lib/notify'

// NOTE: this route's logic now overlaps entirely with the meal half of
// /api/habits-notify (both match `meals` rows against a time window and
// dispatch per-user by role). Kept alive in case an external cron-job.org
// schedule still points at it — verify whether it's still wired up there,
// and if not, it's safe to delete.

const CRON_SECRET = process.env.CRON_SECRET || 'default-secret'

function withinWindow(time: string, curMinutes: number) {
  const [h, m] = time.split(':').map(Number)
  const diff = curMinutes - (h * 60 + m)
  return diff >= 0 && diff < 14
}

async function findAndNotify() {
  const client = getServiceSupabaseClient()
  const vietnamDateTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
  const currentTime = vietnamDateTime.slice(11, 16)
  const today = vietnamDateTime.slice(0, 10)
  const [curH, curM] = currentTime.split(':').map(Number)
  const curMinutes = curH * 60 + curM

  const { data, error } = await client
    .from('meals')
    .select('user_id, time, name, target_calories, foods')
    .eq('date', today)

  if (error) {
    return { error: error.message, currentTime }
  }

  const matched = ((data || []) as MealNotifyRow[]).filter((m) => withinWindow(m.time, curMinutes))
  const sent = await notifyMealRows(client, matched)
  return { currentTime, matched: matched.length, sent }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await findAndNotify()
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ success: true, ...result })
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await findAndNotify()
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ success: true, ...result })
}
