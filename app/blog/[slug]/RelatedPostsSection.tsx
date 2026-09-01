import { RelatedPosts } from '@/components/blog/RelatedPosts'
import { getRelatedPosts, loadPost } from './data'

// A separate async Server Component, not inlined in page.tsx's own await chain,
// so its own Suspense boundary (see page.tsx) can stream it in after the post
// itself has already rendered — nothing about the post's content depends on
// this query, and it used to block first paint for no reason.
export async function RelatedPostsSection({ slug }: { slug: string }) {
  // `loadPost` is wrapped in React `cache()`, so this re-invocation for the same
  // slug within the same request resolves from that cache rather than issuing a
  // second query.
  const loaded = await loadPost(slug)
  if (!loaded) return null

  const relatedPosts = await getRelatedPosts(loaded.post, loaded.client)
  return <RelatedPosts posts={relatedPosts} />
}
