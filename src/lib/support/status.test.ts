import { describe, expect, it } from 'vitest'
import {
  ALLOWED_TRANSITIONS,
  SUPPORT_AUTO_CLOSE_DAYS,
  SUPPORT_AUTO_RESOLVE_HOURS,
  applyLazyResolution,
  canReturnToAi,
  canTransition,
  nextStatusForUserMessage,
} from './status'
import type { ConversationStatus } from '@/lib/support/types'

const ALL_STATUSES: ConversationStatus[] = ['ai_active', 'waiting_admin', 'admin_active', 'resolved', 'closed']

const LEGAL_PAIRS = new Set(ALLOWED_TRANSITIONS.map(([from, to]) => `${from}->${to}`))

describe('canTransition — all 25 (from, to) pairs', () => {
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      const legal = LEGAL_PAIRS.has(`${from}->${to}`)
      it(`${from} -> ${to} is ${legal ? 'legal' : 'illegal'}`, () => {
        expect(canTransition(from, to)).toBe(legal)
      })
    }
  }

  it('enumerates exactly 11 legal pairs (FR-003)', () => {
    expect(ALLOWED_TRANSITIONS.length).toBe(11)
  })
})

describe('nextStatusForUserMessage — reopen (FR-006)', () => {
  it('reopens a resolved conversation to ai_active', () => {
    expect(nextStatusForUserMessage('resolved')).toBe('ai_active')
  })

  it('reopens a closed conversation to ai_active', () => {
    expect(nextStatusForUserMessage('closed')).toBe('ai_active')
  })

  it('leaves ai_active as ai_active', () => {
    expect(nextStatusForUserMessage('ai_active')).toBe('ai_active')
  })

  it('never pulls waiting_admin away from a human (FR-067)', () => {
    expect(nextStatusForUserMessage('waiting_admin')).toBe('waiting_admin')
  })

  it('never pulls admin_active away from a human (FR-067)', () => {
    expect(nextStatusForUserMessage('admin_active')).toBe('admin_active')
  })
})

describe('applyLazyResolution — waiting_admin / admin_active never auto-resolve (FR-082)', () => {
  const now = new Date('2026-09-10T00:00:00.000Z')
  // Ten years old — if either of these ever auto-resolved, this would prove it.
  const ancientLastMessageAt = new Date('2016-09-10T00:00:00.000Z')

  it('waiting_admin stays waiting_admin no matter how old', () => {
    expect(applyLazyResolution('waiting_admin', ancientLastMessageAt, now)).toBe('waiting_admin')
  })

  it('admin_active stays admin_active no matter how old', () => {
    expect(applyLazyResolution('admin_active', ancientLastMessageAt, now)).toBe('admin_active')
  })

  it('closed stays closed (terminal)', () => {
    expect(applyLazyResolution('closed', ancientLastMessageAt, now)).toBe('closed')
  })
})

describe('applyLazyResolution — auto-resolve boundary at exactly 24h', () => {
  const now = new Date('2026-09-10T00:00:00.000Z')
  const resolveWindowMs = SUPPORT_AUTO_RESOLVE_HOURS * 60 * 60 * 1000

  it('resolves when exactly 24h old (inclusive)', () => {
    const lastMessageAt = new Date(now.getTime() - resolveWindowMs)
    expect(applyLazyResolution('ai_active', lastMessageAt, now)).toBe('resolved')
  })

  it('stays ai_active at 24h minus 1ms', () => {
    const lastMessageAt = new Date(now.getTime() - resolveWindowMs + 1)
    expect(applyLazyResolution('ai_active', lastMessageAt, now)).toBe('ai_active')
  })

  it('stays ai_active well under 24h', () => {
    const lastMessageAt = new Date(now.getTime() - 60 * 60 * 1000)
    expect(applyLazyResolution('ai_active', lastMessageAt, now)).toBe('ai_active')
  })
})

describe('applyLazyResolution — auto-close boundary at exactly 7d', () => {
  const now = new Date('2026-09-10T00:00:00.000Z')
  const closeWindowMs = SUPPORT_AUTO_CLOSE_DAYS * 24 * 60 * 60 * 1000

  it('closes when exactly 7d old (inclusive)', () => {
    const lastMessageAt = new Date(now.getTime() - closeWindowMs)
    expect(applyLazyResolution('resolved', lastMessageAt, now)).toBe('closed')
  })

  it('stays resolved at 7d minus 1ms', () => {
    const lastMessageAt = new Date(now.getTime() - closeWindowMs + 1)
    expect(applyLazyResolution('resolved', lastMessageAt, now)).toBe('resolved')
  })

  it('stays resolved well under 7d', () => {
    const lastMessageAt = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    expect(applyLazyResolution('resolved', lastMessageAt, now)).toBe('resolved')
  })
})

describe('applyLazyResolution — the close window runs from resolved_at, not last_message_at', () => {
  const now = new Date('2026-09-10T00:00:00.000Z')
  const day = 24 * 60 * 60 * 1000

  // The case that motivated the extra parameter: an admin tidies up a thread
  // that went quiet long ago. Anchoring the close window on the last message
  // would close it in the same breath as resolving it.
  it('does not close a conversation an admin just resolved, however old the thread', () => {
    const lastMessageAt = new Date(now.getTime() - 30 * day)
    const resolvedAt = new Date(now.getTime() - 1 * day)
    expect(applyLazyResolution('resolved', lastMessageAt, now, resolvedAt)).toBe('resolved')
  })

  it('closes once 7d have passed since resolution, not since the last message', () => {
    const lastMessageAt = new Date(now.getTime() - 30 * day)
    const resolvedAt = new Date(now.getTime() - 7 * day)
    expect(applyLazyResolution('resolved', lastMessageAt, now, resolvedAt)).toBe('closed')
  })

  it('falls back to last_message_at when resolved_at is absent', () => {
    const lastMessageAt = new Date(now.getTime() - 30 * day)
    expect(applyLazyResolution('resolved', lastMessageAt, now, null)).toBe('closed')
  })
})

describe('applyLazyResolution — an auto-resolved thread eventually auto-closes', () => {
  // Lazy resolution is never persisted, so such a thread's stored status is
  // still `ai_active` when the close window comes due. Answering `resolved`
  // forever would make SUPPORT_AUTO_CLOSE_DAYS unreachable.
  const now = new Date('2026-10-01T00:00:00.000Z')
  const hour = 60 * 60 * 1000
  const day = 24 * hour
  const resolveMs = SUPPORT_AUTO_RESOLVE_HOURS * hour
  const closeMs = SUPPORT_AUTO_CLOSE_DAYS * day

  it('is resolved once past the resolve window but before resolve + close', () => {
    const lastMessageAt = new Date(now.getTime() - (resolveMs + closeMs) + 1)
    expect(applyLazyResolution('ai_active', lastMessageAt, now)).toBe('resolved')
  })

  it('is closed once resolve + close has elapsed', () => {
    const lastMessageAt = new Date(now.getTime() - (resolveMs + closeMs))
    expect(applyLazyResolution('ai_active', lastMessageAt, now)).toBe('closed')
  })

  it('is still ai_active just under the resolve window', () => {
    const lastMessageAt = new Date(now.getTime() - resolveMs + 1)
    expect(applyLazyResolution('ai_active', lastMessageAt, now)).toBe('ai_active')
  })
})

describe('canReturnToAi', () => {
  // FR-067b. An escalation nobody answered blocked the user from the assistant
  // forever: waiting_admin never auto-resolves, it still counts as their one
  // open conversation, and a human-owned thread stops the AI. Each rule was
  // right; together they were a trap.
  const t0 = new Date('2026-09-04T00:00:00.000Z')
  const at = (mins: number) => new Date(t0.getTime() + mins * 60_000)

  it('hands back a plain escalation after a full quiet hour', () => {
    expect(canReturnToAi('waiting_admin', t0, at(60), false)).toBe(true)
  })

  it('does not hand back a minute early', () => {
    expect(canReturnToAi('waiting_admin', t0, at(59), false)).toBe(false)
  })

  it('never hands back an escalation that needs a person', () => {
    // A reported charge or breach stays with the human it went to, however long
    // it takes. This is the case the whole feature has to get right.
    expect(canReturnToAi('waiting_admin', t0, at(60 * 48), true)).toBe(false)
  })

  it('never touches a conversation an admin actually replied in', () => {
    expect(canReturnToAi('admin_active', t0, at(60 * 48), false)).toBe(false)
  })

  it('ignores statuses that were never escalated at all', () => {
    for (const status of ['ai_active', 'resolved', 'closed'] as const) {
      expect(canReturnToAi(status, t0, at(60 * 48), false)).toBe(false)
    }
  })
})
