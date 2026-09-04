// Input validation and output shaping for support messages (spec 014,
// FR-011/012/013/015). Pure only — no Supabase, no fetch.

import type { AdminMessage, SenderType, UserMessage } from '@/lib/support/types'

/** FR-015: message content is limited to 4000 characters after trimming. */
const MAX_CONTENT_LENGTH = 4000

/**
 * FR-015. Trims leading/trailing whitespace and nothing else — no internal
 * whitespace collapsing, so line breaks and repeated spaces inside the
 * message are preserved. Returns `null` for anything that is not usable
 * content: a non-string, an empty string, a whitespace-only string, or a
 * (post-trim) string longer than 4000 characters. The length check runs
 * after trimming, so 4000 non-whitespace characters plus surrounding
 * whitespace still passes.
 */
export function normalizeContent(raw: unknown): string | null {
  if (typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (trimmed === '') return null
  if (trimmed.length > MAX_CONTENT_LENGTH) return null

  return trimmed
}

/**
 * Raw shape of a `support_messages` row, as read from the database. Local to
 * this module — the shared `types.ts` contract intentionally only defines the
 * shapes returned to callers (`UserMessage`, `AdminMessage`), not storage rows.
 */
export interface SupportMessageRow {
  id: string
  sender_type: SenderType
  sender_id: string | null
  content: string
  client_message_id: string | null
  created_at: string
  metadata: {
    ai_confidence?: number
    escalation_reason?: string
    ai_model?: string
  } | null
}

/**
 * FR-013. Shapes a row for a user-facing payload. The result is built as a
 * fresh object literal with exactly these five keys — `metadata` and
 * `senderId` are never assigned, not even as `undefined`, so
 * `Object.keys(...)` on the result never contains them.
 *
 * Assumes `row.sender_type !== 'system'` — filtering system rows out of a
 * list is `toUserMessages`' job (FR-011), not this function's.
 */
export function toUserMessage(row: SupportMessageRow): UserMessage {
  return {
    id: row.id,
    senderType: row.sender_type as Exclude<SenderType, 'system'>,
    content: row.content,
    clientMessageId: row.client_message_id,
    createdAt: row.created_at,
  }
}

/**
 * Shapes a row for an admin-facing payload. Unlike `toUserMessage`, admins
 * see `senderId` and `metadata` (FR-013 only strips these from user payloads).
 * Each `metadata` key is included only when the row actually carries it, so a
 * row with no escalation reason doesn't grow an `escalationReason: undefined`
 * key.
 */
export function toAdminMessage(row: SupportMessageRow): AdminMessage {
  const metadata: AdminMessage['metadata'] = {}
  if (row.metadata?.ai_confidence !== undefined) metadata.aiConfidence = row.metadata.ai_confidence
  if (row.metadata?.escalation_reason !== undefined) metadata.escalationReason = row.metadata.escalation_reason
  if (row.metadata?.ai_model !== undefined) metadata.aiModel = row.metadata.ai_model

  return {
    id: row.id,
    senderType: row.sender_type,
    senderId: row.sender_id,
    content: row.content,
    clientMessageId: row.client_message_id,
    createdAt: row.created_at,
    metadata,
  }
}

/**
 * FR-011: a `system` row is an internal note, never returned by any
 * user-facing endpoint. Those rows are dropped from the result entirely —
 * not included with blanked-out content.
 */
export function toUserMessages(rows: SupportMessageRow[]): UserMessage[] {
  return rows.filter((row) => row.sender_type !== 'system').map(toUserMessage)
}
