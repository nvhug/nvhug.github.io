'use client'

import { useCallback } from 'react'

import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { BuyPick } from '@/types'
import type { BuyPickFormState, SetState, Translate } from '../_components/tabs/types'
import { type BuyPickDetail, parseBuyPickNote, serializeBuyPickNote } from '../_lib/buyPickDetails'

type UseBuyPicksActionsParams = {
  buyPickForm: BuyPickFormState
  buyPicks: BuyPick[]
  deleteBuyPick: BuyPick | null
  editingBuyPickId: string | null
  setAddingBuyPick: SetState<boolean>
  setBuyPickForm: SetState<BuyPickFormState>
  setBuyPicks: SetState<BuyPick[]>
  setDeleteBuyPick: SetState<BuyPick | null>
  setDeletingBuyPick: SetState<boolean>
  setEditingBuyPickId: SetState<string | null>
  setSavingBuyPick: SetState<boolean>
  t: Translate
}

const EMPTY_FORM: BuyPickFormState = { category: '', emoji: '🛒', brands: [], note: '', brandInput: '' }

export function useBuyPicksActions(params: UseBuyPicksActionsParams) {
  const {
    buyPickForm,
    buyPicks,
    deleteBuyPick,
    editingBuyPickId,
    setAddingBuyPick,
    setBuyPickForm,
    setBuyPicks,
    setDeleteBuyPick,
    setDeletingBuyPick,
    setEditingBuyPickId,
    setSavingBuyPick,
    t,
  } = params

  const startEditBuyPick = useCallback((pick: BuyPick) => {
    setAddingBuyPick(false)
    setEditingBuyPickId(pick.id)
    setBuyPickForm({ category: pick.category, emoji: pick.emoji, brands: [...pick.brands], note: pick.note ?? '', brandInput: '' })
  }, [setAddingBuyPick, setBuyPickForm, setEditingBuyPickId])

  const cancelBuyPickForm = useCallback(() => {
    setEditingBuyPickId(null)
    setAddingBuyPick(false)
    setBuyPickForm(EMPTY_FORM)
  }, [setAddingBuyPick, setBuyPickForm, setEditingBuyPickId])

  const openAddBuyPick = useCallback(() => {
    setEditingBuyPickId(null)
    setBuyPickForm(EMPTY_FORM)
    setAddingBuyPick(true)
  }, [setAddingBuyPick, setBuyPickForm, setEditingBuyPickId])

  const saveBuyPick = useCallback(async () => {
    const { category, emoji, brands, brandInput, note } = buyPickForm
    if (!category.trim()) return

    const pending = brandInput.split(',').map((b) => b.trim()).filter((b) => b && !brands.includes(b))
    const finalBrands = [...brands, ...pending]

    setSavingBuyPick(true)
    try {
      if (editingBuyPickId) {
        const { error } = await supabase
          .from('buy_picks')
          .update({ category: category.trim(), emoji: emoji || '🛒', brands: finalBrands, note: note.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', editingBuyPickId)
        if (error) {
          toast.error(t('notes.buyPicks.updateError'))
          return
        }

        setBuyPicks((prev) => prev.map((pick) => pick.id === editingBuyPickId ? { ...pick, category: category.trim(), emoji: emoji || '🛒', brands: finalBrands, note: note.trim() || undefined } : pick))
        toast.success(t('notes.buyPicks.updateSuccess'))
        cancelBuyPickForm()
        return
      }

      const { data: { user } } = await getSupabaseBrowserClient().auth.getUser()
      const { data, error } = await supabase
        .from('buy_picks')
        .insert([{ user_id: user?.id, category: category.trim(), emoji: emoji || '🛒', brands: finalBrands, note: note.trim() || null, order_index: buyPicks.length }])
        .select()
        .single()

      if (error || !data) {
        toast.error(t('notes.buyPicks.addError'))
        return
      }

      setBuyPicks((prev) => [...prev, data as BuyPick])
      toast.success(t('notes.buyPicks.addSuccess'))
      cancelBuyPickForm()
    } finally {
      setSavingBuyPick(false)
    }
  }, [buyPickForm, buyPicks.length, cancelBuyPickForm, editingBuyPickId, setBuyPicks, setSavingBuyPick, t])

  const toggleBuyPickPurchased = useCallback(async (pick: BuyPick) => {
    const next = pick.purchase_count + 1
    setBuyPicks((prev) => prev.map((p) => p.id === pick.id ? { ...p, purchase_count: next } : p))
    const { error } = await supabase.from('buy_picks').update({ purchase_count: next }).eq('id', pick.id)
    if (error) {
      setBuyPicks((prev) => prev.map((p) => p.id === pick.id ? { ...p, purchase_count: pick.purchase_count } : p))
      toast.error(t('notes.buyPicks.updateError'))
    }
  }, [setBuyPicks, t])

  const updateBuyPickDetails = useCallback(async (pick: BuyPick, details: BuyPickDetail[]) => {
    const now = new Date().toISOString()
    const previousNote = pick.note ?? null
    const { noteText } = parseBuyPickNote(previousNote)
    const nextNote = serializeBuyPickNote({ noteText, purchaseDetails: details })

    setBuyPicks((prev) => prev.map((item) => item.id === pick.id
      ? { ...item, note: nextNote ?? undefined, updated_at: now }
      : item
    ))

    const { error } = await supabase
      .from('buy_picks')
      .update({ note: nextNote, updated_at: now })
      .eq('id', pick.id)

    if (error) {
      setBuyPicks((prev) => prev.map((item) => item.id === pick.id
        ? { ...item, note: previousNote ?? undefined }
        : item
      ))
      toast.error(t('notes.buyPicks.updateError'))
    }
  }, [setBuyPicks, t])

  const confirmDeleteBuyPick = useCallback(async () => {
    if (!deleteBuyPick) return

    setDeletingBuyPick(true)
    try {
      const { error } = await supabase.from('buy_picks').delete().eq('id', deleteBuyPick.id)

      if (error) {
        toast.error(t('notes.buyPicks.deleteError'))
        return
      }

      setBuyPicks((prev) => prev.filter((pick) => pick.id !== deleteBuyPick.id))
      toast.success(t('notes.buyPicks.deleteSuccess'))
      setDeleteBuyPick(null)
    } catch {
      toast.error(t('notes.buyPicks.deleteError'))
    } finally {
      setDeletingBuyPick(false)
    }
  }, [deleteBuyPick, setBuyPicks, setDeleteBuyPick, setDeletingBuyPick, t])

  return {
    toggleBuyPickPurchased,
    cancelBuyPickForm,
    confirmDeleteBuyPick,
    openAddBuyPick,
    saveBuyPick,
    startEditBuyPick,
    updateBuyPickDetails,
  }
}
