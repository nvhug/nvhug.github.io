import { describe, expect, it } from 'vitest'

import type { GoalDraft } from '../_components/tabs/types'

function sanitizeGoalDraft(draft: GoalDraft) {
  return {
    ...draft,
    target_date: draft.target_date ? draft.target_date : null,
    start_date: draft.start_date ? draft.start_date : null,
  }
}

describe('sanitizeGoalDraft', () => {
  it('converts empty target_date string to null', () => {
    const draft: GoalDraft = {
      title: 'Test Goal',
      type: 'health',
      description: '',
      target_date: '',
      status: 'active',
      completion_percentage: 0,
    }

    const sanitized = sanitizeGoalDraft(draft)
    expect(sanitized.target_date).toBeNull()
  })

  it('converts empty start_date string to null', () => {
    const draft: GoalDraft = {
      title: 'Test Goal',
      type: 'health',
      description: '',
      start_date: '',
      target_date: '',
      status: 'active',
      completion_percentage: 0,
    }

    const sanitized = sanitizeGoalDraft(draft)
    expect(sanitized.start_date).toBeNull()
  })

  it('preserves valid date strings', () => {
    const draft: GoalDraft = {
      title: 'Test Goal',
      type: 'health',
      description: '',
      start_date: '2024-01-01',
      target_date: '2024-12-31',
      status: 'active',
      completion_percentage: 0,
    }

    const sanitized = sanitizeGoalDraft(draft)
    expect(sanitized.start_date).toBe('2024-01-01')
    expect(sanitized.target_date).toBe('2024-12-31')
  })

  it('preserves undefined dates', () => {
    const draft: GoalDraft = {
      title: 'Test Goal',
      type: 'health',
      description: '',
      status: 'active',
      completion_percentage: 0,
    }

    const sanitized = sanitizeGoalDraft(draft)
    expect(sanitized.start_date).toBeNull()
    expect(sanitized.target_date).toBeNull()
  })
})
