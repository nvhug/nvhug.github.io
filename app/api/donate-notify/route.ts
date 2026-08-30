import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { sendTeamsCard } from '@/lib/notify'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const RESEND_API_KEY    = process.env.RESEND_API_KEY
const TO_EMAIL          = process.env.BUG_REPORT_TO_EMAIL
const FROM_EMAIL        = process.env.RESEND_FROM_EMAIL || 'Donate <onboarding@resend.dev>'

function buildHtml(userName: string, userEmail: string, ts: string) {
  const sender = userEmail
    ? `${userName ? `<b>${userName}</b> — ` : ''}<a href="mailto:${userEmail}" style="color:#7c3aed;">${userEmail}</a>`
    : 'Khách (chưa đăng nhập)'

  return `
  <div style="background:#f5f3ff;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #ede9fe;">
      <div style="background:#7c3aed;padding:20px 24px;">
        <span style="display:inline-block;background:rgba(255,255,255,0.18);color:#fff;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:4px 10px;border-radius:999px;">Donate</span>
        <h1 style="margin:10px 0 0;color:#fff;font-size:18px;font-weight:700;">Có người vừa ủng hộ! 🎉</h1>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;">Một người dùng vừa xác nhận đã ủng hộ qua tính năng Phân tích AI.</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;border-top:1px solid #f0f0f0;vertical-align:top;width:100px;">
              <span style="font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.04em;">Người dùng</span>
            </td>
            <td style="padding:10px 0;border-top:1px solid #f0f0f0;vertical-align:top;">
              <span style="font-size:14px;color:#18181b;">${sender}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-top:1px solid #f0f0f0;vertical-align:top;">
              <span style="font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.04em;">Thời gian</span>
            </td>
            <td style="padding:10px 0;border-top:1px solid #f0f0f0;vertical-align:top;">
              <span style="font-size:14px;color:#18181b;">${ts}</span>
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

export async function POST(request: NextRequest) {
  if (!RESEND_API_KEY || !TO_EMAIL) {
    return NextResponse.json({ error: 'not configured' }, { status: 500 })
  }

  const supabaseAuth = await createSupabaseServerClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userName = '', userEmail = '', ts = '' } = await request.json().catch(() => ({})) as {
    userName?: string
    userEmail?: string
    ts?: string
  }

  const resend = new Resend(RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to:   TO_EMAIL,
    subject: '🎉 Có người ủng hộ qua Phân tích AI!',
    html: buildHtml(userName, userEmail, ts || new Date().toISOString()),
  })

  if (error) {
    console.error('donate-notify resend error:', error)
    return NextResponse.json({ error: 'send failed' }, { status: 500 })
  }

  await sendTeamsCard({
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: '7c3aed',
    summary: 'Có người vừa ủng hộ! 🎉',
    sections: [{
      activityTitle: '🎉 Có người vừa ủng hộ!',
      activitySubtitle: userName ? `${userName} — ${userEmail}` : userEmail || 'Khách',
      text: `Thời gian: ${ts}`,
    }],
  })

  return NextResponse.json({ success: true })
}
