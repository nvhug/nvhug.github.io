'use client'

import { useCallback } from 'react'

import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import type { Todo } from '@/types'
import type { SetState, Translate } from '../_components/tabs/types'

type UseTodosActionsParams = {
  deleteTodo: Todo | null
  editingTodoDraft: string
  fetchTodos: () => Promise<void>
  setDeleteTodo: SetState<Todo | null>
  setDeletingTodo: SetState<boolean>
  setEditingTodoId: SetState<string | null>
  setSavingTodo: SetState<boolean>
  setTodoDraft: SetState<string>
  setTodos: SetState<Todo[]>
  t: Translate
  todoDraft: string
}

export function useTodosActions(params: UseTodosActionsParams) {
  const {
    deleteTodo,
    editingTodoDraft,
    fetchTodos,
    setDeleteTodo,
    setDeletingTodo,
    setEditingTodoId,
    setSavingTodo,
    setTodoDraft,
    setTodos,
    t,
    todoDraft,
  } = params

  const addTodo = useCallback(async () => {
    const content = todoDraft.trim()
    if (!content) return

    setSavingTodo(true)
    try {
      const { error } = await supabase.from('todos').insert([{
        content,
        is_done: false,
        priority: 3,
      }])
      if (error) throw error
      setTodoDraft('')
      await fetchTodos()
      toast.success(t('notes.todos.addSuccess'))
    } catch {
      toast.error(t('notes.todos.addError'))
    } finally {
      setSavingTodo(false)
    }
  }, [fetchTodos, setSavingTodo, setTodoDraft, t, todoDraft])

  const toggleTodo = useCallback(async (todo: Todo) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ is_done: !todo.is_done })
        .eq('id', todo.id)

      if (error) throw error
      setTodos((prev) => prev.map((item) => (item.id === todo.id ? { ...item, is_done: !item.is_done } : item)))
    } catch {
      toast.error(t('notes.toasts.updateError'))
    }
  }, [setTodos, t])

  const saveEditingTodo = useCallback(async (id: string) => {
    const content = editingTodoDraft.trim()
    if (!content) return
    try {
      const { error } = await supabase.from('todos').update({ content }).eq('id', id)
      if (error) throw error
      setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, content } : todo)))
      setEditingTodoId(null)
    } catch {
      toast.error(t('notes.toasts.updateError'))
    }
  }, [editingTodoDraft, setEditingTodoId, setTodos, t])

  const confirmDeleteTodo = useCallback(async () => {
    if (!deleteTodo) return
    setDeletingTodo(true)
    try {
      const { error } = await supabase.from('todos').delete().eq('id', deleteTodo.id)
      if (error) throw error
      setTodos((prev) => prev.filter((todo) => todo.id !== deleteTodo.id))
      setDeleteTodo(null)
      toast.success(t('notes.todos.deleted'))
    } catch {
      toast.error(t('notes.toasts.deleteError'))
    } finally {
      setDeletingTodo(false)
    }
  }, [deleteTodo, setDeleteTodo, setDeletingTodo, setTodos, t])

  return {
    addTodo,
    confirmDeleteTodo,
    saveEditingTodo,
    toggleTodo,
  }
}
