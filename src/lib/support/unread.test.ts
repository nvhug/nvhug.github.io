import { describe, expect, it } from 'vitest'
import { isUnreadForAdmin } from './unread'

describe('isUnreadForAdmin', () => {
  it('is unread when no admin has ever read it', () => {
    expect(isUnreadForAdmin('2026-09-03T12:00:00.000Z', null)).toBe(true)
  })

  it('is unread when the last message landed after the last admin read', () => {
    expect(isUnreadForAdmin('2026-09-03T12:00:00.000Z', '2026-09-03T11:00:00.000Z')).toBe(true)
  })

  it('is read when the last message is at or before the last admin read', () => {
    expect(isUnreadForAdmin('2026-09-03T11:00:00.000Z', '2026-09-03T12:00:00.000Z')).toBe(false)
  })

  it('is read when the last message exactly equals the last admin read', () => {
    expect(isUnreadForAdmin('2026-09-03T12:00:00.000Z', '2026-09-03T12:00:00.000Z')).toBe(false)
  })
})
