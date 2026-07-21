export const dynamic = 'force-dynamic'

import HomeClient from './HomeClient'
import { Post, Tag, Quote } from '@/types'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type PostRow = Post & { post_tags: { tags: Tag | null }[] }

async function getPosts(): Promise<Post[]> {
  try {
    const client = await createSupabaseServerClient()
    const { data } = await client
      .from('posts')
      .select('*, post_tags(tags(id, name))')
      .eq('published', true)
      .order('created_at', { ascending: false })
    const rows = (data || []) as PostRow[]
    return rows
      .map(({ post_tags, ...post }) => ({
        ...post,
        tags: post_tags.map((pt) => pt.tags).filter((tag): tag is Tag => tag !== null),
      }))
      .filter((post) => !post.tags?.some((tag) => tag.name === 'Sức Khỏe'))
  } catch {
    return []
  }
}

async function getQuotes(): Promise<Quote[]> {
  try {
    const client = await createSupabaseServerClient()
    const { data } = await client.from('quotes').select('*')
    return (data || []) as Quote[]
  } catch {
    return []
  }
}

export default async function Home() {
  const [posts, quotes] = await Promise.all([getPosts(), getQuotes()])
  return <HomeClient initialPosts={posts} initialQuotes={quotes} />
}
