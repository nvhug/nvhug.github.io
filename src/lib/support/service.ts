// SupportService — the ONLY module in "Chat with Us" (spec 014) that touches
// Supabase. Every function that acts on behalf of a specific user takes that
// user's id explicitly and re-checks ownership itself, because this module
// uses the service-role client (getServiceSupabaseClient), which bypasses
// RLS entirely (plan §2 C2). The database is not the guard at this layer —
// this file is.
//
// Two deliberate exceptions to "only this file touches Supabase":
//   - `claim_support_ai` needs the CALLING USER'S OWN session (its SQL body
//     reads auth.uid()), not the service-role client, which carries no user
//     session at all. Calling it from here with getServiceSupabaseClient()
//     would make auth.uid() resolve to NULL and the fuse would always
//     report exhausted. Exactly like sql/26's `claim_tuvi_generation`, the
//     send route (app/api/support/conversations/[id]/messages/route.ts)
//     calls it directly on the user-scoped client it already created for
//     auth.getUser() — mirroring app/api/tu-vi/interpret/route.ts.
//   - `refund_support_ai` is called from that same route via
//     getServiceSupabaseClient(), also mirroring the tu-vi reference route.
// Everything that touches support_conversations / support_messages /
// support_conversation_events lives here.
//
// Auto-resolution (FR-081) is a READ-time computation, never persisted: the
// DB status column changes only via an explicit write (a user's message
// reopening a resolved/closed row, or an admin's PATCH). Read-facing
// functions (getUserThread, listUserConversations, adminGetThread,
// adminListConversations) apply applyLazyResolution to the STORED status
// before returning it, so a conversation idle past the window is *displayed*
// as resolved/closed without a cron job ever writing that back (ADR-015).
// Functions that decide whether to reopen (appendUserMessage) intentionally
// use the RAW stored status instead — see the comment on that function.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabaseClient } from '@/lib/supabase-admin'
import type {
  AdminMessage,
  Conversation,
  ConversationStatus,
  EscalationCategory,
  InboxFilters,
  Priority,
  SenderType,
  SupportMetrics,
  TriageDecision,
  UserMessage,
} from '@/lib/support/types'
import {
  applyLazyResolution,
  canTransition,
  nextStatusForUserMessage,
  SUPPORT_AUTO_RESOLVE_HOURS,
} from '@/lib/support/status'
import { toAdminMessage, toUserMessage, toUserMessages, type SupportMessageRow } from '@/lib/support/sanitize'
import { deriveSubject } from '@/lib/support/subject'
import { computeSupportMetrics, type SupportMetricsConversationInput } from '@/lib/support/metrics'
import { isUnreadForAdmin } from '@/lib/support/unread'

// ─── Errors ──────────────────────────────────────────────────────────────
//
// Routes translate these to HTTP status codes. Anything else that escapes a
// service call is an unexpected failure the route maps to 500.

export class SupportNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupportNotFoundError'
  }
}

export class SupportValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupportValidationError'
  }
}

// ─── Row shapes and mapping ──────────────────────────────────────────────

interface ConversationRow {
  id: string
  user_id: string
  status: ConversationStatus
  priority: Priority
  assigned_admin_id: string | null
  subject: string | null
  created_at: string
  updated_at: string
  last_message_at: string
  user_last_read_at: string | null
  admin_last_read_at: string | null
  resolved_at: string | null
  closed_at: string | null
}

const CONVERSATION_COLUMNS =
  'id, user_id, status, priority, assigned_admin_id, subject, created_at, updated_at, last_message_at, user_last_read_at, admin_last_read_at, resolved_at, closed_at'

const MESSAGE_COLUMNS = 'id, sender_type, sender_id, content, client_message_id, created_at, metadata'

/**
 * How many messages one thread read returns.
 *
 * Coupled to OLDER_PAGE_SIZE in src/hooks/useSupportConversation.ts: the
 * client decides whether to keep offering "load older" by testing whether the
 * page it got back was full. Lower this without lowering that and the client
 * stops offering to page long before it has reached the top of the thread.
 */
export const THREAD_PAGE_SIZE = 30

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    priority: row.priority,
    assignedAdminId: row.assigned_admin_id,
    subject: row.subject,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
    userLastReadAt: row.user_last_read_at,
    adminLastReadAt: row.admin_last_read_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
  }
}

/** Read-facing conversion: the returned `status` is what FR-081 says the
 *  conversation should be TREATED as right now, not necessarily the literal
 *  DB column. Never used for the reopen decision — see appendUserMessage. */
function mapConversationForRead(row: ConversationRow, now: Date): Conversation {
  const base = mapConversation(row)
  const effective = applyLazyResolution(
    base.status,
    new Date(row.last_message_at),
    now,
    row.resolved_at ? new Date(row.resolved_at) : null,
  )
  return effective === base.status ? base : { ...base, status: effective }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
}

const OPEN_STATUSES: ConversationStatus[] = ['ai_active', 'waiting_admin', 'admin_active']

// ─── Events (FR-090) ──────────────────────────────────────────────────────

export type SupportEventType =
  | 'conversation_created'
  | 'ai_answered'
  | 'ai_escalated'
  | 'admin_assigned'
  | 'admin_replied'
  | 'internal_note_added'
  | 'status_changed'
  | 'priority_changed'
  | 'conversation_resolved'
  | 'conversation_reopened'
  | 'conversation_closed'

/**
 * Writes one audit-trail row. `metadata` must be structural only — status/
 * priority/assignee/category, never message content (C4, ADR-014). Failure
 * is swallowed: an audit-log write must never undo a state change that
 * already committed, same stance as logAiUsage.
 */
export async function recordEvent(
  conversationId: string,
  type: SupportEventType,
  actorId: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  const client = getServiceSupabaseClient()
  const { error } = await client.from('support_conversation_events').insert({
    conversation_id: conversationId,
    event_type: type,
    actor_id: actorId,
    metadata,
  })
  if (error) {
    console.error(`[support] failed to record event ${type}:`, error.message)
  }
}

// ─── User-facing reads/writes ────────────────────────────────────────────

const ACTIVE_STATUSES: ConversationStatus[] = ['ai_active', 'waiting_admin', 'admin_active']

/**
 * Returns the caller's single open conversation, or `null` when there is none
 * to reuse: no row in the active set, or one whose lazily-computed status
 * disagrees (an `ai_active` row gone quiet past the auto-resolve window reads
 * as effectively resolved, so a fresh thread is started rather than a
 * year-old one revived).
 */
export async function findActiveConversation(userId: string): Promise<Conversation | null> {
  const client = getServiceSupabaseClient()
  const now = new Date()

  const { data: candidates, error: candidatesError } = await client
    .from('support_conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('user_id', userId)
    .in('status', ACTIVE_STATUSES)
    .order('last_message_at', { ascending: false })
    .limit(1)
  if (candidatesError) throw candidatesError

  const candidate = (candidates as ConversationRow[] | null)?.[0]
  if (!candidate) return null

  const effective = mapConversationForRead(candidate, now)
  return ACTIVE_STATUSES.includes(effective.status) ? effective : null
}

/** Inserts a fresh `ai_active` conversation and writes `conversation_created`
 *  (FR-090). Split out from the lookup above so the caller can apply the
 *  conversations-per-hour cap (FR-100) to THIS step alone: the cap exists to
 *  bound inserts, and charging it for merely reusing a thread that already
 *  exists locked a user out of their own open conversation. */
export async function createConversation(userId: string): Promise<Conversation> {
  const client = getServiceSupabaseClient()

  const { data: created, error: createError } = await client
    .from('support_conversations')
    .insert({ user_id: userId, status: 'ai_active', priority: 'normal' })
    .select(CONVERSATION_COLUMNS)
    .single()
  if (createError) throw createError

  const row = created as ConversationRow
  await recordEvent(row.id, 'conversation_created', userId, {})
  return mapConversation(row)
}

/** All of the caller's own conversations, most recent activity first. */
export async function listUserConversations(userId: string): Promise<Conversation[]> {
  const client = getServiceSupabaseClient()
  const { data, error } = await client
    .from('support_conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false })
  if (error) throw error

  const now = new Date()
  return ((data as ConversationRow[] | null) ?? []).map((row) => mapConversationForRead(row, now))
}

/**
 * Returns `null` for BOTH "no such conversation" and "not yours" — the one
 * query filters on `id` AND `user_id` together, so the caller is never told
 * which case it hit. This is what makes SR-011 hold (plan §5).
 *
 * Does NOT write `user_last_read_at`. This function is also the thread poll
 * (FR-054, every 8s while the widget is open) and the send route's ownership
 * check, so a write here would fire an UPDATE per poll tick per open widget.
 * Nothing reads that column: the user-side unread badge (FR-055) is derived
 * client-side from localStorage (`LAST_SEEN_KEY` in useSupportConversation.ts),
 * not from a server timestamp, so the write bought nothing but load.
 */
export async function getUserThread(
  userId: string,
  conversationId: string,
  before?: string | null,
): Promise<{ conversation: Conversation; messages: UserMessage[] } | null> {
  const client = getServiceSupabaseClient()

  const { data: convRow, error: convError } = await client
    .from('support_conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()
  if (convError) throw convError
  if (!convRow) return null

  // Windowed read. An unbounded fetch would ship the entire thread on every
  // poll — at 8s intervals a long-running conversation re-sends hundreds of
  // rows a minute for no reason. Newest-first + limit, then reversed back to
  // ascending for display.
  //
  // `system` rows are excluded in SQL rather than only by toUserMessages
  // below, so the page size is exact: filtering after the limit would return
  // fewer than THREAD_PAGE_SIZE rows and the client would read that short
  // page as "no older messages left".
  let msgQuery = client
    .from('support_messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .neq('sender_type', 'system')
    .order('created_at', { ascending: false })
    .limit(THREAD_PAGE_SIZE)
  if (before) msgQuery = msgQuery.lt('created_at', before)

  const { data: msgRowsDesc, error: msgError } = await msgQuery
  if (msgError) throw msgError
  const msgRows = ((msgRowsDesc as SupportMessageRow[] | null) ?? []).slice().reverse()

  return {
    conversation: mapConversationForRead(convRow as ConversationRow, new Date()),
    messages: toUserMessages(msgRows),
  }
}

/**
 * Inserts the user's message, idempotently on `(conversation_id,
 * client_message_id)` (FR-014/SR-009): a 23505 unique-violation returns the
 * ALREADY-STORED row with `duplicate: true` instead of throwing, so the
 * caller never fires a second AI call for a double-click.
 *
 * Re-checks ownership itself (C2) via the same id+user_id filter as
 * getUserThread, independently of whatever the caller already verified.
 *
 * Reopen (FR-006) and the first-message subject (FR-062) are decided from
 * the RAW stored status/subject read here, not any lazily-computed display
 * value — `nextStatusForUserMessage` only changes anything when the DB
 * literally says `resolved`/`closed`, which happens only via an explicit
 * write (this function's own reopen, or an admin PATCH). An `ai_active` row
 * that merely LOOKS resolved because it has been idle is left untouched:
 * nothing needs "reopening" since the DB never left `ai_active`.
 */
export async function appendUserMessage(
  userId: string,
  conversationId: string,
  content: string,
  clientMessageId: string,
): Promise<{ message: UserMessage; duplicate: boolean; status: ConversationStatus }> {
  const client = getServiceSupabaseClient()

  const { data: convRow, error: convError } = await client
    .from('support_conversations')
    .select('id, status, subject')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()
  if (convError) throw convError
  if (!convRow) throw new SupportNotFoundError('conversation not found or not owned')

  const { data: inserted, error: insertError } = await client
    .from('support_messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'user',
      sender_id: userId,
      content,
      client_message_id: clientMessageId,
    })
    .select(MESSAGE_COLUMNS)
    .single()

  if (insertError) {
    if (isUniqueViolation(insertError)) {
      const { data: existing, error: existingError } = await client
        .from('support_messages')
        .select(MESSAGE_COLUMNS)
        .eq('conversation_id', conversationId)
        .eq('client_message_id', clientMessageId)
        .maybeSingle()
      if (existingError) throw existingError
      if (!existing) throw insertError
      return {
        message: toUserMessage(existing as SupportMessageRow),
        duplicate: true,
        status: (convRow as { status: ConversationStatus }).status,
      }
    }
    throw insertError
  }

  const currentStatus = (convRow as { status: ConversationStatus }).status
  const currentSubject = (convRow as { subject: string | null }).subject
  const nextStatus = nextStatusForUserMessage(currentStatus)
  const reopening = nextStatus !== currentStatus
  const now = new Date().toISOString()

  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    last_message_at: now,
    updated_at: now,
  }
  if (reopening) {
    updatePayload.resolved_at = null
    updatePayload.closed_at = null
  }
  if (!currentSubject) {
    updatePayload.subject = deriveSubject(content)
  }

  // Guarded on the status just read above (FR-067): if an admin takes the
  // conversation over between that read and this write (their reply sets
  // `admin_active`), the `.eq('status', currentStatus)` clause no longer
  // matches and this update is skipped entirely instead of silently
  // overwriting the takeover with `currentStatus`'s own value. `.select`
  // reports back whatever ended up actually stored, so the caller decides
  // from truth rather than the value read at the top of this function.
  const { data: updatedRows, error: updateError } = await client
    .from('support_conversations')
    .update(updatePayload)
    .eq('id', conversationId)
    .eq('status', currentStatus)
    .select('status')
  if (updateError) throw updateError

  let finalStatus: ConversationStatus
  if (updatedRows && updatedRows.length > 0) {
    finalStatus = (updatedRows[0] as { status: ConversationStatus }).status
    if (reopening) {
      await recordEvent(conversationId, 'conversation_reopened', userId, {
        fromStatus: currentStatus,
        toStatus: nextStatus,
      })
    }
  } else {
    // Someone else changed the status concurrently and won the race — read
    // back what is actually stored now instead of trusting `currentStatus`.
    const { data: freshRow, error: freshError } = await client
      .from('support_conversations')
      .select('status')
      .eq('id', conversationId)
      .maybeSingle()
    if (freshError) throw freshError
    finalStatus = freshRow ? (freshRow as { status: ConversationStatus }).status : currentStatus
  }

  return { message: toUserMessage(inserted as SupportMessageRow), duplicate: false, status: finalStatus }
}

/**
 * Writes the AI's answer (FR-020 ANSWER path) and the `ai_answered` event.
 * `model` is the id the provider actually served (servedModel()'s result),
 * stored in metadata alongside the confidence — never the prompt or answer
 * text, which already lives in `content` and nowhere else (C4).
 *
 * Returns `false`, having written nothing, when a human now owns the
 * conversation (`admin_active` or `waiting_admin`). That is FR-067, and it needs enforcing HERE rather than at the
 * call site: the send route checks the status before the provider call, and
 * the provider call then takes up to TRIAGE_BUDGET_MS. An admin who replies
 * inside that window owns the conversation (adminAppendMessage sets
 * `admin_active`), and an unguarded write posted a robot answer underneath a
 * human's — the exact thing FR-067 forbids, from a check that was simply
 * twenty seconds stale.
 *
 * The conversation UPDATE runs first and carries the guard, so a lost race
 * costs nothing: the message insert never happens, rather than happening and
 * then needing to be undone.
 */
export async function appendAiMessage(
  conversationId: string,
  decision: TriageDecision,
  model: string,
): Promise<boolean> {
  if (!decision.answer || decision.answer.trim() === '') {
    throw new Error('appendAiMessage requires an ANSWER decision with a non-empty answer')
  }
  const client = getServiceSupabaseClient()
  const now = new Date().toISOString()

  const { data: claimedRows, error: updateError } = await client
    .from('support_conversations')
    .update({ last_message_at: now, updated_at: now })
    .eq('id', conversationId)
    // "Not owned by a human", not "is ai_active": FR-067 is about not taking a
    // conversation away from a person, and nothing more. Narrowing the guard to
    // `ai_active` would also change how resolved/closed threads behave on the
    // recovery paths, which is a different question and not this one.
    .neq('status', 'admin_active')
    .neq('status', 'waiting_admin')
    .select('id')
  if (updateError) throw updateError
  if (!claimedRows || claimedRows.length === 0) return false

  const { error: insertError } = await client.from('support_messages').insert({
    conversation_id: conversationId,
    sender_type: 'ai',
    sender_id: null,
    // Defensive clamp: the 4000-char CHECK constraint must never turn a
    // valid-but-long completion into a thrown DB error on this path.
    content: decision.answer.slice(0, 4000),
    metadata: { ai_confidence: decision.confidence, ai_model: model },
  })
  if (insertError) throw insertError

  await recordEvent(conversationId, 'ai_answered', null, { confidence: decision.confidence })
  return true
}

/**
 * What the model said about its own decision, for the human who picks the
 * conversation up. Every field is optional because most escalation paths have
 * no model reply behind them: a forced category never called the provider, and
 * a provider failure never got an answer out of it.
 */
export interface EscalationNote {
  /** FR-020's `reason` — the model's internal note. Never shown to the user. */
  reason: string | null
  confidence: number | null
  model: string | null
}

/**
 * Files the escalation as a `system` message: an internal note, admin-only by
 * both RLS (`sender_type <> 'system'` in the user policy) and every user-facing
 * mapper (FR-011).
 *
 * This exists because the handover was previously empty. A human opened an
 * escalated thread knowing only that it had been escalated — the model's
 * `reason` was parsed and then discarded, and `metadata.escalation_reason`,
 * which FR-013 and FR-092 both name, was written by nothing at all.
 *
 * The reason lands in two places on purpose, and they answer different
 * requirements: `content` is what the admin thread renders (the internal-note
 * card reads `content` and nothing else), while `metadata.escalation_reason` is
 * the structured field FR-013 requires to exist and FR-092 requires to live
 * here rather than in `ai_usage_log`. Both are behind the same admin-only
 * grant, so storing it twice widens nothing.
 *
 * A failure here is swallowed. The escalation itself has already committed and
 * the user is owed a human either way; losing the note degrades the handover,
 * but throwing would turn a served request into a 500.
 */
async function writeEscalationNote(
  client: SupabaseClient,
  conversationId: string,
  category: EscalationCategory,
  note: EscalationNote | undefined,
): Promise<void> {
  // Internal operational text, read only by admins in the inbox — English per
  // CLAUDE.md §6, unlike the user-facing copy which is translated.
  const header =
    note?.confidence != null
      ? `Escalated automatically — ${category} (confidence ${note.confidence.toFixed(2)})`
      : `Escalated automatically — ${category}`
  const reason = note?.reason?.trim() ? note.reason.trim() : null
  const content = (reason ? `${header}\n${reason}` : header).slice(0, 4000)

  const metadata: Record<string, unknown> = {}
  if (reason) metadata.escalation_reason = reason
  if (note?.confidence != null) metadata.ai_confidence = note.confidence
  if (note?.model) metadata.ai_model = note.model

  const { error } = await client.from('support_messages').insert({
    conversation_id: conversationId,
    sender_type: 'system',
    sender_id: null,
    content,
    metadata,
  })
  if (error) console.error('[support] escalation note not written:', error.message)
}

/**
 * Moves a conversation to `waiting_admin` (FR-041, FR-040, FR-023) and
 * records `ai_escalated` with the category and priority — structural only,
 * never the message that triggered it (C4).
 *
 * Returns `false`, having changed nothing, when a human now owns the
 * conversation. The send route does check before calling, but that check is up
 * to TRIAGE_BUDGET_MS old by the time a decision comes back, so the guard has
 * to be on the write — see the comment on the UPDATE below and FR-067.
 */
export async function escalate(
  conversationId: string,
  category: EscalationCategory,
  priority: Priority,
  note?: EscalationNote,
): Promise<boolean> {
  const client = getServiceSupabaseClient()

  const { data: convRow, error: convError } = await client
    .from('support_conversations')
    .select('status, priority')
    .eq('id', conversationId)
    .maybeSingle()
  if (convError) throw convError
  if (!convRow) throw new SupportNotFoundError('conversation not found')

  const existing = convRow as { status: ConversationStatus; priority: Priority }
  const fromStatus = existing.status
  const now = new Date().toISOString()

  // Priority only ever RISES here. `urgent` is admin-only (FR-024), so
  // writing this escalation's computed priority unconditionally would let an
  // automated escalation quietly demote a conversation a human had marked
  // urgent — the one signal on this surface that a person set deliberately.
  // priorityRank orders urgent=0 .. low=3, so the LOWER rank wins.
  const effectivePriority =
    priorityRank(existing.priority) < priorityRank(priority) ? existing.priority : priority

  // Guarded exactly like appendAiMessage, and for the same race: an admin who
  // replies while the provider call is in flight has taken the conversation
  // over, and flipping them back to `waiting_admin` would unassign live work
  // and re-page the team about a thread someone is already answering.
  //
  // `last_message_at` is deliberately NOT touched. No message the user can see
  // is added here, and that column drives the user's unread badge, the inbox
  // ordering and the auto-resolve clock — moving it for a status change makes
  // all three report an event that never happened.
  const { data: escalatedRows, error: updateError } = await client
    .from('support_conversations')
    .update({ status: 'waiting_admin', priority: effectivePriority, updated_at: now })
    .eq('id', conversationId)
    .neq('status', 'admin_active')
    .neq('status', 'waiting_admin')
    .select('id')
  if (updateError) throw updateError
  if (!escalatedRows || escalatedRows.length === 0) return false

  await writeEscalationNote(client, conversationId, category, note)

  await recordEvent(conversationId, 'ai_escalated', null, {
    category,
    priority: effectivePriority,
    fromStatus,
  })
  return true
}

/**
 * The category of this conversation's most recent escalation, or `null` when it
 * has never been escalated (or the event predates the category being recorded).
 *
 * Read from the event log rather than a column on the conversation, because the
 * event log already records it and a column would need a migration for one
 * decision made on one branch. Called only when a hand-back is actually being
 * considered — a `waiting_admin` thread that has already been quiet for an hour
 * — never on the thread poll and never on the ordinary send path.
 */
export async function lastEscalationCategory(conversationId: string): Promise<EscalationCategory | null> {
  const client = getServiceSupabaseClient()
  const { data, error } = await client
    .from('support_conversation_events')
    .select('metadata')
    .eq('conversation_id', conversationId)
    .eq('event_type', 'ai_escalated')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  const category = (data as { metadata?: { category?: unknown } } | null)?.metadata?.category
  return typeof category === 'string' ? (category as EscalationCategory) : null
}

/**
 * Hands an unanswered escalation back to the assistant (FR-067b). Returns
 * `false`, having changed nothing, if the conversation is no longer
 * `waiting_admin` — an admin who replied in the meantime owns it, and this must
 * not take it from them any more than the AI's own writes may.
 *
 * `last_message_at` is not touched: no message is added, and that column is the
 * inbox's ordering and the idle clock.
 */
export async function returnToAi(conversationId: string): Promise<boolean> {
  const client = getServiceSupabaseClient()
  const now = new Date().toISOString()

  const { data: rows, error } = await client
    .from('support_conversations')
    .update({ status: 'ai_active', updated_at: now })
    .eq('id', conversationId)
    .eq('status', 'waiting_admin')
    .select('id')
  if (error) throw error
  if (!rows || rows.length === 0) return false

  await recordEvent(conversationId, 'status_changed', null, {
    fromStatus: 'waiting_admin',
    toStatus: 'ai_active',
    reason: 'unanswered_escalation_returned_to_ai',
  })
  return true
}

/** FR-100: rows with `sender_type = 'user'` for this sender since `sinceIso`. */
export async function countRecentUserMessages(userId: string, sinceIso: string): Promise<number> {
  const client = getServiceSupabaseClient()
  const { count, error } = await client
    .from('support_messages')
    .select('id', { count: 'exact', head: true })
    .eq('sender_id', userId)
    .eq('sender_type', 'user')
    .gte('created_at', sinceIso)
  if (error) throw error
  return count ?? 0
}

/** FR-100: conversations this user created since `sinceIso`. */
export async function countRecentConversations(userId: string, sinceIso: string): Promise<number> {
  const client = getServiceSupabaseClient()
  const { count, error } = await client
    .from('support_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', sinceIso)
  if (error) throw error
  return count ?? 0
}

// ─── Admin reads/writes ───────────────────────────────────────────────────
//
// Admin functions trust the route's role check (SR-002 is enforced there,
// same as sql/31's own RLS design: "admin reads all") rather than repeating
// a per-row ownership check that has no meaning for an admin. Where a call
// grants a PRIVILEGE (assigning an admin), the function still validates it
// itself (SR-004) — see adminPatchConversation.

/** Full thread for an admin, including internal notes and metadata.
 *  `null` when the conversation does not exist. Marks `admin_last_read_at`
 *  as a side effect, best-effort (see getUserThread's read mark). */
export async function adminGetThread(
  conversationId: string,
): Promise<{ conversation: Conversation; messages: AdminMessage[] } | null> {
  const client = getServiceSupabaseClient()

  const { data: convRow, error: convError } = await client
    .from('support_conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('id', conversationId)
    .maybeSingle()
  if (convError) throw convError
  if (!convRow) return null

  const { data: msgRows, error: msgError } = await client
    .from('support_messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (msgError) throw msgError

  const { error: readMarkError } = await client
    .from('support_conversations')
    .update({ admin_last_read_at: new Date().toISOString() })
    .eq('id', conversationId)
  if (readMarkError) {
    console.error('[support] failed to mark conversation read (admin):', readMarkError.message)
  }

  return {
    conversation: mapConversationForRead(convRow as ConversationRow, new Date()),
    messages: ((msgRows as SupportMessageRow[] | null) ?? []).map(toAdminMessage),
  }
}

/**
 * Admin reply (`kind: 'reply'`, sender_type `admin`) or internal note
 * (`kind: 'note'`, sender_type `system` — invisible to the user, FR-011).
 * A reply sets status to `admin_active` and stamps `assigned_admin_id` to
 * the replying admin only if it was unset (FR-066); a note changes neither.
 */
export async function adminAppendMessage(
  adminId: string,
  conversationId: string,
  content: string,
  kind: 'reply' | 'note',
): Promise<AdminMessage> {
  const client = getServiceSupabaseClient()

  const { data: convRow, error: convError } = await client
    .from('support_conversations')
    .select('status, assigned_admin_id')
    .eq('id', conversationId)
    .maybeSingle()
  if (convError) throw convError
  if (!convRow) throw new SupportNotFoundError('conversation not found')

  const current = convRow as { status: ConversationStatus; assigned_admin_id: string | null }
  const senderType: SenderType = kind === 'reply' ? 'admin' : 'system'

  const { data: inserted, error: insertError } = await client
    .from('support_messages')
    .insert({
      conversation_id: conversationId,
      sender_type: senderType,
      sender_id: adminId,
      content,
    })
    .select(MESSAGE_COLUMNS)
    .single()
  if (insertError) throw insertError

  const now = new Date().toISOString()
  const updatePayload: Record<string, unknown> = { updated_at: now }
  const autoAssigned = kind === 'reply' && !current.assigned_admin_id

  if (kind === 'reply') {
    // Deliberately NOT routed through canTransition. FR-066 states an admin
    // reply sets `admin_active` unconditionally, but FR-003's table only
    // models `waiting_admin -> admin_active`; replying to an `ai_active` or
    // `resolved` thread is a legal thing an admin does that the table does
    // not name. The table governs the PATCH surface, where an admin picks a
    // status directly; here the status is a consequence of the reply, not a
    // choice, so the reply is what is being authorised.
    updatePayload.status = 'admin_active'
    updatePayload.last_message_at = now
    // A reply to a resolved/closed thread revives it, so the timestamps that
    // marked it finished have to go with it. Leaving resolved_at set would
    // keep the conversation in the median-resolution-time sample with a
    // resolution instant that is now in the past of live work, and would let
    // applyLazyResolution re-close a thread an admin is actively answering.
    updatePayload.resolved_at = null
    updatePayload.closed_at = null
    if (autoAssigned) updatePayload.assigned_admin_id = adminId
  }

  const { error: updateError } = await client
    .from('support_conversations')
    .update(updatePayload)
    .eq('id', conversationId)
  if (updateError) throw updateError

  if (kind === 'reply') {
    await recordEvent(conversationId, 'admin_replied', adminId, {
      fromStatus: current.status,
      toStatus: 'admin_active',
      autoAssigned,
    })
  } else {
    await recordEvent(conversationId, 'internal_note_added', adminId, {})
  }

  return toAdminMessage(inserted as SupportMessageRow)
}

export interface AdminConversationPatch {
  status?: ConversationStatus
  priority?: Priority
  /** `null` unassigns. Omit the key entirely to leave assignment unchanged. */
  assignedAdminId?: string | null
}

/**
 * Applies any combination of status/priority/assignment changes in one
 * update (FR-065). Each changed aspect writes its own event, using the
 * specific FR-090 event type where one exists (`conversation_resolved`,
 * `conversation_closed`, `conversation_reopened`) and falling back to the
 * generic `status_changed` only for a transition none of those name (an
 * admin handing a conversation back to AI from `admin_active`).
 *
 * A status change is validated against `canTransition` (status.ts) —
 * illegal transitions throw `SupportValidationError`, the pure rule table
 * still governing even though this call comes from a trusted admin.
 * Assigning a non-admin account throws the same way (SR-004): this is the
 * service-layer check C2 requires, independent of the UI only ever
 * offering admin accounts to pick from.
 */
export async function adminPatchConversation(
  adminId: string,
  conversationId: string,
  patch: AdminConversationPatch,
): Promise<Conversation> {
  const client = getServiceSupabaseClient()

  const { data: convRow, error: convError } = await client
    .from('support_conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('id', conversationId)
    .maybeSingle()
  if (convError) throw convError
  if (!convRow) throw new SupportNotFoundError('conversation not found')

  const current = convRow as ConversationRow
  const now = new Date().toISOString()
  const updatePayload: Record<string, unknown> = { updated_at: now }
  const events: { type: SupportEventType; metadata: Record<string, unknown> }[] = []

  // Validate against the status the admin was actually looking at, which is
  // the lazily-resolved one the list rendered (FR-081) — not the raw column.
  // An idle `ai_active` thread displays as "resolved"; judging their "close
  // it" against the stored `ai_active` rejects a transition that is legal
  // from everything they can see, and there is no action they could take to
  // recover, because nothing in the UI reveals the stored value.
  const currentStatus = applyLazyResolution(
    current.status,
    new Date(current.last_message_at),
    new Date(now),
    current.resolved_at ? new Date(current.resolved_at) : null,
  )

  if (patch.status !== undefined && patch.status !== currentStatus) {
    if (!canTransition(currentStatus, patch.status)) {
      throw new SupportValidationError(`illegal status transition: ${currentStatus} -> ${patch.status}`)
    }
    updatePayload.status = patch.status

    if (patch.status === 'resolved') {
      updatePayload.resolved_at = now
      updatePayload.closed_at = null
      events.push({ type: 'conversation_resolved', metadata: { fromStatus: currentStatus } })
    } else if (patch.status === 'closed') {
      updatePayload.closed_at = now
      // An auto-resolved thread never had resolved_at written, so stamp it
      // here rather than leaving the metrics sample without a resolution
      // instant for a conversation that demonstrably reached one.
      if (!current.resolved_at) updatePayload.resolved_at = now
      events.push({ type: 'conversation_closed', metadata: { fromStatus: currentStatus } })
    } else if (patch.status === 'ai_active' && (currentStatus === 'resolved' || currentStatus === 'closed')) {
      updatePayload.resolved_at = null
      updatePayload.closed_at = null
      // last_message_at moves too, or the reopen silently undoes itself: the
      // thread that was resolved is by definition idle, so applyLazyResolution
      // would re-report it as `resolved` on the very next read and the admin
      // would see their reopen fail for no visible reason. Reopening restarts
      // the idle clock — that is what reopening means.
      updatePayload.last_message_at = now
      events.push({ type: 'conversation_reopened', metadata: { fromStatus: currentStatus } })
    } else {
      events.push({ type: 'status_changed', metadata: { fromStatus: currentStatus, toStatus: patch.status } })
    }
  }

  if (patch.priority !== undefined && patch.priority !== current.priority) {
    updatePayload.priority = patch.priority
    events.push({ type: 'priority_changed', metadata: { fromPriority: current.priority, toPriority: patch.priority } })
  }

  if (patch.assignedAdminId !== undefined && patch.assignedAdminId !== current.assigned_admin_id) {
    if (patch.assignedAdminId !== null) {
      const { data: targetProfile, error: profileError } = await client
        .from('user_profiles')
        .select('role')
        .eq('id', patch.assignedAdminId)
        .maybeSingle()
      if (profileError) throw profileError
      if (targetProfile?.role !== 'admin') {
        throw new SupportValidationError('assignee must be an admin account')
      }
    }
    updatePayload.assigned_admin_id = patch.assignedAdminId
    events.push({ type: 'admin_assigned', metadata: { assignedTo: patch.assignedAdminId } })
  }

  if (Object.keys(updatePayload).length === 1) {
    // Only `updated_at` — nothing the caller asked to change actually differs.
    // Read-facing (FR-081) like every other return below: an idle `ai_active`
    // row a no-op patch touches must keep reading as "resolved", not revert
    // to the raw stored status.
    return mapConversationForRead(current, new Date(now))
  }

  const { data: updated, error: updateError } = await client
    .from('support_conversations')
    .update(updatePayload)
    .eq('id', conversationId)
    .select(CONVERSATION_COLUMNS)
    .single()
  if (updateError) throw updateError

  for (const event of events) {
    await recordEvent(conversationId, event.type, adminId, event.metadata)
  }

  // Read-facing (FR-081), same as every other function that returns a
  // Conversation to a caller: a priority-only PATCH on an idle `ai_active`
  // thread must not flip the UI from "Resolved" back to "AI active" just
  // because this function returned the raw stored column.
  return mapConversationForRead(updated as ConversationRow, new Date(now))
}

/** One row of the admin inbox list — adds the two FR-062 fields the base
 *  `Conversation` type has no room for (it is not admin-specific). */
export interface AdminConversationSummary extends Conversation {
  userEmail: string | null
  lastMessagePreview: string | null
}

export interface SupportInboxCounts {
  waitingAdmin: number
  urgent: number
  unassigned: number
}

const ADMIN_LIST_ROW_CAP = 2000
const ADMIN_LIST_PAGE_SIZE = 30

function statusRank(status: ConversationStatus): number {
  // FR-064: waiting_admin first, everything else keeps its priority/recency order.
  return status === 'waiting_admin' ? 0 : 1
}

function priorityRank(priority: Priority): number {
  return { urgent: 0, high: 1, normal: 2, low: 3 }[priority]
}

async function fetchInboxCounts(client: SupabaseClient): Promise<SupportInboxCounts> {
  const [waiting, urgent, unassigned] = await Promise.all([
    client.from('support_conversations').select('id', { count: 'exact', head: true }).eq('status', 'waiting_admin'),
    client
      .from('support_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('priority', 'urgent')
      .in('status', OPEN_STATUSES),
    client
      .from('support_conversations')
      .select('id', { count: 'exact', head: true })
      .is('assigned_admin_id', null)
      .in('status', OPEN_STATUSES),
  ])
  if (waiting.error) throw waiting.error
  if (urgent.error) throw urgent.error
  if (unassigned.error) throw unassigned.error

  return {
    waitingAdmin: waiting.count ?? 0,
    urgent: urgent.count ?? 0,
    unassigned: unassigned.count ?? 0,
  }
}

/**
 * FR-063/064: filtered, searched, sorted, paginated inbox list plus the
 * FR-068 header counts (always computed over the WHOLE inbox, independent
 * of the current filters — a filtered view must not make the header lie
 * about how much is waiting overall).
 *
 * Sorting/pagination happen in application code rather than in SQL: the
 * FR-064 order ("waiting_admin first, then priority, then recency") is not
 * a single column, and `ADMIN_LIST_ROW_CAP` bounds the in-memory sort for
 * what is expected to stay a small operational inbox.
 *
 * `adminId` is required for the `assignment: 'mine'` filter — "mine" is
 * meaningless without knowing which admin is asking, so this function takes
 * it explicitly rather than only the `InboxFilters` object.
 */
export async function adminListConversations(
  adminId: string,
  filters: InboxFilters,
): Promise<{ rows: AdminConversationSummary[]; total: number; counts: SupportInboxCounts }> {
  const client = getServiceSupabaseClient()

  let matchingIds: Set<string> | null = null
  const search = filters.search.trim()
  if (search) {
    // `%` and `_` are LIKE wildcards, so an unescaped term is a pattern, not
    // a search string: typing a single `%` matches every conversation in the
    // inbox and reads as "search is broken". Escaping `\` first matters —
    // doing it after would also escape the backslashes this adds.
    const term = search.replace(/\\/g, '\\\\').replace(/[%_]/g, (ch) => `\\${ch}`)
    const [{ data: contentMatches, error: contentError }, { data: emailMatches, error: emailError }] = await Promise.all([
      // Queried against support_conversations with an inner-joined filter,
      // not against support_messages directly: PostgREST embeds and dedupes
      // on the parent, so this returns one row per matching CONVERSATION and
      // `limit` bounds distinct conversations, not raw message rows. The
      // previous version capped `support_messages` itself with no ordering —
      // on a busy inbox an arbitrary ADMIN_LIST_ROW_CAP message rows could
      // all belong to a handful of conversations, silently dropping others
      // that matched while `total` still reported the truncated set as
      // complete. Ordered by recency so a truncation (if the cap is ever
      // actually hit) drops the least-recently-active conversations, not an
      // arbitrary slice.
      client
        .from('support_conversations')
        .select('id, support_messages!inner(id)')
        .ilike('support_messages.content', `%${term}%`)
        .order('last_message_at', { ascending: false })
        .limit(ADMIN_LIST_ROW_CAP),
      client.from('user_profiles').select('id').ilike('email', `%${term}%`).limit(ADMIN_LIST_ROW_CAP),
    ])
    if (contentError) throw contentError
    if (emailError) throw emailError

    const ids = new Set<string>(((contentMatches as { id: string }[] | null) ?? []).map((r) => r.id))
    const emailUserIds = ((emailMatches as { id: string }[] | null) ?? []).map((r) => r.id)
    if (emailUserIds.length > 0) {
      const { data: byUser, error: byUserError } = await client
        .from('support_conversations')
        .select('id')
        .in('user_id', emailUserIds)
      if (byUserError) throw byUserError
      for (const row of (byUser as { id: string }[] | null) ?? []) ids.add(row.id)
    }
    matchingIds = ids
    if (matchingIds.size === 0) {
      return { rows: [], total: 0, counts: await fetchInboxCounts(client) }
    }
  }

  // The status filter is deliberately NOT pushed into SQL. Rows are rendered
  // with their lazily-resolved status (FR-081), so filtering on the stored
  // column would return a set that disagrees with what the admin is looking
  // at: an idle `ai_active` thread reads as "resolved" in the list, yet the
  // "resolved" filter would not return it, and picking "closed" for it sends
  // an `ai_active -> closed` PATCH the state machine rejects with a 400. One
  // status, computed once, used for filtering, sorting and rendering alike.
  let query = client.from('support_conversations').select(CONVERSATION_COLUMNS).limit(ADMIN_LIST_ROW_CAP)
  if (filters.priority !== 'all') query = query.eq('priority', filters.priority)
  if (filters.assignment === 'mine') query = query.eq('assigned_admin_id', adminId)
  else if (filters.assignment === 'unassigned') query = query.is('assigned_admin_id', null)
  if (matchingIds) query = query.in('id', [...matchingIds])

  const { data, error } = await query
  if (error) throw error

  const listNow = new Date()
  const rows = ((data as ConversationRow[] | null) ?? [])
    .map((row) => ({
      ...row,
      status: applyLazyResolution(
        row.status,
        new Date(row.last_message_at),
        listNow,
        row.resolved_at ? new Date(row.resolved_at) : null,
      ),
    }))
    .filter((row) => filters.status === 'all' || row.status === filters.status)

  rows.sort((a, b) => {
    const statusDiff = statusRank(a.status) - statusRank(b.status)
    if (statusDiff !== 0) return statusDiff
    const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority)
    if (priorityDiff !== 0) return priorityDiff
    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  })

  const total = rows.length
  const pageStart = Math.max(0, (filters.page - 1) * ADMIN_LIST_PAGE_SIZE)
  const pageRows = rows.slice(pageStart, pageStart + ADMIN_LIST_PAGE_SIZE)

  const userIds = [...new Set(pageRows.map((r) => r.user_id))]
  const pageIds = pageRows.map((r) => r.id)

  const [profilesResult, previewResult] = await Promise.all([
    userIds.length > 0
      ? client.from('user_profiles').select('id, email').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; email: string | null }[], error: null }),
    // One row per conversation, each embedding at most its single most
    // recent message — a preview needs only that, not the whole thread.
    // Querying `support_messages` directly with no per-conversation limit
    // previously fetched the FULL message history for every conversation on
    // the page (or in the bell's list) just to keep the first row per group
    // in JS; this runs every 60s for every admin on the bell path.
    pageIds.length > 0
      ? client
          .from('support_conversations')
          .select('id, support_messages(content, created_at)')
          .in('id', pageIds)
          // Internal notes are excluded from the preview. Escalating now files
          // one, so without this the newest row is always that note and every
          // escalated conversation previewed as "Escalated automatically —
          // model_escalated (confidence 0.98)" instead of what the person
          // actually asked. The status chip already says it was escalated; the
          // preview's job is to show the conversation.
          .neq('support_messages.sender_type', 'system')
          .order('created_at', { referencedTable: 'support_messages', ascending: false })
          .limit(1, { referencedTable: 'support_messages' })
      : Promise.resolve({
          data: [] as { id: string; support_messages: { content: string; created_at: string }[] }[],
          error: null,
        }),
  ])
  if (profilesResult.error) throw profilesResult.error
  if (previewResult.error) throw previewResult.error

  const emailByUser = new Map(
    ((profilesResult.data as { id: string; email: string | null }[] | null) ?? []).map((p) => [p.id, p.email]),
  )
  const previewByConv = new Map<string, string>()
  for (const row of (previewResult.data as { id: string; support_messages: { content: string }[] }[] | null) ?? []) {
    const latest = row.support_messages?.[0]
    if (latest) previewByConv.set(row.id, latest.content.slice(0, 120))
  }

  const now = new Date()
  const summaries: AdminConversationSummary[] = pageRows.map((row) => ({
    ...mapConversationForRead(row, now),
    userEmail: emailByUser.get(row.user_id) ?? null,
    lastMessagePreview: previewByConv.get(row.id) ?? null,
  }))

  return { rows: summaries, total, counts: await fetchInboxCounts(client) }
}

/** One row of the admin notification bell's dropdown (spec 014 WP-6). */
export interface AdminNotification {
  id: string
  userEmail: string | null
  preview: string | null
  status: ConversationStatus
  priority: Priority
  lastMessageAt: string
}

const ADMIN_NOTIFICATIONS_CAP = 20

/**
 * Unread-for-admin conversations for the notification bell. There is no unread
 * column or migration for this — see unread.ts for the derivation rule, applied
 * in application code against `admin_last_read_at`.
 *
 * Scoped to `waiting_admin`/`admin_active` only, not every status: an `ai_active`
 * conversation nobody has opened yet is the AI doing its job, not something an
 * admin needs to act on, and it would never leave this set since a fresh
 * conversation's `admin_last_read_at` starts null. Both statuses here are also
 * exempt from lazy auto-resolution (FR-082, status.ts), so the raw DB column can
 * be filtered on directly with no need to reproduce applyLazyResolution here.
 */
export async function adminListUnreadConversations(): Promise<{ notifications: AdminNotification[]; total: number }> {
  const client = getServiceSupabaseClient()

  const { data, error } = await client
    .from('support_conversations')
    .select('id, user_id, status, priority, last_message_at, admin_last_read_at')
    .in('status', ['waiting_admin', 'admin_active'])
    .order('last_message_at', { ascending: false })
    .limit(ADMIN_LIST_ROW_CAP)
  if (error) throw error

  type Row = {
    id: string
    user_id: string
    status: ConversationStatus
    priority: Priority
    last_message_at: string
    admin_last_read_at: string | null
  }

  const unreadRows = ((data as Row[] | null) ?? []).filter((row) =>
    isUnreadForAdmin(row.last_message_at, row.admin_last_read_at),
  )
  const total = unreadRows.length
  const pageRows = unreadRows.slice(0, ADMIN_NOTIFICATIONS_CAP)

  const userIds = [...new Set(pageRows.map((r) => r.user_id))]
  const pageIds = pageRows.map((r) => r.id)

  const [profilesResult, previewResult] = await Promise.all([
    userIds.length > 0
      ? client.from('user_profiles').select('id, email').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; email: string | null }[], error: null }),
    // One row per conversation, each embedding at most its single most
    // recent message — a preview needs only that, not the whole thread.
    // Querying `support_messages` directly with no per-conversation limit
    // previously fetched the FULL message history for every conversation on
    // the page (or in the bell's list) just to keep the first row per group
    // in JS; this runs every 60s for every admin on the bell path.
    pageIds.length > 0
      ? client
          .from('support_conversations')
          .select('id, support_messages(content, created_at)')
          .in('id', pageIds)
          // Internal notes are excluded from the preview. Escalating now files
          // one, so without this the newest row is always that note and every
          // escalated conversation previewed as "Escalated automatically —
          // model_escalated (confidence 0.98)" instead of what the person
          // actually asked. The status chip already says it was escalated; the
          // preview's job is to show the conversation.
          .neq('support_messages.sender_type', 'system')
          .order('created_at', { referencedTable: 'support_messages', ascending: false })
          .limit(1, { referencedTable: 'support_messages' })
      : Promise.resolve({
          data: [] as { id: string; support_messages: { content: string; created_at: string }[] }[],
          error: null,
        }),
  ])
  if (profilesResult.error) throw profilesResult.error
  if (previewResult.error) throw previewResult.error

  const emailByUser = new Map(
    ((profilesResult.data as { id: string; email: string | null }[] | null) ?? []).map((p) => [p.id, p.email]),
  )
  const previewByConv = new Map<string, string>()
  for (const row of (previewResult.data as { id: string; support_messages: { content: string }[] }[] | null) ?? []) {
    const latest = row.support_messages?.[0]
    if (latest) previewByConv.set(row.id, latest.content.slice(0, 120))
  }

  const notifications: AdminNotification[] = pageRows.map((row) => ({
    id: row.id,
    userEmail: emailByUser.get(row.user_id) ?? null,
    preview: previewByConv.get(row.id) ?? null,
    status: row.status,
    priority: row.priority,
    lastMessageAt: row.last_message_at,
  }))

  return { notifications, total }
}

export interface AdminMetricsRange {
  from: Date
  to: Date
}

/**
 * FR-070/071/072 header figures. All arithmetic is `computeSupportMetrics`
 * (metrics.ts, pure, unit-tested) — this function only assembles its input
 * from two queries: conversations created in `range`, and the events that
 * mark when each first became human-touched (`ai_escalated` or
 * `admin_replied` — whichever happened first) and when an admin first
 * replied. `resolvedAt` reads straight off the conversation row
 * (`resolved_at` preferred, `closed_at` otherwise) rather than events, since
 * that is the single source of truth for a conversation's current
 * resolution and does not need reconstructing from a possibly-multi-cycle
 * event history.
 */
export async function adminMetrics(range: AdminMetricsRange): Promise<SupportMetrics> {
  const client = getServiceSupabaseClient()

  const { data: convRows, error: convError } = await client
    .from('support_conversations')
    .select('id, status, priority, created_at, last_message_at, resolved_at, closed_at')
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())
  if (convError) throw convError

  const conversations =
    (convRows as {
      id: string
      status: ConversationStatus
      priority: Priority
      created_at: string
      last_message_at: string
      resolved_at: string | null
      closed_at: string | null
    }[] | null) ?? []
  const ids = conversations.map((c) => c.id)

  const firstHumanEnteredAt = new Map<string, Date>()
  const firstAdminReplyAt = new Map<string, Date>()

  if (ids.length > 0) {
    const { data: eventRows, error: eventError } = await client
      .from('support_conversation_events')
      .select('conversation_id, event_type, created_at')
      .in('conversation_id', ids)
      .in('event_type', ['ai_escalated', 'admin_replied'])
      .order('created_at', { ascending: true })
    if (eventError) throw eventError

    for (const row of (eventRows as { conversation_id: string; event_type: string; created_at: string }[] | null) ?? []) {
      const createdAt = new Date(row.created_at)
      if (!firstHumanEnteredAt.has(row.conversation_id)) {
        firstHumanEnteredAt.set(row.conversation_id, createdAt)
      }
      if (row.event_type === 'admin_replied' && !firstAdminReplyAt.has(row.conversation_id)) {
        firstAdminReplyAt.set(row.conversation_id, createdAt)
      }
    }
  }

  // Metrics must see the SAME status the inbox list shows. The list renders
  // through mapConversationForRead, which applies lazy auto-resolution
  // (FR-081); reading the raw column here would make the header report a
  // thread as open while the row beside it reads "resolved", and drive
  // aiResolved to 0 for a feature whose headline number is AI resolution
  // rate (FR-072).
  const now = new Date()
  const inputs: SupportMetricsConversationInput[] = conversations.map((c) => {
    const lastMessageAt = new Date(c.last_message_at)
    const storedResolvedAt = c.resolved_at ? new Date(c.resolved_at) : c.closed_at ? new Date(c.closed_at) : null
    const effectiveStatus = applyLazyResolution(c.status, lastMessageAt, now, storedResolvedAt)
    // The STORED column, not the effective one: this is the whole point of the
    // distinction. A row reading `resolved` because it went quiet has
    // `c.status === 'ai_active'` and was ended by nobody (FR-072a).
    const endedExplicitly = c.status === 'resolved' || c.status === 'closed'

    // A thread that only became resolved by going idle has no resolved_at to
    // read, but it does have a knowable resolution instant: the moment the
    // idle window elapsed. Leaving it null would silently drop the row from
    // the median-resolution-time sample.
    const resolvedAt =
      storedResolvedAt ??
      (effectiveStatus === 'resolved' || effectiveStatus === 'closed'
        ? new Date(lastMessageAt.getTime() + SUPPORT_AUTO_RESOLVE_HOURS * 60 * 60 * 1000)
        : null)

    return {
      id: c.id,
      status: effectiveStatus,
      priority: c.priority,
      createdAt: new Date(c.created_at),
      firstHumanEnteredAt: firstHumanEnteredAt.get(c.id) ?? null,
      firstAdminReplyAt: firstAdminReplyAt.get(c.id) ?? null,
      resolvedAt,
      endedExplicitly,
    }
  })

  return computeSupportMetrics(inputs)
}
