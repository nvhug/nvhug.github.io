'use client'

import { Comment } from '@/types'
import { formatDate } from '@/lib/utils'

interface CommentsSectionProps {
  comments: Comment[]
  newComment: { author: string; content: string }
  onCommentChange: (field: 'author' | 'content', value: string) => void
  onSubmit: (e: React.FormEvent) => void
}

export function CommentsSection({ comments, newComment, onCommentChange, onSubmit }: CommentsSectionProps) {
  return (
    <section className="mx-auto mt-8 w-full max-w-3xl px-4 sm:px-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        {/* Comments List */}
        <div>
          <div className="mb-4 rounded-2xl border border-[#e5e0d5] bg-white/65 p-5">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#e5e0d5] bg-[#f7f4ed] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a4a2a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#a05b35]" />
              Reader Feedback
            </div>
            <h2 className="mb-1 font-poppins text-2xl font-semibold text-zinc-900">Discussions</h2>
            <p className="text-sm text-zinc-600">Be the first to share your thoughts.</p>
          </div>

          {comments.length > 0 && (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl border border-[#e5e0d5] bg-white/75 p-5 shadow-[0_14px_34px_-30px_rgba(23,23,23,0.5)]">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e5e0d5] bg-[#f7f4ed]">
                      <span className="text-xs font-bold text-[#8a4a2a]">
                        {comment.author.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-baseline justify-between gap-4">
                        <strong className="font-semibold text-zinc-900">{comment.author}</strong>
                        <time className="whitespace-nowrap text-xs font-medium text-zinc-500">
                          {formatDate(comment.created_at)}
                        </time>
                      </div>
                      <p className="text-sm leading-relaxed text-zinc-700">{comment.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {comments.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#d8cdbf] bg-white/60 p-8 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f4ed] text-[#8a4a2a]">✦</div>
              <p className="font-medium text-zinc-700">No comments yet</p>
              <p className="mt-1 text-sm text-zinc-500">Start the conversation using the form on the right.</p>
            </div>
          )}
        </div>

        {/* Comment Form */}
        <div>
          <div className="sticky top-32">
            <div className="rounded-2xl border border-[#e5e0d5] bg-white/75 p-5 shadow-[0_18px_36px_-32px_rgba(23,23,23,0.45)]">
              <h3 className="mb-1 font-poppins text-xl font-semibold text-zinc-900">Share Your Thoughts</h3>
              <p className="mb-6 text-xs text-zinc-600">Your feedback helps me improve.</p>
              <form onSubmit={onSubmit} className="space-y-3">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Name</label>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={newComment.author}
                    onChange={(e) => onCommentChange('author', e.target.value)}
                    className="w-full rounded-xl border border-[#e5e0d5] bg-[#fffdf8] px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus-visible:border-[#a05b35] focus-visible:ring-2 focus-visible:ring-[#a05b35]/15"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Comment</label>
                  <textarea
                    placeholder="What's on your mind?"
                    value={newComment.content}
                    onChange={(e) => onCommentChange('content', e.target.value)}
                    className="w-full resize-none rounded-xl border border-[#e5e0d5] bg-[#fffdf8] px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus-visible:border-[#a05b35] focus-visible:ring-2 focus-visible:ring-[#a05b35]/15"
                    rows={5}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8a4a2a]"
                >
                  Post Comment <span aria-hidden="true">→</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
