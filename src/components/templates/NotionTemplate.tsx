'use client'

import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { ReadingProgress } from '@/components/ReadingProgress'
import { TableOfContents } from '@/components/TableOfContents'
import type { TemplateProps } from './ParchmentTemplate'

export function NotionTemplate({
  post, processedContent, readingMinutes, backHref,
  commentsSlot,
}: TemplateProps) {
  return (
    <div className="tpl-notion relative min-h-svh bg-white pb-16">
      <ReadingProgress />

      {/* Cover band — Notion-style top color strip */}
      <div className="h-36 w-full bg-gradient-to-br from-[#f1f0ef] via-[#e8e6e3] to-[#dddad6]" />

      <div className="mx-auto flex w-full max-w-5xl items-start gap-8 px-6">
        <section className="min-w-0 flex-1">
          {/* Page icon overlapping the cover */}
          <div className="-mt-8 mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-white text-4xl shadow-sm ring-1 ring-black/5">
            📝
          </div>

          {/* Workspace breadcrumb */}
          <div className="mb-5 flex items-center gap-1.5 text-xs text-[rgba(55,53,47,0.45)]">
            <Link href="/" className="transition-colors hover:text-[#37352f]">Private</Link>
            <span>/</span>
            <Link href={backHref} className="transition-colors hover:text-[#37352f]">Notes</Link>
            <span>/</span>
            <span className="text-[rgba(55,53,47,0.65)]">{post.title}</span>
          </div>

          <h1 className="text-4xl font-bold leading-tight tracking-tight text-[#37352f]">
            {post.title}
          </h1>

          {/* Property row — Notion database style */}
          <div className="mt-6 space-y-1.5 border-t border-[rgba(55,53,47,0.09)] pt-4 text-sm">
            <div className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-[rgba(55,53,47,0.45)]">📅 Created</span>
              <span className="text-[rgba(55,53,47,0.65)]">{formatDate(post.created_at)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-[rgba(55,53,47,0.45)]">⏱️ Read time</span>
              <span className="text-[rgba(55,53,47,0.65)]">{readingMinutes} min</span>
            </div>
            {post.tags && post.tags.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-[rgba(55,53,47,0.45)]">🏷️ Tags</span>
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map((tag) => (
                    <span key={tag.id} className="rounded bg-[rgba(55,53,47,0.08)] px-1.5 py-0.5 text-xs text-[#37352f]">
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 border-t border-[rgba(55,53,47,0.09)]" />

          <div id="article-content" className="tpl-content mt-6">
            <div dangerouslySetInnerHTML={{ __html: processedContent }} />
          </div>

          <div className="mt-12 border-t border-[rgba(55,53,47,0.09)] pt-4">
            <Link href={backHref} className="text-sm text-[rgba(55,53,47,0.45)] transition-colors hover:text-[#37352f]">
              ← Back to Notes
            </Link>
          </div>
        </section>

        <aside className="hidden w-52 shrink-0 xl:block">
          <div className="sticky top-8 pt-10">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[rgba(55,53,47,0.45)]">On this page</p>
            <TableOfContents content={processedContent} />
          </div>
        </aside>
      </div>

      {commentsSlot}
    </div>
  )
}
