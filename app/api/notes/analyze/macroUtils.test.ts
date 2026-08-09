import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MACRO_TARGETS,
  getMacroTargets,
  parseLegacyMacroTargets,
  resolveTargetsByDate,
} from './macroUtils'
import type { MacroTargetRow } from './macroUtils'

describe('getMacroTargets', () => {
  it('returns defaults when called with no argument', () => {
    expect(getMacroTargets()).toEqual(DEFAULT_MACRO_TARGETS)
  })

  it('returns defaults when called with an empty object', () => {
    expect(getMacroTargets({})).toEqual(DEFAULT_MACRO_TARGETS)
  })

  it('accepts valid numeric overrides', () => {
    expect(getMacroTargets({ protein: 150, carbs: 300, fat: 60 })).toEqual({
      protein: 150,
      carbs: 300,
      fat: 60,
    })
  })

  it('falls back to default for zero values', () => {
    expect(getMacroTargets({ protein: 0 })).toEqual(DEFAULT_MACRO_TARGETS)
  })

  it('falls back to default for negative values', () => {
    expect(getMacroTargets({ carbs: -10 })).toEqual(DEFAULT_MACRO_TARGETS)
  })

  it('falls back to default for values exceeding cap (10 000)', () => {
    expect(getMacroTargets({ fat: 10_001 })).toEqual(DEFAULT_MACRO_TARGETS)
  })

  it('falls back to default for NaN', () => {
    expect(getMacroTargets({ protein: NaN })).toEqual(DEFAULT_MACRO_TARGETS)
  })

  it('falls back to default for non-numeric values', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getMacroTargets({ protein: 'abc' as any })).toEqual(DEFAULT_MACRO_TARGETS)
  })

  it('accepts boundary value exactly at cap (10 000)', () => {
    expect(getMacroTargets({ protein: 10_000 })).toMatchObject({ protein: 10_000 })
  })
})

// ─── helpers for resolveTargetsByDate tests ─────────────────────────────────

function row(date: string, protein: number, carbs: number, fat: number): MacroTargetRow {
  return { date, protein_g: protein, carbs_g: carbs, fat_g: fat }
}

describe('resolveTargetsByDate', () => {
  it('returns defaults for all dates when no target rows exist', () => {
    const result = resolveTargetsByDate(['2026-08-01', '2026-08-02'], [])
    expect(result['2026-08-01']).toEqual(DEFAULT_MACRO_TARGETS)
    expect(result['2026-08-02']).toEqual(DEFAULT_MACRO_TARGETS)
  })

  it('applies the only snapshot to all dates on or after it', () => {
    const result = resolveTargetsByDate(
      ['2026-08-01', '2026-08-05', '2026-08-10'],
      [row('2026-08-05', 150, 300, 60)],
    )
    expect(result['2026-08-01']).toEqual(DEFAULT_MACRO_TARGETS)   // before snapshot
    expect(result['2026-08-05']).toMatchObject({ protein: 150 })  // on snapshot day
    expect(result['2026-08-10']).toMatchObject({ protein: 150 })  // after snapshot
  })

  it('carries the last active target forward when multiple snapshots exist', () => {
    const result = resolveTargetsByDate(
      ['2026-08-01', '2026-08-10', '2026-08-20', '2026-08-25'],
      [
        row('2026-08-10', 130, 350, 55),
        row('2026-08-20', 160, 400, 65),
      ],
    )
    expect(result['2026-08-01']).toEqual(DEFAULT_MACRO_TARGETS)
    expect(result['2026-08-10']).toMatchObject({ protein: 130, carbs: 350 })
    expect(result['2026-08-20']).toMatchObject({ protein: 160, carbs: 400 })
    expect(result['2026-08-25']).toMatchObject({ protein: 160, carbs: 400 }) // carry-forward
  })

  it('does not mutate the input targetRows array', () => {
    const rows = [row('2026-08-10', 130, 350, 55), row('2026-08-01', 100, 300, 50)]
    const copy = rows.map(r => ({ ...r }))
    resolveTargetsByDate(['2026-08-01', '2026-08-10'], rows)
    expect(rows).toEqual(copy)
  })

  it('handles baseline row that pre-dates all food dates', () => {
    // Simulates: macroBaselineRes = 1 row from before period.from
    const result = resolveTargetsByDate(
      ['2026-08-01', '2026-08-15'],
      [row('2026-07-25', 120, 360, 58)],  // before period
    )
    expect(result['2026-08-01']).toMatchObject({ protein: 120 })
    expect(result['2026-08-15']).toMatchObject({ protein: 120 })
  })

  it('returns an entry for every supplied date', () => {
    const dates = ['2026-08-01', '2026-08-02', '2026-08-03']
    const result = resolveTargetsByDate(dates, [])
    expect(Object.keys(result).sort()).toEqual(dates.sort())
  })
})

describe('parseLegacyMacroTargets', () => {
  it('returns defaults for null (no key in localStorage)', () => {
    expect(parseLegacyMacroTargets(null)).toEqual(DEFAULT_MACRO_TARGETS)
  })

  it('returns defaults for empty string', () => {
    expect(parseLegacyMacroTargets('')).toEqual(DEFAULT_MACRO_TARGETS)
  })

  it('returns defaults for invalid JSON', () => {
    expect(parseLegacyMacroTargets('{not json')).toEqual(DEFAULT_MACRO_TARGETS)
  })

  it('returns defaults for empty JSON object', () => {
    expect(parseLegacyMacroTargets('{}')).toEqual(DEFAULT_MACRO_TARGETS)
  })

  it('parses valid stored targets', () => {
    const raw = JSON.stringify({ protein: 150, carbs: 300, fat: 60 })
    expect(parseLegacyMacroTargets(raw)).toEqual({ protein: 150, carbs: 300, fat: 60 })
  })

  it('falls back per-field for zero or negative values', () => {
    const raw = JSON.stringify({ protein: 0, carbs: -5, fat: 60 })
    expect(parseLegacyMacroTargets(raw)).toEqual({
      protein: DEFAULT_MACRO_TARGETS.protein,
      carbs:   DEFAULT_MACRO_TARGETS.carbs,
      fat:     60,
    })
  })

  it('falls back per-field for non-numeric values', () => {
    const raw = JSON.stringify({ protein: 'abc', carbs: 300, fat: null })
    expect(parseLegacyMacroTargets(raw)).toEqual({
      protein: DEFAULT_MACRO_TARGETS.protein,
      carbs:   300,
      fat:     DEFAULT_MACRO_TARGETS.fat,
    })
  })
})
