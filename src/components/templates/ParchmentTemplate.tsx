'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Post, Comment } from '@/types'
import { formatDate } from '@/lib/utils'
import { ReadingProgress } from '@/components/ReadingProgress'
import { TableOfContents } from '@/components/TableOfContents'

export interface TemplateProps {
  post: Post
  processedContent: string
  readingMinutes: number
  backHref: string
  comments: Comment[]
  // Owner-gated <CommentsSection> element, or null for a stranger — RLS on the
  // `comments` table grants no anon or other-account access at all, so a
  // stranger's list would always be empty and their submit would silently fail.
  commentsSlot: ReactNode
}

export function ParchmentTemplate({
  post, processedContent, readingMinutes, backHref,
  comments, commentsSlot,
}: TemplateProps) {
  return (
    <div className="tpl-parchment relative min-h-svh overflow-x-clip bg-[#f7f4ed] pb-16 pt-24 text-[#171717]">
      <ReadingProgress />

      <div className="mx-auto flex w-full max-w-5xl items-start gap-8 px-4 sm:px-6">
        <section className="min-w-0 flex-1">
          <div className="rounded-[28px] border border-[#e5e0d5] bg-[#fffdf8]/82 px-5 py-8 shadow-[0_24px_70px_-48px_rgba(23,23,23,0.55)] backdrop-blur sm:px-10 sm:py-10">

            <Link
              href={backHref}
              className="inline-flex rounded-full border border-[#e5e0d5] bg-white/70 px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:border-[#c9bba8] hover:text-[#8a4a2a]"
            >
              ← Back to articles
            </Link>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span key={tag.id} className="rounded-full border border-[#e5e0d5] bg-[#f7f4ed] px-2.5 py-0.5 text-xs font-medium text-[#8a4a2a]">
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            <h1 className="mt-6 max-w-2xl font-poppins text-4xl font-semibold leading-[1.08] tracking-tight text-zinc-950 sm:text-5xl">
              {post.title}
            </h1>

            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-500">
              <time>{formatDate(post.created_at)}</time>
              <span aria-hidden="true">·</span>
              <span>{readingMinutes} min read</span>
              <span aria-hidden="true">·</span>
              <span>{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span>
            </div>

            {/* Thin amber separator */}
            <div className="mt-7 h-px w-full bg-gradient-to-r from-[#e5e0d5] via-[#c9a478]/40 to-transparent" />

            <div id="article-content" className="tpl-content mt-8">
              <div dangerouslySetInnerHTML={{ __html: processedContent }} />
            </div>
          </div>
        </section>

        <aside className="hidden w-52 shrink-0 xl:block">
          <TableOfContents content={processedContent} />
        </aside>
      </div>

      {commentsSlot}
    </div>
  )
}
