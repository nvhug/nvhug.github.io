'use client'

import { useState } from 'react'
import { LayoutTemplate, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const TEMPLATES = [
  { id: 'parchment', label: 'Parchment' },
  { id: 'ink',       label: 'Ink' },
  { id: 'medium',    label: 'Medium' },
  { id: 'vercel',    label: 'Vercel' },
  { id: 'github',    label: 'GitHub' },
  { id: 'notion',    label: 'Notion' },
  { id: 'apple',     label: 'Apple' },
]

interface Props {
  postId: string
  current: string
}

export function FloatingTemplateSwitch({ postId, current }: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSelect(templateId: string) {
    if (templateId === current) { setOpen(false); return }
    setSaving(true)
    const { error } = await supabase
      .from('posts')
      .update({ template: templateId })
      .eq('id', postId)
    if (error) {
      toast.error('Cập nhật thất bại')
      setSaving(false)
    } else {
      toast.success(`Template: ${templateId}`)
      window.location.reload()
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
          {TEMPLATES.map((tpl) => {
            const isActive = tpl.id === current
            return (
              <button
                key={tpl.id}
                onClick={() => handleSelect(tpl.id)}
                disabled={saving}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 ${
                  isActive ? 'text-emerald-600' : 'text-zinc-700'
                }`}
              >
                <Check className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'opacity-100 text-emerald-500' : 'opacity-0'}`} />
                {tpl.label}
              </button>
            )
          })}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        title="Change template"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900/80 text-white shadow-lg backdrop-blur transition-colors hover:bg-zinc-900"
      >
        <LayoutTemplate className="h-4 w-4" />
      </button>
    </div>
  )
}
