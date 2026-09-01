export const dynamic = 'force-dynamic'

import { unstable_cache } from 'next/cache'
import HomeClient from '../HomeClient'
import { Post, Quote } from '@/types'
import { PostRow, toPosts } from '@/lib/blog-posts'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabasePublicClient } from '@/lib/supabase-public'
import { getServiceSupabaseClient } from '@/lib/supabase-admin'

const POST_SELECT = '*, post_tags(tags(id, name))'

// Whose writing an anonymous visitor is shown. Read with the service-role client
// because `user_profiles` has no anon policy at all — and used for nothing else:
// the posts themselves are still fetched through an RLS-enforced client below, so
// `is_public` stays enforced by the database rather than by a query anyone could
// forget. Roles are metadata, not post content, so reading them this way is cheap
// in risk terms. Cached for 5 minutes: which accounts are admins changes about
// as often as never, so every anonymous visit shouldn't re-pay this round trip.
const getAdminUserIds = unstable_cache(
  async (): Promise<string[]> => {
    const { data } = await getServiceSupabaseClient()
      .from('user_profiles')
      .select('id')
      .eq('role', 'admin')
    return ((data || []) as { id: string }[]).map((row) => row.id)
  },
  ['blog-admin-user-ids'],
  { revalidate: 300 }
)

async function getPosts(): Promise<{ posts: Post[]; isLoggedIn: boolean }> {
  try {
    const client = await createSupabaseServerClient()
    const { data: { user } } = await client.auth.getUser()

    if (!user) {
      // The site's own public blog: the admin account's public posts, nobody
      // else's. The owner filter is not belt-and-braces here, it is the whole
      // scoping — `posts_public_read` is deliberately broad (ANY account's
      // public row, so a shared /blog/<slug> link keeps working for every user),
      // and a LISTING with no owner filter is exactly the cross-account leak
      // ADR-018 was written for. RLS still owns the `is_public` half.
      const adminIds = await getAdminUserIds()
      if (adminIds.length === 0) return { posts: [], isLoggedIn: false }

      const { data } = await createSupabasePublicClient()
        .from('posts')
        .select(POST_SELECT)
        .eq('is_public', true)
        .in('user_id', adminIds)
        .order('created_at', { ascending: false })
      return { posts: toPosts((data || []) as PostRow[]), isLoggedIn: false }
    }

    const { data } = await client
      .from('posts')
      .select(POST_SELECT)
      // No is_public filter here on purpose: this is the account's own reading
      // list, so it must show every post they have — public and private,
      // seeded and their own — not just the ones the internet can see. RLS
      // already scopes this to the signed-in account via
      // `posts_authenticated_user` (USING auth.uid() = user_id); the explicit
      // user_id filter is the belt to that braces, the same defense-in-depth
      // `app/blog/[slug]/page.tsx` applies to its own owner-scoped read.
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    return { posts: toPosts((data || []) as PostRow[]), isLoggedIn: true }
  } catch {
    return { posts: [], isLoggedIn: false }
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

export default async function BlogPage() {
  const [{ posts, isLoggedIn }, quotes] = await Promise.all([getPosts(), getQuotes()])
  return <HomeClient initialPosts={posts} initialQuotes={quotes} isLoggedIn={isLoggedIn} />
}
