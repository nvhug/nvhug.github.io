'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
  className?: string
}

export function TagInput({ value, onChange, suggestions = [], placeholder = 'Thêm tag...', className }: TagInputProps) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)
  )

  function addTag(tag: string) {
    const t = tag.trim()
    if (t && !value.includes(t)) {
      onChange([...value, t])
    }
    setInput('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (input.trim()) addTag(input)
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      onChange(value.slice(0, -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <div
        className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 focus-within:border-emerald-400 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 pl-2.5 pr-1 py-0.5 text-xs font-medium text-emerald-700"
          >
            #{tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
              className="rounded-full p-0.5 hover:bg-emerald-200 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true) }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="min-w-24 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
        />
      </div>

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-emerald-200 bg-white py-1 shadow-md">
          {filtered.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addTag(s) }}
                className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700"
              >
                #{s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
