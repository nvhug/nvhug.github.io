import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import BlogPostClient from './BlogPostClient'
import { RelatedPostsSection } from './RelatedPostsSection'
import { loadPost } from './data'

function toDescription(excerpt: string | null | undefined): string | undefined {
  const text = excerpt?.trim()
  if (!text) return undefined
  if (text.length <= 200) return text
  const cut = text.slice(0, 200)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 120 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…'
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const loaded = await loadPost(slug)
  if (!loaded) return {}

  const { post } = loaded
  const description = toDescription(post.excerpt)

  return {
    title: post.title,
    description,
    openGraph: {
      title: post.title,
      description,
      type: 'article',
    },
    // Only the owner can reach a non-public post, but a crawler may still hold
    // the URL of one that used to be public. Telling it not to index drops the
    // post back out of search results once the owner turns sharing off.
    ...(post.is_public !== true ? { robots: { index: false, follow: false } } : {}),
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const loaded = await loadPost(slug)
  // Invariant: "no such post" and "that post is private" must produce the SAME
  // notFound(). Any distinguishable response would let a stranger enumerate
  // which slugs exist on this account.
  if (!loaded) notFound()

  const { post, isOwner } = loaded

  // BlogPostClient reads ?from= via useSearchParams, which needs a Suspense
  // boundary; without it the page is prerendered with empty params.
  //
  // Related posts are their own nested Suspense boundary rather than an
  // awaited value here: nothing about rendering the post itself depends on
  // that query, so it streams in after first paint instead of delaying it.
  return (
    <Suspense>
      <BlogPostClient
        post={post}
        isOwner={isOwner}
        relatedSlot={
          <Suspense fallback={null}>
            <RelatedPostsSection slug={slug} />
          </Suspense>
        }
      />
    </Suspense>
  )
}
