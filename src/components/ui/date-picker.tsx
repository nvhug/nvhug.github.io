'use client'

import { useState } from 'react'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTodayLocalISODate, getYearOptions } from '@/lib/date'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12']
const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function parseISO(iso: string) {
  const [y, mo, d] = (iso || '').split('-').map(Number)
  const now = new Date()
  return { year: y || now.getFullYear(), month: (mo || now.getMonth() + 1) - 1, day: d || 1 }
}

function toISO(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

interface DatePickerProps {
  value: string // "YYYY-MM-DD"
  onChange: (v: string) => void
  align?: 'start' | 'center' | 'end'
  className?: string
}

export function DatePicker({ value, onChange, align = 'start', className }: DatePickerProps) {
  const todayISO = getTodayLocalISODate()
  const { year: initY, month: initMo } = parseISO(value)
  const [viewYear, setViewYear] = useState(initY)
  const [viewMonth, setViewMonth] = useState(initMo)
  const yearOptions = getYearOptions(new Date().getFullYear(), viewYear)

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const { year: selY, month: selMo, day: selD } = parseISO(value)
  const label = value ? `${selD}/${selMo + 1}/${selY}` : 'Chọn ngày'

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-900 tabular-nums transition-colors hover:border-emerald-300 hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400',
          className
        )}
      >
        <CalendarIcon className="h-3.5 w-3.5 text-emerald-500" />
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align={align} sideOffset={6}>
        {/* Month/year navigation — direct-jump selects so a far-past date (e.g.
            a birth year) doesn't require clicking prevMonth hundreds of times */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <button type="button" onClick={prevMonth} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1">
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
              className="cursor-pointer rounded-md border-none bg-transparent text-sm font-semibold text-zinc-900 outline-none hover:bg-zinc-100"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
            <select
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
              className="cursor-pointer rounded-md border-none bg-transparent text-sm font-semibold text-zinc-900 outline-none hover:bg-zinc-100"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={nextMonth} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Day-of-week header */}
        <div className="mb-1 grid grid-cols-7">
          {DAYS.map((d) => (
            <div key={d} className="flex h-7 w-8 items-center justify-center text-[11px] font-medium text-zinc-400">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="h-8 w-8" />
            const iso = toISO(viewYear, viewMonth, day)
            const isSelected = iso === value
            const isToday = iso === todayISO
            return (
              <button
                key={iso}
                type="button"
                onClick={() => onChange(iso)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors',
                  isSelected && 'bg-emerald-500 font-semibold text-white',
                  !isSelected && isToday && 'border border-emerald-300 font-semibold text-emerald-600',
                  !isSelected && !isToday && 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'
                )}
              >
                {day}
              </button>
            )
          })}
        </div>

        {/* Quick "today" shortcut */}
        {value !== todayISO && (
          <div className="mt-2 border-t border-zinc-100 pt-2">
            <button
              type="button"
              onClick={() => onChange(todayISO)}
              className="w-full rounded-md py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50"
            >
              Hôm nay
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
