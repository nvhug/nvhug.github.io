'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { Check, ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getTagColor } from '@/lib/utils'
import type { BuyPick } from '@/types'
import { type BuyPickDetail, parseBuyPickNote, sumBuyPickDetails } from '../../_lib/buyPickDetails'

type Translate = (key: string, vars?: Record<string, string | number>) => string

const STATS_CHART_COLORS = [
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#6366f1',
  '#14b8a6',
  '#f97316',
  '#8b5cf6',
]

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
  updateBuyPickDetails: (pick: BuyPick, details: BuyPickDetail[]) => Promise<void>
  toggleBuyPickPurchased: (pick: BuyPick) => Promise<void>
  t: Translate
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
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
  updateBuyPickDetails,
  toggleBuyPickPurchased,
  t,
}: BuyPicksSectionProps) {
  const [activeMobileActionsId, setActiveMobileActionsId] = useState<string | null>(null)
  const [expandedPickId, setExpandedPickId] = useState<string | null>(null)
  const [statsExpanded, setStatsExpanded] = useState(false)
  const [statsFilter, setStatsFilter] = useState<'all' | 'worth_buying' | 'neutral' | 'not_worth_buying'>('all')
  const [statsSearch, setStatsSearch] = useState('')
  const [selectedStatsCategories, setSelectedStatsCategories] = useState<string[]>([])
  const [showPurchasedCountById, setShowPurchasedCountById] = useState<Record<string, boolean>>({})
  const [detailDrafts, setDetailDrafts] = useState<Record<string, { name: string; price: string; recommendation: BuyPickDetail['recommendation'] }>>({})
  const [editingDetail, setEditingDetail] = useState<{ pickId: string; detailId: string } | null>(null)
  const [editingDetailDraft, setEditingDetailDraft] = useState<{ name: string; price: string; recommendation: BuyPickDetail['recommendation'] }>({
    name: '',
    price: '',
    recommendation: 'worth_buying',
  })
  const editingNameRef = useRef<HTMLSpanElement | null>(null)
  const editingPriceRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!editingDetail || !editingNameRef.current) return

    // Focus the first editable field and place the caret at the end for true single-click editing.
    const editable = editingNameRef.current
    requestAnimationFrame(() => {
      editable.focus()
      const selection = window.getSelection()
      if (!selection) return
      const range = document.createRange()
      range.selectNodeContents(editable)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    })
  }, [editingDetail])

  const parsedDetailsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof parseBuyPickNote>>()
    for (const pick of buyPicks) {
      map.set(pick.id, parseBuyPickNote(pick.note))
    }
    return map
  }, [buyPicks])

  const purchasedItems = useMemo(() => {
    return buyPicks.flatMap((pick) => {
      const parsed = parsedDetailsById.get(pick.id)
      if (!parsed) return []

      return parsed.purchaseDetails.map((detail) => ({
        id: `${pick.id}-${detail.id}`,
        category: pick.category,
        emoji: pick.emoji,
        name: detail.name,
        price: detail.price,
        recommendation: detail.recommendation,
      }))
    })
  }, [buyPicks, parsedDetailsById])

  const statsCategories = useMemo(() => {
    return Array.from(new Set(purchasedItems.map((item) => item.category))).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [purchasedItems])

  const toggleStatsCategory = (category: string) => {
    setSelectedStatsCategories((prev) => (
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category]
    ))
  }

  const filteredPurchasedItems = useMemo(() => {
    const keyword = normalizeSearchText(statsSearch)

    return purchasedItems.filter((item) => {
      if (statsFilter !== 'all' && item.recommendation !== statsFilter) {
        return false
      }

      if (selectedStatsCategories.length > 0 && !selectedStatsCategories.includes(item.category)) {
        return false
      }

      if (!keyword) {
        return true
      }

      return [item.name, item.category].some((value) => normalizeSearchText(value).includes(keyword))
    })
  }, [purchasedItems, selectedStatsCategories, statsFilter, statsSearch])

  const filteredTotal = useMemo(() => {
    return filteredPurchasedItems.reduce((sum, item) => sum + item.price, 0)
  }, [filteredPurchasedItems])

  const statsChartData = useMemo(() => {
    const grouped = new Map<string, { category: string; total: number; count: number }>()

    for (const item of filteredPurchasedItems) {
      const current = grouped.get(item.category)
      if (!current) {
        grouped.set(item.category, { category: item.category, total: item.price, count: 1 })
        continue
      }

      current.total += item.price
      current.count += 1
    }

    return Array.from(grouped.values()).sort((a, b) => b.total - a.total)
  }, [filteredPurchasedItems])

  const statsChartTotal = useMemo(() => {
    return statsChartData.reduce((sum, item) => sum + item.total, 0)
  }, [statsChartData])

  const statsChartMaxTotal = statsChartData[0]?.total ?? 0

  const statsChartGradient = useMemo(() => {
    if (statsChartData.length === 0 || statsChartTotal <= 0) {
      return 'conic-gradient(#e4e4e7 0deg 360deg)'
    }

    let currentAngle = 0
    const segments = statsChartData.map((item, index) => {
      const angle = (item.total / statsChartTotal) * 360
      const start = currentAngle
      const end = currentAngle + angle
      currentAngle = end
      const color = STATS_CHART_COLORS[index % STATS_CHART_COLORS.length]
      return `${color} ${start}deg ${end}deg`
    })

    return `conic-gradient(${segments.join(', ')})`
  }, [statsChartData, statsChartTotal])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const toggleDetailsPanel = (pickId: string) => {
    setExpandedPickId((prev) => (prev === pickId ? null : pickId))
  }

  const handleAddDetail = async (pick: BuyPick) => {
    const draft = detailDrafts[pick.id] ?? { name: '', price: '', recommendation: 'worth_buying' }
    const name = draft.name.trim()
    const price = Number(draft.price.replace(/[^0-9]/g, ''))
    if (!name || !Number.isFinite(price) || price <= 0) {
      toast.error(t('notes.buyPicks.invalidDetail'))
      return
    }

    const parsed = parsedDetailsById.get(pick.id) ?? { noteText: '', purchaseDetails: [] }
    const details = [...parsed.purchaseDetails, {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      price,
      recommendation: draft.recommendation,
    }]
    await updateBuyPickDetails(pick, details)
    setDetailDrafts((prev) => ({ ...prev, [pick.id]: { name: '', price: '', recommendation: draft.recommendation } }))
  }

  const handleDeleteDetail = async (pick: BuyPick, detailId: string) => {
    const parsed = parsedDetailsById.get(pick.id)
    if (!parsed) return
    const details = parsed.purchaseDetails.filter((detail) => detail.id !== detailId)
    await updateBuyPickDetails(pick, details)
  }

  const startEditDetail = (
    pickId: string,
    detailId: string,
    currentName: string,
    currentPrice: number,
    currentRecommendation: BuyPickDetail['recommendation']
  ) => {
    setEditingDetail({ pickId, detailId })
    setEditingDetailDraft({ name: currentName, price: String(currentPrice), recommendation: currentRecommendation })
  }

  const cancelEditDetail = () => {
    setEditingDetail(null)
    setEditingDetailDraft({ name: '', price: '', recommendation: 'worth_buying' })
  }

  const saveEditDetail = async (pick: BuyPick, detailId: string) => {
    const parsed = parsedDetailsById.get(pick.id)
    if (!parsed) return

    const liveName = editingNameRef.current?.textContent ?? editingDetailDraft.name
    const livePrice = editingPriceRef.current?.textContent ?? editingDetailDraft.price
    const nextName = liveName.trim()
    const nextPrice = Number(livePrice.replace(/[^0-9]/g, ''))
    if (!nextName || !Number.isFinite(nextPrice) || nextPrice <= 0) {
      toast.error(t('notes.buyPicks.invalidDetail'))
      return
    }

    const details = parsed.purchaseDetails.map((detail) => (
      detail.id === detailId
        ? { ...detail, name: nextName, price: nextPrice, recommendation: editingDetailDraft.recommendation }
        : detail
    ))

    await updateBuyPickDetails(pick, details)
    cancelEditDetail()
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-slate-50 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">🛍️</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">{t('notes.buyPicks.heading')}</span>
        </div>
        <button
          onClick={openAddBuyPick}
          aria-label={t('notes.buyPicks.addCategory')}
          title={t('notes.buyPicks.addCategory')}
          className="inline-flex items-center justify-center rounded-md bg-teal-600 p-1 text-white hover:bg-teal-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
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
                className={`group relative rounded-xl border p-3 shadow-sm transition-all ${
                  expandedPickId === pick.id ? 'col-span-2 sm:col-span-3 lg:col-span-4' : ''
                } ${
                  pick.purchase_count > 0
                    ? 'border-green-300 bg-green-50 hover:border-green-400 hover:shadow-md'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md'
                }`}
              >
                <div className="mb-2 flex items-start gap-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowPurchasedCountById((prev) => ({ ...prev, [pick.id]: !prev[pick.id] }))
                      }}
                      className="shrink-0 text-base leading-none"
                      aria-label={t('notes.buyPicks.detailsToggle')}
                      title={t('notes.buyPicks.detailsToggle')}
                    >
                      {pick.emoji}
                    </button>
                    <span className="truncate group-hover:whitespace-normal group-hover:overflow-visible text-xs font-bold text-zinc-800 pr-14" title={pick.category}>{pick.category}</span>
                  </div>
                  <div className={`absolute top-1.5 right-1 flex shrink-0 items-center gap-0.5 transition-opacity ${activeMobileActionsId === pick.id ? 'opacity-100' : 'pointer-events-none opacity-0'} sm:pointer-events-auto sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowPurchasedCountById((prev) => ({ ...prev, [pick.id]: true }))
                        void toggleBuyPickPurchased(pick)
                      }}
                      className={`rounded p-1.5 transition-colors ${
                        pick.purchase_count > 0
                          ? 'text-green-600 hover:bg-green-100'
                          : 'text-zinc-400 hover:bg-zinc-100 hover:text-green-600'
                      }`}
                      title="Đánh dấu đã mua"
                    >
                      <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    </button>
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
                <div className="mt-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleDetailsPanel(pick.id)
                    }}
                    className="inline-flex items-center justify-center rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                    title={t('notes.buyPicks.detailsToggle')}
                  >
                    {expandedPickId === pick.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
                {expandedPickId === pick.id && (
                  <div className="mt-2 w-full space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                    <div className="flex w-full items-center justify-between rounded-md bg-emerald-50 px-2 py-1 text-[11px]">
                      <span className="font-medium text-emerald-700">{t('notes.buyPicks.itemTotal')}</span>
                      <span className="font-semibold text-emerald-800">
                        {formatCurrency(sumBuyPickDetails((parsedDetailsById.get(pick.id)?.purchaseDetails) ?? []))}
                      </span>
                    </div>

                    {(parsedDetailsById.get(pick.id)?.purchaseDetails.length ?? 0) === 0 && (
                      <p className="text-[11px] italic text-zinc-500">{t('notes.buyPicks.detailsEmpty')}</p>
                    )}

                    {(parsedDetailsById.get(pick.id)?.purchaseDetails ?? []).map((detail) => {
                      const isEditingDetail = editingDetail?.pickId === pick.id && editingDetail.detailId === detail.id

                      return (
                        <div key={detail.id} className="w-full rounded-lg border border-zinc-200 bg-white p-2">
                          {isEditingDetail ? (
                            <div
                              className="flex w-full items-center gap-1.5"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  void saveEditDetail(pick, detail.id)
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault()
                                  cancelEditDetail()
                                }
                              }}
                            >
                              <span
                                ref={editingNameRef}
                                contentEditable
                                suppressContentEditableWarning
                                onClick={(e) => e.stopPropagation()}
                                className="min-h-8 min-w-0 flex-1 cursor-text rounded-md bg-transparent px-2 py-1.5 text-xs text-zinc-800 outline-none"
                              >
                                {editingDetailDraft.name}
                              </span>
                              <span
                                ref={editingPriceRef}
                                contentEditable
                                suppressContentEditableWarning
                                onClick={(e) => e.stopPropagation()}
                                className="min-h-8 w-24 shrink-0 cursor-text rounded-md bg-transparent px-2 py-1.5 text-xs text-zinc-800 outline-none"
                              >
                                {editingDetailDraft.price}
                              </span>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingDetailDraft((prev) => ({ ...prev, recommendation: 'worth_buying' }))
                                  }}
                                  className={`rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${
                                    editingDetailDraft.recommendation === 'worth_buying'
                                      ? 'bg-emerald-200 text-emerald-900'
                                      : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                                  }`}
                                >
                                  {t('notes.buyPicks.optionWorth')}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingDetailDraft((prev) => ({ ...prev, recommendation: 'neutral' }))
                                  }}
                                  className={`rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${
                                    editingDetailDraft.recommendation === 'neutral'
                                      ? 'bg-slate-200 text-slate-900'
                                      : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                                  }`}
                                >
                                  {t('notes.buyPicks.optionNeutral')}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingDetailDraft((prev) => ({ ...prev, recommendation: 'not_worth_buying' }))
                                  }}
                                  className={`rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${
                                    editingDetailDraft.recommendation === 'not_worth_buying'
                                      ? 'bg-amber-200 text-amber-900'
                                      : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                                  }`}
                                >
                                  {t('notes.buyPicks.optionNotWorth')}
                                </button>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void saveEditDetail(pick, detail.id)
                                  }}
                                  className="rounded p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50"
                                  title={t('common.save')}
                                >
                                  <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    cancelEditDetail()
                                  }}
                                  className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                                  title={t('common.cancel')}
                                >
                                  <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className="flex w-full items-center gap-2"
                              onClick={(e) => {
                                e.stopPropagation()
                                startEditDetail(pick.id, detail.id, detail.name, detail.price, detail.recommendation)
                              }}
                              title={t('common.edit')}
                            >
                              <span className="min-w-0 flex-1 truncate text-xs text-zinc-700" title={detail.name}>{detail.name}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  detail.recommendation === 'worth_buying'
                                    ? 'bg-emerald-200 text-emerald-900'
                                    : detail.recommendation === 'neutral'
                                      ? 'bg-slate-200 text-slate-900'
                                      : 'bg-amber-200 text-amber-900'
                                }`}
                              >
                                {detail.recommendation === 'worth_buying'
                                  ? t('notes.buyPicks.optionWorth')
                                  : detail.recommendation === 'neutral'
                                    ? t('notes.buyPicks.optionNeutral')
                                    : t('notes.buyPicks.optionNotWorth')}
                              </span>
                              <span className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-900">{formatCurrency(detail.price)}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startEditDetail(pick.id, detail.id, detail.name, detail.price, detail.recommendation)
                                }}
                                className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                                aria-label={t('common.edit')}
                                title={t('common.edit')}
                              >
                                <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleDeleteDetail(pick, detail.id)
                                }}
                                className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                                aria-label={t('common.delete')}
                                title={t('common.delete')}
                              >
                                <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <div className="grid w-full grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,1fr)_11rem_auto_auto] sm:items-center">
                      <Input
                        value={detailDrafts[pick.id]?.name ?? ''}
                        onChange={(e) => setDetailDrafts((prev) => ({
                          ...prev,
                          [pick.id]: { ...(prev[pick.id] ?? { name: '', price: '', recommendation: 'worth_buying' }), name: e.target.value },
                        }))}
                        onClick={(e) => e.stopPropagation()}
                        placeholder={t('notes.buyPicks.detailNamePlaceholder')}
                        className="h-8 w-full text-xs"
                      />
                      <Input
                        value={detailDrafts[pick.id]?.price ?? ''}
                        onChange={(e) => setDetailDrafts((prev) => ({
                          ...prev,
                          [pick.id]: { ...(prev[pick.id] ?? { name: '', price: '', recommendation: 'worth_buying' }), price: e.target.value },
                        }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void handleAddDetail(pick)
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        inputMode="numeric"
                        placeholder={t('notes.buyPicks.detailPricePlaceholder')}
                        className="h-8 w-full text-xs"
                      />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailDrafts((prev) => ({
                              ...prev,
                              [pick.id]: { ...(prev[pick.id] ?? { name: '', price: '', recommendation: 'worth_buying' }), recommendation: 'worth_buying' },
                            }))
                          }}
                          className={`rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${(detailDrafts[pick.id]?.recommendation ?? 'worth_buying') === 'worth_buying' ? 'bg-emerald-200 text-emerald-900' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
                        >
                          {t('notes.buyPicks.optionWorth')}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailDrafts((prev) => ({
                              ...prev,
                              [pick.id]: { ...(prev[pick.id] ?? { name: '', price: '', recommendation: 'worth_buying' }), recommendation: 'neutral' },
                            }))
                          }}
                          className={`rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${(detailDrafts[pick.id]?.recommendation ?? 'worth_buying') === 'neutral' ? 'bg-slate-200 text-slate-900' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
                        >
                          {t('notes.buyPicks.optionNeutral')}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailDrafts((prev) => ({
                              ...prev,
                              [pick.id]: { ...(prev[pick.id] ?? { name: '', price: '', recommendation: 'worth_buying' }), recommendation: 'not_worth_buying' },
                            }))
                          }}
                          className={`rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${(detailDrafts[pick.id]?.recommendation ?? 'worth_buying') === 'not_worth_buying' ? 'bg-amber-200 text-amber-900' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
                        >
                          {t('notes.buyPicks.optionNotWorth')}
                        </button>
                      </div>
                      <Button
                        size="sm"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleAddDetail(pick)
                        }}
                        aria-label={t('notes.buyPicks.addDetail')}
                        title={t('notes.buyPicks.addDetail')}
                        className="h-8 w-full bg-emerald-600 px-2 text-white hover:bg-emerald-700 sm:w-8 sm:p-0"
                      >
                        <Plus className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {pick.purchase_count > 0 && expandedPickId !== pick.id && showPurchasedCountById[pick.id] && (
                  <span className="absolute bottom-2 left-2 inline-flex items-center justify-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                    {pick.purchase_count}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {buyPicks.length > 0 && (
          <div className="mt-3 rounded-lg border border-zinc-200 bg-white">
            <button
              type="button"
              onClick={() => setStatsExpanded((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-2 text-left"
              aria-label={t('notes.buyPicks.statsToggle')}
              title={t('notes.buyPicks.statsToggle')}
            >
              <span className="text-xs font-semibold text-zinc-800">{t('notes.buyPicks.statsHeading')}</span>
              {statsExpanded ? <ChevronUp className="h-4 w-4 text-zinc-600" /> : <ChevronDown className="h-4 w-4 text-zinc-600" />}
            </button>

            {statsExpanded && (
              <div className="border-t border-zinc-200 px-2.5 py-2">
                <div className="mb-1.5 flex flex-wrap items-center gap-1">
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStatsFilter('all')}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        statsFilter === 'all' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {t('notes.buyPicks.statsFilterAll')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatsFilter('worth_buying')}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        statsFilter === 'worth_buying' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      }`}
                    >
                      {t('notes.buyPicks.optionWorth')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatsFilter('neutral')}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        statsFilter === 'neutral' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {t('notes.buyPicks.optionNeutral')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatsFilter('not_worth_buying')}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        statsFilter === 'not_worth_buying' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900 hover:bg-amber-300'
                      }`}
                    >
                      {t('notes.buyPicks.optionNotWorth')}
                    </button>
                  </div>

                  <Input
                    value={statsSearch}
                    onChange={(e) => setStatsSearch(e.target.value)}
                    placeholder={t('notes.buyPicks.statsSearchPlaceholder')}
                    className="h-7 min-w-48 flex-1 text-xs"
                  />

                  <div className="ml-auto shrink-0 whitespace-nowrap px-0.5 py-0.5 text-right">
                    <span className="text-xs font-medium text-zinc-600">{t('notes.buyPicks.grandTotal')}: </span>
                    <span className="text-xs font-semibold text-zinc-900">{formatCurrency(filteredTotal)}</span>
                  </div>
                </div>

                <div className="mb-1.5 flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedStatsCategories([])}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      selectedStatsCategories.length === 0
                        ? 'bg-zinc-800 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {t('notes.buyPicks.statsCategoryAll')}
                  </button>

                  {statsCategories.map((category) => {
                    const isActive = selectedStatsCategories.includes(category)
                    const colors = getTagColor(category)
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleStatsCategory(category)}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                          isActive
                            ? `${colors.bg} ${colors.text} ${colors.border} border`
                            : `${colors.bg} ${colors.text} ${colors.border} border opacity-75 hover:opacity-100`
                        }`}
                        title={category}
                      >
                        {category}
                      </button>
                    )
                  })}
                </div>

                {filteredPurchasedItems.length === 0 ? (
                  <p className="text-xs italic text-zinc-500">{t('notes.buyPicks.statsEmpty')}</p>
                ) : (
                  <div className="space-y-1">
                    {filteredPurchasedItems.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between rounded-md px-2 py-1 text-xs ${
                          item.recommendation === 'worth_buying' ? 'bg-emerald-50' : item.recommendation === 'neutral' ? 'bg-slate-50' : 'bg-amber-50'
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate text-zinc-700" title={item.name}>{item.emoji} {item.name}</span>
                        <span
                          className={`mx-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            item.recommendation === 'worth_buying'
                              ? 'bg-emerald-200 text-emerald-900'
                              : item.recommendation === 'neutral'
                                ? 'bg-slate-200 text-slate-900'
                                : 'bg-amber-200 text-amber-900'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${item.recommendation === 'worth_buying' ? 'bg-emerald-700' : item.recommendation === 'neutral' ? 'bg-slate-700' : 'bg-amber-700'}`} />
                          {item.recommendation === 'worth_buying'
                            ? t('notes.buyPicks.optionWorth')
                            : item.recommendation === 'neutral'
                              ? t('notes.buyPicks.optionNeutral')
                              : t('notes.buyPicks.optionNotWorth')}
                        </span>
                        <span className="mx-2 truncate text-[11px] text-zinc-500">{item.category}</span>
                        <span className="font-semibold text-zinc-900">
                          {formatCurrency(item.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 rounded-xl border border-sky-100/80 bg-linear-to-br from-white via-sky-50/50 to-cyan-50/60 p-2.5 shadow-[0_14px_30px_-22px_rgba(2,132,199,0.9)]">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-zinc-700">{t('notes.buyPicks.statsChartHeading')}</p>
                    <span className="rounded-full border border-sky-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-sky-700">
                      {statsChartData.length} {t('notes.buyPicks.statsCategoryUnit')}
                    </span>
                  </div>

                  {statsChartData.length === 0 ? (
                    <p className="text-[11px] italic text-zinc-500">{t('notes.buyPicks.statsChartEmpty')}</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-[6.75rem_minmax(0,1fr)] sm:items-center">
                      <div className="relative mx-auto h-24 w-24">
                        <div className="absolute inset-0 rounded-full bg-sky-300/20 blur-md" />
                        <div className="relative h-full w-full rounded-full ring-2 ring-white/70" style={{ background: statsChartGradient }}>
                          <div className="absolute inset-3.5 flex items-center justify-center rounded-full border border-sky-100 bg-white text-center shadow-inner">
                            <div>
                              <p className="text-[10px] text-zinc-500">{t('notes.buyPicks.statsTotalLabel')}</p>
                              <p className="text-[11px] font-semibold text-zinc-800">{formatCurrency(statsChartTotal)}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {statsChartData.map((row, index) => {
                          const percent = statsChartTotal > 0 ? Math.round((row.total / statsChartTotal) * 100) : 0
                          const color = STATS_CHART_COLORS[index % STATS_CHART_COLORS.length]
                          return (
                            <div key={row.category} className="flex items-center justify-between gap-2 rounded-md border border-white/80 bg-white/85 px-1.5 py-1 text-[10px] backdrop-blur">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                <span className="truncate font-medium text-zinc-700" title={row.category}>{row.category}</span>
                              </div>
                              <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600">{percent}% • {row.count}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2 rounded-xl border border-emerald-100 bg-linear-to-br from-white via-emerald-50/40 to-teal-50/60 p-2.5 shadow-[0_14px_30px_-24px_rgba(5,150,105,0.9)]">
                  <p className="mb-1.5 text-[11px] font-semibold text-zinc-700">{t('notes.buyPicks.statsBarChartHeading')}</p>

                  {statsChartData.length === 0 ? (
                    <p className="text-[11px] italic text-zinc-500">{t('notes.buyPicks.statsChartEmpty')}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {statsChartData.map((row, index) => {
                        const color = STATS_CHART_COLORS[index % STATS_CHART_COLORS.length]
                        const width = statsChartMaxTotal > 0 ? (row.total / statsChartMaxTotal) * 100 : 0
                        const relativePercent = Math.round(width)
                        return (
                          <div key={`${row.category}-bar`} className="rounded-lg border border-white/80 bg-white/90 px-2 py-1 backdrop-blur">
                            <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px]">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-semibold text-white">{index + 1}</span>
                                <span className="truncate font-medium text-zinc-700" title={row.category}>{row.category}</span>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 font-semibold text-white">{formatCurrency(row.total)}</span>
                                <span className="ml-1 text-[9px] font-medium text-zinc-500">{relativePercent}%</span>
                              </div>
                            </div>
                            <div className="relative h-2 overflow-hidden rounded-full bg-zinc-200/80">
                              <div
                                className="h-full rounded-full transition-all duration-500 ease-out"
                                style={{
                                  width: `${width}%`,
                                  background: `linear-gradient(90deg, ${color} 0%, ${color}CC 100%)`,
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}