export interface Post {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string
  published: boolean
  created_at: string
  updated_at: string
  tags?: Tag[]
}

export interface Tag {
  id: string
  name: string
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
  created_at: string
}

export interface Quote {
  id: string
  content: string
  author?: string
  created_at: string
}
