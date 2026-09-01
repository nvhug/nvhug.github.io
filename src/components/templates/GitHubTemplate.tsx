'use client'

import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { ReadingProgress } from '@/components/ReadingProgress'
import { TableOfContents } from '@/components/TableOfContents'
import type { TemplateProps } from './ParchmentTemplate'

export function GitHubTemplate({
  post, processedContent, readingMinutes, backHref,
  comments, commentsSlot,
}: TemplateProps) {
  return (
    <div className="tpl-github relative min-h-svh bg-[#ffffff] pb-16 pt-20">
      <ReadingProgress />

      <div className="mx-auto flex w-full max-w-5xl items-start gap-8 px-4">
        <section className="min-w-0 flex-1">
          {/* Repo-style breadcrumb */}
          <div className="mb-4 flex items-center gap-1.5 text-sm">
            <Link href="/" className="font-semibold text-[#0969da] hover:underline">Notez</Link>
            <span className="text-[#59636e]">/</span>
            <Link href={backHref} className="font-semibold text-[#0969da] hover:underline">blog</Link>
            <span className="text-[#59636e]">/</span>
            <span className="font-semibold text-[#1f2328]">{post.slug}.md</span>
          </div>

          {/* GitHub README-style bordered container */}
          <div className="overflow-hidden rounded-md border border-[#d1d9e0]">

            {/* File header bar */}
            <div className="flex items-center justify-between border-b border-[#d1d9e0] bg-[#f6f8fa] px-4 py-2">
              <div className="flex items-center gap-2 text-xs text-[#59636e]">
                <svg viewBox="0 0 16 16" className="h-4 w-4 fill-[#59636e]">
                  <path d="M3.75 1.5h8.5a2.25 2.25 0 0 1 2.25 2.25v8.5a2.25 2.25 0 0 1-2.25 2.25h-8.5A2.25 2.25 0 0 1 1.5 12.25v-8.5A2.25 2.25 0 0 1 3.75 1.5zM3 3.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-8.5A.75.75 0 0 0 12.25 3h-8.5A.75.75 0 0 0 3 3.75z" />
                </svg>
                <span className="font-semibold text-[#1f2328]">{post.slug}.md</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#59636e]">
                <span>{readingMinutes} min read</span>
                <span>·</span>
                <span>{formatDate(post.created_at)}</span>
                <span>·</span>
                <span>{comments.length} comments</span>
              </div>
            </div>

            {/* Rendered markdown content */}
            <div className="px-5 py-8 sm:px-8">
              <div id="article-content" className="tpl-content">
                <div dangerouslySetInnerHTML={{ __html: processedContent }} />
              </div>
            </div>
          </div>

          <div className="mt-4 text-right">
            <Link href={backHref} className="text-sm text-[#0969da] hover:underline">← Back</Link>
          </div>
        </section>

        <aside className="hidden w-52 shrink-0 xl:block">
          <div className="sticky top-20">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#59636e]">On this page</p>
            <TableOfContents content={processedContent} />
          </div>
        </aside>
      </div>

      {commentsSlot}
    </div>
  )
}
