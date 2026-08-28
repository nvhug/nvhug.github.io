import { describe, expect, it } from 'vitest'
import {
  buildCopiedPostSlug,
  buildDefaultAccountRows,
  buildFirstGoalItems,
} from './default-account-data'

const USER = '9f8c1b2a-3d4e-4f56-8a7b-0c1d2e3f4a5b'
const TODAY = '2026-03-05'

/** The eight `EVENT_COLORS` ids in CalendarView.tsx:22-33. */
const EVENT_COLOR_IDS = ['emerald', 'blue', 'violet', 'rose', 'amber', 'cyan', 'orange', 'slate']

describe('buildDefaultAccountRows — counts (FR-008)', () => {
  const rows = buildDefaultAccountRows(USER, TODAY)

  it('creates 11 notes: 5 pinned habits, 3 good, 3 bad', () => {
    expect(rows.notes).toHaveLength(11)
    expect(rows.notes.filter((n) => n.pinned)).toHaveLength(5)
    const unpinned = rows.notes.filter((n) => !n.pinned)
    expect(unpinned.filter((n) => n.type === 'good')).toHaveLength(3)
    expect(unpinned.filter((n) => n.type === 'bad')).toHaveLength(3)
  })

  it('creates 3 todos, 3 buy picks, 3 gym logs, 3 weight logs, 3 goals, 3 calendar events', () => {
    expect(rows.todos).toHaveLength(3)
    expect(rows.buy_picks).toHaveLength(3)
    expect(rows.gym_logs).toHaveLength(3)
    expect(rows.weight_logs).toHaveLength(3)
    expect(rows.goals).toHaveLength(3)
    expect(rows.calendar_events).toHaveLength(3)
  })

  it('creates 2 fund transactions and 1 fund asset', () => {
    expect(rows.fund_transactions).toHaveLength(2)
    expect(rows.fund_assets).toHaveLength(1)
  })

  it('never builds meal rows — the meal plan is the app default, not seeded (FR-010a)', () => {
    expect(rows).not.toHaveProperty('meals')
  })
})

describe('buildDefaultAccountRows — ownership (FR-006)', () => {
  it('stamps the given user_id on every row of every table', () => {
    const rows = buildDefaultAccountRows(USER, TODAY)
    const all = Object.values(rows).flat()
    expect(all.length).toBeGreaterThan(0)
    for (const row of all) {
      expect(row).toHaveProperty('user_id', USER)
    }
  })
})

describe('buildDefaultAccountRows — dates relative to the given today (FR-007)', () => {
  const rows = buildDefaultAccountRows(USER, TODAY)

  it('dates habits and notes today', () => {
    for (const note of rows.notes) expect(note.note_date).toBe(TODAY)
  })

  it('dates gym logs today', () => {
    for (const log of rows.gym_logs) expect(log.log_date).toBe(TODAY)
  })

  it('records three weekly weigh-ins before today, descending toward today', () => {
    expect(rows.weight_logs).toEqual([
      expect.objectContaining({ date: '2026-02-26', weight: 68.8 }),
      expect.objectContaining({ date: '2026-02-19', weight: 69.4 }),
      expect.objectContaining({ date: '2026-02-12', weight: 70 }),
    ])
  })

  it('loses at a rate the goal itself implies, not 14 kg a week', () => {
    // Newest first, so chronological order is the reverse.
    const chronological = [...rows.weight_logs].reverse()
    const spanDays =
      (Date.parse(chronological[chronological.length - 1].date) -
        Date.parse(chronological[0].date)) /
      86_400_000
    const lost = chronological[0].weight - chronological[chronological.length - 1].weight
    const perWeek = (lost / spanDays) * 7
    // The starter goal is 5 kg in ~2 months, i.e. ~0.6 kg/week.
    expect(perWeek).toBeGreaterThan(0.2)
    expect(perWeek).toBeLessThan(1)
  })

  it('trends downward, so the chart agrees with the lose-weight starter goal', () => {
    // Ordered newest first. Read chronologically the weight must fall, or the
    // tracker draws a line moving away from its own target.
    const chronological = [...rows.weight_logs].reverse().map((w) => w.weight)
    for (let i = 1; i < chronological.length; i += 1) {
      expect(chronological[i]).toBeLessThan(chronological[i - 1])
    }
  })

  it('schedules calendar events on today, tomorrow, and the day after', () => {
    expect(rows.calendar_events.map((e) => e.date)).toEqual([
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
    ])
  })

  it('crosses a month boundary correctly rather than producing day 0 or 32', () => {
    const rows = buildDefaultAccountRows(USER, '2026-03-01')
    expect(rows.weight_logs.map((w) => w.date)).toEqual([
      '2026-02-22',
      '2026-02-15',
      '2026-02-08',
    ])
  })

  it('handles a leap day without drifting', () => {
    // 2024-03-07 minus 7 days lands exactly on 29 February.
    const rows = buildDefaultAccountRows(USER, '2024-03-07')
    expect(rows.weight_logs[0].date).toBe('2024-02-29')
  })

  it('starts every goal today with a target date in the future', () => {
    for (const goal of rows.goals) {
      expect(goal.start_date).toBe(TODAY)
      expect(goal.target_date > TODAY).toBe(true)
    }
  })
})

describe('buildDefaultAccountRows — buy picks are split, not one string (DESIGN)', () => {
  const rows = buildDefaultAccountRows(USER, TODAY)

  it('puts the product in brands[], never the whole label in category', () => {
    expect(rows.buy_picks[0].category).toBe('Sạc')
    expect(rows.buy_picks[0].brands).toEqual(['Anker A121D'])
    for (const pick of rows.buy_picks) {
      expect(pick.category).not.toContain('—')
      expect(pick.brands.length).toBeGreaterThan(0)
    }
  })

  it('gives every pick a non-empty emoji — the column is NOT NULL and rendered inline', () => {
    for (const pick of rows.buy_picks) {
      expect(pick.emoji.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('buildDefaultAccountRows — calendar times and colours (DESIGN)', () => {
  const rows = buildDefaultAccountRows(USER, TODAY)

  it('gives every event a start and end time, end after start', () => {
    for (const event of rows.calendar_events) {
      expect(event.start_time).toMatch(/^\d{2}:\d{2}$/)
      expect(event.end_time).toMatch(/^\d{2}:\d{2}$/)
      expect(event.end_time > event.start_time).toBe(true)
    }
  })

  it('uses only known EVENT_COLORS ids — an unknown id falls back to emerald silently', () => {
    for (const event of rows.calendar_events) {
      expect(EVENT_COLOR_IDS).toContain(event.color)
    }
  })
})

describe('buildDefaultAccountRows — ordering and initial state', () => {
  const rows = buildDefaultAccountRows(USER, TODAY)

  it('numbers order_index from 0 without gaps where the table has one', () => {
    expect(rows.buy_picks.map((p) => p.order_index)).toEqual([0, 1, 2])
    expect(rows.gym_logs.map((g) => g.order_index)).toEqual([0, 1, 2])
  })

  it('leaves every todo undone and every goal active', () => {
    for (const todo of rows.todos) expect(todo.is_done).toBe(false)
    for (const goal of rows.goals) expect(goal.status).toBe('active')
  })

  it('marks the five habits as pinned good notes so they land in the habit area (FR-009)', () => {
    const habits = rows.notes.filter((n) => n.pinned)
    for (const habit of habits) {
      expect(habit.type).toBe('good')
      expect(habit.hide_meta).toBe(true)
    }
  })
})

describe('buildDefaultAccountRows — finance reconciles (FR-015)', () => {
  const rows = buildDefaultAccountRows(USER, TODAY)

  it('records 15,000,000 in and 10,000,000 out', () => {
    const income = rows.fund_transactions.find((t) => t.type === 'in')
    const spending = rows.fund_transactions.find((t) => t.type === 'out')
    expect(income?.amount).toBe(15_000_000)
    expect(spending?.amount).toBe(10_000_000)
  })

  it('holds exactly income minus spending as cash', () => {
    const income = rows.fund_transactions
      .filter((t) => t.type === 'in')
      .reduce((sum, t) => sum + t.amount, 0)
    const spending = rows.fund_transactions
      .filter((t) => t.type === 'out')
      .reduce((sum, t) => sum + t.amount, 0)
    const held = rows.fund_assets.reduce((sum, a) => sum + a.amount, 0)
    expect(held).toBe(income - spending)
  })

  it('fills who and reason, which the table requires NOT NULL', () => {
    for (const tx of rows.fund_transactions) {
      expect(tx.who.trim().length).toBeGreaterThan(0)
      expect(tx.reason.trim().length).toBeGreaterThan(0)
    }
  })

  it('records the holding as cash named Tiết kiệm', () => {
    expect(rows.fund_assets[0]).toEqual(
      expect.objectContaining({ type: 'cash', name: 'Tiết kiệm', amount: 5_000_000 }),
    )
  })
})

describe('buildFirstGoalItems — only the first goal carries items (FR-008a)', () => {
  it('returns two or three items', () => {
    const items = buildFirstGoalItems(USER)
    expect(items.length).toBeGreaterThanOrEqual(2)
    expect(items.length).toBeLessThanOrEqual(3)
  })

  it('leaves every item uncompleted and ordered from 0', () => {
    const items = buildFirstGoalItems(USER)
    for (const item of items) expect(item.is_completed).toBe(false)
    expect(items.map((i) => i.order)).toEqual(items.map((_, index) => index))
  })

  it('stamps user_id — goal_items has its own column, not ownership via the parent goal', () => {
    for (const item of buildFirstGoalItems(USER)) {
      expect(item.user_id).toBe(USER)
    }
  })

  it('omits goal_id, which does not exist until the goal is inserted', () => {
    for (const item of buildFirstGoalItems(USER)) {
      expect(item).not.toHaveProperty('goal_id')
    }
  })

  it('gives every item a non-empty content and item_type, both NOT NULL', () => {
    for (const item of buildFirstGoalItems(USER)) {
      expect(item.content.trim().length).toBeGreaterThan(0)
      expect(item.item_type.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('buildCopiedPostSlug — per-account addresses (FR-011a)', () => {
  it('suffixes the source slug with the first 8 characters of the account id', () => {
    expect(buildCopiedPostSlug('giu-tam-the-binh-than', USER)).toBe(
      'giu-tam-the-binh-than-9f8c1b2a',
    )
  })

  it('is stable for the same inputs', () => {
    const first = buildCopiedPostSlug('bai-viet', USER)
    const second = buildCopiedPostSlug('bai-viet', USER)
    expect(first).toBe(second)
  })

  it('gives two accounts different addresses for the same source post', () => {
    const other = '00112233-4455-6677-8899-aabbccddeeff'
    expect(buildCopiedPostSlug('bai-viet', USER)).not.toBe(buildCopiedPostSlug('bai-viet', other))
  })
})
