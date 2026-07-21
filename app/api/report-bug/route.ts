import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const BUG_REPORT_TO_EMAIL = process.env.BUG_REPORT_TO_EMAIL
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Bug Report <onboarding@resend.dev>'

const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const MIN_SUBMIT_MS = 1500
const MIN_DESCRIPTION_LENGTH = 10
const MAX_DESCRIPTION_LENGTH = 5000
const MIN_UNIQUE_CHARS = 3
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildEmailHtml(params: {
  typeLabel: string
  isFeature: boolean
  description: string
  reporterName: string
  reporterEmail: string
  pageUrl: string
  userAgent: string
}) {
  const { typeLabel, isFeature, description, reporterName, reporterEmail, pageUrl, userAgent } = params
  const accentColor = isFeature ? '#2563eb' : '#059669'
  const accentBg = isFeature ? '#eff6ff' : '#ecfdf5'
  const reporterLine = reporterEmail
    ? `${reporterName ? `${escapeHtml(reporterName)} — ` : ''}<a href="mailto:${escapeHtml(reporterEmail)}" style="color:${accentColor};text-decoration:none;">${escapeHtml(reporterEmail)}</a>`
    : 'Khách (chưa đăng nhập)'

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 0;border-top:1px solid #f0f0f0;vertical-align:top;width:120px;">
        <span style="font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.04em;">${label}</span>
      </td>
      <td style="padding:10px 0;border-top:1px solid #f0f0f0;vertical-align:top;">
        <span style="font-size:14px;color:#18181b;">${value}</span>
      </td>
    </tr>`

  return `
  <div style="background:#f4f4f5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
      <div style="background:${accentColor};padding:20px 24px;">
        <span style="display:inline-block;background:rgba(255,255,255,0.18);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:4px 10px;border-radius:999px;">${typeLabel}</span>
        <h1 style="margin:10px 0 0;color:#ffffff;font-size:18px;font-weight:700;">Có báo cáo mới từ website</h1>
      </div>
      <div style="padding:24px;">
        <div style="background:${accentBg};border-radius:10px;padding:14px 16px;margin-bottom:20px;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#27272a;white-space:pre-wrap;">${escapeHtml(description)}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          ${row('Người gửi', reporterLine)}
          ${pageUrl ? row('Trang', `<a href="${escapeHtml(pageUrl)}" style="color:${accentColor};text-decoration:none;">${escapeHtml(pageUrl)}</a>`) : ''}
          ${userAgent ? row('Thiết bị', escapeHtml(userAgent)) : ''}
        </table>
      </div>
      <div style="padding:14px 24px;background:#fafafa;border-top:1px solid #f0f0f0;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;">Gửi tự động từ hệ thống Báo lỗi &amp; Góp ý — noteviet.vercel.app</p>
      </div>
    </div>
  </div>`
}

export async function POST(request: NextRequest) {
  if (!RESEND_API_KEY || !BUG_REPORT_TO_EMAIL) {
    console.error('Bug report email not configured (RESEND_API_KEY / BUG_REPORT_TO_EMAIL missing)')
    return NextResponse.json({ error: 'Bug report service not configured' }, { status: 500 })
  }

  try {
    const formData = await request.formData()

    // Honeypot — bots tend to fill every field, real users never see it
    const honeypot = formData.get('website')
    if (typeof honeypot === 'string' && honeypot.trim() !== '') {
      return NextResponse.json({ success: true })
    }

    // Real users take at least a moment to fill the form
    const renderedAt = Number(formData.get('renderedAt'))
    if (!renderedAt || Date.now() - renderedAt < MIN_SUBMIT_MS) {
      return NextResponse.json({ error: 'errorCaptcha' }, { status: 400 })
    }

    if (formData.get('sliderVerified') !== 'true') {
      return NextResponse.json({ error: 'errorCaptcha' }, { status: 400 })
    }

    const type = formData.get('type') === 'feature' ? 'feature' : 'bug'

    const description = String(formData.get('description') || '').trim()
    if (!description) {
      return NextResponse.json({ error: 'errorDescriptionRequired' }, { status: 400 })
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json({ error: 'errorGeneric' }, { status: 400 })
    }
    const meaningfulChars = description.replace(/\s/g, '')
    const uniqueChars = new Set(meaningfulChars.toLowerCase()).size
    if (meaningfulChars.length < MIN_DESCRIPTION_LENGTH || uniqueChars < MIN_UNIQUE_CHARS) {
      return NextResponse.json({ error: 'errorDescriptionTooShort' }, { status: 400 })
    }

    const reporterEmail = String(formData.get('reporterEmail') || '').trim()
    if (reporterEmail && !EMAIL_RE.test(reporterEmail)) {
      return NextResponse.json({ error: 'errorGeneric' }, { status: 400 })
    }
    const reporterName = String(formData.get('reporterName') || '').trim()

    const pageUrl = String(formData.get('pageUrl') || '').trim()
    const userAgent = String(formData.get('userAgent') || '').trim()

    const attachments: { filename: string; content: Buffer }[] = []
    const image = formData.get('image')
    if (image instanceof File && image.size > 0) {
      if (!image.type.startsWith('image/')) {
        return NextResponse.json({ error: 'errorImageType' }, { status: 400 })
      }
      if (image.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: 'errorImageSize' }, { status: 400 })
      }
      const buffer = Buffer.from(await image.arrayBuffer())
      attachments.push({ filename: image.name || 'screenshot.png', content: buffer })
    }

    const isFeature = type === 'feature'
    const typeLabel = isFeature ? 'Đề xuất tính năng' : 'Báo lỗi'

    const resend = new Resend(RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: BUG_REPORT_TO_EMAIL,
      replyTo: reporterEmail || undefined,
      subject: `[${isFeature ? 'Feature Request' : 'Bug Report'}] ${description.slice(0, 60)}`,
      html: buildEmailHtml({ typeLabel, isFeature, description, reporterName, reporterEmail, pageUrl, userAgent }),
      attachments: attachments.length ? attachments : undefined,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'errorGeneric' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in bug report route:', error)
    return NextResponse.json({ error: 'errorGeneric' }, { status: 500 })
  }
}
