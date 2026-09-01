'use client'

import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { ReadingProgress } from '@/components/ReadingProgress'
import { TableOfContents } from '@/components/TableOfContents'
import type { TemplateProps } from './ParchmentTemplate'

export function MediumTemplate({
  post, processedContent, readingMinutes, backHref,
  comments, commentsSlot,
}: TemplateProps) {
  return (
    <div className="tpl-medium relative min-h-svh bg-white pb-16 pt-20">
      <ReadingProgress />

      <div className="mx-auto flex w-full max-w-5xl items-start gap-10 px-6">
        <section className="min-w-0 flex-1">
          <Link href={backHref} className="text-sm text-[#6b6b6b] transition-colors hover:text-[#292929]">
            ← Back
          </Link>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag.id} className="rounded-full bg-[#f2f2f2] px-3 py-1 text-xs font-medium text-[#292929]">
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-[#1a1a1a] sm:text-5xl">
            {post.title}
          </h1>

          {/* Author card */}
          <div className="mt-7 flex items-center gap-3 border-b border-[#e8e8e8] pb-7">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#292929] text-sm font-bold text-white">
              N
            </div>
            <div>
              <p className="text-sm font-medium text-[#292929]">Nguyen Van Hung</p>
              <p className="mt-0.5 text-xs text-[#6b6b6b]">
                {formatDate(post.created_at)} · {readingMinutes} min read · {comments.length} comments
              </p>
            </div>
          </div>

          <div id="article-content" className="tpl-content mt-9">
            <div dangerouslySetInnerHTML={{ __html: processedContent }} />
          </div>

          {/* Clap-style footer */}
          <div className="mt-14 flex items-center gap-4 border-t border-b border-[#e8e8e8] py-5">
            <button className="flex items-center gap-2 rounded-full border border-[#e8e8e8] px-4 py-2 text-sm text-[#6b6b6b] transition-colors hover:border-[#292929] hover:text-[#292929]">
              👏 Clap
            </button>
            <span className="text-sm text-[#6b6b6b]">{comments.length} responses</span>
          </div>
        </section>

        <aside className="hidden w-52 shrink-0 xl:block">
          <div className="sticky top-20">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b6b6b]">Contents</p>
            <TableOfContents content={processedContent} />
          </div>
        </aside>
      </div>

      {commentsSlot}
    </div>
  )
}
