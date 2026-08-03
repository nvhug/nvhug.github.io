'use client'

import { Plus } from 'lucide-react'

import type { Post } from '@/types'

type Translate = (key: string, vars?: Record<string, string | number>) => string

type HealthTabProps = {
  healthPosts: Post[]
  t: Translate
}

export function HealthTab({ healthPosts, t }: HealthTabProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#f0fdf4_0%,#ffffff_100%)] shadow-[0_4px_20px_-8px_rgba(16,185,129,0.25)]">
      <div className="flex items-center gap-2 border-b border-emerald-100 px-4 py-3">
        <span className="text-xl">💪</span>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t('notes.health.heading')}</span>
        <a
          href={`/admin/create?autotag=${encodeURIComponent('Sức Khỏe')}`}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
        >
          <Plus className="h-3 w-3" />
          {t('notes.health.newPost')}
        </a>
      </div>

      <div className="px-4 py-3">
        {healthPosts.length === 0 ? (
          <div className="py-6 text-center text-sm text-zinc-500">{t('notes.health.empty')}</div>
        ) : (
          <div className="space-y-3">
            {healthPosts.map((post) => (
              <a
                key={post.id}
                href={`/blog/${post.slug}?from=health`}
                className="block rounded-lg border border-emerald-100 bg-white p-4 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-zinc-900 hover:text-emerald-600">{post.title}</h3>
                <p className="mt-1 text-sm text-zinc-600 line-clamp-2">{post.excerpt}</p>
                {post.tags && post.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {post.tags.map((tag) => (
                      <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}