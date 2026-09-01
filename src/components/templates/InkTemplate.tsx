'use client'

import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { ReadingProgress } from '@/components/ReadingProgress'
import { TableOfContents } from '@/components/TableOfContents'
import type { TemplateProps } from './ParchmentTemplate'

export function InkTemplate({
  post, processedContent, readingMinutes, backHref,
  comments, commentsSlot,
}: TemplateProps) {
  return (
    <div className="tpl-ink relative min-h-svh overflow-x-clip bg-[#0f172a] pb-16 pt-24">
      {/* Orange gradient accent bar at top */}
      <div className="absolute left-0 right-0 top-0 h-0.75 bg-linear-to-r from-orange-600 via-orange-400 to-yellow-400" />

      <ReadingProgress />

      <div className="mx-auto flex w-full max-w-5xl items-start gap-8 px-4 sm:px-6">
        <section className="min-w-0 flex-1">

          {/* Terminal-style briefing bar */}
          <div className="mb-8 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
            <span className="text-slate-500">{formatDate(post.created_at)}</span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-500">{readingMinutes} min read</span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-500">{comments.length} comments</span>
            <span className="ml-auto text-orange-600/80">● Live</span>
          </div>

          <Link
            href={backHref}
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-600 transition-colors hover:text-orange-400"
          >
            ← Back
          </Link>

          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            {post.title}
          </h1>

          {/* Orange accent underline */}
          <div className="mt-5 mb-10 h-0.5 w-14 bg-linear-to-r from-orange-500 to-orange-400/0" />

          <div id="article-content" className="tpl-content">
            <div dangerouslySetInnerHTML={{ __html: processedContent }} />
          </div>
        </section>

        <aside className="hidden w-52 shrink-0 xl:block">
          <TableOfContents content={processedContent} />
        </aside>
      </div>

      {/* Comments on a slightly lighter dark surface */}
      {commentsSlot && (
        <div className="mt-12 border-t border-slate-800 bg-[#0a1122]">
          {commentsSlot}
        </div>
      )}
    </div>
  )
}
