import { describe, expect, it } from 'vitest'

import { applyPresetToForm, EMPTY_FORM, PRESETS } from './gymTrackerPresets'

describe('gym tracker presets', () => {
  it('includes running with a 100-step default', () => {
    const running = PRESETS.find((preset) => preset.exercise === 'Chạy bộ')

    expect(running).toMatchObject({
      exercise: 'Chạy bộ',
      muscle_group: 'Cardio, chân',
      default_weight_kg: '',
      default_reps: '100 bước',
    })
  })

  it('applies the running preset to the form', () => {
    const running = PRESETS.find((preset) => preset.exercise === 'Chạy bộ')

    expect(running).toBeDefined()

    const nextForm = applyPresetToForm(EMPTY_FORM, running!)

    expect(nextForm.exercise).toBe('Chạy bộ')
    expect(nextForm.muscle_group).toBe('Cardio, chân')
    expect(nextForm.reps).toBe('100 bước')
    expect(nextForm.weight_kg).toBe('')
  })
})