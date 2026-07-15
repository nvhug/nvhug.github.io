import { NextRequest, NextResponse } from 'next/server'

const CRON_SECRET = process.env.CRON_SECRET || 'default-secret'
const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL

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

async function sendTeamsNotification(meal: typeof MEAL_SCHEDULE[0]) {
  if (!TEAMS_WEBHOOK_URL) {
    console.error('Teams webhook URL not configured')
    return false
  }

  const foods = MEAL_FOODS[meal.mealType as keyof typeof MEAL_FOODS]
  const foodsList = foods.map((food) => `• ${food}`).join('\n')

  const payload = {
    title: `${meal.icon} ${meal.name}`,
    sections: [
      {
        activityTitle: `⏰ ${meal.time} - ${meal.name}`,
        activitySubtitle: `🔥 ${meal.calories} kcal`,
        text: `📋 Thực phẩm gợi ý:\n${foodsList}\n\n💡 Ăn chậm & nhai kỹ (30-40 phút)`,
      },
      {
        activityTitle: 'Mục tiêu hôm nay',
        text: '💪 Tăng cân: 61kg → 75kg\n⏳ Mục tiêu: 2400 kcal/ngày\n✅ Check in tại app khi ăn xong',
      },
    ],
    themeColor: 'FF8C00',
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

    console.log(`✅ Sent Teams notification for ${meal.name}`)
    return true
  } catch (error) {
    console.error('Error sending Teams notification:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get current time
    const now = new Date()
    const currentTime = now.toLocaleString('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    console.log(`🔔 Cron job triggered at ${currentTime}`)

    // Find meals that should be sent at this time
    const mealsToSend = MEAL_SCHEDULE.filter((meal) => meal.time === currentTime)

    if (mealsToSend.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No meals scheduled for ${currentTime}`,
        currentTime,
      })
    }

    // Send notifications for all meals at this time
    const results = await Promise.all(
      mealsToSend.map((meal) => sendTeamsNotification(meal))
    )

    const successful = results.filter((r) => r).length
    const failed = results.length - successful

    return NextResponse.json({
      success: true,
      currentTime,
      scheduled: mealsToSend.length,
      successful,
      failed,
      meals: mealsToSend.map((m) => m.name),
    })
  } catch (error) {
    console.error('Error in meal notification cron:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get('secret')
    if (secret !== CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const now = new Date()
    const currentTime = now.toLocaleString('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    const mealsToSend = MEAL_SCHEDULE.filter((meal) => meal.time === currentTime)

    if (mealsToSend.length === 0) {
      return NextResponse.json({
        message: `No meals at ${currentTime}`,
        currentTime,
        schedule: MEAL_SCHEDULE,
      })
    }

    const results = await Promise.all(
      mealsToSend.map((meal) => sendTeamsNotification(meal))
    )

    return NextResponse.json({
      success: true,
      currentTime,
      sent: mealsToSend.map((m) => m.name),
      results,
    })
  } catch (error) {
    console.error('Error in test meal notification:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
