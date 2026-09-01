import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabasePublicClient } from '@/lib/supabase-public'
import { PostRow, toPost } from '@/lib/blog-posts'
import { Post } from '@/types'

export type LoadedPost = { post: Post; isOwner: boolean; client: SupabaseClient }

const POST_SELECT = '*, post_tags(tags(id, name))'

// Wrapped in React's `cache` so generateMetadata, the page, and the related-posts
// section (streamed separately) all share ONE fetch per request. Next's own
// request-level dedupe does not apply here: createSupabaseServerClient pins
// `cache: 'no-store'` on its fetch, so without this the post would be read (and
// RLS evaluated) once per caller instead of once per request.
export const loadPost = cache(async (slug: string): Promise<LoadedPost | null> => {
  // 1. Cookie-bearing client first — but only when there is actually a session.
  //    With one, PostgreSQL sees the `authenticated` role, `posts_public_read`
  //    (granted TO anon only) does not apply, and `posts_authenticated_user`
  //    scopes the read to the owner: that is what lets an owner preview their
  //    own PRIVATE post. WITHOUT a session this same client reaches PostgreSQL
  //    as `anon`, where the public-read policy WOULD return any public post —
  //    so skipping the query is what stops a stranger being treated as the
  //    owner of one. The user_id comparison is the belt to that braces.
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (user) {
    const { data: owned } = await serverClient
      .from('posts')
      .select(POST_SELECT)
      .eq('slug', slug)
      .maybeSingle()
    if (owned && (owned as PostRow).user_id === user.id) {
      return { post: toPost(owned as PostRow), isOwner: true, client: serverClient }
    }
  }

  // 2. Otherwise read it as `anon`, where `posts_public_read` applies. A hit here
  //    is a genuinely public post being read by the public.
  const publicClient = createSupabasePublicClient()
  const { data: shared } = await publicClient
    .from('posts')
    .select(POST_SELECT)
    .eq('slug', slug)
    .eq('is_public', true)
    .maybeSingle()
  if (shared) return { post: toPost(shared as PostRow), isOwner: false, client: publicClient }

  return null
})

export async function getRelatedPosts(post: Post, client: SupabaseClient): Promise<Post[]> {
  // Same tags first, fallback to recent. Runs on the SAME client that found the
  // post: for an anonymous reader the post_tags query simply returns nothing
  // (there is no anon grant on post_tags), so it falls through to the recent
  // branch — expected, not a bug.
  const tagIds = post.tags?.map((t: { id: string }) => t.id) ?? []
  let related: Post[] = []

  if (tagIds.length > 0) {
    const { data: taggedPosts } = await client
      .from('post_tags')
      .select('post_id')
      .in('tag_id', tagIds)
      .neq('post_id', post.id)
      .limit(30)

    const ids = [...new Set((taggedPosts ?? []).map((r: { post_id: string }) => r.post_id))]
      .sort(() => Math.random() - 0.5)
      .slice(0, 10)

    if (ids.length > 0) {
      const { data: posts } = await client
        .from('posts')
        .select('id, title, slug, excerpt, created_at')
        .in('id', ids)
        .eq('is_public', true)
        // Explicit owner filter: this used to rely on RLS scoping the read to the
        // signed-in account, which the anon path does not provide.
        .eq('user_id', post.user_id)
      related = (posts as Post[]) ?? []
    }
  }

  if (related.length < 10) {
    const exclude = [post.id, ...related.map((p) => p.id)]
    const { data: recent } = await client
      .from('posts')
      .select('id, title, slug, excerpt, created_at')
      .eq('is_public', true)
      .eq('user_id', post.user_id)
      .not('id', 'in', `(${exclude.join(',')})`)
      .limit(50)
    const shuffled = ((recent as Post[]) ?? []).sort(() => Math.random() - 0.5)
    related = [...related, ...shuffled].slice(0, 10)
  }

  return related
}
