import { describe, expect, it } from 'vitest'
import { deriveSubject } from './subject'

describe('deriveSubject', () => {
  it('uses a short message as-is', () => {
    expect(deriveSubject('How do I reset my password?')).toBe('How do I reset my password?')
  })

  it('takes only the first line of a multi-line message', () => {
    expect(deriveSubject('Line one\nLine two\nLine three')).toBe('Line one')
  })

  it('collapses internal whitespace (tabs, repeated spaces) to single spaces', () => {
    expect(deriveSubject('hello    there\tfriend')).toBe('hello there friend')
  })

  it('trims leading/trailing whitespace around the whole message', () => {
    expect(deriveSubject('   spaced out message   ')).toBe('spaced out message')
  })

  it('skips leading blank lines to find the first real line', () => {
    expect(deriveSubject('\n\n  actual first line\nsecond line')).toBe('actual first line')
  })

  it('truncates to 60 characters total, ending in an ellipsis', () => {
    const longMessage = 'a'.repeat(100)
    const result = deriveSubject(longMessage)
    expect(result.length).toBe(60)
    expect(result.endsWith('…')).toBe(true)
    expect(result).toBe(`${'a'.repeat(59)}…`)
  })

  it('does not truncate a message at exactly 60 characters', () => {
    const message = 'a'.repeat(60)
    expect(deriveSubject(message)).toBe(message)
  })

  it('truncates a message at 61 characters', () => {
    const message = 'a'.repeat(61)
    const result = deriveSubject(message)
    expect(result.length).toBe(60)
    expect(result.endsWith('…')).toBe(true)
  })

  it('falls back for an empty string', () => {
    expect(deriveSubject('')).toBe('New conversation')
  })

  it('falls back for a whitespace-only string', () => {
    expect(deriveSubject('   \n\t  ')).toBe('New conversation')
  })
})
