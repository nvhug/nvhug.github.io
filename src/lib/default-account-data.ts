/**
 * Starter content every new account receives (feature 009, FR-008 / FR-014).
 *
 * Pure by design: no Supabase import, no `new Date()`. The caller resolves
 * "today" in Vietnam local time and passes it in (FR-007, plan R6), which is
 * what makes every row here unit-testable against a fixed date.
 *
 * The Vietnamese strings are product content, not interface copy — the app is
 * bilingual but these are the user's own rows from the first moment, so they
 * are not translated (spec Assumptions).
 */

export interface SeedNoteRow {
  user_id: string
  note_date: string
  content: string
  type: 'good' | 'bad'
  status: 'in_progress'
  priority: number
  completion_percentage: number
  tags: string[]
  hide_meta: boolean
  pinned: boolean
}

export interface SeedTodoRow {
  user_id: string
  content: string
  is_done: boolean
}

export interface SeedBuyPickRow {
  user_id: string
  category: string
  emoji: string
  brands: string[]
  order_index: number
}

export interface SeedGymLogRow {
  user_id: string
  log_date: string
  exercise: string
  muscle_group: string
  sets: number
  reps: string
  order_index: number
}

export interface SeedWeightLogRow {
  user_id: string
  date: string
  weight: number
}

export interface SeedGoalRow {
  user_id: string
  title: string
  type: string
  description: string
  start_date: string
  target_date: string
  status: 'active'
  completion_percentage: number
}

export interface SeedCalendarEventRow {
  user_id: string
  title: string
  date: string
  start_time: string
  end_time: string
  color: string
  is_recurring: boolean
}

export interface SeedFundTransactionRow {
  user_id: string
  type: 'in' | 'out'
  amount: number
  who: string
  reason: string
  date: string
}

export interface SeedFundAssetRow {
  user_id: string
  name: string
  type: 'cash'
  amount: number
}

/**
 * A goal item before its parent goal exists. `goal_id` is deliberately absent —
 * the seeder fills it in from the id the `goals` insert returns.
 */
export interface SeedGoalItemRow {
  user_id: string
  content: string
  item_type: string
  is_completed: boolean
  order: number
}

export interface DefaultAccountRows {
  notes: SeedNoteRow[]
  todos: SeedTodoRow[]
  buy_picks: SeedBuyPickRow[]
  gym_logs: SeedGymLogRow[]
  weight_logs: SeedWeightLogRow[]
  goals: SeedGoalRow[]
  calendar_events: SeedCalendarEventRow[]
  fund_transactions: SeedFundTransactionRow[]
  fund_assets: SeedFundAssetRow[]
}

const HABITS = [
  'Ăn chậm nhai kỹ, uống đủ nước',
  'Tập thể dục đều đặn, ngủ đủ giấc',
  'Duy trì tinh thần tích cực, tránh căng thẳng',
  'Không sử dụng chất kích thích, hạn chế đồ ngọt',
  'Không bao giờ bỏ bữa, ăn đúng giờ',
]

const GOOD_NOTES = [
  'Giúp đỡ người khác khi có thể',
  'Tham gia các hoạt động tình nguyện',
  'Tôn trọng và lắng nghe ý kiến của người khác',
]

const BAD_NOTES = [
  'Trì hoãn công việc, không hoàn thành đúng hạn',
  'Ăn sau 8 giờ tối, ăn vặt nhiều',
  'Ăn đồ ngọt, ăn nhanh, uống ít nước',
]

const TODOS = [
  'Hoàn thành báo cáo công việc trước hạn',
  'Dọn dẹp nhà cửa, giữ gìn vệ sinh',
  'Lên kế hoạch cho tuần tới, đặt mục tiêu cụ thể',
]

/**
 * `category` and `brands` are separate columns and `category` renders
 * `truncate` — so the spec's "Sạc — Anker A121D" is split, not stored whole.
 * `emoji` is NOT NULL and rendered inline next to the category.
 */
const BUY_PICKS = [
  { category: 'Sạc', emoji: '🔌', brands: ['Anker A121D'] },
  { category: 'Điện thoại', emoji: '📱', brands: ['iPhone 17 Pro Max'] },
  { category: 'AirPods', emoji: '🎧', brands: ['Soundcore Liberty 4 NC'] },
]

/** Authored beginner entries — no dependency on any account's workout history (FR-013). */
const GYM_LOGS = [
  { exercise: 'Squat với trọng lượng cơ thể', muscle_group: 'Chân', sets: 3, reps: '12' },
  { exercise: 'Chống đẩy', muscle_group: 'Ngực', sets: 3, reps: '10' },
  { exercise: 'Plank giữ thẳng người', muscle_group: 'Cơ bụng', sets: 3, reps: '30 giây' },
]

/**
 * Days before today, paired with the weight recorded on that day.
 *
 * Descending toward today, so the trend agrees with the first starter goal
 * ("Giảm 5kg") and with the tracker's own START -> TARGET direction. Ordered
 * newest first, which is how the tracker reads them back.
 *
 * Spaced a week apart, not a day: three consecutive days falling 70 -> 66 kg is
 * 14 kg/week, which is not a plausible reading and which the AI Insights prompt
 * would hand the model against its stated 0.25-0.5 kg/week target. At this
 * spacing the rate is 0.6 kg/week — the same rate the "5 kg in 2 months" goal
 * itself implies — and the card opens at 24% rather than 80% on day one.
 */
const WEIGHT_HISTORY = [
  { daysAgo: 7, weight: 68.8 },
  { daysAgo: 14, weight: 69.4 },
  { daysAgo: 21, weight: 70 },
]

const GOALS = [
  {
    title: 'Giảm 5kg trong 2 tháng tới',
    type: 'health',
    description: 'Giảm cân đều đặn bằng chế độ ăn hợp lý và vận động mỗi ngày.',
    daysToTarget: 60,
  },
  {
    title: 'Tăng cường sức khỏe tim mạch bằng cách tập thể dục ít nhất 30 phút mỗi ngày',
    type: 'fitness',
    description: 'Duy trì vận động vừa sức mỗi ngày để cải thiện sức bền tim mạch.',
    daysToTarget: 90,
  },
  {
    title: 'Ngủ trước 23 giờ và ngủ đủ 7 tiếng mỗi ngày trong 1 tháng',
    type: 'health',
    description: 'Đi ngủ và thức dậy đúng giờ để cơ thể phục hồi tốt hơn.',
    daysToTarget: 30,
  },
]

/**
 * Times and colours are not in the spec — they come from the DESIGN gate. Each
 * title names its time of day, so the slot has to agree with it. Colours are
 * `EVENT_COLORS` ids (CalendarView.tsx:22-33), never raw hex: `colorById`
 * falls back to emerald for an unknown id, so a typo would fail silently.
 */
const CALENDAR_EVENTS = [
  {
    title: 'Tập gym 1 giờ vào buổi sáng',
    daysFromToday: 0,
    start_time: '06:00',
    end_time: '07:00',
    color: 'emerald',
  },
  {
    title: 'Chạy bộ 5km vào buổi chiều',
    daysFromToday: 1,
    start_time: '17:00',
    end_time: '18:00',
    color: 'blue',
  },
  {
    title: 'Đi bộ nhẹ và giãn cơ 30 phút vào buổi sáng',
    daysFromToday: 2,
    start_time: '09:00',
    end_time: '10:00',
    color: 'amber',
  },
]

const FUND_OWNER = 'Chủ tài khoản'
const STARTER_INCOME = 15_000_000
const STARTER_SPENDING = 10_000_000

/** Sub-items for the first goal only — an itemless goal is a normal state (FR-008a). */
const FIRST_GOAL_ITEMS = [
  { content: 'Tập cardio 30 phút, 5 buổi mỗi tuần', item_type: 'exercise' },
  { content: 'Ăn đủ 3 bữa, giảm tinh bột vào buổi tối', item_type: 'meal' },
  { content: 'Cân và ghi lại cân nặng mỗi tuần', item_type: 'routine' },
]

/**
 * The owner's existing articles that every new account receives a private copy
 * of (FR-011). Matched by exact title.
 *
 * Split by destination because only the health pair needs a `post_tags` link to
 * the account's own "Sức Khỏe" tag — the blog three are found by the blog page
 * without any tag (FR-011a).
 */
export const SOURCE_POST_TITLES = {
  health: [
    'Gan và thận có thể tự phục hồi?',
    'Miệng là bước đầu tiên và rất quan trọng của quá trình tiêu hóa',
  ],
  blog: [
    'Dù trời có sập cũng hãy giữ tâm thế bình thản',
    '7 cảnh giới làm người của Lão Tử – Càng sống càng thấy đúng',
    'Nhân sinh tại thế – Đừng vội vàng, đừng so đo, hãy sống thiện lương',
  ],
} as const

/**
 * Prefixes identifying the three source quotes (FR-012).
 *
 * Prefixes rather than full text because the spec quotes them truncated with an
 * ellipsis, so there is no exact string to match. Each prefix is deliberately
 * **comma-free**: they go into one PostgREST `.or(...)` filter, where a comma
 * separates conditions and would split the value.
 */
export const SOURCE_QUOTE_PREFIXES = [
  'Đời người như dòng nước',
  'Hoa nở một mùa',
  'Hạnh phúc không phải là điều sẵn có',
] as const

/**
 * The tag the Health tab filters on. `normalizeHealthTagName` strips diacritics
 * and lowercases, so this matches the `suc khoe` alias in
 * `app/notes/_lib/healthTags.ts`.
 */
export const HEALTH_TAG_NAME = 'Sức Khỏe'

/**
 * Shift a `YYYY-MM-DD` date by whole days.
 *
 * Deliberately UTC-only arithmetic: the input is a calendar date already
 * resolved in Vietnam local time, so re-interpreting it through the server's
 * own timezone (which is UTC on Vercel) would shift it by a day.
 */
function shiftISODate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  const yyyy = shifted.getUTCFullYear()
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(shifted.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function habitRow(userId: string, today: string, content: string): SeedNoteRow {
  return {
    user_id: userId,
    note_date: today,
    content,
    type: 'good',
    status: 'in_progress',
    priority: 5,
    completion_percentage: 0,
    tags: [],
    hide_meta: true,
    pinned: true,
  }
}

function journalRow(
  userId: string,
  today: string,
  content: string,
  type: 'good' | 'bad',
): SeedNoteRow {
  return {
    user_id: userId,
    note_date: today,
    content,
    type,
    status: 'in_progress',
    priority: 3,
    completion_percentage: 0,
    tags: [],
    hide_meta: false,
    pinned: false,
  }
}

/**
 * Every starter row for one account, keyed by table. `meals` is absent on
 * purpose — the meal plan reaches the account through the app's own default
 * daily plan, not through seeding (FR-010a).
 */
export function buildDefaultAccountRows(userId: string, today: string): DefaultAccountRows {
  return {
    notes: [
      ...HABITS.map((content) => habitRow(userId, today, content)),
      ...GOOD_NOTES.map((content) => journalRow(userId, today, content, 'good')),
      ...BAD_NOTES.map((content) => journalRow(userId, today, content, 'bad')),
    ],
    todos: TODOS.map((content) => ({ user_id: userId, content, is_done: false })),
    buy_picks: BUY_PICKS.map((pick, index) => ({
      user_id: userId,
      category: pick.category,
      emoji: pick.emoji,
      brands: [...pick.brands],
      order_index: index,
    })),
    gym_logs: GYM_LOGS.map((log, index) => ({
      user_id: userId,
      log_date: today,
      exercise: log.exercise,
      muscle_group: log.muscle_group,
      sets: log.sets,
      reps: log.reps,
      order_index: index,
    })),
    weight_logs: WEIGHT_HISTORY.map((entry) => ({
      user_id: userId,
      date: shiftISODate(today, -entry.daysAgo),
      weight: entry.weight,
    })),
    goals: GOALS.map((goal) => ({
      user_id: userId,
      title: goal.title,
      type: goal.type,
      description: goal.description,
      start_date: today,
      target_date: shiftISODate(today, goal.daysToTarget),
      status: 'active' as const,
      completion_percentage: 0,
    })),
    calendar_events: CALENDAR_EVENTS.map((event) => ({
      user_id: userId,
      title: event.title,
      date: shiftISODate(today, event.daysFromToday),
      start_time: event.start_time,
      end_time: event.end_time,
      color: event.color,
      is_recurring: false,
    })),
    fund_transactions: [
      {
        user_id: userId,
        type: 'in' as const,
        amount: STARTER_INCOME,
        who: FUND_OWNER,
        reason: 'Thu nhập',
        date: today,
      },
      {
        user_id: userId,
        type: 'out' as const,
        amount: STARTER_SPENDING,
        who: FUND_OWNER,
        reason: 'Chi tiêu',
        date: today,
      },
    ],
    // The holding is income minus spending, so the finance page reconciles (FR-015).
    fund_assets: [
      {
        user_id: userId,
        name: 'Tiết kiệm',
        type: 'cash' as const,
        amount: STARTER_INCOME - STARTER_SPENDING,
      },
    ],
  }
}

/**
 * Sub-items for the first starter goal. Returned without `goal_id`: the goal's
 * id does not exist until it has been inserted, so the seeder attaches it.
 */
export function buildFirstGoalItems(userId: string): SeedGoalItemRow[] {
  return FIRST_GOAL_ITEMS.map((item, index) => ({
    user_id: userId,
    content: item.content,
    item_type: item.item_type,
    is_completed: false,
    order: index,
  }))
}

/**
 * A per-account address for a copied post. `posts.slug` is globally UNIQUE, so
 * a straight copy collides on the second account; suffixing with the account id
 * is deterministic and collision-free (FR-011a).
 */
export function buildCopiedPostSlug(sourceSlug: string, userId: string): string {
  return `${sourceSlug}-${userId.slice(0, 8)}`
}
