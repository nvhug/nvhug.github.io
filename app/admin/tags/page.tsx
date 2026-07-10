'use client'

import { useEffect, useState } from 'react'
import { Check, Hash, Pencil, Plus, Tag as TagIcon, Trash2, X } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { Tag } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type TagWithCount = Tag & { postCount: number }
type TagRow = Tag & { post_tags: { count: number }[] }

export default function AdminTagsPage() {
  const [tags, setTags] = useState<TagWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [newTagName, setNewTagName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function fetchTags(withLoading = true) {
    if (withLoading) {
      setLoading(true)
    }
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*, post_tags(count)')
        .order('name')

      if (error) throw error

      const rows = (data || []) as TagRow[]
      setTags(
        rows.map(({ post_tags, ...tag }) => ({
          ...tag,
          postCount: post_tags[0]?.count ?? 0,
        }))
      )
    } catch (error) {
      console.error('Error fetching tags:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchTags(false)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  async function handleCreate() {
    const name = newTagName.trim()
    if (!name) return

    setCreating(true)
    try {
      const { error } = await supabase.from('tags').insert([{ name }])
      if (error) throw error
      setNewTagName('')
      await fetchTags()
    } catch (error) {
      console.error('Error creating tag:', error)
      alert('Failed to create tag. It may already exist.')
    } finally {
      setCreating(false)
    }
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id)
    setEditingName(tag.name)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingName('')
  }

  async function saveEdit(tag: Tag) {
    const name = editingName.trim()
    if (!name || name === tag.name) {
      cancelEdit()
      return
    }

    setBusyId(tag.id)
    try {
      const { error } = await supabase.from('tags').update({ name }).eq('id', tag.id)
      if (error) throw error
      setTags((prev) => prev.map((t) => (t.id === tag.id ? { ...t, name } : t)))
      cancelEdit()
    } catch (error) {
      console.error('Error updating tag:', error)
      alert('Failed to rename tag. The name may already be in use.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(tag: TagWithCount) {
    const message =
      tag.postCount > 0
        ? `"${tag.name}" is used by ${tag.postCount} post(s). Delete it anyway?`
        : `Delete tag "${tag.name}"?`
    if (!confirm(message)) return

    setBusyId(tag.id)
    try {
      const { error } = await supabase.from('tags').delete().eq('id', tag.id)
      if (error) throw error
      setTags((prev) => prev.filter((t) => t.id !== tag.id))
    } catch (error) {
      console.error('Error deleting tag:', error)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#ffffff_0%,#f7fef9_45%,#ecfdf5_100%)] p-6 shadow-[0_30px_60px_-45px_rgba(16,185,129,0.45)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_16px_28px_-16px_rgba(16,185,129,0.9)]">
              <TagIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">Taxonomy</p>
              <h2 className="mt-1 font-poppins text-2xl font-semibold leading-tight text-zinc-900">Tag Manager</h2>
              <p className="mt-1 text-sm text-zinc-600">Create and maintain topics used to classify your posts.</p>
            </div>
          </div>

          <div className="grid min-w-45 gap-2 rounded-xl border border-emerald-100 bg-white p-3 text-right shadow-[0_1px_0_0_rgba(16,185,129,0.15)]">
            <p className="text-xs font-medium text-zinc-600">Total tags</p>
            <p className="text-2xl font-semibold leading-none text-zinc-900">{tags.length}</p>
            <p className="text-xs text-zinc-500">Live in the content system</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_30px_60px_-45px_rgba(16,185,129,0.32)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-emerald-100 px-3 py-3">
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCreate()
              }
            }}
            placeholder="New tag name"
            className="h-9 max-w-xs border-emerald-200 bg-emerald-50/60 text-zinc-900 placeholder:text-zinc-500"
          />
          <Button
            onClick={handleCreate}
            disabled={creating || !newTagName.trim()}
            className="h-9 rounded-lg bg-linear-to-r from-emerald-500 to-emerald-600 px-3.5 text-white hover:from-emerald-400 hover:to-emerald-500"
          >
            <Plus />
            Add Tag
          </Button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-zinc-500">Loading...</div>
        ) : tags.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-500">No tags yet.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-emerald-100 bg-emerald-50/60 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Posts</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr key={tag.id} className="border-b border-emerald-50 last:border-0 hover:bg-emerald-50/70">
                  <td className="px-4 py-3">
                    {editingId === tag.id ? (
                      <Input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(tag)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        className="h-8 max-w-xs border-emerald-200 bg-emerald-50/60 text-zinc-900"
                      />
                    ) : (
                      <Badge variant="outline" className="inline-flex items-center gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                        <Hash className="h-3 w-3" />
                        {tag.name}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{tag.postCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {editingId === tag.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={busyId === tag.id}
                            onClick={() => saveEdit(tag)}
                            className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700"
                          >
                            <Check />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={cancelEdit} className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700">
                            <X />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={busyId === tag.id}
                            onClick={() => startEdit(tag)}
                            className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={busyId === tag.id}
                            onClick={() => handleDelete(tag)}
                            className="text-rose-300 hover:bg-rose-500/15"
                          >
                            <Trash2 />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
