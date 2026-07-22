import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import type { UserRole } from '@/types'

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL
const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Notifications <onboarding@resend.dev>'

export type NotifyProfile = { role: UserRole; email: string | null }

export function getServiceSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function sendTeamsCard(payload: Record<string, unknown>): Promise<boolean> {
  if (!TEAMS_WEBHOOK_URL) {
    console.error('TEAMS_WEBHOOK_URL not set')
    return false
  }
  try {
    const res = await fetch(TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) console.error('Teams webhook failed:', res.status)
    return res.ok
  } catch (err) {
    console.error('Error sending Teams notification:', err)
    return false
  }
}

export async function sendNotifyEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set')
    return false
  }
  try {
    const resend = new Resend(RESEND_API_KEY)
    const { error } = await resend.emails.send({ from: RESEND_FROM_EMAIL, to, subject, html })
    if (error) console.error('Resend error:', error)
    return !error
  } catch (err) {
    console.error('Error sending notify email:', err)
    return false
  }
}

// One-shot lookup for a batch of user ids. Rows with no user_id (legacy data
// from before per-user isolation) resolve to 'admin' via resolveNotifyProfile
// below, so they keep going to Teams exactly like before this rewrite.
export async function getProfilesByIds(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, NotifyProfile>> {
  const map = new Map<string, NotifyProfile>()
  const uniqueIds = [...new Set(userIds)]
  if (uniqueIds.length === 0) return map

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, role, email')
    .in('id', uniqueIds)

  if (error) {
    console.error('Error fetching profiles for notify:', error)
    return map
  }
  for (const row of (data ?? []) as { id: string; role: UserRole; email: string | null }[]) {
    map.set(row.id, { role: row.role, email: row.email })
  }
  return map
}

export function resolveNotifyProfile(userId: string | null, profiles: Map<string, NotifyProfile>): NotifyProfile {
  if (!userId) return { role: 'admin', email: null }
  return profiles.get(userId) ?? { role: 'user', email: null }
}

// admin -> Teams (existing behavior). paid/user -> email to their own account.
export async function dispatchByRole(params: {
  profile: NotifyProfile
  teamsPayload: Record<string, unknown>
  emailSubject: string
  emailHtml: string
}): Promise<boolean> {
  const { profile, teamsPayload, emailSubject, emailHtml } = params
  if (profile.role === 'admin') {
    return sendTeamsCard(teamsPayload)
  }
  if (!profile.email) {
    console.error('Cannot send notify email — profile has no email address on file')
    return false
  }
  return sendNotifyEmail(profile.email, emailSubject, emailHtml)
}

export type MealNotifyRow = {
  user_id: string | null
  time: string
  name: string
  target_calories: number
  foods: string[]
}

function buildMealTeamsPayload(meal: MealNotifyRow) {
  const foodsList = meal.foods.map((f) => `• ${f}`).join('\n\n')
  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: 'FF8C00',
    summary: `${meal.name} - ${meal.time}`,
    sections: [{
      activityTitle: `🍽️ ${meal.name}`,
      activitySubtitle: `⏰ ${meal.time} | 🔥 ${meal.target_calories} kcal`,
      text: `📋 Thực phẩm gợi ý:\n\n${foodsList}\n\n💡 Ăn chậm & nhai kỹ (30-40 phút)\n\n✅ Check in tại app khi ăn xong`,
    }],
  }
}

function buildMealEmailHtml(meal: MealNotifyRow) {
  return buildNotifyEmailHtml({
    title: `🍽️ ${meal.name}`,
    subtitle: `${meal.time} · ${meal.target_calories} kcal`,
    accentColor: '#FF8C00',
    bodyHtml: `<ul style="margin:0;padding-left:20px;">${meal.foods.map((f) => `<li style="margin-bottom:6px;font-size:14px;color:#27272a;">${escapeHtml(f)}</li>`).join('')}</ul>`,
  })
}

// Shared by habits-notify and cron/meal-notification — both match `meals` rows
// against a time window and route each one to its owner (Teams for admin,
// email for paid/user).
export async function notifyMealRows(
  client: SupabaseClient,
  rows: MealNotifyRow[]
): Promise<number> {
  const userIds = rows.map((r) => r.user_id).filter((id): id is string => !!id)
  const profiles = await getProfilesByIds(client, userIds)

  let sent = 0
  for (const meal of rows) {
    const profile = resolveNotifyProfile(meal.user_id, profiles)
    const ok = await dispatchByRole({
      profile,
      teamsPayload: buildMealTeamsPayload(meal),
      emailSubject: `${meal.name} lúc ${meal.time}`,
      emailHtml: buildMealEmailHtml(meal),
    })
    if (ok) sent++
  }
  return sent
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildNotifyEmailHtml(params: { title: string; subtitle?: string; accentColor?: string; bodyHtml: string }) {
  const { title, subtitle, accentColor = '#059669', bodyHtml } = params
  return `
  <div style="background:#f4f4f5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
      <div style="background:${accentColor};padding:20px 24px;">
        <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">${title}</h1>
        ${subtitle ? `<p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${subtitle}</p>` : ''}
      </div>
      <div style="padding:24px;">${bodyHtml}</div>
      <div style="padding:14px 24px;background:#fafafa;border-top:1px solid #f0f0f0;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;">noteviet.vercel.app</p>
      </div>
    </div>
  </div>`
}
