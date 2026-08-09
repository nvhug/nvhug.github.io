import { describe, expect, it } from 'vitest'

import {
  INTERNAL_NUTRITION_TABLE_VERSION,
  normalizeItemsWithInternalTable,
  type NutritionItem,
} from './nutrition-normalizer'

function makeItem(partial?: Partial<NutritionItem>): NutritionItem {
  return {
    name: 'Com trang',
    portion: '154g',
    calories: 999,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    confidence: 0.8,
    assumptions: '',
    ...partial,
  }
}

describe('normalizeItemsWithInternalTable', () => {
  it('normalizes white rice from explicit grams', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Com trang', portion: '154g' })])
    expect(item.calories).toBe(205)
    expect(item.protein_g).toBe(4)
    expect(item.carbs_g).toBe(46.2)
    expect(item.fat_g).toBe(0.5)
    expect(item.assumptions).toContain('[internal-table:white_rice:154g]')
    expect(item.normalized_by_internal_table).toBe(true)
    expect(item.normalized_table_key).toBe('white_rice')
    expect(item.normalized_source).toBe('internal_table')
    expect(item.normalization_version).toBe(INTERNAL_NUTRITION_TABLE_VERSION)
  })

  it('normalizes fried tofu with dedicated fried profile', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Dau hu chien', portion: '75g' })])
    expect(item.calories).toBe(125)
    expect(item.protein_g).toBe(9.8)
    expect(item.carbs_g).toBe(3)
    expect(item.fat_g).toBe(8.3)
    expect(item.assumptions).toContain('[internal-table:tofu_fried:75g]')
    expect(item.normalized_by_internal_table).toBe(true)
    expect(item.normalized_table_key).toBe('tofu_fried')
  })

  it('normalizes plain tofu with dedicated plain profile', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Dau hu trang', portion: '100g' })])
    expect(item.calories).toBe(76)
    expect(item.protein_g).toBe(8)
    expect(item.carbs_g).toBe(2)
    expect(item.fat_g).toBe(4)
    expect(item.normalized_table_key).toBe('tofu_plain')
  })

  it('normalizes braised fish by grams', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Ca kho', portion: '10g' })])
    expect(item.calories).toBe(14)
    expect(item.protein_g).toBe(1.9)
    expect(item.carbs_g).toBe(0.3)
    expect(item.fat_g).toBe(0.5)
    expect(item.assumptions).toContain('[internal-table:braised_fish:10g]')
    expect(item.normalized_by_internal_table).toBe(true)
    expect(item.normalized_table_key).toBe('braised_fish')
  })

  it('matches Vietnamese diacritics alias for tofu', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Đậu hũ chiên', portion: '100g' })])
    expect(item.calories).toBe(166)
    expect(item.normalized_table_key).toBe('tofu_fried')
  })

  it('keeps AI result and emits warning for ambiguous tofu alias', () => {
    const src = makeItem({ name: 'Tofu', portion: '100g', calories: 99, protein_g: 7, carbs_g: 4, fat_g: 5 })
    const [item] = normalizeItemsWithInternalTable([src])
    expect(item.calories).toBe(99)
    expect(item.normalized_by_internal_table).toBeUndefined()
    expect(item.normalized_table_key).toBe('tofu_plain')
    expect(item.normalization_warning).toBe('ambiguous_match')
  })

  it('matches English synonym for rice and avoids fried rice', () => {
    const [plain] = normalizeItemsWithInternalTable([makeItem({ name: 'Steamed rice', portion: '100g' })])
    expect(plain.calories).toBe(133)
    expect(plain.normalized_table_key).toBe('white_rice')

    const friedSrc = makeItem({ name: 'Fried rice', portion: '100g', calories: 200, protein_g: 5, carbs_g: 24, fat_g: 9 })
    const [fried] = normalizeItemsWithInternalTable([friedSrc])
    expect(fried).toEqual(friedSrc)
  })

  it('does not confuse thit kho to with braised fish', () => {
    const src = makeItem({
      name: 'Thit kho to',
      portion: '100g',
      calories: 215,
      protein_g: 16,
      carbs_g: 4,
      fat_g: 14,
    })
    const [item] = normalizeItemsWithInternalTable([src])
    expect(item).toEqual(src)
  })

  it('does not normalize other kho dishes as fish', () => {
    const samples: NutritionItem[] = [
      makeItem({ name: 'Thit kho', portion: '100g', calories: 210, protein_g: 15, carbs_g: 6, fat_g: 14 }),
      makeItem({ name: 'Suon kho', portion: '100g', calories: 240, protein_g: 14, carbs_g: 5, fat_g: 18 }),
      makeItem({ name: 'Ga kho', portion: '100g', calories: 190, protein_g: 20, carbs_g: 3, fat_g: 10 }),
    ]

    const out = normalizeItemsWithInternalTable(samples)
    expect(out).toEqual(samples)
  })

  it('does not normalize fish-related non-braised items', () => {
    const samples: NutritionItem[] = [
      makeItem({ name: 'Fish sauce', portion: '20g', calories: 15, protein_g: 2, carbs_g: 1, fat_g: 0 }),
      makeItem({ name: 'Fish ball', portion: '100g', calories: 135, protein_g: 10, carbs_g: 15, fat_g: 4 }),
      makeItem({ name: 'Ca vien', portion: '100g', calories: 140, protein_g: 9, carbs_g: 17, fat_g: 4 }),
    ]

    const out = normalizeItemsWithInternalTable(samples)
    expect(out).toEqual(samples)
  })

  it('does not normalize accented Vietnamese nuoc mam input', () => {
    const src = makeItem({
      name: 'Nước mắm',
      portion: '20g',
      calories: 15,
      protein_g: 2,
      carbs_g: 1,
      fat_g: 0,
    })
    const [item] = normalizeItemsWithInternalTable([src])
    expect(item).toEqual(src)
  })

  it('leaves unknown foods untouched', () => {
    const src = makeItem({ name: 'Banh mi', portion: '120g', calories: 320, protein_g: 12, carbs_g: 48, fat_g: 9 })
    const [item] = normalizeItemsWithInternalTable([src])
    expect(item).toEqual(src)
  })

  it('normalizes from household units when grams are missing', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Com trang', portion: '1 chen' })])
    expect(item.normalized_by_internal_table).toBe(true)
    expect(item.normalized_table_key).toBe('white_rice')
    expect(item.normalization_warning).toBe('household_unit_converted')
    expect(item.calories).toBe(213)
  })
})
