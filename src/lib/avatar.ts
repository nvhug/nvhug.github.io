import type { User } from '@supabase/supabase-js'

export function getAvatarLetter(user: User): string {
  const name = user.user_metadata?.full_name as string | undefined
  if (name?.trim()) return name.trim()[0].toUpperCase()
  return (user.email ?? '?')[0].toUpperCase()
}

export function getAvatarLabel(user: User): string {
  const name = user.user_metadata?.full_name as string | undefined
  return name?.trim() || user.email || ''
}
