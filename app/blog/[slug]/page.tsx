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
      <main className="min-h-svh bg-[#f7fef9] px-4 pb-16 pt-24 sm:px-6">
        <div className="mx-auto w-full max-w-6xl rounded-2xl border border-emerald-100 bg-white p-16 text-center text-sm text-zinc-500">
          Loading...
        </div>
      </main>
    )
  }

  if (!post) {
    return (
      <main className="min-h-svh bg-[#f7fef9] px-4 pb-16 pt-24 sm:px-6">
        <div className="mx-auto w-full max-w-6xl rounded-2xl border border-emerald-100 bg-white p-16 text-center">
          <h1 className="mb-4 font-poppins text-3xl font-semibold text-zinc-900">Post not found</h1>
          <Link href="/" className="text-sm font-semibold text-emerald-700 hover:underline">
            ← Back to blog
          </Link>
        </div>
      </main>
    )
  }

  return (
    <article className="relative min-h-svh overflow-x-clip bg-[radial-gradient(circle_at_top,#d1fae5,#f7fef9_38%,#eef2ff_100%)] pb-16 pt-24">
      {/* Post Header & Content */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-white/85 p-6 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.35)] backdrop-blur sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-200/40 blur-3xl" />

          <Link href="/" className="text-sm font-medium text-zinc-500 transition-colors hover:text-emerald-700">
            ← Back to articles
          </Link>

          <h1 className="mt-4 font-poppins text-3xl font-semibold leading-tight text-zinc-900 sm:text-4xl">{post.title}</h1>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              Published
            </span>
            <time className="text-sm text-zinc-500">{formatDate(post.created_at)}</time>
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
              {readingMinutes} min read
            </span>
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
              {comments.length} comments
            </span>
          </div>

          <div className="prose mt-8 max-w-none text-zinc-700 [&_:is(h1,h2,h3,h4)]:font-poppins [&_:is(h1,h2,h3,h4)]:text-zinc-900 [&_a]:text-emerald-700 [&_a:hover]:text-emerald-600 [&_p]:my-3">
            <div dangerouslySetInnerHTML={{ __html: post.content }} />
          </div>
        </div>
      </section>

      {/* Comments Section */}
      <section className="mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Comments List - Left Side */}
          <div className="md:col-span-2">
            <div className="mb-6 rounded-2xl border border-emerald-200/60 bg-white/90 p-6 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)]">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Reader Feedback
              </div>
              <h2 className="mb-2 font-poppins text-2xl font-semibold text-zinc-900">Discussions</h2>
              <p className="text-sm text-zinc-600">Be the first to share your thoughts.</p>
            </div>

            {/* Comments List */}
            {comments.length > 0 && (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl border border-emerald-100/80 bg-white/95 p-5 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.55)] transition-transform hover:-translate-y-0.5">
                    <div className="flex gap-4 items-start">
                      {/* Avatar placeholder */}
                      <div className="h-10 w-10 shrink-0 rounded-full border border-emerald-200 bg-emerald-100/80 flex items-center justify-center">
                        <span className="text-xs font-bold text-emerald-700/80">
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
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-white/80 p-8 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">✦</div>
                <p className="font-medium text-zinc-700">No comments yet</p>
                <p className="mt-1 text-sm text-zinc-500">Start the conversation using the form on the right.</p>
              </div>
            )}
          </div>

          {/* Comment Form - Right Side */}
          <div className="md:col-span-1">
            <div className="sticky top-32">
              <div className="rounded-2xl border border-emerald-200/80 bg-linear-to-b from-white to-emerald-50/80 p-6 shadow-[0_18px_36px_-30px_rgba(5,150,105,0.5)]">
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
                      className="w-full rounded-xl border border-emerald-200 bg-white/95 px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20"
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
                      className="w-full resize-none rounded-xl border border-emerald-200 bg-white/95 px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20"
                      rows={5}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
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
