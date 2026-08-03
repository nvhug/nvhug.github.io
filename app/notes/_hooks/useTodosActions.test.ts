// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Todo } from '@/types'
import { useTodosActions } from './useTodosActions'

const mockSupabaseFrom = vi.fn()
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

function todo(id: string): Todo {
  return {
    id,
    content: 'todo',
    is_done: false,
    priority: 3,
    created_at: '2026-08-03T00:00:00.000Z',
    updated_at: '2026-08-03T00:00:00.000Z',
  }
}

describe('useTodosActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds todo with trimmed content and refreshes list', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mockSupabaseFrom.mockReturnValue({ insert })

    const setSavingTodo = vi.fn()
    const setTodoDraft = vi.fn()
    const fetchTodos = vi.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useTodosActions({
        deleteTodo: null,
        editingTodoDraft: '',
        fetchTodos,
        setDeleteTodo: vi.fn(),
        setDeletingTodo: vi.fn(),
        setEditingTodoId: vi.fn(),
        setSavingTodo,
        setTodoDraft,
        setTodos: vi.fn(),
        t: (key) => key,
        todoDraft: '  buy milk  ',
      })
    )

    await act(async () => {
      await result.current.addTodo()
    })

    expect(insert).toHaveBeenCalledWith([{ content: 'buy milk', is_done: false, priority: 3 }])
    expect(setSavingTodo).toHaveBeenNthCalledWith(1, true)
    expect(setSavingTodo).toHaveBeenNthCalledWith(2, false)
    expect(setTodoDraft).toHaveBeenCalledWith('')
    expect(fetchTodos).toHaveBeenCalledTimes(1)
    expect(mockToastSuccess).toHaveBeenCalledWith('notes.todos.addSuccess')
  })

  it('always clears deleting flag after delete attempt', async () => {
    const eq = vi.fn().mockResolvedValue({ error: new Error('db error') })
    const del = vi.fn(() => ({ eq }))
    mockSupabaseFrom.mockReturnValue({ delete: del })

    const setDeletingTodo = vi.fn()

    const { result } = renderHook(() =>
      useTodosActions({
        deleteTodo: todo('todo-1'),
        editingTodoDraft: '',
        fetchTodos: vi.fn(),
        setDeleteTodo: vi.fn(),
        setDeletingTodo,
        setEditingTodoId: vi.fn(),
        setSavingTodo: vi.fn(),
        setTodoDraft: vi.fn(),
        setTodos: vi.fn(),
        t: (key) => key,
        todoDraft: '',
      })
    )

    await act(async () => {
      await result.current.confirmDeleteTodo()
    })

    expect(setDeletingTodo).toHaveBeenNthCalledWith(1, true)
    expect(setDeletingTodo).toHaveBeenNthCalledWith(2, false)
    expect(mockToastError).toHaveBeenCalledWith('notes.toasts.deleteError')
  })
})
