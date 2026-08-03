'use client'

import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { Pencil, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getTagColor } from '@/lib/utils'
import type { BuyPick } from '@/types'

type Translate = (key: string, vars?: Record<string, string | number>) => string

type BuyPickFormState = {
  category: string
  emoji: string
  brands: string[]
  note: string
  brandInput: string
}

type BuyPicksSectionProps = {
  addingBuyPick: boolean
  buyPickForm: BuyPickFormState
  buyPicks: BuyPick[]
  cancelBuyPickForm: () => void
  editingBuyPickId: string | null
  openAddBuyPick: () => void
  saveBuyPick: () => void
  savingBuyPick: boolean
  setBuyPickForm: Dispatch<SetStateAction<BuyPickFormState>>
  setDeleteBuyPick: (pick: BuyPick) => void
  startEditBuyPick: (pick: BuyPick) => void
  t: Translate
}

export function BuyPicksSection({
  addingBuyPick,
  buyPickForm,
  buyPicks,
  cancelBuyPickForm,
  editingBuyPickId,
  openAddBuyPick,
  saveBuyPick,
  savingBuyPick,
  setBuyPickForm,
  setDeleteBuyPick,
  startEditBuyPick,
  t,
}: BuyPicksSectionProps) {
  const [activeMobileActionsId, setActiveMobileActionsId] = useState<string | null>(null)

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-slate-50 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">🛍️</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">{t('notes.buyPicks.heading')}</span>
        </div>
        <button
          onClick={openAddBuyPick}
          className="flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
        >
          <Plus className="h-3 w-3" />
          {t('notes.buyPicks.addCategory')}
        </button>
      </div>

      <div className="px-4 py-3">
        {(addingBuyPick || editingBuyPickId) && (
          <div className="mb-3 space-y-2 rounded-lg border border-zinc-200 bg-white p-3">
            <div className="flex flex-wrap gap-1">
              {['🔋','🔌','🔊','🎧','📱','💻','⌨️','🖥️','📷','🎮','👕','👖','👟','🩲','👜','🧴','💊','📚','🍎','🏠','🚗','✈️','🎨','🖊️','🧸'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setBuyPickForm((prev) => ({ ...prev, emoji }))}
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-amber-100 ${buyPickForm.emoji === emoji ? 'bg-amber-200 ring-1 ring-amber-400' : ''}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={buyPickForm.emoji}
                onChange={(e) => setBuyPickForm((prev) => ({ ...prev, emoji: e.target.value }))}
                className="h-8 w-8 shrink-0 rounded-md border border-amber-200 bg-white text-center text-base outline-none focus:border-amber-400"
                maxLength={2}
                title="Hoặc gõ emoji bất kỳ"
              />
              <Input
                autoFocus
                value={buyPickForm.category}
                onChange={(e) => setBuyPickForm((prev) => ({ ...prev, category: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancelBuyPickForm()
                }}
                placeholder={t('notes.buyPicks.categoryPlaceholder')}
                className="flex-1 h-8 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {buyPickForm.brands.map((brand, index) => {
                const colors = getTagColor(brand)
                return (
                  <span key={index} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.border} ${colors.text}`}>
                    {brand}
                    <button
                      type="button"
                      onClick={() => setBuyPickForm((prev) => ({ ...prev, brands: prev.brands.filter((_, brandIndex) => brandIndex !== index) }))}
                      className="opacity-60 transition-opacity hover:opacity-100"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )
              })}
              <Input
                value={buyPickForm.brandInput}
                onChange={(e) => setBuyPickForm((prev) => ({ ...prev, brandInput: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const newBrands = buyPickForm.brandInput.split(',').map((brand) => brand.trim()).filter((brand) => brand && !buyPickForm.brands.includes(brand))
                    if (newBrands.length > 0) {
                      setBuyPickForm((prev) => ({ ...prev, brands: [...prev.brands, ...newBrands], brandInput: '' }))
                    }
                  }
                }}
                placeholder={t('notes.buyPicks.brandPlaceholder')}
                className="h-7 w-40 text-xs"
              />
            </div>
            <div className="flex justify-end gap-1.5">
              <Button variant="ghost" size="sm" onClick={cancelBuyPickForm} className="h-7 text-xs text-zinc-500">
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={() => void saveBuyPick()}
                disabled={savingBuyPick || !buyPickForm.category.trim()}
                className="h-7 bg-amber-500 text-xs text-white hover:bg-amber-600"
              >
                {t('common.save')}
              </Button>
            </div>
          </div>
        )}

        {buyPicks.length === 0 && !addingBuyPick ? (
          <p className="py-4 text-center text-sm text-zinc-400">{t('notes.buyPicks.empty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.25 sm:grid-cols-3 lg:grid-cols-4">
            {buyPicks.map((pick) => editingBuyPickId !== pick.id && (
              <div
                key={pick.id}
                onClick={() => setActiveMobileActionsId((prev) => prev === pick.id ? null : pick.id)}
                className="group rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md"
              >
                <div className="mb-2 flex items-start justify-between gap-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 text-base leading-none">{pick.emoji}</span>
                    <span className="truncate text-xs font-bold text-zinc-800">{pick.category}</span>
                  </div>
                  <div className={`flex shrink-0 transition-opacity ${activeMobileActionsId === pick.id ? 'opacity-100' : 'pointer-events-none opacity-0'} sm:pointer-events-auto sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        startEditBuyPick(pick)
                      }}
                      className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    >
                      <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteBuyPick(pick)
                      }}
                      className="rounded p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {pick.brands.length > 0 ? pick.brands.map((brand, index) => {
                    const colors = getTagColor(brand)
                    return (
                      <span key={index} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${colors.bg} ${colors.border} ${colors.text}`}>
                        {brand}
                      </span>
                    )
                  }) : (
                    <span className="text-[10px] italic text-zinc-400">{t('notes.buyPicks.noBrands')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}