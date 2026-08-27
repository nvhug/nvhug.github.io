'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Shield } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/lib/i18n/language-context'
import { APP_ROLES, EXTRA_FEATURES, type AppRole } from '@/lib/permissions'
import type { PagePermission } from '@/types'

// Route-based rows (/admin, /notes, ...) are fixed policy — only non-route
// feature flags (EXTRA_FEATURES) are togglable here.
type CellKey = `${string}:${AppRole}`

export default function AdminPageAccessPage() {
  const { t } = useLanguage()
  const pathname = usePathname()
  const [permissions, setPermissions] = useState<Map<CellKey, PagePermission>>(new Map())
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<CellKey | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await getSupabaseBrowserClient()
        .from('page_permissions')
        .select('id, page_key, role, allowed')

      if (error) {
        console.error('Error fetching page permissions:', error)
      } else {
        const map = new Map<CellKey, PagePermission>()
        for (const row of (data ?? []) as PagePermission[]) {
          map.set(`${row.page_key}:${row.role}`, row)
        }
        setPermissions(map)
      }
      setLoading(false)
    }
    void load()
  }, [])

  async function toggle(pageKey: string, role: AppRole) {
    const key: CellKey = `${pageKey}:${role}`
    const current = permissions.get(key)
    const nextAllowed = current ? !current.allowed : true

    setBusyKey(key)
    try {
      const { data, error } = await getSupabaseBrowserClient()
        .from('page_permissions')
        .upsert({ page_key: pageKey, role, allowed: nextAllowed }, { onConflict: 'page_key,role' })
        .select('id, page_key, role, allowed')
        .single()
      if (error) throw error
      setPermissions((prev) => new Map(prev).set(key, data as PagePermission))
      toast.success(t('admin.settings.pages.updateSuccess'))
    } catch (err) {
      console.error('Error updating page permission:', err)
      toast.error(t('admin.settings.pages.updateError'))
    } finally {
      setBusyKey(null)
    }
  }

  const pageLabels: Record<string, string> = {
    'notes.ai_analysis': t('admin.settings.pages.featureAiAnalysis'),
  }

  const roleLabels: Record<AppRole, string> = {
    admin: t('admin.settings.users.roleAdmin'),
    paid:  t('admin.settings.users.rolePaid'),
    user:  t('admin.settings.users.roleUser'),
  }

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
      </div>

      {/* Compact header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]">
          <Shield className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-poppins text-base font-semibold leading-tight text-zinc-900">{t('admin.settings.pagesTab')}</h2>
          <p className="text-xs text-zinc-400">{t('admin.settings.subtitle')}</p>
        </div>
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-400">{t('common.loading')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <th className="px-4 py-2.5">{t('admin.settings.pages.colPage')}</th>
                  {APP_ROLES.map((role) => (
                    <th key={role} className="px-4 py-2.5 text-center">{roleLabels[role]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EXTRA_FEATURES.map((page) => (
                  <tr key={page.key} className="border-b border-zinc-50 last:border-0 transition-colors hover:bg-zinc-50/60">
                    <td className="px-4 py-2.5 text-[13px] font-medium text-zinc-900">
                      {pageLabels[page.key] ?? page.key}
                    </td>
                    {APP_ROLES.map((role) => {
                      const key: CellKey = `${page.key}:${role}`
                      const cell = permissions.get(key)
                      const allowed = cell?.allowed ?? false
                      return (
                        <td key={role} className="px-4 py-2.5 text-center">
                          <button
                            type="button"
                            disabled={busyKey === key}
                            onClick={() => toggle(page.key, role)}
                            className={`inline-flex h-5 w-5 items-center justify-center rounded border transition-all disabled:cursor-not-allowed ${
                              allowed
                                ? 'border-emerald-500 bg-emerald-500 text-white shadow-[0_2px_6px_rgba(16,185,129,0.4)]'
                                : 'border-zinc-300 bg-white text-transparent hover:border-emerald-400'
                            }`}
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
