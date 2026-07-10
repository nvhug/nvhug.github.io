'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TableOfContentsCard from '@/components/TableOfContentsCard'
import { supabase } from '@/lib/supabase'
import { Post, Tag } from '@/types'
import { getTagColor } from '@/lib/utils'

type PostRow = Post & { post_tags: { tags: Tag | null }[] }

const ITEMS_PER_PAGE = 5

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  const fetchPosts = useCallback(async (withLoading = true) => {
    if (withLoading) {
      setLoading(true)
    }
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, post_tags(tags(id, name))')
        .eq('published', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = (data || []) as PostRow[]
      const mapped: Post[] = rows.map(({ post_tags, ...post }) => ({
        ...post,
        tags: post_tags.map((pt) => pt.tags).filter((tag): tag is Tag => tag !== null),
      }))
      setPosts(mapped)
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

  const allTags = useMemo(() => {
    const map = new Map<string, string>()
    posts.forEach((post) => post.tags?.forEach((tag) => map.set(tag.id, tag.name)))
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [posts])

  const filteredPosts = useMemo(
    () =>
      posts.filter((post) => {
        const matchesSearch =
          post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          post.excerpt.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesTag = selectedTag === 'all' || post.tags?.some((tag) => tag.id === selectedTag)

        return matchesSearch && matchesTag
      }),
    [posts, searchTerm, selectedTag]
  )

  const totalPages = Math.ceil(filteredPosts.length / ITEMS_PER_PAGE)
  const paginatedPosts = useMemo(
    () => {
      const start = (currentPage - 1) * ITEMS_PER_PAGE
      return filteredPosts.slice(start, start + ITEMS_PER_PAGE)
    },
    [filteredPosts, currentPage]
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

          <div className="mt-6 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {filteredPosts.length} bài viết
              </span>
              {totalPages > 1 && (
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
                  Trang {currentPage} / {totalPages}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedTag('all')}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedTag === 'all'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-emerald-100 text-zinc-600 hover:bg-emerald-50 hover:text-zinc-900'
                }`}
              >
                All Tags
              </button>
              {allTags.map((tag) => {
                const colors = getTagColor(tag.name)
                const isSelected = selectedTag === tag.id
                return (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedTag(tag.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${colors.border} ${colors.bg} ${colors.text} ${
                      isSelected ? 'ring-2 ring-offset-1' : 'hover:shadow-sm'
                    }`}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
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
          <>
            <div className="rounded-2xl border border-emerald-100 bg-white/90 px-5 py-6 shadow-[0_18px_36px_-30px_rgba(16,185,129,0.24)] sm:px-7 sm:py-7">
              {paginatedPosts.map((post, index) => (
                <TableOfContentsCard key={post.id} post={post} index={(currentPage - 1) * ITEMS_PER_PAGE + index} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    setCurrentPage(Math.max(1, currentPage - 1))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors disabled:border-zinc-100 disabled:text-zinc-400 hover:bg-emerald-50 disabled:hover:bg-transparent"
                >
                  ← Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => {
                        setCurrentPage(page)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className={`h-9 w-9 rounded-lg border font-medium transition-colors ${
                        currentPage === page
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-emerald-100 text-zinc-600 hover:bg-emerald-50 hover:text-zinc-900'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors disabled:border-zinc-100 disabled:text-zinc-400 hover:bg-emerald-50 disabled:hover:bg-transparent"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}
