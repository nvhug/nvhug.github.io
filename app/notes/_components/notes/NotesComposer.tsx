'use client'

import { Check, Plus, Sparkles, Star, ThumbsDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { TagInput } from '@/components/ui/tag-input'

type Translate = (key: string, vars?: Record<string, string | number>) => string

type Draft = {
  note_date: string
  content: string
  type: 'good' | 'bad'
  priority: number
  completion_percentage: number
  tags: string[]
  hide_meta: boolean
}

type NotesComposerProps = {
  allTags: string[]
  cancelDraft: () => void
  draft: Draft | null
  openDraft: () => void
  saveDraft: () => void
  savingDraft: boolean
  t: Translate
  textareaClass: string
  updateDraft: (patch: Partial<Draft>) => void
}

export function NotesComposer({ allTags, cancelDraft, draft, openDraft, saveDraft, savingDraft, t, textareaClass, updateDraft }: NotesComposerProps) {
  return (
    <div className="border-b border-emerald-100 px-4 py-3.5">
      {draft ? (
        <div className="flex flex-col gap-2 rounded-xl border-l-4 border-dashed border-emerald-300 bg-emerald-50/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker value={draft.note_date} onChange={(v) => updateDraft({ note_date: v })} />
            <div className="inline-flex overflow-hidden rounded-lg border border-emerald-200">
              <button
                type="button"
                onClick={() => updateDraft({ type: 'good' })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                  draft.type === 'good' ? 'bg-emerald-500 text-white' : 'bg-white text-zinc-600 hover:bg-emerald-50'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t('notes.composer.good')}
              </button>
              <button
                type="button"
                onClick={() => updateDraft({ type: 'bad' })}
                className={`inline-flex items-center gap-1.5 border-l border-emerald-200 px-3 py-1.5 text-sm font-medium transition-colors ${
                  draft.type === 'bad' ? 'bg-amber-500 text-white' : 'bg-white text-zinc-600 hover:bg-amber-50'
                }`}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                {t('notes.composer.bad')}
              </button>
            </div>
            <div className="inline-flex items-center gap-0.5">
              {([1, 2, 3, 4, 5] as const).map((star) => (
                <button key={star} type="button" onClick={() => updateDraft({ priority: star })}>
                  <Star className={`h-3.5 w-3.5 ${star <= draft.priority ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'}`} />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={draft.completion_percentage}
                onChange={(e) => updateDraft({ completion_percentage: Number(e.target.value) })}
                className="w-32 sm:w-48"
              />
              <span className="w-8 text-right text-xs font-medium text-zinc-600">{draft.completion_percentage}%</span>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500 select-none">
                <input
                  type="checkbox"
                  checked={draft.hide_meta}
                  onChange={(e) => updateDraft({ hide_meta: e.target.checked })}
                  className="h-3.5 w-3.5 accent-emerald-500"
                />
                <span className="hidden sm:inline">{t('notes.composer.hideProgress')}</span>
              </label>
            </div>
          </div>
          <textarea
            autoFocus
            rows={3}
            value={draft.content}
            onChange={(e) => updateDraft({ content: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelDraft()
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                saveDraft()
              }
            }}
            placeholder={t('notes.composer.placeholder')}
            className={textareaClass}
          />
          <TagInput value={draft.tags} onChange={(tags) => updateDraft({ tags })} suggestions={allTags} />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={cancelDraft} className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700">
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              disabled={savingDraft || !draft.content.trim()}
              onClick={saveDraft}
              className="bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500"
            >
              <Check />
              {t('notes.composer.saveNote')}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openDraft}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-300 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
        >
          <Plus className="h-4 w-4" />
          {t('notes.composer.addNew')}
        </button>
      )}
    </div>
  )
}