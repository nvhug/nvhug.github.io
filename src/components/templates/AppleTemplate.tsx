'use client'

import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { ReadingProgress } from '@/components/ReadingProgress'
import { TableOfContents } from '@/components/TableOfContents'
import { CommentsSection } from '@/components/blog/CommentsSection'
import type { TemplateProps } from './ParchmentTemplate'

export function AppleTemplate({
  post, processedContent, readingMinutes, backHref,
  comments, newComment, onCommentChange, onAddComment,
}: TemplateProps) {
  return (
    <div className="tpl-apple relative min-h-svh bg-white pb-16">
      <ReadingProgress />

      {/* Hero header — Apple's large title treatment */}
      <div className="bg-[#f5f5f7] pt-20 pb-14">
        <div className="mx-auto w-full max-w-[820px] px-8">
          <Link href={backHref} className="text-sm font-medium text-[#0071e3] transition-opacity hover:opacity-70">
            ← Back
          </Link>

          {/* Category label */}
          <p className="mt-6 text-sm font-semibold tracking-wide text-[#6e6e73] uppercase">
            Blog
          </p>

          <h1 className="mt-3 font-semibold leading-tight text-[#1d1d1f]" style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif" }}>
            {post.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[#6e6e73]">
            <time>{formatDate(post.created_at)}</time>
            <span aria-hidden>·</span>
            <span>{readingMinutes} min read</span>
            <span aria-hidden>·</span>
            <span>{comments.length} comments</span>
          </div>

          {post.tags && post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag.id} className="rounded-full bg-[#e8e8ed] px-3 py-1 text-xs font-medium text-[#1d1d1f]">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Article body — lots of breathing room */}
      <div className="mx-auto flex w-full max-w-5xl items-start gap-8 px-8 pt-12">
        <section className="min-w-0 flex-1">
          <div id="article-content" className="tpl-content">
            <div dangerouslySetInnerHTML={{ __html: processedContent }} />
          </div>

          {/* Footer */}
          <div className="mt-16 flex items-center justify-between border-t border-[#d2d2d7] pt-6">
            <Link href={backHref} className="text-sm font-medium text-[#0071e3] transition-opacity hover:opacity-70">
              ← Back
            </Link>
            <span className="text-xs text-[#6e6e73]">
              {formatDate(post.updated_at ?? post.created_at)}
            </span>
          </div>
        </section>

        <aside className="hidden w-52 shrink-0 xl:block">
          <div className="sticky top-20">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">On this page</p>
            <TableOfContents content={processedContent} />
          </div>
        </aside>
      </div>

      <CommentsSection
        comments={comments}
        newComment={newComment}
        onCommentChange={onCommentChange}
        onSubmit={onAddComment}
      />
    </div>
  )
}
