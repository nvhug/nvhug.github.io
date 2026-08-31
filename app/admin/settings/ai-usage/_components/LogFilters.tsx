'use client'

import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/lib/i18n/language-context'
import { formatUserIdentity } from '../_lib/format'
import { escapeIlikeTerm } from '../_lib/filters'
import type { Surface } from '../_lib/types'

const MAX_USER_RESULTS = 8

/** Single-select toggle chip — the same visual/interaction the by-user breakdown rows
 * already use for `scope`, exposed directly instead of requiring a drill-down click. */
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
          : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
      }`}
    >
      {label}
    </button>
  )
}

interface UserResult {
  id: string
  label: string
}

export function LogFilters({
  models,
  selectedModel,
  onSelectModel,
  surfaces,
  selectedSurface,
  onSelectSurface,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onSelectUser,
  onSelectDeleted,
  onSelectSystem,
  isDeletedActive,
  isSystemActive,
}: {
  models: string[]
  selectedModel: string | null
  onSelectModel: (model: string | null) => void
  surfaces: { key: Surface; label: string }[]
  selectedSurface: Surface | null
  onSelectSurface: (surface: Surface | null) => void
  dateFrom: string | null
  dateTo: string | null
  onDateFromChange: (v: string | null) => void
  onDateToChange: (v: string | null) => void
  onSelectUser: (userId: string) => void
  onSelectDeleted: () => void
  onSelectSystem: () => void
  isDeletedActive: boolean
  isSystemActive: boolean
}) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserResult[]>([])
  const [searched, setSearched] = useState(false)

  // Two plain ilike queries merged client-side, rather than one `.or('full_name.ilike...,
  // email.ilike...')` — a raw admin-typed string spliced into a `.or()` filter expression
  // can be read as PostgREST filter syntax (commas, parens) instead of a literal value.
  useEffect(() => {
    const term = query.trim()
    let cancelled = false
    const handle = setTimeout(async () => {
      if (term.length < 2) {
        setResults([])
        setSearched(false)
        return
      }
      const like = `%${escapeIlikeTerm(term)}%`
      const supabase = getSupabaseBrowserClient()
      const [byName, byEmail] = await Promise.all([
        supabase.from('user_profiles').select('id, full_name, email').ilike('full_name', like).limit(MAX_USER_RESULTS),
        supabase.from('user_profiles').select('id, full_name, email').ilike('email', like).limit(MAX_USER_RESULTS),
      ])
      if (cancelled) return
      const byId = new Map<string, UserResult>()
      for (const row of [...(byName.data ?? []), ...(byEmail.data ?? [])]) {
        byId.set(row.id as string, {
          id: row.id as string,
          label: formatUserIdentity(row.full_name as string | null, row.email as string | null),
        })
      }
      setResults([...byId.values()].slice(0, MAX_USER_RESULTS))
      setSearched(true)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query])

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3">
      <Chip label={t('admin.settings.aiUsage.allModels')} active={selectedModel === null} onClick={() => onSelectModel(null)} />
      {models.map((model) => (
        <Chip key={model} label={model} active={selectedModel === model} onClick={() => onSelectModel(selectedModel === model ? null : model)} />
      ))}

      <span className="mx-1 h-4 w-px bg-zinc-200" aria-hidden />

      <Chip label={t('admin.settings.aiUsage.allFeatures')} active={selectedSurface === null} onClick={() => onSelectSurface(null)} />
      {surfaces.map((s) => (
        <Chip key={s.key} label={s.label} active={selectedSurface === s.key} onClick={() => onSelectSurface(selectedSurface === s.key ? null : s.key)} />
      ))}

      <span className="mx-1 h-4 w-px bg-zinc-200" aria-hidden />

      <div className="relative min-w-50">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('admin.settings.aiUsage.userSearchPlaceholder')}
          className="h-8 pl-8 text-xs"
        />
        {query.trim().length >= 2 ? (
          <div className="absolute z-10 mt-1 w-full min-w-60 rounded-lg border border-zinc-200 bg-white py-1 shadow-md">
            {results.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-400">
                {searched ? t('admin.settings.aiUsage.userSearchNoResults') : t('admin.settings.aiUsage.userSearchHint')}
              </p>
            ) : (
              results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onSelectUser(r.id)
                    setQuery('')
                  }}
                  className="block w-full truncate px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  {r.label}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
      <Chip label={t('admin.settings.aiUsage.deletedUser')} active={isDeletedActive} onClick={onSelectDeleted} />
      <Chip label={t('admin.settings.aiUsage.systemActor')} active={isSystemActive} onClick={onSelectSystem} />

      <span className="mx-1 h-4 w-px bg-zinc-200" aria-hidden />

      <div className="flex items-center gap-1.5">
        {/* DatePicker has no aria-label/aria-labelledby prop to forward to (checked its
            props: value/onChange/align/className only) — a visible label is what every
            other DatePicker call site in this codebase already uses instead. */}
        <span className="text-xs text-zinc-400">{t('admin.settings.aiUsage.dateFromLabel')}</span>
        <DatePicker value={dateFrom ?? ''} onChange={onDateFromChange} className="h-8 w-32 text-xs" />
        <span className="text-xs text-zinc-400" aria-hidden>
          –
        </span>
        <span className="text-xs text-zinc-400">{t('admin.settings.aiUsage.dateToLabel')}</span>
        <DatePicker value={dateTo ?? ''} onChange={onDateToChange} className="h-8 w-32 text-xs" />
        {dateFrom || dateTo ? (
          <button
            type="button"
            onClick={() => {
              onDateFromChange(null)
              onDateToChange(null)
            }}
            aria-label={t('admin.settings.aiUsage.clearDateRange')}
            className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 sm:p-1"
          >
            <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
