// Conversation status machine for "Chat with Us" (spec 014, FR-001..FR-006, FR-080..082).
// Pure only — no Supabase, no fetch, no internal Date.now() read (`now` is always a parameter).

import type { ConversationStatus } from '@/lib/support/types'

/** FR-080: auto-resolution windows, in one place. */
export const SUPPORT_AUTO_RESOLVE_HOURS = 24
export const SUPPORT_AUTO_CLOSE_DAYS = 7

/**
 * How long an escalation may sit unanswered before the assistant is allowed to
 * take the conversation back (FR-067b).
 *
 * Not an auto-resolution and not a contradiction of FR-082: nothing is marked
 * finished and the conversation stays open. It exists because the three rules
 * that were each right on their own combined into a trap — `waiting_admin`
 * never auto-resolves, a `waiting_admin` thread still counts as the user's one
 * open conversation, and a human-owned thread blocks the AI. A user whose
 * escalation went unanswered therefore had no route to the assistant at all,
 * in that thread or any new one, until a person replied.
 */
export const SUPPORT_AI_RETURN_HOURS = 1

const RESOLVE_WINDOW_MS = SUPPORT_AUTO_RESOLVE_HOURS * 60 * 60 * 1000
export const AI_RETURN_WINDOW_MS = SUPPORT_AI_RETURN_HOURS * 60 * 60 * 1000
const CLOSE_WINDOW_MS = SUPPORT_AUTO_CLOSE_DAYS * 24 * 60 * 60 * 1000

/**
 * The legal `(from, to)` pairs from spec FR-003, transcribed verbatim. Anything
 * not listed here — including every `from === to` pair — is illegal. There is
 * no "stay the same" transition in this table; staying in place is simply not
 * calling `canTransition` at all.
 */
export const ALLOWED_TRANSITIONS: ReadonlyArray<readonly [ConversationStatus, ConversationStatus]> = [
  ['ai_active', 'waiting_admin'],
  ['ai_active', 'resolved'],
  ['waiting_admin', 'admin_active'],
  ['waiting_admin', 'resolved'],
  ['waiting_admin', 'closed'],
  ['admin_active', 'ai_active'],
  ['admin_active', 'resolved'],
  ['admin_active', 'closed'],
  ['resolved', 'ai_active'],
  ['resolved', 'closed'],
  ['closed', 'ai_active'],
]

export function canTransition(from: ConversationStatus, to: ConversationStatus): boolean {
  return ALLOWED_TRANSITIONS.some(([f, t]) => f === from && t === to)
}

/**
 * FR-006 reopen + FR-067 human-priority guard. The only status change a user
 * message can ever trigger:
 *  - `resolved` / `closed` reopen to `ai_active`.
 *  - `ai_active` stays `ai_active` (message is triaged normally).
 *  - `waiting_admin` / `admin_active` are left **unchanged** — a user message
 *    must never pull a conversation away from a human (FR-067).
 */
export function nextStatusForUserMessage(current: ConversationStatus): ConversationStatus {
  if (current === 'resolved' || current === 'closed') return 'ai_active'
  return current
}

/**
 * FR-081 lazy auto-resolution, evaluated on read — never by a cron job.
 *
 * Both windows are measured from the same `lastMessageAt` timestamp:
 *  - a conversation actually stored as `ai_active` whose last message is at or
 *    past `SUPPORT_AUTO_RESOLVE_HOURS` old reads as `resolved`.
 *  - a conversation actually stored as `resolved` whose last message is at or
 *    past `SUPPORT_AUTO_CLOSE_DAYS` old reads as `closed`.
 *
 * `resolved` conversations don't get new messages, so `lastMessageAt` stays
 * fixed at the moment they stopped — reusing it as the single time reference
 * for the close window (rather than requiring a separate `resolvedAt` input)
 * still measures "how long has this sat idle since resolution."
 *
 * Boundary is **inclusive**: exactly `SUPPORT_AUTO_RESOLVE_HOURS` / exactly
 * `SUPPORT_AUTO_CLOSE_DAYS` of elapsed time already counts as past the window.
 *
 * FR-082: `waiting_admin` and `admin_active` are never auto-resolved or
 * auto-closed by this function, regardless of how old `lastMessageAt` is.
 * `closed` is terminal and never changes here either.
 */
/**
 * Whether an escalation that nobody answered may go back to the assistant.
 *
 * Pure and read-only — deliberately NOT folded into `applyLazyResolution`. That
 * function is applied on every read, including the 8s thread poll and the admin
 * inbox listing, and a status that silently flips to `ai_active` on read would
 * drop the row out of the admin's "waiting" filter while the count chip beside
 * it (which queries the stored column) still counted it. The hand-back is a
 * real, written transition made once, on the send path, by `returnToAi`.
 */
export function canReturnToAi(
  status: ConversationStatus,
  lastMessageAt: Date,
  now: Date,
  humanRequired: boolean,
): boolean {
  // `admin_active` is excluded on purpose: a person has actually replied there.
  // Only an escalation nobody picked up is eligible.
  if (status !== 'waiting_admin') return false
  if (humanRequired) return false
  return now.getTime() - lastMessageAt.getTime() >= AI_RETURN_WINDOW_MS
}

export function applyLazyResolution(
  status: ConversationStatus,
  lastMessageAt: Date,
  now: Date,
  resolvedAt: Date | null = null
): ConversationStatus {
  if (status === 'waiting_admin' || status === 'admin_active' || status === 'closed') {
    return status
  }

  if (status === 'ai_active') {
    const idleMs = now.getTime() - lastMessageAt.getTime()
    if (idleMs < RESOLVE_WINDOW_MS) return 'ai_active'
    // Cascade, not a single step. Lazy resolution is never written back, so
    // an auto-resolved thread's stored status stays `ai_active` forever; a
    // one-step function would answer `resolved` for it in perpetuity and the
    // close window would be unreachable code. Such a thread resolves at
    // lastMessageAt + RESOLVE, so it closes RESOLVE + CLOSE after that same
    // instant.
    return idleMs >= RESOLVE_WINDOW_MS + CLOSE_WINDOW_MS ? 'closed' : 'resolved'
  }

  // status === 'resolved'. The close window runs from `resolved_at`, NOT from
  // `last_message_at`. They coincide for an auto-resolved conversation, but not
  // for one an admin resolves by hand: an admin tidying up a thread that went
  // quiet ten days ago would otherwise see it read back as `closed` the instant
  // they resolved it, because the last message is already past the close window.
  // Falling back to `lastMessageAt` when `resolved_at` is missing keeps an older
  // row (or one resolved before this column was populated) behaving as before
  // rather than never closing at all.
  const closeAnchor = resolvedAt ?? lastMessageAt
  return now.getTime() - closeAnchor.getTime() >= CLOSE_WINDOW_MS ? 'closed' : 'resolved'
}
