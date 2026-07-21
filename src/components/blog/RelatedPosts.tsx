'use client'

import Link from 'next/link'
import { Post } from '@/types'
import { formatDate } from '@/lib/utils'
import { ArrowUpRight } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'

export function RelatedPosts({ posts }: { posts: Post[] }) {
  const { t } = useLanguage()
  if (posts.length === 0) return null

  return (
    <section className="border-t border-zinc-100 bg-white">
      <div className="py-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            {t('relatedPosts.heading')}
          </p>
        </div>

        {/* Mobile: vertical list */}
        <div className="flex flex-col divide-y divide-zinc-100 px-4 sm:hidden">
          {posts.map((post, i) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group flex items-center gap-3 py-3"
            >
              <span className="w-6 shrink-0 font-mono text-[10px] tracking-wider text-zinc-300">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-800 group-hover:text-zinc-600">
                  {post.title}
                </h3>
                <time className="text-[11px] text-zinc-400">{formatDate(post.created_at)}</time>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-all duration-200 group-hover:text-zinc-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          ))}
        </div>

        {/* Desktop: horizontal scroll */}
        <div className="hidden sm:flex gap-3 overflow-x-auto px-6 pb-3 [&::-webkit-scrollbar]:hidden scrollbar-none">
          {posts.map((post, i) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group flex-none w-52 shrink-0 rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4 transition-all duration-200 hover:border-zinc-200 hover:bg-white hover:shadow-sm"
            >
              <span className="font-mono text-[10px] tracking-wider text-zinc-300">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-2 line-clamp-3 text-sm font-semibold leading-snug text-zinc-800 group-hover:text-zinc-600">
                {post.title}
              </h3>
              <div className="mt-3 flex items-center justify-between">
                <time className="text-[11px] text-zinc-400">{formatDate(post.created_at)}</time>
                <ArrowUpRight className="h-3.5 w-3.5 text-zinc-300 transition-all duration-200 group-hover:text-zinc-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
