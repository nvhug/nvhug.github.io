'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import TableOfContentsCard from '@/components/TableOfContentsCard'
import { supabase } from '@/lib/supabase'
import { Post } from '@/types'

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchPosts = useCallback(async (withLoading = true) => {
    if (withLoading) {
      setLoading(true)
    }
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPosts(data || [])
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPosts(false)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchPosts])

  const filteredPosts = posts.filter(
    (post) =>
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <main className="min-h-svh bg-[#f7fef9] pb-16 pt-24">
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl border border-emerald-200/70 bg-white/80 p-5 shadow-[0_20px_42px_-32px_rgba(16,185,129,0.28)] backdrop-blur sm:p-7">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">Journal</p>
              <h1 className="mt-2 font-poppins text-3xl font-semibold leading-tight text-zinc-900 sm:text-4xl">All Articles</h1>
              <p className="mt-2 text-sm text-zinc-600">Khám phá các bài viết mới nhất về design, product và engineering.</p>
            </div>

            <div className="w-full max-w-sm">
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Tìm bài viết</label>
              <input
                type="text"
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 w-full rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-500 focus-visible:border-emerald-500"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {filteredPosts.length} bài viết
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6">
        {loading ? (
          <div className="rounded-2xl border border-emerald-100 bg-white p-16 text-center text-sm text-zinc-500">Loading...</div>
        ) : filteredPosts.length === 0 ? (
          <div className="rounded-2xl border border-emerald-100 bg-white p-16 text-center text-sm text-zinc-500">
            <p className="mb-4">
              {searchTerm ? 'No articles found.' : 'No articles published yet.'}
            </p>
            {!searchTerm && (
              <Link href="/admin/create" className="font-semibold text-emerald-700 hover:underline">
                Write your first article →
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-100 bg-white/90 px-5 py-6 shadow-[0_18px_36px_-30px_rgba(16,185,129,0.24)] sm:px-7 sm:py-7">
            {filteredPosts.map((post, index) => (
              <TableOfContentsCard key={post.id} post={post} index={index} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
