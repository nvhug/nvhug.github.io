import { createClient } from '@supabase/supabase-js'
import HomeClient from './HomeClient'
import { Post, Tag, Quote } from '@/types'

type PostRow = Post & { post_tags: { tags: Tag | null }[] }

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function getPosts(): Promise<Post[]> {
  const client = getClient()
  if (!client) return []
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
}

async function getQuotes(): Promise<Quote[]> {
  const client = getClient()
  if (!client) return []
  const { data } = await client.from('quotes').select('*')
  return (data || []) as Quote[]
}

export default async function Home() {
  const [posts, quotes] = await Promise.all([getPosts(), getQuotes()])
  return <HomeClient initialPosts={posts} initialQuotes={quotes} />
}
