'use client'

import { Trash2, X } from 'lucide-react'
import { Button } from './button'

type Props = {
  open: boolean
  itemContent?: string
  itemMeta?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ open, itemContent, itemMeta, loading, onConfirm, onCancel }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
              <Trash2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="font-poppins text-sm font-semibold text-zinc-900">Xác nhận xoá</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="mb-3 text-sm text-zinc-500">Bạn sắp xoá mục này. Hành động không thể hoàn tác.</p>
          {itemContent && (
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
              <p className="line-clamp-3 text-sm text-zinc-800">{itemContent}</p>
              {itemMeta && <p className="mt-1.5 text-xs text-zinc-500">{itemMeta}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-zinc-100 px-5 py-4">
          <Button
            variant="ghost"
            className="flex-1 border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            disabled={loading}
            onClick={onCancel}
          >
            Huỷ
          </Button>
          <Button
            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:ring-emerald-300"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? 'Đang xoá...' : 'Xoá'}
          </Button>
        </div>
      </div>
    </div>
  )
}
