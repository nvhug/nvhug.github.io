'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Post } from '@/types'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'

const TEMPLATES = [
  {
    id: 'parchment',
    name: 'Parchment',
    descKey: 'parchment',
    preview: (
      <div className="flex h-28 flex-col gap-1.5 rounded-xl bg-[#f7f4ed] p-3">
        <div className="rounded-lg border border-[#e5e0d5] bg-[#fffdf8] p-2.5">
          <div className="mb-1.5 h-2.5 w-3/4 rounded bg-zinc-900/80" />
          <div className="mb-1 h-1.5 w-full rounded bg-zinc-400/60" />
          <div className="mb-1 h-1.5 w-5/6 rounded bg-zinc-400/60" />
          <div className="mt-2 h-5 w-full rounded-md border border-[#e5e0d5] bg-[#f7f4ed]/80 pl-2">
            <div className="mt-1 h-1.5 w-4/5 rounded bg-zinc-400/40" />
          </div>
        </div>
      </div>
    ),
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'ink',
    name: 'Ink',
    descKey: 'ink',
    preview: (
      <div className="flex h-28 flex-col gap-1.5 rounded-xl bg-[#0f172a] p-3">
        <div className="h-0.5 w-full rounded bg-gradient-to-r from-orange-500 to-transparent" />
        <div className="mt-1 h-2.5 w-3/5 rounded bg-white/90" />
        <div className="mt-1 h-1.5 w-full rounded bg-slate-600/80" />
        <div className="h-1.5 w-5/6 rounded bg-slate-600/80" />
        <div className="mt-1 rounded-md border-l-2 border-orange-400 bg-white/5 p-1.5">
          <div className="h-1.5 w-4/5 rounded bg-slate-600/60" />
        </div>
      </div>
    ),
    badge: 'bg-slate-800 text-orange-400',
  },
  {
    id: 'medium',
    name: 'Medium',
    descKey: 'medium',
    preview: (
      <div className="flex h-28 flex-col gap-1.5 rounded-xl bg-white p-3">
        <div className="mb-1 h-3 w-2/3 rounded bg-[#1a1a1a]" style={{ fontWeight: 700 }} />
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full bg-[#292929]" />
          <div className="h-1.5 w-20 rounded bg-gray-300" />
        </div>
        <div className="mt-1 h-px w-full bg-[#e8e8e8]" />
        <div className="mt-1 h-1.5 w-full rounded bg-gray-300/80" />
        <div className="h-1.5 w-5/6 rounded bg-gray-300/80" />
      </div>
    ),
    badge: 'bg-green-100 text-green-700',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    descKey: 'vercel',
    preview: (
      <div className="flex h-28 flex-col gap-1.5 rounded-xl bg-black p-3">
        <div className="flex items-center gap-1">
          <div className="h-1 w-5 rounded bg-white/20" />
          <span className="text-[8px] text-white/30">/</span>
          <div className="h-1 w-8 rounded bg-white/20" />
          <span className="text-[8px] text-white/30">/</span>
          <div className="h-1 w-10 rounded bg-white/40" />
        </div>
        <div className="h-2.5 w-2/3 rounded bg-white/90" />
        <div className="mt-0.5 h-px w-full bg-[#2a2a2a]" />
        <div className="mt-1 h-1.5 w-full rounded bg-white/20" />
        <div className="flex items-start gap-2">
          <div className="flex-1 space-y-1">
            <div className="h-1.5 w-full rounded bg-white/15" />
            <div className="h-1.5 w-4/5 rounded bg-white/15" />
          </div>
          <div className="w-8 space-y-1">
            <div className="h-1 w-full rounded bg-white/10" />
            <div className="h-1 w-3/4 rounded bg-white/10" />
          </div>
        </div>
      </div>
    ),
    badge: 'bg-zinc-100 text-zinc-700',
  },
  {
    id: 'github',
    name: 'GitHub',
    descKey: 'github',
    preview: (
      <div className="flex h-28 flex-col gap-1 rounded-xl bg-white p-3">
        <div className="flex items-center gap-1 text-[9px] text-[#59636e]">
          <span className="text-[#0969da]">owner</span>
          <span>/</span>
          <span className="font-semibold text-[#1f2328]">repo.md</span>
        </div>
        <div className="flex-1 overflow-hidden rounded border border-[#d1d9e0]">
          <div className="border-b border-[#d1d9e0] bg-[#f6f8fa] px-2 py-1">
            <div className="h-1.5 w-16 rounded bg-[#1f2328]/50" />
          </div>
          <div className="space-y-1 px-2 py-1.5">
            <div className="h-2 w-1/2 rounded bg-[#1f2328]/80" />
            <div className="h-px w-full bg-[#d1d9e0]" />
            <div className="h-1.5 w-full rounded bg-[#1f2328]/20" />
          </div>
        </div>
      </div>
    ),
    badge: 'bg-[#dafbe1] text-[#1a7f37]',
  },
  {
    id: 'notion',
    name: 'Notion',
    descKey: 'notion',
    preview: (
      <div className="flex h-28 flex-col rounded-xl bg-white overflow-hidden">
        <div className="h-8 bg-gradient-to-br from-[#f1f0ef] to-[#dddad6]" />
        <div className="flex flex-col gap-1 px-3 pb-2">
          <div className="-mt-3 mb-1 h-6 w-6 rounded bg-white shadow-sm ring-1 ring-black/5 flex items-center justify-center text-[10px]">📝</div>
          <div className="h-2.5 w-3/5 rounded bg-[#37352f]/80" />
          <div className="h-px w-full bg-[rgba(55,53,47,0.09)]" />
          <div className="h-1.5 w-full rounded bg-[#37352f]/15" />
          <div className="flex items-center gap-1 rounded bg-[rgba(235,236,237,0.5)] px-1.5 py-1">
            <span className="text-[8px]">💡</span>
            <div className="h-1.5 flex-1 rounded bg-[#37352f]/20" />
          </div>
        </div>
      </div>
    ),
    badge: 'bg-[#f1f0ef] text-[#37352f]',
  },
  {
    id: 'apple',
    name: 'Apple',
    descKey: 'apple',
    preview: (
      <div className="flex h-28 flex-col rounded-xl bg-white overflow-hidden">
        <div className="bg-[#f5f5f7] px-3 pt-2.5 pb-3">
          <div className="mb-1 h-1 w-8 rounded bg-[#6e6e73]/40" />
          <div className="h-3 w-4/5 rounded bg-[#1d1d1f]/90" />
          <div className="mt-1.5 h-1 w-24 rounded bg-[#6e6e73]/40" />
        </div>
        <div className="flex-1 space-y-1 px-3 pt-2">
          <div className="h-1.5 w-full rounded bg-[#1d1d1f]/15" />
          <div className="h-1.5 w-full rounded bg-[#1d1d1f]/15" />
          <div className="h-4 w-full rounded-lg bg-[#f5f5f7]">
            <div className="m-1 h-1.5 w-4/5 rounded bg-[#6e6e73]/30" />
          </div>
        </div>
      </div>
    ),
    badge: 'bg-blue-50 text-[#0071e3]',
  },
]

export default function TemplatesPage() {
  const { t } = useLanguage()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [applyingAll, setApplyingAll] = useState<string | null>(null)

  useEffect(() => {
    fetchPosts()
  }, [])

  async function fetchPosts() {
    const { data } = await supabase
      .from('posts')
      .select('id, title, slug, template, created_at, published')
      .order('created_at', { ascending: false })
    setPosts((data as Post[]) || [])
    setLoading(false)
  }

  async function updateTemplate(postId: string, template: string) {
    setSaving(postId)
    const { error } = await supabase
      .from('posts')
      .update({ template })
      .eq('id', postId)
    if (error) {
      toast.error(t('admin.templates.updateError'))
    } else {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, template } : p)))
      toast.success(t('admin.templates.updateSuccess'))
    }
    setSaving(null)
  }

  async function applyToAll(template: string) {
    setApplyingAll(template)
    const { error } = await supabase.from('posts').update({ template }).not('id', 'is', null)
    if (error) {
      toast.error(t('admin.templates.applyAllError'))
    } else {
      setPosts((prev) => prev.map((p) => ({ ...p, template })))
      toast.success(t('admin.templates.applyAllSuccess', { template }))
    }
    setApplyingAll(null)
  }

  return (
    <div className="space-y-6 p-2 sm:p-5">
      <div>
        <h1 className="font-poppins text-2xl font-semibold text-zinc-900">{t('admin.templates.heading')}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('admin.templates.subtitle')}</p>
      </div>

      {/* Template cards */}
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {TEMPLATES.map((tpl) => (
          <div
            key={tpl.id}
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            {tpl.preview}
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tpl.badge}`}>
                  {tpl.id}
                </span>
                <span className="font-semibold text-zinc-900">{tpl.name}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{t(`admin.templates.descriptions.${tpl.descKey}`)}</p>
              <button
                onClick={() => applyToAll(tpl.id)}
                disabled={!!applyingAll}
                className="mt-3 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
              >
                {applyingAll === tpl.id ? t('admin.templates.applying') : t('admin.templates.applyToAll')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Posts table */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="border-b border-zinc-100 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            {t('admin.templates.postsHeading')}
          </p>
        </div>

        {loading ? (
          <p className="p-5 text-sm text-zinc-400">{t('common.loading')}</p>
        ) : posts.length === 0 ? (
          <p className="p-5 text-sm text-zinc-400">{t('admin.templates.emptyNoPosts')}</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {posts.map((post) => {
              const currentTemplate = post.template || 'parchment'
              return (
                <div key={post.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${post.published ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                        {post.published ? t('admin.templates.live') : t('admin.templates.draft')}
                      </span>
                      <Link
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        className="truncate text-sm font-semibold text-zinc-900 hover:underline"
                      >
                        {post.title}
                      </Link>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-400">{formatDate(post.created_at)}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {TEMPLATES.map((tpl) => {
                      const isActive = currentTemplate === tpl.id
                      const isSaving = saving === post.id
                      return (
                        <button
                          key={tpl.id}
                          onClick={() => !isActive && updateTemplate(post.id, tpl.id)}
                          disabled={isSaving}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                            isActive
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
                          }`}
                        >
                          {isActive && <Check className="h-3 w-3" />}
                          {tpl.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
