'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarClock,
  CircleDot,
  Eye,
  FileText,
  Globe,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { Post, Tag } from '@/types'
import { canPostBePublic, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useLanguage } from '@/lib/i18n/language-context'

type StatusFilter = 'all' | 'public' | 'private'
type PostRow = Post & { post_tags: { tags: Tag | null }[] }

export default function AdminPostsPage() {
  const { t } = useLanguage()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function fetchPosts(withLoading = true) {
    if (withLoading) {
      setLoading(true)
    }
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, post_tags(tags(id, name))')
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
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPosts(false)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  async function toggleVisibility(post: Post) {
    if (!canPostBePublic(post)) return
    setBusyId(post.id)
    try {
      const { error } = await supabase
        .from('posts')
        .update({ is_public: !post.is_public })
        .eq('id', post.id)

      if (error) throw error
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, is_public: !p.is_public } : p))
      )
    } catch (error) {
      console.error('Error updating post:', error)
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('posts').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (error) {
      console.error('Error deleting post:', error)
    } finally {
      setDeleting(false)
    }
  }

  const allTags = useMemo(() => {
    const map = new Map<string, string>()
    posts.forEach((post) => post.tags?.forEach((tag) => map.set(tag.id, tag.name)))
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [posts])

  const counts = useMemo(
    () => ({
      all: posts.length,
      public: posts.filter((p) => p.is_public).length,
      private: posts.filter((p) => !p.is_public).length,
    }),
    [posts]
  )

  const filteredPosts = posts.filter((post) => {
    if (statusFilter === 'public' && !post.is_public) return false
    if (statusFilter === 'private' && post.is_public) return false
    if (tagFilter !== 'all' && !post.tags?.some((tag) => tag.id === tagFilter)) return false
    if (search) {
      const term = search.toLowerCase()
      if (
        !post.title.toLowerCase().includes(term) &&
        !post.excerpt?.toLowerCase().includes(term)
      ) {
        return false
      }
    }
    return true
  })

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: t('common.all'), count: counts.all },
    { key: 'public', label: t('admin.posts.filterPublic'), count: counts.public },
    { key: 'private', label: t('admin.posts.filterPrivate'), count: counts.private },
  ]

  const statCards = [
    {
      key: 'all',
      label: t('admin.posts.statTotal'),
      value: counts.all,
      icon: Layers,
      hint: t('admin.posts.statTotalHint'),
    },
    {
      key: 'public',
      label: t('admin.posts.statPublic'),
      value: counts.public,
      icon: CircleDot,
      hint: t('admin.posts.statPublicHint'),
    },
    {
      key: 'private',
      label: t('admin.posts.statPrivate'),
      value: counts.private,
      icon: CalendarClock,
      hint: t('admin.posts.statPrivateHint'),
    },
  ]

  return (
    <>
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#ffffff_0%,#f7fef9_45%,#ecfdf5_100%)] p-6 shadow-[0_30px_60px_-45px_rgba(16,185,129,0.45)]">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_16px_28px_-16px_rgba(16,185,129,0.9)]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">{t('admin.posts.eyebrow')}</p>
              <h2 className="mt-1 font-poppins text-2xl font-semibold leading-tight text-zinc-900">{t('admin.posts.heading')}</h2>
              <p className="mt-1 text-sm text-zinc-600">{t('admin.posts.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/create">
              <Button className="h-9 rounded-lg bg-linear-to-r from-emerald-500 to-emerald-600 px-3.5 text-white hover:from-emerald-400 hover:to-emerald-500">
                <Plus />
                {t('admin.posts.newPost')}
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {statCards.map((card) => (
            <article
              key={card.key}
              className="rounded-xl border border-emerald-100 bg-white p-3 shadow-[0_1px_0_0_rgba(16,185,129,0.15)]"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-zinc-600">{card.label}</p>
                <card.icon className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-semibold leading-none text-zinc-900">{card.value}</p>
              <p className="mt-1 text-xs text-zinc-500">{card.hint}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_30px_60px_-45px_rgba(16,185,129,0.32)]">
        <div className="flex flex-wrap gap-2 border-b border-emerald-100 px-4 py-3.5">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-emerald-100 text-zinc-600 hover:bg-emerald-50 hover:text-zinc-900'
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs ${
                  statusFilter === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-emerald-100 px-4 py-3.5">
          <div className="relative min-w-50 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.posts.searchPlaceholder')}
              className="h-9 border-emerald-200 bg-emerald-50/60 pl-8 text-zinc-900 placeholder:text-zinc-500"
            />
          </div>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="h-9 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 text-sm text-zinc-900 outline-none focus-visible:border-emerald-400"
          >
            <option value="all">{t('admin.posts.allTagsOption')}</option>
            {allTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-zinc-500">{t('common.loading')}</div>
        ) : filteredPosts.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-500">
            {posts.length === 0 ? (
              <>
                {t('admin.posts.emptyNoPosts')}{' '}
                <Link href="/admin/create" className="font-semibold text-emerald-600 hover:underline">
                  {t('admin.posts.writeFirstPost')}
                </Link>
              </>
            ) : (
              t('admin.posts.emptyNoMatch')
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-100 bg-emerald-50/60 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-5 py-3.5">{t('admin.posts.colTitle')}</th>
                  <th className="px-5 py-3.5">{t('admin.posts.colTags')}</th>
                  <th className="px-5 py-3.5">{t('admin.posts.colStatus')}</th>
                  <th className="px-5 py-3.5">{t('admin.posts.colCreated')}</th>
                  <th className="px-5 py-3.5 text-center">{t('admin.posts.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post) => (
                  <tr key={post.id} className="border-b border-emerald-50 last:border-0 hover:bg-emerald-50/70">
                    <td className="max-w-xs px-5 py-3.5">
                      {post.is_public ? (
                        <Link href={`/blog/${post.slug}`}>
                          <div className="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline">{post.title}</div>
                          <div className="line-clamp-1 text-xs text-zinc-500">{post.excerpt}</div>
                        </Link>
                      ) : (
                        <div>
                          <div className="font-semibold text-zinc-900">{post.title}</div>
                          <div className="line-clamp-1 text-xs text-zinc-500">{post.excerpt}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {post.tags && post.tags.length > 0 ? (
                          post.tags.map((tag) => (
                            <Badge key={tag.id} variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                              {tag.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {post.is_public ? (
                        <Badge className="border border-emerald-300 bg-emerald-50 text-emerald-700">{t('admin.posts.badgePublic')}</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">{t('admin.posts.badgePrivate')}</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-zinc-500">
                      {formatDate(post.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        {post.is_public ? (
                          <Link href={`/blog/${post.slug}`} title={t('admin.posts.viewPublicTitle')}>
                            <Button variant="ghost" size="icon-sm" className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700">
                              <Eye />
                            </Button>
                          </Link>
                        ) : (
                          <Button variant="ghost" size="icon-sm" disabled title={t('admin.posts.viewTitle')} className="text-zinc-400">
                            <Eye />
                          </Button>
                        )}
                        <Link href={`/admin/${post.id}/edit`} title={t('admin.posts.editTitle')}>
                          <Button variant="ghost" size="icon-sm" className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700">
                            <Pencil />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busyId === post.id || !canPostBePublic(post)}
                          onClick={() => toggleVisibility(post)}
                          title={post.is_public ? t('admin.posts.makePrivateTitle') : t('admin.posts.makePublicTitle')}
                          className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700"
                        >
                          <Globe />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busyId === post.id}
                          onClick={() => setDeleteTarget(post)}
                          title={t('admin.posts.deleteTitle')}
                          className="text-rose-300 hover:bg-rose-500/15"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>

    <ConfirmModal
      open={!!deleteTarget}
      itemContent={deleteTarget?.title}
      loading={deleting}
      onConfirm={() => void confirmDelete()}
      onCancel={() => setDeleteTarget(null)}
    />
    </>
  )
}
