'use client'

import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { BowelLog } from '@/types'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useLanguage } from '@/lib/i18n/language-context'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { getIntlLocale } from '@/lib/i18n/locale'
import type { Lang } from '@/lib/i18n/language-context'

type StoolType = BowelLog['stool_type']

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string, lang: Lang) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat(getIntlLocale(lang), { day: 'numeric', month: 'numeric', year: 'numeric' })
    .format(new Date(y, m - 1, d))
}

const STOOL_BADGE: Record<StoolType, string> = {
  hard:   'bg-orange-100 text-orange-700 border-orange-200',
  normal: 'bg-green-100 text-green-700 border-green-200',
  soft:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  loose:  'bg-amber-100 text-amber-700 border-amber-200',
  watery: 'bg-red-100 text-red-700 border-red-200',
}

const STOOL_SELECT: Record<StoolType, string> = {
  hard:   'border-orange-300 bg-orange-50 text-orange-700 ring-orange-300',
  normal: 'border-green-300 bg-green-50 text-green-700 ring-green-300',
  soft:   'border-emerald-300 bg-emerald-50 text-emerald-700 ring-emerald-300',
  loose:  'border-amber-300 bg-amber-50 text-amber-700 ring-amber-300',
  watery: 'border-red-300 bg-red-50 text-red-700 ring-red-300',
}

export function BowelTracker() {
  const { t, lang } = useLanguage()
  const [logs, setLogs] = useState<BowelLog[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayDate())
  const [time, setTime] = useState('')
  const [count, setCount] = useState('1')
  const [stoolType, setStoolType] = useState<StoolType>('normal')
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const STOOL_TYPES: { value: StoolType; label: string; hint: string }[] = [
    { value: 'hard',   label: t('bowelTracker.stoolTypes.hard'),   hint: t('bowelTracker.stoolHints.hard') },
    { value: 'normal', label: t('bowelTracker.stoolTypes.normal'), hint: t('bowelTracker.stoolHints.normal') },
    { value: 'soft',   label: t('bowelTracker.stoolTypes.soft'),   hint: t('bowelTracker.stoolHints.soft') },
    { value: 'loose',  label: t('bowelTracker.stoolTypes.loose'),  hint: t('bowelTracker.stoolHints.loose') },
    { value: 'watery', label: t('bowelTracker.stoolTypes.watery'), hint: t('bowelTracker.stoolHints.watery') },
  ]

  useEffect(() => { fetchLogs() }, [])

  async function fetchLogs() {
    const { data } = await supabase
      .from('bowel_logs')
      .select('*')
      .order('date', { ascending: false })
      .limit(60)
    setLogs(data || [])
    setLoading(false)
  }

  function startEdit(log: BowelLog) {
    setEditingId(log.id)
    setDate(log.date)
    setTime(log.time || '')
    setCount(String(log.count))
    setStoolType(log.stool_type)
    setNotes(log.notes || '')
  }

  function resetForm() {
    setEditingId(null)
    setDate(todayDate())
    setTime('')
    setCount('1')
    setStoolType('normal')
    setNotes('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const c = parseInt(count)
    if (isNaN(c) || c < 1 || c > 20) { toast.error(t('bowelTracker.invalidCount')); return }
    setSaving(true)

    const payload = { date, time: time || null, count: c, stool_type: stoolType, notes: notes || null }

    if (editingId) {
      const { error } = await supabase
        .from('bowel_logs')
        .update(payload)
        .eq('id', editingId)
      if (error) { toast.error(t('bowelTracker.saveFailed')); setSaving(false); return }
      toast.success(t('bowelTracker.updated'))
    } else {
      const { error } = await supabase
        .from('bowel_logs')
        .upsert(payload, { onConflict: 'date' })
      if (error) { toast.error(t('bowelTracker.saveFailed')); setSaving(false); return }
      toast.success(t('bowelTracker.saved'))
    }

    await fetchLogs()
    resetForm()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('bowel_logs').delete().eq('id', id)
    if (error) { toast.error(t('bowelTracker.deleteFailed')); return }
    toast.success(t('bowelTracker.deleted'))
    setLogs((prev) => prev.filter((l) => l.id !== id))
  }

  const latest = logs[0]
  const stoolLabel = (type: StoolType) => STOOL_TYPES.find((s) => s.value === type)?.label ?? type

  return (
    <div className="space-y-4">
      {/* Latest summary */}
      {latest && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-3">
          <div>
            <p className="text-xs text-zinc-500">{t('bowelTracker.latestLabel')}</p>
            <p className="text-2xl font-bold text-zinc-900">
              {latest.count}
              <span className="ml-1 text-sm font-normal text-zinc-500">{t('bowelTracker.timesUnit')}</span>
            </p>
          </div>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STOOL_BADGE[latest.stool_type]}`}>
            {stoolLabel(latest.stool_type)}
          </span>
          <span className="ml-auto text-xs text-zinc-400">
            {formatDate(latest.date, lang)}{latest.time && ` · ${latest.time}`}
          </span>
        </div>
      )}

      {/* Form */}
      <div className="rounded-2xl border border-teal-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-700">
          {editingId ? t('bowelTracker.editHeading') : t('bowelTracker.addHeading')}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">{t('bowelTracker.dateLabel')}</label>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">{t('bowelTracker.timeLabel')}</label>
              <TimePicker value={time} onChange={setTime} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">{t('bowelTracker.countLabel')}</label>
              <input
                type="number"
                min="1"
                max="20"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-20 rounded-lg border border-teal-200 px-2.5 py-1.5 text-sm outline-none focus:border-teal-400"
                required
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-36">
              <label className="text-xs text-zinc-500">{t('bowelTracker.notesLabel')}</label>
              <input
                type="text"
                placeholder={t('bowelTracker.notesPlaceholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-lg border border-teal-200 px-2.5 py-1.5 text-sm outline-none focus:border-teal-400"
              />
            </div>
          </div>

          {/* Stool type selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-500">{t('bowelTracker.typeLabel')}</label>
            <div className="flex flex-wrap gap-2">
              {STOOL_TYPES.map(({ value, label, hint }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStoolType(value)}
                  className={`flex flex-col items-center rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                    stoolType === value
                      ? STOOL_SELECT[value] + ' ring-2 ring-offset-1'
                      : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <span>{label}</span>
                  <span className="text-[10px] opacity-60">{hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {editingId ? t('bowelTracker.update') : t('common.save')}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                {t('common.cancel')}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* History */}
      <div className="overflow-hidden rounded-2xl border border-teal-200 bg-white">
        <div className="border-b border-teal-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">{t('bowelTracker.history')}</p>
        </div>
        {loading ? (
          <p className="p-4 text-sm text-zinc-400">{t('common.loading')}</p>
        ) : logs.length === 0 ? (
          <p className="p-4 text-sm text-zinc-400">{t('bowelTracker.emptyHistory')}</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-800">
                    {log.count} {t('bowelTracker.timesUnit')}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STOOL_BADGE[log.stool_type]}`}>
                    {stoolLabel(log.stool_type)}
                  </span>
                  <span className="text-xs text-zinc-400">{formatDate(log.date, lang)}</span>
                  {log.time && <span className="text-xs text-zinc-400">· {log.time}</span>}
                  {log.notes && <span className="text-xs text-zinc-400">· {log.notes}</span>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => startEdit(log)}
                    className="rounded p-1.5 sm:p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                  >
                    <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteId(log.id)}
                    className="rounded p-1.5 sm:p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteId}
        itemContent={t('bowelTracker.deleteConfirmContent')}
        itemMeta={t('bowelTracker.deleteConfirmMeta')}
        onConfirm={() => { if (deleteId) { handleDelete(deleteId); setDeleteId(null) } }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
