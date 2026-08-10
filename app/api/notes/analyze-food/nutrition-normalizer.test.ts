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

  it('normalizes ripe banana from explicit grams close to USDA density', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Chuoi chin', portion: '163.5g' })])
    expect(item.calories).toBe(146)
    expect(item.protein_g).toBe(1.8)
    expect(item.carbs_g).toBe(37.4)
    expect(item.fat_g).toBe(0.5)
    expect(item.assumptions).toContain('[internal-table:ripe_banana:164g]')
    expect(item.normalized_by_internal_table).toBe(true)
    expect(item.normalized_table_key).toBe('ripe_banana')
  })

  it('normalizes ripe banana from household unit when grams are missing', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Chuoi chin', portion: '1 qua' })])
    expect(item.calories).toBe(105)
    expect(item.protein_g).toBe(1.3)
    expect(item.carbs_g).toBe(27)
    expect(item.fat_g).toBe(0.4)
    expect(item.normalized_by_internal_table).toBe(true)
    expect(item.normalized_table_key).toBe('ripe_banana')
    expect(item.normalization_warning).toBe('household_unit_converted')
  })

  it('normalizes boiled eggs from household units', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Trung luoc', portion: '2 qua' })])
    expect(item.calories).toBe(155)
    expect(item.protein_g).toBe(13)
    expect(item.carbs_g).toBe(1.1)
    expect(item.fat_g).toBe(11)
    expect(item.normalized_table_key).toBe('boiled_egg')
  })

  it('normalizes whole milk from explicit ml', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Sua tuoi', portion: '250ml' })])
    expect(item.calories).toBe(153)
    expect(item.protein_g).toBe(8)
    expect(item.carbs_g).toBe(12)
    expect(item.fat_g).toBe(8.3)
    expect(item.normalized_table_key).toBe('whole_milk')
    expect(item.normalization_warning).toBeUndefined()
  })

  it('normalizes milk tea with dedicated profile instead of whole milk', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Milk tea', portion: '350ml' })])
    expect(item.calories).toBe(245)
    expect(item.protein_g).toBe(3.5)
    expect(item.carbs_g).toBe(40.3)
    expect(item.fat_g).toBe(7.7)
    expect(item.normalized_table_key).toBe('milk_tea')
    expect(item.normalization_warning).toBeUndefined()
  })

  it('normalizes coffee with milk with dedicated profile', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Ca phe sua', portion: '240ml' })])
    expect(item.calories).toBe(132)
    expect(item.protein_g).toBe(3.6)
    expect(item.carbs_g).toBe(19.2)
    expect(item.fat_g).toBe(4.3)
    expect(item.normalized_table_key).toBe('coffee_with_milk')
    expect(item.normalization_warning).toBeUndefined()
  })

  it('normalizes oats from explicit grams', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Yen mach', portion: '40g' })])
    expect(item.calories).toBe(156)
    expect(item.protein_g).toBe(6.8)
    expect(item.carbs_g).toBe(26.5)
    expect(item.fat_g).toBe(2.8)
    expect(item.normalized_table_key).toBe('rolled_oats_dry')
  })

  it('normalizes pho bowl as composite dish instead of plain rice noodles', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Pho bo', portion: '1 to' })])
    expect(item.calories).toBe(358)
    expect(item.protein_g).toBe(25.9)
    expect(item.carbs_g).toBe(45.1)
    expect(item.fat_g).toBe(8.8)
    expect(item.normalized_table_key).toBe('pho_beef_bowl')
  })

  it('normalizes bun bowl as composite dish instead of plain rice noodles', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Bun bo', portion: '1 to' })])
    expect(item.calories).toBe(625)
    expect(item.protein_g).toBe(30)
    expect(item.carbs_g).toBe(85)
    expect(item.fat_g).toBe(17.5)
    expect(item.normalized_table_key).toBe('bun_meat_bowl')
  })

  it('normalizes filled banh mi separately from plain white bread', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Banh mi kep', portion: '1 o' })])
    expect(item.calories).toBe(495)
    expect(item.protein_g).toBe(19.8)
    expect(item.carbs_g).toBe(61.2)
    expect(item.fat_g).toBe(18)
    expect(item.normalized_table_key).toBe('banh_mi_filled')
  })

  it('does not treat "1 to" as white bread loaf unit', () => {
    const src = makeItem({ name: 'White bread', portion: '1 to', calories: 222, protein_g: 8, carbs_g: 40, fat_g: 3 })
    const [item] = normalizeItemsWithInternalTable([src])
    expect(item).toEqual(src)
  })

  it('supports fractional household quantity such as 1/2 banana', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Chuoi chin', portion: '1/2 qua' })])
    expect(item.calories).toBe(53)
    expect(item.protein_g).toBe(0.6)
    expect(item.carbs_g).toBe(13.5)
    expect(item.fat_g).toBe(0.2)
    expect(item.normalized_table_key).toBe('ripe_banana')
  })

  it('supports mixed-fraction quantity such as 1 1/2 banana', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Chuoi chin', portion: '1 1/2 qua' })])
    expect(item.calories).toBe(158)
    expect(item.protein_g).toBe(1.9)
    expect(item.carbs_g).toBe(40.5)
    expect(item.fat_g).toBe(0.5)
    expect(item.normalized_table_key).toBe('ripe_banana')
  })

  it('supports ranged quantity such as 2-3 eggs using midpoint', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Trung luoc', portion: '2-3 qua' })])
    expect(item.calories).toBe(194)
    expect(item.protein_g).toBe(16.3)
    expect(item.carbs_g).toBe(1.4)
    expect(item.fat_g).toBe(13.8)
    expect(item.normalized_table_key).toBe('boiled_egg')
  })

  it('does not normalize banana-based composite desserts as ripe banana', () => {
    const src = makeItem({
      name: 'Banana bread',
      portion: '100g',
      calories: 326,
      protein_g: 4.3,
      carbs_g: 53,
      fat_g: 10.5,
    })
    const [item] = normalizeItemsWithInternalTable([src])
    expect(item).toEqual(src)
  })

  it('does not classify latte as plain whole milk', () => {
    const src = makeItem({
      name: 'Latte',
      portion: '240ml',
      calories: 155,
      protein_g: 8,
      carbs_g: 14,
      fat_g: 6,
    })
    const [item] = normalizeItemsWithInternalTable([src])
    expect(item.normalized_table_key).not.toBe('whole_milk')
    expect(item.normalized_table_key).toBe('coffee_with_milk')
  })

  it('does not normalize milkshake as plain whole milk', () => {
    const src = makeItem({
      name: 'Milkshake',
      portion: '300ml',
      calories: 330,
      protein_g: 7,
      carbs_g: 45,
      fat_g: 13,
    })
    const [item] = normalizeItemsWithInternalTable([src])
    expect(item).toEqual(src)
  })

  it('does not normalize banana oats composite bowl as ripe banana', () => {
    const src = makeItem({
      name: 'Banana oats',
      portion: '1 bowl',
      calories: 365,
      protein_g: 12,
      carbs_g: 61,
      fat_g: 9,
    })
    const [item] = normalizeItemsWithInternalTable([src])
    expect(item).toEqual(src)
  })

  it('normalizes pho noodles ingredient to rice_noodles_cooked profile', () => {
    const [item] = normalizeItemsWithInternalTable([makeItem({ name: 'Pho noodles', portion: '100g' })])
    expect(item.calories).toBe(109)
    expect(item.protein_g).toBe(1.8)
    expect(item.carbs_g).toBe(24.9)
    expect(item.fat_g).toBe(0.2)
    expect(item.normalized_table_key).toBe('rice_noodles_cooked')
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
