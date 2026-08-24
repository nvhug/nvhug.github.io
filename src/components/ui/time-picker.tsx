'use client'

import { forwardRef, useRef } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

interface TimePickerProps {
  value: string // "HH:MM"
  onChange: (v: string) => void
  className?: string
  disabled?: boolean
}

export function TimePicker({ value, onChange, className, disabled }: TimePickerProps) {
  const [h = '00', m = '00'] = (value || '00:00').split(':')
  const hourRef = useRef<HTMLDivElement>(null)
  const minRef = useRef<HTMLDivElement>(null)

  function onOpen(open: boolean) {
    if (!open) return
    const itemH = 36
    setTimeout(() => {
      hourRef.current?.scrollTo({ top: parseInt(h) * itemH - itemH * 2, behavior: 'smooth' })
      minRef.current?.scrollTo({ top: parseInt(m) * itemH - itemH * 2, behavior: 'smooth' })
    }, 50)
  }

  return (
    <Popover onOpenChange={onOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-900 tabular-nums transition-colors hover:border-emerald-300 hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
      >
        <Clock className="h-3.5 w-3.5 text-emerald-500" />
        {h}:{m}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start" sideOffset={6}>
        <div className="flex items-start gap-1">
          <TimeColumn
            ref={hourRef}
            items={HOURS}
            selected={h}
            label="Giờ"
            onSelect={(hh) => onChange(`${hh}:${m}`)}
          />
          <div className="flex items-center px-0.5 pt-6 text-base font-light text-zinc-300">:</div>
          <TimeColumn
            ref={minRef}
            items={MINUTES}
            selected={m}
            label="Phút"
            onSelect={(mm) => onChange(`${h}:${mm}`)}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

const TimeColumn = forwardRef<
  HTMLDivElement,
  { items: string[]; selected: string; label: string; onSelect: (v: string) => void }
>(({ items, selected, label, onSelect }, ref) => (
  <div className="flex flex-col gap-1">
    <p className="text-center text-[11px] font-medium uppercase tracking-wide text-zinc-400">{label}</p>
    <div
      ref={ref}
      className="h-[162px] overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onSelect(item)}
          className={cn(
            'flex h-9 w-11 items-center justify-center rounded-md text-sm tabular-nums transition-colors',
            item === selected
              ? 'bg-emerald-500 font-semibold text-white'
              : 'font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          )}
        >
          {item}
        </button>
      ))}
    </div>
  </div>
))
TimeColumn.displayName = 'TimeColumn'
