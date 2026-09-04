import { describe, expect, it } from 'vitest'
import { computeSupportMetrics, median, type SupportMetricsConversationInput } from './metrics'

function conv(overrides: Partial<SupportMetricsConversationInput> = {}): SupportMetricsConversationInput {
  return {
    id: 'c1',
    status: 'ai_active',
    priority: 'normal',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    firstHumanEnteredAt: null,
    firstAdminReplyAt: null,
    resolvedAt: null,
    // Default true so the pre-existing cases keep testing what they were written
    // to test — the aiResolved/humanResolved split — rather than all silently
    // becoming `abandoned`. The abandonment cases set it false explicitly.
    endedExplicitly: true,
    ...overrides,
  }
}

describe('median', () => {
  it('returns null for an empty array', () => {
    expect(median([])).toBeNull()
  })

  it('returns the middle value for an odd-length array', () => {
    expect(median([5, 1, 3])).toBe(3)
  })

  it('averages the two middle values for an even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('returns the single value for a one-element array', () => {
    expect(median([42])).toBe(42)
  })
})

describe('computeSupportMetrics — counts', () => {
  it('counts totals, open, waiting and urgent', () => {
    const result = computeSupportMetrics([
      conv({ status: 'ai_active' }),
      conv({ status: 'waiting_admin', priority: 'urgent' }),
      conv({ status: 'admin_active' }),
      conv({ status: 'resolved' }),
      conv({ status: 'closed', priority: 'urgent' }), // closed + urgent: no longer "open", excluded from urgent count
    ])
    expect(result.totalConversations).toBe(5)
    expect(result.open).toBe(3)
    expect(result.waiting).toBe(1)
    expect(result.urgent).toBe(1)
  })
})

describe('computeSupportMetrics — FR-072 AI resolution rate', () => {
  it('returns null for both rates when there are no conversations at all', () => {
    const result = computeSupportMetrics([])
    expect(result.escalationRate).toBeNull()
    expect(result.aiResolutionRate).toBeNull()
    expect(Number.isNaN(result.escalationRate)).toBe(false)
    expect(Number.isNaN(result.aiResolutionRate)).toBe(false)
  })

  it('returns null for aiResolutionRate when there are conversations but none resolved yet', () => {
    const result = computeSupportMetrics([conv({ status: 'ai_active' }), conv({ status: 'waiting_admin' })])
    expect(result.aiResolutionRate).toBeNull()
    expect(Number.isNaN(result.aiResolutionRate)).toBe(false)
  })

  it('counts a conversation that never entered waiting_admin/admin_active as AI-resolved', () => {
    const result = computeSupportMetrics([
      conv({ status: 'resolved', firstHumanEnteredAt: null, resolvedAt: new Date('2026-09-02T00:00:00.000Z') }),
    ])
    expect(result.aiResolved).toBe(1)
    expect(result.humanResolved).toBe(0)
    expect(result.aiResolutionRate).toBe(1)
  })

  it('counts a conversation that entered waiting_admin as human-resolved even if resolved directly from admin_active', () => {
    const result = computeSupportMetrics([
      conv({
        status: 'closed',
        firstHumanEnteredAt: new Date('2026-09-01T01:00:00.000Z'),
        resolvedAt: new Date('2026-09-02T00:00:00.000Z'),
      }),
    ])
    expect(result.aiResolved).toBe(0)
    expect(result.humanResolved).toBe(1)
    expect(result.aiResolutionRate).toBe(0)
  })

  it('computes a mixed rate over resolved conversations only, ignoring still-open ones', () => {
    const result = computeSupportMetrics([
      conv({ status: 'resolved', firstHumanEnteredAt: null, resolvedAt: new Date('2026-09-02T00:00:00.000Z') }),
      conv({ status: 'resolved', firstHumanEnteredAt: null, resolvedAt: new Date('2026-09-02T00:00:00.000Z') }),
      conv({
        status: 'resolved',
        firstHumanEnteredAt: new Date('2026-09-01T01:00:00.000Z'),
        resolvedAt: new Date('2026-09-02T00:00:00.000Z'),
      }),
      conv({ status: 'ai_active' }), // still open — excluded from the denominator
    ])
    expect(result.aiResolved).toBe(2)
    expect(result.humanResolved).toBe(1)
    expect(result.aiResolutionRate).toBeCloseTo(2 / 3, 10)
  })
})

describe('computeSupportMetrics — escalation rate', () => {
  it('is the fraction of all conversations that ever entered a human stage', () => {
    const result = computeSupportMetrics([
      conv({ firstHumanEnteredAt: new Date('2026-09-01T01:00:00.000Z') }),
      conv({ firstHumanEnteredAt: null }),
      conv({ firstHumanEnteredAt: null }),
      conv({ firstHumanEnteredAt: null }),
    ])
    expect(result.escalationRate).toBe(0.25)
  })
})

describe('computeSupportMetrics — median first-response and resolution times', () => {
  it('computes medians only over conversations that have the relevant timestamp', () => {
    const result = computeSupportMetrics([
      conv({
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        firstAdminReplyAt: new Date('2026-09-01T00:10:00.000Z'), // 10 min
        resolvedAt: new Date('2026-09-01T01:00:00.000Z'), // 60 min
      }),
      conv({
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        firstAdminReplyAt: new Date('2026-09-01T00:30:00.000Z'), // 30 min
        resolvedAt: null,
      }),
      conv({
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        firstAdminReplyAt: null,
        resolvedAt: null,
      }),
    ])
    expect(result.medianFirstResponseMs).toBe(median([10 * 60_000, 30 * 60_000]))
    expect(result.medianResolutionMs).toBe(60 * 60_000)
  })

  it('returns null medians when no conversation has the relevant timestamp', () => {
    const result = computeSupportMetrics([conv(), conv()])
    expect(result.medianFirstResponseMs).toBeNull()
    expect(result.medianResolutionMs).toBeNull()
  })
})

describe('abandonment is not a resolution (FR-072a)', () => {
  it('counts a silently idled conversation as abandoned, not as AI-resolved', () => {
    // The shape that used to inflate the headline number: the assistant
    // answered, the answer was useless, the user left, and 24h later
    // applyLazyResolution called it resolved.
    const m = computeSupportMetrics([
      conv({ status: 'resolved', endedExplicitly: false, firstHumanEnteredAt: null }),
    ])
    expect(m.abandoned).toBe(1)
    expect(m.aiResolved).toBe(0)
    expect(m.humanResolved).toBe(0)
  })

  it('still credits the AI when somebody actually closed it', () => {
    const m = computeSupportMetrics([
      conv({ status: 'resolved', endedExplicitly: true, firstHumanEnteredAt: null }),
    ])
    expect(m.aiResolved).toBe(1)
    expect(m.abandoned).toBe(0)
  })

  it('counts an abandoned conversation that had been escalated as abandoned too', () => {
    // Reachable now that an unanswered escalation can go back to the AI: it was
    // escalated, handed back, then went quiet. Nobody resolved it either way.
    const m = computeSupportMetrics([
      conv({ status: 'resolved', endedExplicitly: false, firstHumanEnteredAt: new Date('2026-09-01T01:00:00.000Z') }),
    ])
    expect(m.abandoned).toBe(1)
    expect(m.humanResolved).toBe(0)
  })

  it('keeps abandoned out of both halves of the AI resolution rate', () => {
    const m = computeSupportMetrics([
      conv({ id: 'a', status: 'resolved', endedExplicitly: true, firstHumanEnteredAt: null }),
      conv({ id: 'b', status: 'closed', endedExplicitly: true, firstHumanEnteredAt: new Date('2026-09-01T01:00:00.000Z') }),
      conv({ id: 'c', status: 'resolved', endedExplicitly: false, firstHumanEnteredAt: null }),
      conv({ id: 'd', status: 'resolved', endedExplicitly: false, firstHumanEnteredAt: null }),
    ])
    // 1 AI + 1 human finished; the two abandoned ones move neither way.
    expect(m.aiResolutionRate).toBe(0.5)
    expect(m.abandoned).toBe(2)
  })

  it('leaves open conversations out of every bucket', () => {
    const m = computeSupportMetrics([conv({ status: 'ai_active', endedExplicitly: false })])
    expect(m.abandoned).toBe(0)
    expect(m.aiResolved).toBe(0)
    expect(m.open).toBe(1)
  })
})
