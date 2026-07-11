'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Post, Comment } from '@/types'
import { formatDate } from '@/lib/utils'


export default function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState({ author: '', content: '' })
  const [loading, setLoading] = useState(true)

  const readingMinutes = Math.max(1, Math.ceil((post?.content?.replace(/<[^>]*>/g, '').trim().split(/\s+/).length || 0) / 220))

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .eq('slug', slug)
          .eq('published', true)
          .single()

        if (error) throw error
        setPost(data)
      } catch (error) {
        console.error('Error fetching post:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [slug])

  useEffect(() => {
    if (!post?.id) return
    fetchComments(post.id)
  }, [post?.id])

  async function fetchComments(postId: string) {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()

    if (!post || !newComment.author || !newComment.content) return

    try {
      const { error } = await supabase.from('comments').insert([
        {
          post_id: post.id,
          author: newComment.author,
          content: newComment.content,
        },
      ])

      if (error) throw error

      setNewComment({ author: '', content: '' })
      await fetchComments(post.id)
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  if (loading) {
    return (
      <main className="min-h-svh bg-[#f7f4ed] px-4 pb-16 pt-24 sm:px-6">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#e5e0d5] bg-white/75 p-16 text-center text-sm text-zinc-500 shadow-[0_18px_45px_-34px_rgba(23,23,23,0.35)]">
          Loading...
        </div>
      </main>
    )
  }

  if (!post) {
    return (
      <main className="min-h-svh bg-[#f7f4ed] px-4 pb-16 pt-24 sm:px-6">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#e5e0d5] bg-white/75 p-16 text-center shadow-[0_18px_45px_-34px_rgba(23,23,23,0.35)]">
          <h1 className="mb-4 font-poppins text-3xl font-semibold text-zinc-900">Post not found</h1>
          <Link href="/" className="text-sm font-semibold text-[#8a4a2a] hover:underline">
            ← Back to blog
          </Link>
        </div>
      </main>
    )
  }

  return (
    <article className="relative min-h-svh overflow-x-clip bg-[#f7f4ed] pb-16 pt-24 text-[#171717]">
      {/* Post Header & Content */}
      <section className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <div className="rounded-[28px] border border-[#e5e0d5] bg-[#fffdf8]/82 px-5 py-6 shadow-[0_24px_70px_-48px_rgba(23,23,23,0.55)] backdrop-blur sm:px-8 sm:py-8">
          <Link href="/" className="inline-flex rounded-full border border-[#e5e0d5] bg-white/70 px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:border-[#c9bba8] hover:text-[#8a4a2a]">
            ← Back to articles
          </Link>

          <h1 className="mt-8 max-w-2xl font-poppins text-4xl font-semibold leading-[1.08] tracking-tight text-zinc-950 sm:text-5xl">{post.title}</h1>

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-500">
            <time>{formatDate(post.created_at)}</time>
            <span aria-hidden="true">/</span>
            <span>
              {readingMinutes} min read
            </span>
            <span aria-hidden="true">/</span>
            <span>
              {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
            </span>
          </div>

          <div className="prose mt-9 max-w-none text-[16.5px] text-zinc-800 [&_a]:font-medium [&_a]:text-[#8a4a2a] [&_a:hover]:underline [&_blockquote]:my-5 [&_blockquote]:rounded-2xl [&_blockquote]:border [&_blockquote]:border-[#e5e0d5] [&_blockquote]:bg-[#f7f4ed]/65 [&_blockquote]:px-5 [&_blockquote]:py-3.5 [&_blockquote]:text-zinc-700 [&_blockquote]:shadow-inner [&_code]:rounded-md [&_code]:bg-[#f7f4ed] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_h1]:font-poppins [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-zinc-950 [&_h2]:mb-2.5 [&_h2]:mt-8 [&_h2]:font-poppins [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-zinc-950 [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:font-poppins [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-zinc-900 [&_li]:pl-1 [&_li]:leading-7 [&_ol]:my-3.5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-7 [&_p]:my-3 [&_p]:leading-[1.65] [&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-[#e5e0d5] [&_pre]:bg-zinc-950 [&_pre]:p-5 [&_table]:my-5 [&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-2xl [&_table]:border [&_table]:border-[#e5e0d5] [&_table]:bg-white/70 [&_td]:border-t [&_td]:border-[#e5e0d5] [&_td]:px-4 [&_td]:py-3 [&_th]:bg-[#f7f4ed] [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_ul]:my-3.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-7">
            <div dangerouslySetInnerHTML={{ __html: post.content }} />
          </div>
        </div>
      </section>

      {/* Comments Section */}
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

            {/* Comments List */}
            {comments.length > 0 && (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl border border-[#e5e0d5] bg-white/75 p-5 shadow-[0_14px_34px_-30px_rgba(23,23,23,0.5)]">
                    <div className="flex gap-4 items-start">
                      {/* Avatar placeholder */}
                      <div className="h-10 w-10 shrink-0 rounded-full border border-[#e5e0d5] bg-[#f7f4ed] flex items-center justify-center">
                        <span className="text-xs font-bold text-[#8a4a2a]">
                          {comment.author.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      
                      {/* Comment content */}
                      <div className="flex-1 min-w-0">
                        <div className="mb-2 flex items-baseline justify-between gap-4">
                          <strong className="font-semibold text-zinc-900">{comment.author}</strong>
                          <time className="text-xs text-zinc-500 whitespace-nowrap font-medium">
                            {formatDate(comment.created_at)}
                          </time>
                        </div>
                        <p className="text-sm leading-relaxed text-zinc-700">
                          {comment.content}
                        </p>
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

          {/* Comment Form - Right Side */}
          <div>
            <div className="sticky top-32">
              <div className="rounded-2xl border border-[#e5e0d5] bg-white/75 p-5 shadow-[0_18px_36px_-32px_rgba(23,23,23,0.45)]">
                <h3 className="mb-1 font-poppins text-xl font-semibold text-zinc-900">Share Your Thoughts</h3>
                <p className="mb-6 text-xs text-zinc-600">Your feedback helps me improve.</p>
                
                <form onSubmit={handleAddComment} className="space-y-3">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Name</label>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={newComment.author}
                      onChange={(e) =>
                        setNewComment({ ...newComment, author: e.target.value })
                      }
                      className="w-full rounded-xl border border-[#e5e0d5] bg-[#fffdf8] px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus-visible:border-[#a05b35] focus-visible:ring-2 focus-visible:ring-[#a05b35]/15"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Comment</label>
                    <textarea
                      placeholder="What's on your mind?"
                      value={newComment.content}
                      onChange={(e) =>
                        setNewComment({ ...newComment, content: e.target.value })
                      }
                      className="w-full resize-none rounded-xl border border-[#e5e0d5] bg-[#fffdf8] px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus-visible:border-[#a05b35] focus-visible:ring-2 focus-visible:ring-[#a05b35]/15"
                      rows={5}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8a4a2a]"
                  >
                    Post Comment
                    <span aria-hidden="true">→</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </article>
  )
}
