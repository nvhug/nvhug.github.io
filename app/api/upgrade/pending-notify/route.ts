import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { sendNotifyEmail, sendTeamsCard, escapeHtml } from '@/lib/notify'

const TO_EMAIL  = process.env.BUG_REPORT_TO_EMAIL
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Notifications <onboarding@resend.dev>'

const FEATURE_LABELS: Record<string, string> = {
  notes_analyze:     'Phân tích sức khỏe AI',
  food_analyze:      'Phân tích dinh dưỡng AI',
  stock_analyze:     'Phân tích cổ phiếu AI',
  stock_suggestions: 'Gợi ý cổ phiếu AI',
}

function buildHtml(email: string, feature: string, planId: string) {
  const featureLabel = escapeHtml(FEATURE_LABELS[feature] ?? feature)
  const sender = `<a href="mailto:${escapeHtml(email)}" style="color:#7c3aed;">${escapeHtml(email)}</a>`
  return `
  <div style="background:#f5f3ff;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #ede9fe;">
      <div style="background:#7c3aed;padding:20px 24px;">
        <span style="display:inline-block;background:rgba(255,255,255,0.18);color:#fff;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:4px 10px;border-radius:999px;">Upgrade Request</span>
        <h1 style="margin:10px 0 0;color:#fff;font-size:18px;font-weight:700;">Người dùng đang chờ duyệt ⏳</h1>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;">
          Người dùng này đã gửi yêu cầu nâng cấp và đang cố dùng tính năng AI nhưng đã hết lượt thử.
          Hãy xét duyệt yêu cầu của họ.
        </p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;border-top:1px solid #f0f0f0;width:120px;vertical-align:top;">
              <span style="font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.04em;">Email</span>
            </td>
            <td style="padding:10px 0;border-top:1px solid #f0f0f0;vertical-align:top;">
              <span style="font-size:14px;color:#18181b;">${sender}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-top:1px solid #f0f0f0;vertical-align:top;">
              <span style="font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.04em;">Tính năng</span>
            </td>
            <td style="padding:10px 0;border-top:1px solid #f0f0f0;vertical-align:top;">
              <span style="font-size:14px;color:#18181b;">${featureLabel}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-top:1px solid #f0f0f0;vertical-align:top;">
              <span style="font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.04em;">Gói đăng ký</span>
            </td>
            <td style="padding:10px 0;border-top:1px solid #f0f0f0;vertical-align:top;">
              <span style="font-size:14px;color:#18181b;">${escapeHtml(planId)}</span>
            </td>
          </tr>
        </table>
      </div>
      <div style="padding:14px 24px;background:#fafafa;border-top:1px solid #f0f0f0;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;">Tự động gửi từ notez.vn</p>
      </div>
    </div>
  </div>`
}

export async function POST(request: Request) {
  if (!TO_EMAIL) return NextResponse.json({ ok: true }) // silently skip if not configured

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { feature = '' } = await request.json().catch(() => ({})) as { feature?: string }

  // Verify user actually has a pending request (not spoofable — RLS enforces user_id)
  const { data: req } = await supabase
    .from('upgrade_requests')
    .select('plan_id')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!req) return NextResponse.json({ error: 'No pending request' }, { status: 400 })

  const email = user.email ?? ''

  await Promise.all([
    sendNotifyEmail(TO_EMAIL, `⏳ Người dùng đang chờ duyệt: ${email}`, buildHtml(email, feature, req.plan_id)),
    sendTeamsCard({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '7c3aed',
      summary: 'Người dùng đang chờ duyệt',
      sections: [{
        activityTitle: '⏳ Người dùng đang chờ duyệt!',
        activitySubtitle: email,
        text: `Tính năng: ${FEATURE_LABELS[feature] ?? feature} | Gói: ${req.plan_id}`,
      }],
    }),
  ])

  return NextResponse.json({ ok: true })
}
