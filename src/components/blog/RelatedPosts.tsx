'use client'

import Link from 'next/link'
import { Post } from '@/types'
import { formatDate } from '@/lib/utils'

export function RelatedPosts({ posts }: { posts: Post[] }) {
  if (posts.length === 0) return null

  return (
    <section className="border-t border-zinc-100 bg-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Bài viết khác
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group rounded-xl border border-zinc-100 p-4 transition-colors hover:border-zinc-200 hover:bg-zinc-50"
            >
              <time className="text-[11px] text-zinc-400">{formatDate(post.created_at)}</time>
              <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 group-hover:text-zinc-700">
                {post.title}
              </h3>
              {post.excerpt && (
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                  {post.excerpt}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
