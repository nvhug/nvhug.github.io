import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Post } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// A seeded starter copy is byte-identical across every account (ADR-018), so it
// can never be made public — every account would end up publishing the same
// content. Enforced again at the DB layer: CHECK posts_seeded_copy_never_public
// (sql/28.blog_public_posts.sql). One predicate so the admin list's disabled
// toggle, its click handler, and PostForm's own display state can never drift
// from each other or from the constraint.
export function canPostBePublic(post: Pick<Post, "is_seeded_copy">): boolean {
  return !post.is_seeded_copy
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

const COMBINING_MARKS = new RegExp('[̀-ͯ]', 'g')

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/g, 'd')
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function truncateHtml(html: string, maxLength: number = 160): string {
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= maxLength) return text
  return text.substring(0, maxLength).trim() + '...'
}

const TAG_COLORS = [
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
]

export function getTagColor(tagName: string): (typeof TAG_COLORS)[0] {
  const hash = tagName
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return TAG_COLORS[hash % TAG_COLORS.length]
}
