// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBuyPicksActions } from './useBuyPicksActions'

const mockSupabaseFrom = vi.fn()
const mockGetSupabaseBrowserClient = vi.fn(() => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
  },
}))
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}))

vi.mock('@/lib/supabase-browser', () => ({
  getSupabaseBrowserClient: () => mockGetSupabaseBrowserClient(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

describe('useBuyPicksActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resets deleting flag and shows error toast when delete throws', async () => {
    const eq = vi.fn().mockRejectedValue(new Error('network error'))
    const del = vi.fn(() => ({ eq }))
    mockSupabaseFrom.mockReturnValue({ delete: del })

    const setAddingBuyPick = vi.fn()
    const setBuyPickForm = vi.fn()
    const setBuyPicks = vi.fn()
    const setDeleteBuyPick = vi.fn()
    const setDeletingBuyPick = vi.fn()
    const setEditingBuyPickId = vi.fn()
    const setSavingBuyPick = vi.fn()

    const { result } = renderHook(() =>
      useBuyPicksActions({
        buyPickForm: { category: '', emoji: '🛒', brands: [], note: '', brandInput: '' },
        buyPicks: [],
        deleteBuyPick: {
          id: 'pick-1',
          user_id: 'user-1',
          category: 'Groceries',
          emoji: '🛒',
          brands: ['A'],
          note: '',
          order_index: 0,
          created_at: '2026-08-03T00:00:00.000Z',
          updated_at: '2026-08-03T00:00:00.000Z',
        },
        editingBuyPickId: null,
        setAddingBuyPick,
        setBuyPickForm,
        setBuyPicks,
        setDeleteBuyPick,
        setDeletingBuyPick,
        setEditingBuyPickId,
        setSavingBuyPick,
        t: (key) => key,
      })
    )

    await act(async () => {
      await result.current.confirmDeleteBuyPick()
    })

    expect(setDeletingBuyPick).toHaveBeenNthCalledWith(1, true)
    expect(setDeletingBuyPick).toHaveBeenNthCalledWith(2, false)
    expect(mockToastError).toHaveBeenCalledWith('notes.buyPicks.deleteError')
    expect(setDeleteBuyPick).not.toHaveBeenCalled()
  })

  it('deletes buy pick and clears selection on success', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const del = vi.fn(() => ({ eq }))
    mockSupabaseFrom.mockReturnValue({ delete: del })

    const setBuyPicks = vi.fn()
    const setDeleteBuyPick = vi.fn()

    const { result } = renderHook(() =>
      useBuyPicksActions({
        buyPickForm: { category: '', emoji: '🛒', brands: [], note: '', brandInput: '' },
        buyPicks: [],
        deleteBuyPick: {
          id: 'pick-1',
          user_id: 'user-1',
          category: 'Groceries',
          emoji: '🛒',
          brands: ['A'],
          note: '',
          order_index: 0,
          created_at: '2026-08-03T00:00:00.000Z',
          updated_at: '2026-08-03T00:00:00.000Z',
        },
        editingBuyPickId: null,
        setAddingBuyPick: vi.fn(),
        setBuyPickForm: vi.fn(),
        setBuyPicks,
        setDeleteBuyPick,
        setDeletingBuyPick: vi.fn(),
        setEditingBuyPickId: vi.fn(),
        setSavingBuyPick: vi.fn(),
        t: (key) => key,
      })
    )

    await act(async () => {
      await result.current.confirmDeleteBuyPick()
    })

    expect(setBuyPicks).toHaveBeenCalledTimes(1)
    expect(setDeleteBuyPick).toHaveBeenCalledWith(null)
    expect(mockToastSuccess).toHaveBeenCalledWith('notes.buyPicks.deleteSuccess')
  })
})
