import { describe, expect, it } from 'vitest'
import { buildFoodDisplayName } from '@/lib/foodDisplay'

describe('buildFoodDisplayName', () => {
  it('returns fallback when both values are empty', () => {
    expect(buildFoodDisplayName('', '')).toBe('-')
    expect(buildFoodDisplayName(undefined, undefined)).toBe('-')
  })

  it('appends explicit gram portion to food name', () => {
    expect(buildFoodDisplayName('Com trang', '154g')).toBe('Com trang 154g')
  })

  it('does not duplicate portion if name already contains it', () => {
    expect(buildFoodDisplayName('Com trang 154g', '154g')).toBe('Com trang 154g')
  })

  it('uses parentheses when portion has no numeric amount', () => {
    expect(buildFoodDisplayName('Ca kho', 'it sot')).toBe('Ca kho (it sot)')
  })

  it('returns portion when name is missing', () => {
    expect(buildFoodDisplayName('', '75g')).toBe('75g')
  })
})
