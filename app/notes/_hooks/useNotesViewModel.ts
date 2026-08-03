'use client'

import { useMemo, useState } from 'react'

import type { Note, Todo } from '@/types'
import type { Translate, TypeFilter } from '../_components/tabs/types'
import { buildNotesViewModel } from '../_lib/notesViewModel'

export function useNotesViewModel(params: {
  notes: Note[]
  t: Translate
  todos: Todo[]
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  const model = useMemo(
    () => buildNotesViewModel({
      notes: params.notes,
      searchQuery,
      t: params.t,
      todos: params.todos,
      typeFilter,
    }),
    [params.notes, params.t, params.todos, searchQuery, typeFilter]
  )

  return {
    ...model,
    searchQuery,
    setSearchQuery,
    setTypeFilter,
    typeFilter,
  }
}
