// Shared types for the "Chat with Us" feature (spec 014). Written first — every
// other module under src/lib/support/ imports from here. This file owns shapes
// only: no logic, no imports from sibling support modules, no Supabase client.
//
// Two type families live here:
//   1. The plan §4 contract, transcribed verbatim (ConversationStatus ... AdminMessage).
//   2. Types the rest of the feature needs that the plan describes but does not
//      spell out in TS: Conversation (mirrors sql/31's support_conversations),
//      SupportMetrics (the FR-070 figures), InboxFilters (FR-063).

export type ConversationStatus = 'ai_active' | 'waiting_admin' | 'admin_active' | 'resolved' | 'closed'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type SenderType = 'user' | 'ai' | 'admin' | 'system'
export type SupportLang = 'vi' | 'en'

/** What the model is asked to return. Never trusted as-is — see decideTriage in triage.ts. */
export interface TriageResponse {
  action: 'ANSWER' | 'ESCALATE'
  confidence: number
  reason: string | null
  answer: string | null
  priority?: Priority
}

/** Why the backend escalated, independent of the model. null = model/threshold decided. */
export type EscalationCategory =
  | 'payment'
  | 'account'
  | 'security'
  | 'data_loss'
  | 'human_requested'
  | 'low_confidence'
  | 'unparseable'
  | 'provider_failure'
  | 'quota_exhausted'
  /** The model itself asked for a human, on a message no keyword rule caught.
   *  Distinct from `low_confidence`: the model can be perfectly confident that
   *  a request needs a person. */
  | 'model_escalated'

export interface TriageDecision {
  action: 'ANSWER' | 'ESCALATE'
  answer: string | null
  priority: Priority
  /** Internal only — never serialised to a user payload. */
  category: EscalationCategory | null
  confidence: number
  /**
   * The model's own internal note on why it decided as it did (FR-020's
   * `reason`). Internal only, exactly like `category`: FR-013/FR-092 place it
   * in `support_messages.metadata`, which admins read and every user payload
   * strips. `null` whenever no model reply produced one — a forced escalation
   * (the category IS the reason), a provider failure, or an exhausted fuse.
   *
   * This was parsed and then dropped on the floor until 2026-09-04, which left
   * a human picking up an escalated thread with no idea what the assistant had
   * concluded — the one piece of handover a hybrid system exists to pass along.
   */
  reason: string | null
}

/**
 * Shape returned to the USER. Note the absence of `metadata` — that absence is
 * the contract (FR-013/FR-025): ai_confidence, escalation_reason and ai_model
 * must never reach a user-facing payload, so the user-facing type has no field
 * to accidentally populate. `senderType` also excludes `system` — an internal
 * note is never returned by any user-facing endpoint (FR-011).
 */
export interface UserMessage {
  id: string
  senderType: Exclude<SenderType, 'system'>
  content: string
  clientMessageId: string | null
  createdAt: string
}

/** Shape returned to an ADMIN. Adds what the user must never see. */
export interface AdminMessage extends Omit<UserMessage, 'senderType'> {
  senderType: SenderType
  senderId: string | null
  metadata: { aiConfidence?: number; escalationReason?: string; aiModel?: string }
}

/**
 * One support conversation. Mirrors `support_conversations` in sql/31.support_chat.sql
 * column-for-column, camelCased. `assignedAdminId: null` renders as Unassigned
 * (FR-008); `userLastReadAt`/`adminLastReadAt` drive the unread badges on both
 * sides (FR-055, FR-062); `resolvedAt`/`closedAt` are cleared on reopen (FR-006).
 */
export interface Conversation {
  id: string
  userId: string
  status: ConversationStatus
  priority: Priority
  assignedAdminId: string | null
  subject: string | null
  createdAt: string
  updatedAt: string
  lastMessageAt: string
  userLastReadAt: string | null
  adminLastReadAt: string | null
  resolvedAt: string | null
  closedAt: string | null
}

/**
 * The FR-070 inbox header figures. Every rate/median field is `number | null` —
 * `null` for a zero-denominator case (e.g. no resolved conversations yet), never
 * `NaN`. Renders as an em dash at that point (FR-072). Counts are always plain
 * numbers, since a count naturally starts at 0 and has no undefined case.
 */
export interface SupportMetrics {
  totalConversations: number
  open: number
  waiting: number
  /**
   * Conversations that reached a terminal status only by going quiet — nobody
   * ever wrote `resolved` or `closed` for them (FR-072a). Counted separately
   * from `aiResolved` because an unanswered question the user walked away from
   * is not a success, and folding it into the AI's number rewarded exactly the
   * answers that drove people off.
   */
  abandoned: number
  urgent: number
  aiResolved: number
  humanResolved: number
  /** escalated / total, over the same range. */
  escalationRate: number | null
  /** FR-072: resolved-without-ever-entering waiting_admin/admin_active / all resolved. */
  aiResolutionRate: number | null
  medianFirstResponseMs: number | null
  medianResolutionMs: number | null
}

/** FR-063 admin inbox filter/search/pagination state. */
export interface InboxFilters {
  status: ConversationStatus | 'all'
  priority: Priority | 'all'
  /** "mine" = assigned to the calling admin; "unassigned" = assigned_admin_id IS NULL. */
  assignment: 'mine' | 'unassigned' | 'all'
  /** Free-text, matched against message content and user email. */
  search: string
  /** 1-based page number, 30 rows/page (matches the UsageLog.tsx pattern). */
  page: number
}

/**
 * The body of POST /api/support/conversations/[id]/messages.
 *
 * Declared here, and imported by BOTH the route that produces it and the
 * hook that consumes it, because this seam has already broken once: the
 * route returned {message, duplicate, escalated} while the hook
 * destructured {conversation, messages}, and every send in the product
 * failed. Neither tsc nor the test suite caught it, because `res.json()` is
 * typed `any` and nothing tied the two ends together.
 *
 * Annotate the route's response with this type and parse the hook's
 * `res.json()` as it. Then a field renamed on one side stops compiling on
 * the other, which is the only check that would have caught the original
 * bug.
 *
 * `message` is null only on the post-acceptance recovery path, where the
 * write may not have completed but the thread is still readable.
 */
export interface SendMessageResponse {
  message: UserMessage | null
  duplicate: boolean
  escalated: boolean
  conversation: Conversation
  messages: UserMessage[]
}

/** The body of GET /api/support/conversations/[id]. */
export interface ThreadResponse {
  conversation: Conversation
  messages: UserMessage[]
}

/** The body of GET /api/support/conversations. */
export interface ConversationListResponse {
  conversations: Conversation[]
}
