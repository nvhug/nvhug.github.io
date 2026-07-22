import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabaseClient, notifyMealRows, type MealNotifyRow } from '@/lib/notify'

async function notifyMeal(mealType: string) {
  const client = getServiceSupabaseClient()
  const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 10)

  const { data, error } = await client
    .from('meals')
    .select('user_id, time, name, target_calories, foods')
    .eq('date', today)
    .eq('meal_type', mealType)

  if (error) {
    console.error('Error fetching meals for notify-meal:', error)
    return { matched: 0, sent: 0 }
  }

  const rows = (data || []) as MealNotifyRow[]
  const sent = await notifyMealRows(client, rows)
  return { matched: rows.length, sent }
}

export async function POST(request: NextRequest) {
  try {
    const { mealType, time } = await request.json()
    if (!mealType || !time) {
      return NextResponse.json({ error: 'mealType and time are required' }, { status: 400 })
    }
    const result = await notifyMeal(mealType)
    return NextResponse.json({ success: true, mealType, time, ...result })
  } catch (error) {
    console.error('Error in meal notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET endpoint to manually trigger notifications for testing
export async function GET(request: NextRequest) {
  const mealType = request.nextUrl.searchParams.get('mealType')
  const time = request.nextUrl.searchParams.get('time')
  if (!mealType || !time) {
    return NextResponse.json({ error: 'mealType and time query parameters are required' }, { status: 400 })
  }
  const result = await notifyMeal(mealType)
  return NextResponse.json({ success: true, mealType, time, ...result })
}
