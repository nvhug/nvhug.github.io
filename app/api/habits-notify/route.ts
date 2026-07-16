import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const MEAL_SCHEDULE = [
  { time: '07:00', mealType: 'breakfast', name: 'Bữa sáng', icon: '🌅', calories: 520 },
  { time: '09:30', mealType: 'mid_morning', name: 'Sáng muộn', icon: '☀️', calories: 380 },
  { time: '12:00', mealType: 'lunch', name: 'Bữa trưa', icon: '🍽️', calories: 680 },
  { time: '15:00', mealType: 'afternoon', name: 'Chiều', icon: '🥤', calories: 360 },
  { time: '17:00', mealType: 'dinner', name: 'Tối', icon: '🥛', calories: 460 },
]

const MEAL_FOODS = {
  breakfast: ['Cơm trắng: 150g', 'Trứng luộc: 2 quả', 'Sữa nóng: 150ml', 'Mật ong: 1.5 thìa'],
  mid_morning: ['Bánh mì trắng: 2 lát', 'Bơ: 1 thìa', 'Chuối: 1 quả', 'Sữa chua plain: 100g'],
  lunch: ['Cơm trắng: 250g', 'Gà nướng: 180g (không da)', 'Cháo gạo nhạt: 150ml'],
  afternoon: ['Bánh mì trắng nướng: 2 lát', 'Bơ: 1 thìa', 'Mật ong pha sữa ấm: 250ml', 'Chuối: 0.5 quả'],
  dinner: ['Sữa nóng: 300ml', 'Yến mạch: 40g', 'Trứng luộc: 1 quả', 'Mật ong: 1 thìa'],
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

  // 14-minute window: safe for two cron jobs at :00 and :30 (30 min apart).
  const scheduled = (habits || []).filter((h: { notify_times?: string[] }) =>
    (h.notify_times || []).some((t) => {
      const [tH, tM] = t.split(':').map(Number)
      const diff = curMinutes - (tH * 60 + tM)
      return diff >= 0 && diff < 14
    })
  )

  // --- Send habits notification (if any habits scheduled) ---
  let habitsStatus: number | null = null
  if (scheduled.length > 0) {
    const today = new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date())

    const habitsPayload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '10b981',
      summary: scheduled.map((h: { content: string }) => h.content).join(' | '),
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

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(habitsPayload),
      })
      habitsStatus = res.status
      if (!res.ok) console.error('Habits notification failed:', res.status)
    } catch (err) {
      console.error('Error sending habits notification:', err)
    }
  }

  // --- Send meal notification (independent of habits) ---
  const meal = MEAL_SCHEDULE.find((m) => {
    const [mH, mM] = m.time.split(':').map(Number)
    const mealMinutes = mH * 60 + mM
    const diff = curMinutes - mealMinutes
    return diff >= 0 && diff < 14
  })

  let mealStatus: number | null = null
  if (meal) {
    const mealFoods = MEAL_FOODS[meal.mealType as keyof typeof MEAL_FOODS] || []
    const foodsList = mealFoods.map((f) => f).join('\n')

    const mealPayload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: 'FF8C00',
      summary: `${meal.icon} ${meal.name} - ${meal.time}`,
      sections: [
        {
          activityTitle: `${meal.icon} ${meal.name}`,
          activitySubtitle: `⏰ ${meal.time} | 🔥 ${meal.calories} kcal`,
          text: `📋 Thực phẩm gợi ý:\n${foodsList}\n\n💡 Ăn chậm & nhai kỹ (30-40 phút)\n✅ Check in tại app khi ăn xong`,
        },
        {
          activityTitle: '💪 Mục tiêu hôm nay',
          text: 'Tăng cân: 61kg → 75kg\nMục tiêu: 2400 kcal/ngày',
        },
      ],
    }

    try {
      const mealRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mealPayload),
      })
      mealStatus = mealRes.status
      if (!mealRes.ok) console.error('Meal notification failed:', mealRes.status)
    } catch (err) {
      console.error('Error sending meal notification:', err)
    }
  }

  return NextResponse.json({
    ok: true,
    time: currentTime,
    habitsCount: scheduled.length,
    habitsStatus,
    meal: meal?.name || null,
    mealStatus,
  })
}
