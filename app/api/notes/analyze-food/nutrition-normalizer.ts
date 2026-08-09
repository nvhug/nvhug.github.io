export interface NutritionItem {
  name: string
  portion: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  confidence: number
  assumptions: string
  normalized_by_internal_table?: boolean
  normalized_table_key?: 'white_rice' | 'tofu_plain' | 'tofu_fried' | 'braised_fish'
  normalized_source?: 'internal_table'
  normalization_version?: string
  normalization_confidence?: number
  normalization_warning?: 'ambiguous_match' | 'household_unit_converted'
}

export const INTERNAL_NUTRITION_TABLE_VERSION = '2026-08-09.v3'

type FoodStandard = {
  key: 'white_rice' | 'tofu_plain' | 'tofu_fried' | 'braised_fish'
  kcalPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
}

type FoodMatcher = {
  key: FoodStandard['key']
  aliases: string[]
  excludes?: string[]
  confidence: number
}

const INTERNAL_FOOD_TABLE: FoodStandard[] = [
  {
    key: 'white_rice',
    kcalPer100g: 133,
    proteinPer100g: 2.6,
    carbsPer100g: 30,
    fatPer100g: 0.3,
  },
  {
    key: 'tofu_plain',
    kcalPer100g: 76,
    proteinPer100g: 8,
    carbsPer100g: 2,
    fatPer100g: 4,
  },
  {
    key: 'tofu_fried',
    kcalPer100g: 165,
    proteinPer100g: 13,
    carbsPer100g: 4,
    fatPer100g: 11,
  },
  {
    key: 'braised_fish',
    kcalPer100g: 137,
    proteinPer100g: 19,
    carbsPer100g: 3,
    fatPer100g: 5,
  },
]

const FOOD_MATCHERS: FoodMatcher[] = [
  {
    key: 'white_rice',
    aliases: [
      'com trang',
      'white rice',
      'plain rice',
      'steamed rice',
      'cooked rice',
    ],
    excludes: ['com chien', 'fried rice'],
    confidence: 0.93,
  },
  {
    key: 'tofu_fried',
    aliases: [
      'dau hu chien',
      'dau phu chien',
      'tofu fried',
      'fried tofu',
      'deep fried tofu',
      'tofu ran',
    ],
    excludes: ['nuoc duong', 'pudding', 'dessert', 'tofu pudding'],
    confidence: 0.92,
  },
  {
    key: 'tofu_plain',
    aliases: [
      'dau hu trang',
      'dau phu trang',
      'tofu plain',
      'plain tofu',
      'silken tofu',
      'boiled tofu',
      'steamed tofu',
    ],
    excludes: ['nuoc duong', 'pudding', 'dessert', 'tofu pudding'],
    confidence: 0.88,
  },
  {
    key: 'tofu_plain',
    aliases: [
      'dau hu',
      'dau phu',
      'tofu',
      'tau hu',
    ],
    excludes: ['nuoc duong', 'pudding', 'dessert', 'tofu pudding', 'chien', 'fried', 'ran'],
    confidence: 0.62,
  },
  {
    key: 'braised_fish',
    aliases: [
      'ca kho',
      'ca ram',
      'ca kho to',
      'fish kho to',
      'braised fish',
      'caramelized fish',
    ],
    excludes: [
      'thit kho',
      'suon kho',
      'ga kho',
      'heo kho',
      'bo kho',
      'fish sauce',
      'nuoc mam',
      'fish ball',
      'ca vien',
    ],
    confidence: 0.9,
  },
]

const STANDARD_BY_KEY = INTERNAL_FOOD_TABLE.reduce<Record<FoodStandard['key'], FoodStandard>>(
  (acc, row) => {
    acc[row.key] = row
    return acc
  },
  {} as Record<FoodStandard['key'], FoodStandard>
)

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function caloriesFromMacros(protein: number, carbs: number, fat: number): number {
  return protein * 4 + carbs * 4 + fat * 9
}

function extractWeightGrams(text: string): number | null {
  const normalized = normalizeText(text)

  const gramMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gram|grams|gam)\b/)
  if (gramMatch) {
    const raw = Number(gramMatch[1].replace(',', '.'))
    if (Number.isFinite(raw) && raw > 0) return raw
  }

  const kgMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilogram|kilograms)\b/)
  if (kgMatch) {
    const raw = Number(kgMatch[1].replace(',', '.'))
    if (Number.isFinite(raw) && raw > 0) return raw * 1000
  }

  return null
}

type PortionWeight = {
  grams: number
  confidence: number
  source: 'explicit' | 'household'
}

function unitWeightByFoodKey(key: FoodStandard['key']): Array<{ pattern: RegExp; grams: number }> {
  if (key === 'white_rice') {
    return [
      { pattern: /(chen|bat|to|bowl)\b/, grams: 160 },
      { pattern: /(muong|thia|spoon|tablespoon|tbsp)\b/, grams: 15 },
    ]
  }

  if (key === 'tofu_plain' || key === 'tofu_fried') {
    return [
      { pattern: /(mieng|piece|pieces|cube|cubes)\b/, grams: 30 },
      { pattern: /(block|slab)\b/, grams: 100 },
    ]
  }

  return [
    { pattern: /(mieng|piece|pieces|slice|slices|lat)\b/, grams: 40 },
  ]
}

function extractHouseholdWeight(text: string, key: FoodStandard['key']): number | null {
  const normalized = normalizeText(text)
  const quantityMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*([a-z\u00c0-\u1ef9]+)/i)
  if (!quantityMatch) return null

  const quantity = Number(quantityMatch[1].replace(',', '.'))
  if (!Number.isFinite(quantity) || quantity <= 0) return null

  const unit = quantityMatch[2]
  for (const candidate of unitWeightByFoodKey(key)) {
    if (candidate.pattern.test(unit)) {
      return quantity * candidate.grams
    }
  }

  return null
}

function resolvePortionWeight(item: NutritionItem, key: FoodStandard['key']): PortionWeight | null {
  const explicit = extractWeightGrams(item.portion) ?? extractWeightGrams(item.name)
  if (explicit) {
    return {
      grams: explicit,
      confidence: 0.95,
      source: 'explicit',
    }
  }

  const household = extractHouseholdWeight(item.portion, key) ?? extractHouseholdWeight(item.name, key)
  if (household) {
    return {
      grams: household,
      confidence: 0.75,
      source: 'household',
    }
  }

  return null
}

function matchesAlias(text: string, matcher: FoodMatcher): boolean {
  const hasAlias = matcher.aliases.some((alias) => text.includes(alias))
  if (!hasAlias) return false
  if (!matcher.excludes?.length) return true
  return !matcher.excludes.some((keyword) => text.includes(keyword))
}

function resolveStandard(name: string): { standard: FoodStandard; aliasConfidence: number } | null {
  const n = normalizeText(name)

  for (const matcher of FOOD_MATCHERS) {
    if (matchesAlias(n, matcher)) {
      return {
        standard: STANDARD_BY_KEY[matcher.key],
        aliasConfidence: matcher.confidence,
      }
    }
  }

  return null
}

function normalizeOne(item: NutritionItem): NutritionItem {
  const matched = resolveStandard(item.name)
  if (!matched) return item

  const { standard, aliasConfidence } = matched

  const portion = resolvePortionWeight(item, standard.key)
  if (!portion) return item

  const overallConfidence = round2(aliasConfidence * portion.confidence)
  const shouldNormalize = overallConfidence >= 0.65

  if (!shouldNormalize) {
    return {
      ...item,
      normalized_table_key: standard.key,
      normalization_confidence: overallConfidence,
      normalization_version: INTERNAL_NUTRITION_TABLE_VERSION,
      normalization_warning: 'ambiguous_match',
    }
  }

  const grams = portion.grams

  const ratio = grams / 100
  const protein = round1(standard.proteinPer100g * ratio)
  const carbs = round1(standard.carbsPer100g * ratio)
  const fat = round1(standard.fatPer100g * ratio)

  const kcalFromMacros = Math.round(caloriesFromMacros(protein, carbs, fat))
  const kcalFromTable = Math.round(standard.kcalPer100g * ratio)
  const calories = Math.round((kcalFromMacros + kcalFromTable) / 2)

  const marker = `[internal-table:${standard.key}:${Math.round(grams)}g]`
  const assumptions = item.assumptions?.includes(marker)
    ? item.assumptions
    : [item.assumptions?.trim(), `${marker}[v:${INTERNAL_NUTRITION_TABLE_VERSION}]`]
      .filter(Boolean)
      .join(' ')

  return {
    ...item,
    calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    assumptions,
    normalized_by_internal_table: true,
    normalized_table_key: standard.key,
    normalized_source: 'internal_table',
    normalization_version: INTERNAL_NUTRITION_TABLE_VERSION,
    normalization_confidence: overallConfidence,
    normalization_warning: portion.source === 'household'
      ? 'household_unit_converted'
      : undefined,
  }
}

export function normalizeItemsWithInternalTable(items: NutritionItem[]): NutritionItem[] {
  return items.map(normalizeOne)
}
