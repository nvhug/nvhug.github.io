'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/lib/i18n/language-context'
import { getIntlLocale } from '@/lib/i18n/locale'
import { useUserRole } from '@/lib/useUserRole'

type MetricRow = {
  id: string
  created_at: string
  event_name: string
  normalized_table_key: string | null
  normalization_confidence: number | null
}

export default function AdminNutritionQaPage() {
  const { t, lang } = useLanguage()
  const pathname = usePathname()
  const { role, loading: roleLoading } = useUserRole()
  const [rows, setRows] = useState<MetricRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (roleLoading) return
    if (role !== 'admin') {
      setRows([])
      setLoading(false)
      return
    }

    async function load() {
      const { data, error } = await getSupabaseBrowserClient()
        .from('nutrition_normalization_metrics')
        .select('id, created_at, event_name, normalized_table_key, normalization_confidence')
        .order('created_at', { ascending: false })
        .limit(500)

      if (!error) {
        setRows((data ?? []) as MetricRow[])
      }
      setLoading(false)
    }

    void load()
  }, [role, roleLoading])

  const summary = useMemo(() => {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000
    const last30 = rows.filter((r) => new Date(r.created_at).getTime() >= since)

    const total = last30.length
    const applied = last30.filter((r) => r.event_name === 'internal_table_match_applied').length
    const ambiguous = last30.filter((r) => r.event_name === 'internal_table_match_ambiguous').length
    const noMatch = last30.filter((r) => r.event_name === 'internal_table_no_match').length
    const manualEdits = last30.filter((r) => r.event_name === 'manual_calorie_edit_after_normalization').length

    const topKeys = Object.entries(
      last30.reduce<Record<string, number>>((acc, r) => {
        if (!r.normalized_table_key) return acc
        acc[r.normalized_table_key] = (acc[r.normalized_table_key] ?? 0) + 1
        return acc
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    return {
      total,
      applied,
      ambiguous,
      noMatch,
      manualEdits,
      applyRate: total > 0 ? Math.round((applied / total) * 100) : 0,
      topKeys,
      recent: rows.slice(0, 12),
    }
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-1 sm:mx-0 sm:inline-flex">
        <Link
          href="/admin/settings"
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            pathname === '/admin/settings'
              ? 'bg-emerald-500 text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          {t('admin.settings.usersTab')}
        </Link>
        <Link
          href="/admin/settings/pages"
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            pathname === '/admin/settings/pages'
              ? 'bg-emerald-500 text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          {t('admin.settings.pagesTab')}
        </Link>
        <Link
          href="/admin/settings/nutrition-qa"
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            pathname === '/admin/settings/nutrition-qa'
              ? 'bg-emerald-500 text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          {t('admin.settings.nutritionTab')}
        </Link>
        <Link
          href="/admin/settings/ai-usage"
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            pathname === '/admin/settings/ai-usage'
              ? 'bg-emerald-500 text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          {t('admin.settings.aiUsage.tab')}
        </Link>
        <Link
          href="/admin/settings/support"
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            pathname === '/admin/settings/support'
              ? 'bg-emerald-500 text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          {t('support.admin.pageTitle')}
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-poppins text-base font-semibold leading-tight text-zinc-900">{t('admin.settings.nutrition.heading')}</h2>
          <p className="text-xs text-zinc-400">{t('admin.settings.nutrition.subtitle')}</p>
        </div>
      </div>

      {!roleLoading && role !== 'admin' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-800">{t('admin.settings.nutrition.nonAdminTitle')}</p>
          <p className="mt-1 text-sm text-amber-700">{t('admin.settings.nutrition.nonAdminHint')}</p>
        </div>
      ) : null}

      {role === 'admin' && loading ? (
        <div className="rounded-xl border border-zinc-100 bg-white p-6 text-sm text-zinc-500">{t('common.loading')}</div>
      ) : role === 'admin' ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label={t('admin.settings.nutrition.totalEvents30d')} value={summary.total} />
            <StatCard label={t('admin.settings.nutrition.applied30d')} value={summary.applied} />
            <StatCard label={t('admin.settings.nutrition.ambiguous30d')} value={summary.ambiguous} />
            <StatCard label={t('admin.settings.nutrition.noMatch30d')} value={summary.noMatch} />
            <StatCard label={t('admin.settings.nutrition.manualEdits30d')} value={summary.manualEdits} />
          </div>

          <div className="rounded-xl border border-zinc-100 bg-white p-4">
            <p className="text-sm font-medium text-zinc-900">{t('admin.settings.nutrition.applyRate')}</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">{summary.applyRate}%</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-100 bg-white p-4">
              <p className="mb-3 text-sm font-medium text-zinc-900">{t('admin.settings.nutrition.topKeys')}</p>
              {summary.topKeys.length === 0 ? (
                <p className="text-xs text-zinc-500">{t('admin.settings.nutrition.empty')}</p>
              ) : (
                <div className="space-y-2">
                  {summary.topKeys.map(([key, count]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                      <span className="font-medium text-zinc-700">{key}</span>
                      <span className="text-zinc-500">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-100 bg-white p-4">
              <p className="mb-3 text-sm font-medium text-zinc-900">{t('admin.settings.nutrition.recentEvents')}</p>
              {summary.recent.length === 0 ? (
                <p className="text-xs text-zinc-500">{t('admin.settings.nutrition.empty')}</p>
              ) : (
                <div className="space-y-2">
                  {summary.recent.map((row) => (
                    <div key={row.id} className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-zinc-700">{row.event_name}</span>
                        <span>
                          {new Date(row.created_at).toLocaleString(getIntlLocale(lang), {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="mt-1 text-zinc-500">
                        {row.normalized_table_key ?? '-'}
                        {typeof row.normalization_confidence === 'number'
                          ? ` • ${Math.round(row.normalization_confidence * 100)}%`
                          : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
    </div>
  )
}
