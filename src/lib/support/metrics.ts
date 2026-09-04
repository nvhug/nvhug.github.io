// FR-070/071/072 inbox header metrics. Pure only — a plain in-memory array in,
// a plain object out. No I/O; no Date.now() read internally.

import type { ConversationStatus, Priority, SupportMetrics } from '@/lib/support/types'

const OPEN_STATUSES: ReadonlySet<ConversationStatus> = new Set(['ai_active', 'waiting_admin', 'admin_active'])
const TERMINAL_STATUSES: ReadonlySet<ConversationStatus> = new Set(['resolved', 'closed'])

/**
 * One conversation's contribution to the metrics, derived from
 * `support_conversations` plus its `support_conversation_events` (service.ts
 * assembles this; this module only consumes it). All timestamps are `Date`
 * so the caller controls "now" and no clock is read in here.
 */
export interface SupportMetricsConversationInput {
  id: string
  status: ConversationStatus
  priority: Priority
  createdAt: Date
  /**
   * When this conversation first entered `waiting_admin` or `admin_active`
   * (i.e. was escalated to a human), or `null` if it never has been. This is
   * the FR-072 discriminator between an AI-only and a human-touched
   * conversation, independent of its *current* status.
   */
  firstHumanEnteredAt: Date | null
  /**
   * When the first admin reply was sent, or `null` if none has been. Used
   * for `medianFirstResponseMs`. (An AI answer does not count as the "first
   * response" this metric tracks — it is specifically the human response
   * time an admin is measured against.)
   */
  firstAdminReplyAt: Date | null
  /**
   * When this conversation reached a terminal status (`resolved` or
   * `closed`), or `null` if it hasn't. Used for `medianResolutionMs` and to
   * decide whether it counts toward `aiResolved`/`humanResolved`.
   */
  resolvedAt: Date | null
  /**
   * Whether this conversation was ended by an actual write — a `resolved`/
   * `closed` value really stored on the row — as opposed to only *reading* as
   * terminal because `applyLazyResolution` found it idle (FR-081).
   *
   * This is the difference between "someone decided this was finished" and
   * "nobody came back". Without it, a conversation where the assistant answered
   * badly and the user gave up counted as an AI resolution 24 hours later.
   */
  endedExplicitly: boolean
}

/** Exported for direct unit-testing of the empty/odd/even cases. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * FR-070/072. `resolved`/`closed` are both treated as "resolved" for the
 * purposes of `aiResolved`/`humanResolved`/`aiResolutionRate`: a conversation
 * an admin closes directly out of `admin_active` (a legal FR-003 transition
 * that never passes through `resolved`) is still a finished, human-touched
 * conversation and must count toward `humanResolved`, not be excluded. This
 * is the reading used throughout this module — see `TERMINAL_STATUSES`.
 *
 * `urgent` counts only conversations that are both `priority === 'urgent'`
 * and still open — a resolved/closed urgent conversation no longer needs the
 * header's attention.
 *
 * FR-072a: `aiResolutionRate` is measured over conversations somebody actually
 * finished (`aiResolved + humanResolved`). `abandoned` is reported beside them
 * and deliberately excluded from both halves of the ratio — including it in the
 * denominator would make the AI's rate fall every time a user simply had their
 * answer and left, which is not a failure either. The honest reading is that an
 * abandoned conversation tells you nothing about who resolved what, and the
 * number is shown so it cannot be mistaken for either.
 */
export function computeSupportMetrics(conversations: SupportMetricsConversationInput[]): SupportMetrics {
  const totalConversations = conversations.length

  let open = 0
  let waiting = 0
  let urgent = 0
  let aiResolved = 0
  let humanResolved = 0
  let abandoned = 0
  let escalated = 0

  const firstResponseDurations: number[] = []
  const resolutionDurations: number[] = []

  for (const conversation of conversations) {
    const isOpen = OPEN_STATUSES.has(conversation.status)
    if (isOpen) open += 1
    if (conversation.status === 'waiting_admin') waiting += 1
    if (isOpen && conversation.priority === 'urgent') urgent += 1
    if (conversation.firstHumanEnteredAt !== null) escalated += 1

    if (TERMINAL_STATUSES.has(conversation.status)) {
      // Three outcomes, not two. A conversation that is terminal only because it
      // went quiet was resolved by nobody: it is abandoned, whichever side had
      // it last. Crediting the AI for it made the headline number go up as the
      // answers got worse, since a useless answer is the one most likely to be
      // met with silence.
      if (!conversation.endedExplicitly) {
        abandoned += 1
      } else if (conversation.firstHumanEnteredAt === null) {
        aiResolved += 1
      } else {
        humanResolved += 1
      }
    }

    if (conversation.firstAdminReplyAt !== null) {
      firstResponseDurations.push(conversation.firstAdminReplyAt.getTime() - conversation.createdAt.getTime())
    }

    if (conversation.resolvedAt !== null) {
      resolutionDurations.push(conversation.resolvedAt.getTime() - conversation.createdAt.getTime())
    }
  }

  const resolvedTotal = aiResolved + humanResolved

  return {
    totalConversations,
    open,
    waiting,
    abandoned,
    urgent,
    aiResolved,
    humanResolved,
    escalationRate: totalConversations === 0 ? null : escalated / totalConversations,
    aiResolutionRate: resolvedTotal === 0 ? null : aiResolved / resolvedTotal,
    medianFirstResponseMs: median(firstResponseDurations),
    medianResolutionMs: median(resolutionDurations),
  }
}
