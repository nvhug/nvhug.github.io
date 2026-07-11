'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Quote as QuoteIcon } from 'lucide-react'
import TableOfContentsCard from '@/components/TableOfContentsCard'
import { supabase } from '@/lib/supabase'
import { Post, Tag, Quote } from '@/types'
import { getTagColor } from '@/lib/utils'

type PostRow = Post & { post_tags: { tags: Tag | null }[] }

const ITEMS_PER_PAGE = 5

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null)

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

  const fetchQuotes = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('quotes').select('*')
      if (error) throw error
      setQuotes((data || []) as Quote[])
      if (data && data.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.length)
        setCurrentQuote(data[randomIndex])
      }
    } catch (error) {
      console.error('Error fetching quotes:', error)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPosts(false)
      void fetchQuotes()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchPosts, fetchQuotes])

  useEffect(() => {
    if (quotes.length === 0) return

    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * quotes.length)
      setCurrentQuote(quotes[randomIndex])
    }, 60000)

    return () => clearInterval(interval)
  }, [quotes])

  function getRandomQuote() {
    if (quotes.length <= 1) return
    let idx
    do {
      idx = Math.floor(Math.random() * quotes.length)
    } while (quotes[idx]?.id === currentQuote?.id)
    setCurrentQuote(quotes[idx])
  }

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
            {currentQuote ? (
              <div className="group relative min-w-0 flex-1 overflow-hidden">
                <QuoteIcon className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rotate-12 text-emerald-600/10" />
                <div className="relative flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_8px_16px_-8px_rgba(16,185,129,0.9)]">
                    <QuoteIcon className="h-4 w-4" />
                  </div>
                  <Link href="/quotes" className="min-w-0 flex-1">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">Daily Quote</p>
                    <blockquote className="whitespace-pre-wrap font-playfair text-lg font-medium leading-relaxed tracking-wide text-stone-600 hover:underline sm:text-xl">
                      &ldquo;{currentQuote.content}&rdquo;
                    </blockquote>
                    {currentQuote.author && (
                      <p className="mt-1.5 text-sm font-medium text-zinc-500">— {currentQuote.author}</p>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); getRandomQuote() }}
                    aria-label="Quote tiếp theo"
                    title="Quote tiếp theo"
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1" />
            )}

          </div>

          <div className="mt-5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setSelectedTag('all')}
                  className={`rounded-md border px-3 py-1 text-sm font-medium transition-colors ${
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
                      className={`rounded-md border px-3 py-1 text-sm font-medium transition-all ${colors.border} ${colors.bg} ${colors.text} ${
                        isSelected ? 'ring-2 ring-offset-1' : 'hover:shadow-sm'
                      }`}
                    >
                      {tag.name}
                    </button>
                  )
                })}
              </div>
              <input
                type="text"
                placeholder="Tìm bài viết..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-emerald-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                {filteredPosts.length} bài viết
              </span>
              {totalPages > 1 && (
                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                  Trang {currentPage} / {totalPages}
                </span>
              )}
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
