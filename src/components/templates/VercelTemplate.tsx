'use client'

import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { ReadingProgress } from '@/components/ReadingProgress'
import { TableOfContents } from '@/components/TableOfContents'
import { CommentsSection } from '@/components/blog/CommentsSection'
import type { TemplateProps } from './ParchmentTemplate'

export function VercelTemplate({
  post, processedContent, readingMinutes, backHref,
  comments, newComment, onCommentChange, onAddComment,
}: TemplateProps) {
  return (
    <div className="tpl-vercel relative min-h-svh overflow-x-clip bg-black pb-16 pt-20 text-[#ededed]">
      <ReadingProgress />

      <div className="mx-auto flex w-full max-w-5xl items-start gap-12 px-6">
        <article className="min-w-0 flex-1">

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 font-mono text-xs text-[#888]">
            <Link href="/" className="transition-colors hover:text-white">Docs</Link>
            <span>/</span>
            <Link href={backHref} className="transition-colors hover:text-white">Blog</Link>
            <span>/</span>
            <span className="text-[#ededed]">{post.slug}</span>
          </div>

          <h1 className="mt-6 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
            {post.title}
          </h1>

          <div className="mt-4 flex items-center gap-3 font-mono text-xs text-[#888]">
            <time>{formatDate(post.created_at)}</time>
            <span>·</span>
            <span>{readingMinutes} min read</span>
            <span>·</span>
            <span>{comments.length} comments</span>
          </div>

          <div className="mt-6 border-t border-[#2a2a2a]" />

          <div id="article-content" className="tpl-content mt-7">
            <div dangerouslySetInnerHTML={{ __html: processedContent }} />
          </div>

          <div className="mt-12 flex items-center justify-between border-t border-[#2a2a2a] pt-6">
            <Link href={backHref} className="font-mono text-xs text-[#888] transition-colors hover:text-white">
              ← Back to Blog
            </Link>
            <span className="font-mono text-xs text-[#888]">Last updated {formatDate(post.updated_at ?? post.created_at)}</span>
          </div>
        </article>

        {/* TOC sidebar — key feature of Vercel docs */}
        <aside className="hidden w-56 shrink-0 xl:block">
          <div className="sticky top-20">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#666]">
              On this page
            </p>
            <TableOfContents content={processedContent} />
          </div>
        </aside>
      </div>

      <div className="mt-10 border-t border-[#1a1a1a]">
        <CommentsSection
          comments={comments}
          newComment={newComment}
          onCommentChange={onCommentChange}
          onSubmit={onAddComment}
        />
      </div>
    </div>
  )
}
