import { describe, expect, it } from 'vitest'
import { normalizeContent, toAdminMessage, toUserMessage, toUserMessages, type SupportMessageRow } from './sanitize'

function row(overrides: Partial<SupportMessageRow> = {}): SupportMessageRow {
  return {
    id: 'msg-1',
    sender_type: 'user',
    sender_id: 'user-1',
    content: 'Hello',
    client_message_id: 'client-1',
    created_at: '2026-09-01T00:00:00.000Z',
    metadata: null,
    ...overrides,
  }
}

describe('normalizeContent', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeContent('  hello world  ')).toBe('hello world')
  })

  it('preserves internal whitespace (no collapsing)', () => {
    expect(normalizeContent('  line one\n\nline two  ')).toBe('line one\n\nline two')
  })

  it('rejects a non-string', () => {
    expect(normalizeContent(42)).toBeNull()
    expect(normalizeContent(null)).toBeNull()
    expect(normalizeContent(undefined)).toBeNull()
    expect(normalizeContent({})).toBeNull()
  })

  it('rejects an empty string', () => {
    expect(normalizeContent('')).toBeNull()
  })

  it('rejects a whitespace-only string', () => {
    expect(normalizeContent('   \n\t  ')).toBeNull()
  })

  it('accepts content at exactly 4000 characters', () => {
    const content = 'a'.repeat(4000)
    expect(normalizeContent(content)).toBe(content)
  })

  it('rejects content at 4001 characters', () => {
    const content = 'a'.repeat(4001)
    expect(normalizeContent(content)).toBeNull()
  })

  it('checks the length limit after trimming', () => {
    // Exactly 4000 non-whitespace characters plus surrounding whitespace still passes.
    const content = `  ${'a'.repeat(4000)}  `
    expect(normalizeContent(content)).toBe('a'.repeat(4000))
  })
})

describe('toUserMessage — no metadata/senderId key at all', () => {
  it('output has exactly the five UserMessage keys, nothing more', () => {
    const result = toUserMessage(
      row({ metadata: { ai_confidence: 0.9, escalation_reason: 'human_requested', ai_model: 'gemini' } })
    )
    expect(Object.keys(result).sort()).toEqual(['clientMessageId', 'content', 'createdAt', 'id', 'senderType'])
    expect(Object.prototype.hasOwnProperty.call(result, 'metadata')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(result, 'senderId')).toBe(false)
  })

  it('maps fields to their camelCase equivalents', () => {
    const result = toUserMessage(row())
    expect(result).toEqual({
      id: 'msg-1',
      senderType: 'user',
      content: 'Hello',
      clientMessageId: 'client-1',
      createdAt: '2026-09-01T00:00:00.000Z',
    })
  })
})

describe('toAdminMessage', () => {
  it('includes senderId and metadata', () => {
    const result = toAdminMessage(
      row({
        sender_type: 'ai',
        sender_id: null,
        metadata: { ai_confidence: 0.72, escalation_reason: 'low_confidence', ai_model: 'gemini-2.5-flash' },
      })
    )
    expect(result.senderId).toBeNull()
    expect(result.metadata).toEqual({
      aiConfidence: 0.72,
      escalationReason: 'low_confidence',
      aiModel: 'gemini-2.5-flash',
    })
  })

  it('omits metadata keys the row does not carry rather than setting them to undefined', () => {
    const result = toAdminMessage(row({ metadata: null }))
    expect(result.metadata).toEqual({})
    expect(Object.keys(result.metadata)).toEqual([])
  })

  it('passes through a system row (admin-only view)', () => {
    const result = toAdminMessage(row({ sender_type: 'system', content: 'internal note' }))
    expect(result.senderType).toBe('system')
    expect(result.content).toBe('internal note')
  })
})

describe('toUserMessages — system rows dropped, not blanked', () => {
  it('drops system rows entirely rather than including them with blanked content', () => {
    const rows = [
      row({ id: 'm1', sender_type: 'user', content: 'hi' }),
      row({ id: 'm2', sender_type: 'system', content: 'internal note, must not leak' }),
      row({ id: 'm3', sender_type: 'ai', content: 'answer' }),
    ]
    const result = toUserMessages(rows)
    expect(result.map((m) => m.id)).toEqual(['m1', 'm3'])
    expect(result.some((m) => m.content.includes('internal note'))).toBe(false)
  })

  it('returns an empty array when every row is a system row', () => {
    const rows = [row({ sender_type: 'system' }), row({ sender_type: 'system' })]
    expect(toUserMessages(rows)).toEqual([])
  })

  it('returns an empty array for an empty input', () => {
    expect(toUserMessages([])).toEqual([])
  })
})
