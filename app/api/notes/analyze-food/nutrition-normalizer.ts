import type { NormalizedSource, NormalizedTableKey, NormalizationWarning } from '@/types/nutrition-normalization'

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
  normalized_table_key?: NormalizedTableKey
  normalized_source?: NormalizedSource
  normalization_version?: string
  normalization_confidence?: number
  normalization_warning?: NormalizationWarning
}

export const INTERNAL_NUTRITION_TABLE_VERSION = '2026-08-10.v5'

type FoodStandard = {
  key: NormalizedTableKey
  kcalPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  caloriesMode?: 'average' | 'table'
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
  {
    key: 'ripe_banana',
    kcalPer100g: 89,
    proteinPer100g: 1.1,
    carbsPer100g: 22.9,
    fatPer100g: 0.3,
    caloriesMode: 'table',
  },
  {
    key: 'boiled_egg',
    kcalPer100g: 155,
    proteinPer100g: 13,
    carbsPer100g: 1.1,
    fatPer100g: 11,
    caloriesMode: 'table',
  },
  {
    key: 'chicken_breast_cooked',
    kcalPer100g: 165,
    proteinPer100g: 31,
    carbsPer100g: 0,
    fatPer100g: 3.6,
    caloriesMode: 'table',
  },
  {
    key: 'white_bread',
    kcalPer100g: 266,
    proteinPer100g: 8.9,
    carbsPer100g: 49,
    fatPer100g: 3.2,
    caloriesMode: 'table',
  },
  {
    key: 'rolled_oats_dry',
    kcalPer100g: 389,
    proteinPer100g: 16.9,
    carbsPer100g: 66.3,
    fatPer100g: 6.9,
    caloriesMode: 'table',
  },
  {
    key: 'whole_milk',
    kcalPer100g: 61,
    proteinPer100g: 3.2,
    carbsPer100g: 4.8,
    fatPer100g: 3.3,
    caloriesMode: 'table',
  },
  {
    key: 'milk_tea',
    kcalPer100g: 70,
    proteinPer100g: 1,
    carbsPer100g: 11.5,
    fatPer100g: 2.2,
    caloriesMode: 'table',
  },
  {
    key: 'coffee_with_milk',
    kcalPer100g: 55,
    proteinPer100g: 1.5,
    carbsPer100g: 8,
    fatPer100g: 1.8,
    caloriesMode: 'table',
  },
  {
    key: 'plain_yogurt',
    kcalPer100g: 61,
    proteinPer100g: 3.5,
    carbsPer100g: 4.7,
    fatPer100g: 3.3,
    caloriesMode: 'table',
  },
  {
    key: 'sweet_potato_boiled',
    kcalPer100g: 86,
    proteinPer100g: 1.6,
    carbsPer100g: 20.1,
    fatPer100g: 0.1,
    caloriesMode: 'table',
  },
  {
    key: 'rice_noodles_cooked',
    kcalPer100g: 109,
    proteinPer100g: 1.8,
    carbsPer100g: 24.9,
    fatPer100g: 0.2,
    caloriesMode: 'table',
  },
  {
    key: 'pho_beef_bowl',
    kcalPer100g: 65,
    proteinPer100g: 4.7,
    carbsPer100g: 8.2,
    fatPer100g: 1.6,
    caloriesMode: 'table',
  },
  {
    key: 'bun_meat_bowl',
    kcalPer100g: 125,
    proteinPer100g: 6,
    carbsPer100g: 17,
    fatPer100g: 3.5,
    caloriesMode: 'table',
  },
  {
    key: 'banh_mi_filled',
    kcalPer100g: 275,
    proteinPer100g: 11,
    carbsPer100g: 34,
    fatPer100g: 10,
    caloriesMode: 'table',
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
  {
    key: 'ripe_banana',
    aliases: [
      'chuoi chin',
      'chuoi tieu chin',
      'chuoi cau chin',
      'ripe banana',
      'banana ripe',
      'banana',
    ],
    excludes: [
      'banana chips',
      'chuoi say',
      'fried banana',
      'chuoi chien',
      'banana bread',
      'banana cake',
      'banana muffin',
      'banana pie',
      'banana smoothie',
      'banana milkshake',
      'smoothie banana',
    ],
    confidence: 0.95,
  },
  {
    key: 'boiled_egg',
    aliases: [
      'trung luoc',
      'boiled egg',
      'hard boiled egg',
      'egg boiled',
    ],
    excludes: ['egg tart', 'trung ga non', 'fried egg', 'trung chien', 'egg mayo'],
    confidence: 0.95,
  },
  {
    key: 'chicken_breast_cooked',
    aliases: [
      'uc ga',
      'ga luoc',
      'ga hap',
      'chicken breast',
      'boiled chicken breast',
      'grilled chicken breast',
    ],
    excludes: ['ga ran', 'fried chicken', 'chicken skin', 'chicken wing'],
    confidence: 0.92,
  },
  {
    key: 'pho_beef_bowl',
    aliases: [
      'pho bo',
      'pho ga',
      'pho tai',
      'pho chin',
      'pho dac biet',
    ],
    excludes: ['banh pho', 'pho kho'],
    confidence: 0.9,
  },
  {
    key: 'bun_meat_bowl',
    aliases: [
      'bun bo',
      'bun cha',
      'bun thit nuong',
      'bun rieu',
      'bun mam',
    ],
    excludes: ['bun tuoi', 'bun kho'],
    confidence: 0.9,
  },
  {
    key: 'banh_mi_filled',
    aliases: [
      'banh mi thit',
      'banh mi kep',
      'banh mi op la',
      'banh mi cha',
    ],
    excludes: ['banh mi lat', 'sandwich bread', 'white bread'],
    confidence: 0.92,
  },
  {
    key: 'white_bread',
    aliases: [
      'banh mi sandwich',
      'sandwich bread',
      'white bread',
      'bread slice',
      'banh mi lat',
    ],
    excludes: ['banh mi thit', 'croissant', 'burger', 'pizza'],
    confidence: 0.88,
  },
  {
    key: 'rolled_oats_dry',
    aliases: [
      'yen mach',
      'rolled oats',
      'oats',
      'oatmeal dry',
    ],
    excludes: ['granola bar', 'oat milk'],
    confidence: 0.9,
  },
  {
    key: 'whole_milk',
    aliases: [
      'sua tuoi',
      'whole milk',
      'fresh milk',
      'full cream milk',
      'sua bo',
    ],
    excludes: ['sua dac', 'condensed milk', 'oat milk', 'soy milk', 'almond milk', 'milk tea', 'bubble tea', 'latte'],
    confidence: 0.9,
  },
  {
    key: 'milk_tea',
    aliases: [
      'tra sua',
      'milk tea',
      'bubble tea',
      'boba tea',
    ],
    excludes: ['oat milk tea', 'almond milk tea'],
    confidence: 0.92,
  },
  {
    key: 'coffee_with_milk',
    aliases: [
      'ca phe sua',
      'coffee with milk',
      'latte',
      'bac xiu',
    ],
    excludes: ['black coffee', 'americano'],
    confidence: 0.9,
  },
  {
    key: 'plain_yogurt',
    aliases: [
      'sua chua',
      'plain yogurt',
      'yogurt plain',
      'unsweetened yogurt',
    ],
    excludes: ['greek yogurt', 'sweetened yogurt', 'frozen yogurt'],
    confidence: 0.88,
  },
  {
    key: 'sweet_potato_boiled',
    aliases: [
      'khoai lang luoc',
      'sweet potato boiled',
      'boiled sweet potato',
      'khoai lang hap',
    ],
    excludes: ['khoai tay', 'french fries', 'sweet potato fries'],
    confidence: 0.93,
  },
  {
    key: 'rice_noodles_cooked',
    aliases: [
      'bun tuoi',
      'banh pho',
      'rice noodles',
      'pho noodles',
      'bun',
      'hu tieu',
    ],
    excludes: [
      'mi goi',
      'egg noodles',
      'instant noodles',
      'bun bo',
      'bun cha',
      'bun thit nuong',
      'pho bo',
      'pho ga',
      'banh mi',
    ],
    confidence: 0.82,
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

function parseQuantity(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')

  const mixedFraction = normalized.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixedFraction) {
    const whole = Number(mixedFraction[1])
    const numerator = Number(mixedFraction[2])
    const denominator = Number(mixedFraction[3])
    if (denominator === 0) return null
    const value = whole + numerator / denominator
    return Number.isFinite(value) && value > 0 ? value : null
  }

  const fraction = normalized.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (fraction) {
    const numerator = Number(fraction[1])
    const denominator = Number(fraction[2])
    if (denominator === 0) return null
    const value = numerator / denominator
    return Number.isFinite(value) && value > 0 ? value : null
  }

  const range = normalized.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/)
  if (range) {
    const min = Number(range[1])
    const max = Number(range[2])
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) return null
    const value = (Math.min(min, max) + Math.max(min, max)) / 2
    return value
  }

  const decimal = Number(normalized)
  return Number.isFinite(decimal) && decimal > 0 ? decimal : null
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
  source: 'explicit' | 'explicit_volume' | 'household'
}

const LIQUID_FOOD_KEYS: ReadonlySet<NormalizedTableKey> = new Set([
  'whole_milk',
  'milk_tea',
  'coffee_with_milk',
])

function isLiquidFoodKey(key: NormalizedTableKey): boolean {
  return LIQUID_FOOD_KEYS.has(key)
}

function extractVolumeMl(text: string): number | null {
  const normalized = normalizeText(text)

  const mlMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(ml|milliliter|milliliters)\b/)
  if (mlMatch) {
    const raw = Number(mlMatch[1].replace(',', '.'))
    if (Number.isFinite(raw) && raw > 0) return raw
  }

  return null
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

  if (key === 'ripe_banana') {
    return [
      { pattern: /(qua|trai|banana|chuoi)\b/, grams: 118 },
      { pattern: /(half|1\/2)\b/, grams: 59 },
    ]
  }

  if (key === 'boiled_egg') {
    return [
      { pattern: /(qua|egg|trung)\b/, grams: 50 },
      { pattern: /(long)\b/, grams: 17 },
    ]
  }

  if (key === 'chicken_breast_cooked') {
    return [
      { pattern: /(mieng|piece|pieces|uc|breast)\b/, grams: 120 },
    ]
  }

  if (key === 'white_bread') {
    return [
      { pattern: /(lat|slice|slices)\b/, grams: 30 },
      { pattern: /^(o|loaf)$/, grams: 400 },
    ]
  }

  if (key === 'rolled_oats_dry') {
    return [
      { pattern: /(muong|thia|spoon|tablespoon|tbsp)\b/, grams: 10 },
      { pattern: /(cup|coc)\b/, grams: 80 },
    ]
  }

  if (key === 'whole_milk') {
    return [
      { pattern: /(ml)\b/, grams: 1 },
      { pattern: /(ly|glass|coc|cup)\b/, grams: 240 },
    ]
  }

  if (key === 'milk_tea') {
    return [
      { pattern: /(ml)\b/, grams: 1 },
      { pattern: /(ly|glass|coc|cup)\b/, grams: 350 },
    ]
  }

  if (key === 'coffee_with_milk') {
    return [
      { pattern: /(ml)\b/, grams: 1 },
      { pattern: /(ly|glass|coc|cup)\b/, grams: 240 },
    ]
  }

  if (key === 'plain_yogurt') {
    return [
      { pattern: /(hop|cup|hu)\b/, grams: 100 },
      { pattern: /(muong|thia|spoon|tablespoon|tbsp)\b/, grams: 15 },
    ]
  }

  if (key === 'sweet_potato_boiled') {
    return [
      { pattern: /(cu|piece|mieng)\b/, grams: 120 },
    ]
  }

  if (key === 'rice_noodles_cooked') {
    return [
      { pattern: /(to|bat|bowl)\b/, grams: 250 },
      { pattern: /(vắt|vat|bundle)\b/, grams: 100 },
    ]
  }

  if (key === 'pho_beef_bowl') {
    return [
      { pattern: /(to|bat|bowl)\b/, grams: 550 },
    ]
  }

  if (key === 'bun_meat_bowl') {
    return [
      { pattern: /(to|bat|bowl)\b/, grams: 500 },
    ]
  }

  if (key === 'banh_mi_filled') {
    return [
      { pattern: /(o|cai|chiec|piece)\b/, grams: 180 },
    ]
  }

  return [
    { pattern: /(mieng|piece|pieces|slice|slices|lat)\b/, grams: 40 },
  ]
}

function extractHouseholdWeight(text: string, key: FoodStandard['key']): number | null {
  const normalized = normalizeText(text)
  const quantityMatch = normalized.match(/(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?)\s*([a-z]+)/i)
  if (!quantityMatch) return null

  const quantity = parseQuantity(quantityMatch[1])
  if (!quantity) return null

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

  if (isLiquidFoodKey(key)) {
    const explicitVolumeMl = extractVolumeMl(item.portion) ?? extractVolumeMl(item.name)
    if (explicitVolumeMl) {
      return {
        // Assume 1 ml ~= 1 g for drink-like normalization.
        grams: explicitVolumeMl,
        confidence: 0.95,
        source: 'explicit_volume',
      }
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
  const calories = standard.caloriesMode === 'table'
    ? kcalFromTable
    : Math.round((kcalFromMacros + kcalFromTable) / 2)

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
