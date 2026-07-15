import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL

const MEAL_DETAILS = {
  breakfast: {
    name: 'Bữa sáng',
    icon: '🌅',
    foods: ['Cơm trắng: 150g', 'Trứng luộc: 2 quả', 'Sữa nóng: 150ml', 'Mật ong: 1.5 thìa'],
    calories: 520,
  },
  mid_morning: {
    name: 'Sáng muộn',
    icon: '☀️',
    foods: ['Bánh mì trắng: 2 lát', 'Bơ: 1 thìa', 'Chuối: 1 quả', 'Sữa chua plain: 100g'],
    calories: 380,
  },
  lunch: {
    name: 'Bữa trưa',
    icon: '🍽️',
    foods: ['Cơm trắng: 250g', 'Gà nướng: 180g (không da)', 'Cháo gạo nhạt: 150ml'],
    calories: 680,
  },
  afternoon: {
    name: 'Chiều',
    icon: '🥤',
    foods: ['Cơm cháy (bánh): 80g', 'Mật ong pha sữa ấm: 250ml', 'Bánh quy nhẹ: 30g'],
    calories: 360,
  },
  dinner: {
    name: 'Tối',
    icon: '🥛',
    foods: ['Sữa nóng: 300ml', 'Yến mạch: 40g', 'Trứng luộc: 1 quả', 'Mật ong: 1 thìa'],
    calories: 460,
  },
}

async function sendTeamsNotification(mealType: string, time: string) {
  if (!TEAMS_WEBHOOK_URL) {
    console.error('Teams webhook URL not configured')
    return false
  }

  const meal = MEAL_DETAILS[mealType as keyof typeof MEAL_DETAILS]
  if (!meal) {
    console.error(`Unknown meal type: ${mealType}`)
    return false
  }

  const foodsList = meal.foods.map((food) => `• ${food}`).join('\n')

  const payload = {
    title: `${meal.icon} ${meal.name} (${mealType === 'lunch' ? '12:00' : time})`,
    sections: [
      {
        activityTitle: `Lịch ăn: ${meal.name}`,
        activitySubtitle: `⏰ ${time} | 🔥 ${meal.calories} kcal`,
        text: `📋 Gợi ý thực phẩm:\n${foodsList}`,
      },
      {
        activityTitle: 'Mục tiêu hôm nay',
        text: '💪 Tăng cân từ 61kg → 75kg\n⏳ Tuần 1-4: 2400 kcal/ngày\n✅ Kiểm tra app để báo cáo',
      },
    ],
  }

  try {
    const response = await fetch(TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error(`Teams webhook failed: ${response.status}`)
      return false
    }

    return true
  } catch (error) {
    console.error('Error sending Teams notification:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const { mealType, time } = await request.json()

    if (!mealType || !time) {
      return NextResponse.json(
        { error: 'mealType and time are required' },
        { status: 400 }
      )
    }

    // Send Teams notification
    const success = await sendTeamsNotification(mealType, time)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to send Teams notification' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, mealType, time })
  } catch (error) {
    console.error('Error in meal notification:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to manually trigger notifications for testing
export async function GET(request: NextRequest) {
  const mealType = request.nextUrl.searchParams.get('mealType')
  const time = request.nextUrl.searchParams.get('time')

  if (!mealType || !time) {
    return NextResponse.json(
      { error: 'mealType and time query parameters are required' },
      { status: 400 }
    )
  }

  const success = await sendTeamsNotification(mealType, time)

  if (!success) {
    return NextResponse.json(
      { error: 'Failed to send Teams notification' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, mealType, time })
}
