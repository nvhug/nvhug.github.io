// POST /api/support/conversations/[id]/messages — the critical path (spec
// 014, plan §6). Order matters; each numbered step below matches plan §6
// exactly, including its failure mode. Do not reorder without re-reading it.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getServiceSupabaseClient } from '@/lib/supabase-admin'
import { callGeminiWithDeepSeekFallback, isProviderConfigured } from '@/lib/ai-provider'
import { logAiUsage, normalizeUsage } from '@/lib/ai-usage'
import {
  appendAiMessage,
  appendUserMessage,
  countRecentUserMessages,
  escalate,
  getUserThread,
  lastEscalationCategory,
  returnToAi,
  type EscalationNote,
} from '@/lib/support/service'
import { isOverLimit, RATE_LIMITS, windowStart } from '@/lib/support/rate-limit'
import { normalizeContent } from '@/lib/support/sanitize'
import { clampPriority, decideTriage, forceEscalation, parseTriageResponse, requiresHuman } from '@/lib/support/triage'
import { canReturnToAi } from '@/lib/support/status'
import { buildTriagePrompt, HISTORY_WINDOW, TRIAGE_MAX_TOKENS, type TriageHistoryTurn } from '@/lib/support/prompt'
import { PRODUCT_KNOWLEDGE } from '@/lib/support/knowledge'
import { deriveSubject } from '@/lib/support/subject'
import { escapeHtml, sendTeamsCard } from '@/lib/notify'
import type {
  ConversationStatus,
  EscalationCategory,
  Priority,
  SendMessageResponse,
  SupportLang,
  UserMessage,
} from '@/lib/support/types'

export const dynamic = 'force-dynamic'
// A support reply that takes the tu-vi route's 60s would be a failed support
// reply — this budget is much smaller on purpose (plan §6).
export const maxDuration = 30

const TRIAGE_BUDGET_MS = 22_000
const TRIAGE_DEEPSEEK_RESERVE_MS = 8_000

/**
 * YYYY-MM-DD in Asia/Ho_Chi_Minh (UTC+7, no DST) — the day key the
 * claim_support_ai/refund_support_ai fuse partitions on. Same fixed-offset
 * technique as vietnamTodaySolar in horoscope-interpretation.ts; this
 * feature has no lunar calendar to key off, so it is a plain calendar date.
 */
function supportUsageDayKey(now: Date): string {
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const year = local.getUTCFullYear()
  const month = String(local.getUTCMonth() + 1).padStart(2, '0')
  const day = String(local.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * The reply language (FR-027). NOT read from the request body — C3/SR-003
 * restrict the body to exactly `content` and `clientMessageId`. The
 * widget's language toggle (src/lib/i18n/language-context.tsx) lives only in
 * localStorage today with nothing server-readable, so this route reads a
 * request header instead, which is an HTTP concern the C3 body restriction
 * does not touch. Defaults to Vietnamese, matching the app's own default.
 */
function resolveLang(request: Request): SupportLang {
  return request.headers.get('x-support-lang') === 'en' ? 'en' : 'vi'
}

/** The column is UUID; anything else reaches Postgres as a 22P02 error rather
 *  than a validation failure, on a route that must never 500. Also used to
 *  validate the `id` path segment itself (SR-011): a malformed id is
 *  indistinguishable from one that exists but is not the caller's. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The response every non-error path returns.
 *
 * It re-reads the thread rather than echoing only the message just written,
 * because by the time this route answers, the conversation has usually
 * changed in ways the client cannot infer: an AI reply was appended, or the
 * status moved to `waiting_admin`. The client renders straight from
 * `conversation` + `messages`, so anything omitted here is invisible until
 * the next poll — and a shape that omits them is what made every send fail
 * before (the hook destructured fields the route never sent).
 *
 * Keep this the single exit point. Adding a bare NextResponse.json elsewhere
 * in the success path re-opens exactly that bug.
 */
async function respondWithThread(
  userId: string,
  conversationId: string,
  message: UserMessage,
  duplicate: boolean,
  escalated: boolean,
) {
  const thread = await getUserThread(userId, conversationId)
  if (!thread) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const payload: SendMessageResponse = {
    message,
    duplicate,
    escalated,
    conversation: thread.conversation,
    messages: thread.messages,
  }
  return NextResponse.json(payload)
}

// Vietnamese labels for the Teams card only — EscalationCategory itself stays
// internal-only (never serialised to a user payload, see types.ts) and Priority's
// English values are unrelated to this display concern.
const CATEGORY_LABEL_VI: Record<EscalationCategory, string> = {
  payment: 'Thanh toán',
  account: 'Truy cập tài khoản',
  security: 'Bảo mật',
  data_loss: 'Mất dữ liệu',
  human_requested: 'Yêu cầu gặp người thật',
  low_confidence: 'AI không đủ tự tin',
  unparseable: 'Phản hồi AI không hợp lệ',
  provider_failure: 'Lỗi hệ thống AI',
  quota_exhausted: 'Hết hạn mức AI',
  model_escalated: 'AI chủ động chuyển tiếp',
}

const PRIORITY_LABEL_VI: Record<Priority, string> = {
  low: 'Thấp',
  normal: 'Bình thường',
  high: 'Cao',
  urgent: 'Khẩn cấp',
}

/**
 * Every escalation pages the team, not just the model-driven ones.
 *
 * The forced categories (payment, security, account access, data loss, a
 * user asking for a human) are the MOST urgent things this route produces —
 * wiring the notification to only one escalation path would page for
 * low-confidence answers and stay silent for a security report.
 *
 * Subject and category only, never message content (C4). Failure is
 * swallowed: a Teams outage must not fail the user's message.
 */
async function notifyEscalation(subject: string, category: EscalationCategory, priority: Priority): Promise<void> {
  try {
    await sendTeamsCard({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      summary: `Hội thoại hỗ trợ cần xử lý: ${subject}`,
      sections: [
        {
          activityTitle: '🆘 Hội thoại hỗ trợ được chuyển tiếp',
          activitySubtitle: `Lý do: ${CATEGORY_LABEL_VI[category]} · Mức độ: ${PRIORITY_LABEL_VI[priority]}`,
          text: `Chủ đề: ${escapeHtml(subject)}`,
        },
      ],
    })
  } catch (err) {
    console.error('[support] admin notification failed:', err)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // 1. Auth.
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const userId = user.id

  const { id: conversationId } = await params

  // The column is UUID; a malformed id is indistinguishable from one that
  // exists but belongs to someone else (SR-011), so it gets the same 404 —
  // never a 400, and never let through to Postgres as a 22P02. Checked
  // before any DB call, same reasoning as clientMessageId below.
  if (!UUID_RE.test(conversationId)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // 3. Validate. The body is read for exactly these two fields and nothing
  // else, ever (C3, SR-003).
  let body: { content?: unknown; clientMessageId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const content = normalizeContent(body.content)
  if (!content) return NextResponse.json({ error: 'invalid_content' }, { status: 400 })
  const clientMessageId = typeof body.clientMessageId === 'string' && UUID_RE.test(body.clientMessageId.trim())
    ? body.clientMessageId.trim()
    : null
  if (!clientMessageId) return NextResponse.json({ error: 'invalid_client_message_id' }, { status: 400 })

  // Everything from here on touches the database, so it all runs inside one
  // try: no DB call — ownership included — is left unguarded ahead of it.
  // `thread` and `statusAfterAppend` are hoisted so the catch below can tell
  // how far things got: whether ownership was ever confirmed, and whether
  // the conversation was still AI-owned by the time the failure happened.
  let thread: Awaited<ReturnType<typeof getUserThread>> = null
  let statusAfterAppend: ConversationStatus | null = null
  let answered = false

  try {
    // 2. Ownership. null covers both "no such conversation" and "not yours" —
    // 404 either way, never 403 (SR-011).
    thread = await getUserThread(userId, conversationId)
    if (!thread) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // 4. Rate limit — before any AI cost.
    const now = new Date()
    const since = windowStart(now, 60_000).toISOString()
    const recentCount = await countRecentUserMessages(userId, since)
    if (isOverLimit(recentCount, RATE_LIMITS.messagesPerMinute)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    // 5. Persist the user message. A duplicate clientMessageId returns the
    // already-stored row and stops here — no second AI call (FR-014/SR-009).
    const { message: userMessage, duplicate, status } = await appendUserMessage(
      userId,
      conversationId,
      content,
      clientMessageId,
    )
    statusAfterAppend = status
    if (duplicate) {
      return await respondWithThread(userId, conversationId, userMessage, true, false)
    }

    // 6. Reopen (FR-006) happens inside appendUserMessage itself when the
    // stored status was resolved/closed.

    // 7. Skip AI entirely when a human already owns the conversation
    // (FR-067). `status` is what appendUserMessage's own guarded write
    // actually ended up storing — truth from that write itself, not a
    // separate re-read that the write could have silently clobbered (an
    // admin can take the conversation over while this request is in
    // flight; appendUserMessage's update is now conditioned on the status
    // it read, so it cannot stomp that takeover, and reports back whatever
    // is really there instead).
    if (status === 'admin_active' || status === 'waiting_admin') {
      // 7a. FR-067b — an escalation nobody answered may come back to the AI.
      //
      // `thread.conversation.lastMessageAt` is the value from BEFORE this
      // message was appended: the question is how long the conversation sat
      // waiting, and the message being sent right now is what proves the user
      // is still there, not what restarts the clock.
      //
      // Forced categories never come back (see requiresHuman): a reported
      // charge or breach stays with the person it was escalated to, however
      // long it takes. Only escalations that happened because the AI could not
      // answer this time are eligible.
      let handedBack = false
      if (status === 'waiting_admin') {
        const category = await lastEscalationCategory(conversationId)
        if (
          canReturnToAi(status, new Date(thread.conversation.lastMessageAt), now, requiresHuman(category))
        ) {
          handedBack = await returnToAi(conversationId)
          if (handedBack) statusAfterAppend = 'ai_active'
        }
      }
      if (!handedBack) {
        return await respondWithThread(userId, conversationId, userMessage, false, false)
      }
    }

    const lang = resolveLang(request)
    const subject = thread.conversation.subject ?? deriveSubject(content)

    // Shared tail for every escalation path: transition, page the team, and
    // hand the caller the same full-thread payload a successful answer gets.
    //
    // `escalate` returns false when a human took the conversation over while
    // this request was in flight — an admin replied and now owns it. In
    // that case nothing was written and nobody is paged: the team does not need
    // telling about a thread one of them is already answering (FR-067), and the
    // user gets the thread as it now really stands, admin reply included.
    const escalateAndRespond = async (
      category: EscalationCategory,
      priority: Priority,
      note?: EscalationNote,
    ) => {
      const escalated = await escalate(conversationId, category, priority, note)
      if (escalated) await notifyEscalation(subject, category, priority)
      return respondWithThread(userId, conversationId, userMessage, false, escalated)
    }

    // 8. Forced escalation — before any provider call, so a hit spends nothing.
    const forcedCategory = forceEscalation(content)
    if (forcedCategory !== null) {
      return await escalateAndRespond(forcedCategory, clampPriority(undefined, forcedCategory))
    }

    // Nothing configured to call — treated exactly like a provider failure
    // rather than attempting a call that cannot succeed.
    if (!isProviderConfigured()) {
      return await escalateAndRespond('provider_failure', clampPriority(undefined, null))
    }

    // 9. Claim the fuse. `false` escalates — never 429 to the client here
    // (FR-041). Uses the user's OWN session client, not the service-role one:
    // claim_support_ai reads auth.uid() from the caller's JWT and would
    // always return FALSE without a session.
    const usageDay = supportUsageDayKey(now)
    const { data: claimed, error: claimError } = await supabase.rpc('claim_support_ai', { p_usage_day: usageDay })
    if (claimError) {
      console.error('[support] claim_support_ai unavailable:', claimError.message)
    }
    if (claimError || claimed !== true) {
      return await escalateAndRespond('quota_exhausted', clampPriority(undefined, null))
    }

    const refundSlot = async () => {
      try {
        // Through the service role, not the user's session — a refund the
        // client could call itself would let anyone reset their own cap.
        await getServiceSupabaseClient().rpc('refund_support_ai', { p_user_id: userId, p_usage_day: usageDay })
      } catch (err) {
        console.error('[support] slot refund failed:', err)
      }
    }

    // 10. Provider call — buffered only (C7: never streamGeminiWithDeepSeekFallback),
    // and never naming a Gemini model (C8: the router walks GEMINI_CASCADE itself).
    const history: TriageHistoryTurn[] = thread.messages.slice(-HISTORY_WINDOW).map((m) => ({
      senderType: m.senderType,
      content: m.content,
    }))
    const prompt = buildTriagePrompt({ knowledge: PRODUCT_KNOWLEDGE, history, message: content, lang })
    const startedAt = new Date()

    const result = await callGeminiWithDeepSeekFallback({
      deepseekModel: 'deepseek-v4-flash',
      prompt,
      temperature: 0.3,
      maxTokens: TRIAGE_MAX_TOKENS,
      budgetMs: TRIAGE_BUDGET_MS,
      deepseekReserveMs: TRIAGE_DEEPSEEK_RESERVE_MS,
    })

    if (!result.ok) {
      // Neither provider produced a completion, so nothing was billed —
      // refund the fuse slot and escalate. Never a 500 (FR-040).
      await refundSlot()
      return await escalateAndRespond('provider_failure', clampPriority(undefined, null))
    }

    // 11. Log usage — failure is swallowed inside logAiUsage itself.
    await logAiUsage({
      surface: 'support_chat',
      provider: result.provider,
      model: result.model,
      usage: normalizeUsage(result.usage, result.provider),
      outcome: 'success',
      userId,
      actor: 'user',
      at: startedAt,
    })

    // 12. Parse + decide. Unparseable or confidence < AI_CONFIDENCE_THRESHOLD
    // escalates inside decideTriage itself.
    const parsed = parseTriageResponse(result.text)
    const decision = decideTriage({ parsed, forced: null })

    // 13. Write the outcome. `appendAiMessage` returns false when an admin took
    // the conversation over during the provider call: the answer is dropped
    // rather than posted underneath a human's reply (FR-067). `answered` still
    // becomes true either way — the user has been served, by a person if not by
    // the model, so the catch below must not escalate on top of it.
    if (decision.action === 'ANSWER') {
      await appendAiMessage(conversationId, decision, result.model)
      answered = true
      return await respondWithThread(userId, conversationId, userMessage, false, false)
    }

    // 14. Escalate + notify, via the same shared tail as every other path. The
    // model's own reason travels with it — that note is the entire handover a
    // human gets (FR-013/FR-092).
    return await escalateAndRespond(decision.category ?? 'low_confidence', decision.priority, {
      reason: decision.reason,
      confidence: decision.confidence,
      model: result.model,
    })
  } catch (err) {
    // Only the error's own message, never the error object. A PostgrestError
    // from the message INSERT this block wraps carries `details` = "Failing row
    // contains (...)", i.e. the user's message text, and FR-092 forbids message
    // content in any application log. No reachable constraint produces that
    // today (normalizeContent already bounds content to the CHECK's 1..4000),
    // so this is the guard, not a fix for a live leak.
    console.error('[support] send failed after the message was accepted:', err instanceof Error ? err.message : String(err))

    if (!thread) {
      // Ownership was never confirmed — there is nothing safe to escalate or
      // recover here, since this conversation may not even belong to the
      // caller. This is the one case left where the route cannot promise a
      // stored message plus a human handoff.
      return NextResponse.json({ error: 'support_unavailable' }, { status: 500 })
    }

    // Escalating unconditionally here was the bug: forcing status back to
    // `waiting_admin` is wrong when the AI already produced and stored an
    // answer (the user is already served — `answered`), and just as wrong
    // when a human already owns the conversation (`admin_active` or
    // `waiting_admin` — taking it away from the admin handling it is exactly
    // what FR-067 forbids). Escalate only when the conversation is still
    // genuinely AI-owned and nothing was written to answer the user.
    // `statusAfterAppend` is `null` only when the failure happened before
    // appendUserMessage ever reported back — the ordinary "something in the
    // provider chain blew up" case FR-040 describes, which still belongs on
    // this path.
    const humanAlreadyOwns = statusAfterAppend === 'admin_active' || statusAfterAppend === 'waiting_admin'
    let escalated = false
    if (!answered && !humanAlreadyOwns) {
      try {
        const subject = thread.conversation.subject ?? deriveSubject(content)
        // Same guard as the happy path: `escalate` refuses if the conversation
        // is no longer AI-owned, and `escalated` must then stay false so the
        // client is not told a handoff happened that did not.
        escalated = await escalate(conversationId, 'provider_failure', 'normal')
        if (escalated) await notifyEscalation(subject, 'provider_failure', 'normal')
      } catch (escalateErr) {
        console.error('[support] escalation after failure also failed:', escalateErr)
      }
    }

    // The user's message may or may not have been stored, but either way the
    // reply they are owed is now a human's (when escalated) or whatever the
    // thread already shows (when it was not). Return a readable thread
    // rather than an error page.
    //
    // Guarded: the likeliest reason for being in this catch at all is that the
    // database is unreachable, which is exactly when this read throws too. An
    // unguarded recovery turned FR-040's careful "never 500" path into a raw
    // 500 in the one situation it was written for.
    try {
      const recovered = await getUserThread(userId, conversationId)
      if (!recovered) return NextResponse.json({ error: 'not_found' }, { status: 404 })
      return NextResponse.json({
        message: null,
        duplicate: false,
        escalated,
        conversation: recovered.conversation,
        messages: recovered.messages,
      })
    } catch (recoverErr) {
      console.error('[support] thread recovery after failure also failed:', recoverErr)
      return NextResponse.json({ error: 'support_unavailable' }, { status: 500 })
    }
  }
}
