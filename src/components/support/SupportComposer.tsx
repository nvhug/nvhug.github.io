'use client'

// Textarea that grows 1 -> ~5 lines then scrolls internally (DESIGN.md
// "Content and interaction range check"). Enter sends, Shift+Enter inserts a
// newline (FR-111); a 4000-char cap is enforced while typing, with a counter
// once within 200 chars of the limit.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'

const MAX_LENGTH = 4000
const WARN_THRESHOLD = MAX_LENGTH - 200
const MAX_HEIGHT_PX = 130
/** Three lines at rest, matching the admin composer. A single-line box invites
 *  single-line messages, and it grows under the writer as soon as they pass one. */
const MIN_HEIGHT_PX = 78

export function SupportComposer({
  disabled,
  onSend,
  autoFocus,
}: {
  disabled: boolean
  onSend: (content: string) => void
  autoFocus?: boolean
}) {
  const { t } = useLanguage()
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    // scrollHeight measures content + padding but not the border, and this
    // element is border-box — so using it directly sizes the box one border
    // short of its own content and the browser shows a scrollbar next to an
    // empty composer. Add the border back, and only allow scrolling once the
    // content genuinely reaches the cap.
    const style = getComputedStyle(el)
    const borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
    el.style.height = 'auto'
    const fitted = Math.min(Math.max(el.scrollHeight + borderY, MIN_HEIGHT_PX), MAX_HEIGHT_PX)
    el.style.height = `${fitted}px`
    el.style.overflowY = fitted >= MAX_HEIGHT_PX ? 'auto' : 'hidden'
  }, [value])

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus()
  }, [autoFocus])

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const showCounter = value.length >= WARN_THRESHOLD

  return (
    // The counter sits BELOW the row, not inside the textarea's own column:
    // with `items-end`, a counter inside that column becomes the column's
    // bottom edge, so the send button dropped a line the moment the counter
    // appeared. Keeping the row to just the input and the button pins them
    // to each other.
    <div>
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={3}
          placeholder={t('support.composer.placeholder')}
          maxLength={MAX_LENGTH}
          style={{ maxHeight: MAX_HEIGHT_PX }}
          className="min-w-0 flex-1 resize-none overflow-y-hidden rounded-lg border border-zinc-200 px-2.5 py-2 text-sm outline-none placeholder:text-zinc-400 focus-visible:border-emerald-400 focus-visible:ring-3 focus-visible:ring-emerald-100 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          aria-label={t('support.composer.send')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 sm:h-9 sm:w-9"
        >
          <Send className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </button>
      </div>
      {showCounter && (
        <p className="mt-1 text-right text-[11px] text-zinc-400">
          {t('support.composer.charHint', { count: value.length })}
        </p>
      )}
    </div>
  )
}
