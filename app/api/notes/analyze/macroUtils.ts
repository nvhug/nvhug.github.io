export const DEFAULT_MACRO_TARGETS = { protein: 118, carbs: 375, fat: 73 }

export type MacroTargets = typeof DEFAULT_MACRO_TARGETS

export interface MacroTargetRow {
  date: string
  protein_g: number
  carbs_g: number
  fat_g: number
}

export function getMacroTargets(targets?: Partial<MacroTargets>): MacroTargets {
  const normalize = (value: unknown, fallback: number) => (
    typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 10_000 ? value : fallback
  )

  return {
    protein: normalize(targets?.protein, DEFAULT_MACRO_TARGETS.protein),
    carbs:   normalize(targets?.carbs,   DEFAULT_MACRO_TARGETS.carbs),
    fat:     normalize(targets?.fat,     DEFAULT_MACRO_TARGETS.fat),
  }
}

/**
 * Assigns each food date the macro target effective on that date (carry-forward).
 * Dates before the first snapshot receive DEFAULT_MACRO_TARGETS.
 */
export function resolveTargetsByDate(
  dailyDates: string[],
  targetRows: MacroTargetRow[],
): Record<string, MacroTargets> {
  const sorted = [...targetRows]
    .map(row => ({
      date:    row.date,
      targets: getMacroTargets({ protein: Number(row.protein_g), carbs: Number(row.carbs_g), fat: Number(row.fat_g) }),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const result: Record<string, MacroTargets> = {}
  let idx = 0
  let active = DEFAULT_MACRO_TARGETS as MacroTargets
  for (const date of [...dailyDates].sort()) {
    while (idx < sorted.length && sorted[idx].date <= date) {
      active = sorted[idx].targets
      idx++
    }
    result[date] = active
  }
  return result
}
