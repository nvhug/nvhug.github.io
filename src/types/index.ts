export type UserRole = 'admin' | 'paid' | 'user'

export interface UserProfile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
}

export interface PagePermission {
  id: string
  page_key: string
  role: UserRole
  allowed: boolean
}

export interface Post {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string
  published: boolean
  template?: string
  user_id?: string
  created_at: string
  updated_at: string
  tags?: Tag[]
}

export interface Tag {
  id: string
  name: string
  user_id?: string
}

export interface PostTag {
  post_id: string
  tag_id: string
}

export interface Comment {
  id: string
  post_id: string
  author: string
  content: string
  created_at: string
}

export interface Like {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

export interface Note {
  id: string
  note_date: string
  content: string
  type: 'good' | 'bad'
  status: 'done' | 'in_progress'
  priority?: number
  completion_percentage?: number
  tags?: string[]
  hide_meta?: boolean
  pinned?: boolean
  notify_times?: string[]
  created_at: string
}

export interface Todo {
  id: string
  content: string
  is_done: boolean
  priority?: number
  created_at: string
  updated_at: string
}

export interface BuyPick {
  id: string
  user_id: string
  category: string
  emoji: string
  brands: string[]
  note?: string
  order_index: number
  purchase_count: number
  created_at: string
  updated_at: string
}

export interface Quote {
  id: string
  content: string
  author?: string
  created_at: string
}

export interface CalendarEvent {
  id: string
  user_id: string
  title: string
  description?: string
  date: string         // YYYY-MM-DD
  start_time: string   // HH:MM
  end_time: string     // HH:MM
  color: string        // preset color id
  recurrence_id?: string
  is_recurring: boolean
  created_at: string
  updated_at: string
}

export interface Goal {
  id: string
  title: string
  type: string // 'health', 'learning', 'fitness', etc.
  description?: string
  start_date?: string
  target_date?: string
  status: 'active' | 'completed' | 'archived'
  completion_percentage?: number
  created_at: string
  updated_at?: string
}

export interface GoalItem {
  id: string
  goal_id: string
  content: string
  item_type: string // 'meal', 'routine', 'lesson', 'exercise', etc.
  metadata?: Record<string, unknown> // JSON: { calories, duration, reps, etc. }
  result?: string // Kết quả sau khi hoàn thành
  is_completed?: boolean
  order?: number // For drag-drop sorting
  created_at: string
  updated_at?: string
}

export interface GymLog {
  id: string
  user_id: string
  log_date: string
  exercise: string
  muscle_group?: string
  sets: number
  reps: string
  weight_kg?: number
  note?: string
  order_index: number
  created_at: string
}

export interface GymVideo {
  id: string
  user_id: string
  source_url: string
  platform: 'youtube' | 'tiktok' | 'facebook'
  video_id?: string
  note?: string
  backup_storage_path?: string
  backup_public_url?: string
  created_at: string
  updated_at?: string
}

export interface FoodTemplate {
  id: string
  name: string
  calories_per_unit: number
  unit: string // 'g', 'chén', 'quả', 'lát', etc.
  category?: string
  created_at: string
}

export interface DailyFood {
  id: string
  date: string
  food_template_id?: string
  custom_food_name?: string
  quantity: number
  unit?: string
  total_calories: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface WeightLog {
  id: string
  date: string
  weight: number
  notes?: string
  created_at: string
}

export interface BowelLog {
  id: string
  date: string
  time?: string
  count: number
  stool_type: 'hard' | 'normal' | 'soft' | 'loose' | 'watery'
  notes?: string
  created_at: string
}

export interface Meal {
  id: string
  date: string
  meal_type: string // 'breakfast', 'mid_morning', 'lunch', 'afternoon', 'dinner'
  time: string // 'HH:MM' format like "07:00"
  name: string // 'Bữa sáng', 'Sáng muộn', etc.
  target_calories: number
  foods: string[] // Array of food items like ["Cơm 150g", "Trứng luộc 2"]
  notes?: string
  is_completed: boolean
  completed_at?: string
  created_at: string
  updated_at: string
}
