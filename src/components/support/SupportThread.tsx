'use client'

// Message list: ARIA live region (FR-112), load-older control, auto-scroll to
// newest without yanking the view when the user has scrolled up to read
// history.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronUp } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils'
import { SupportMessage } from './SupportMessage'
import { isEscalationNotice, isMessageItem, type SupportThreadItem } from '@/hooks/useSupportConversation'

export function SupportThread({
  items,
  loading,
  loadingOlder,
  hasMoreOlder,
  onLoadOlder,
  onRetry,
  reducedMotion,
}: {
  items: SupportThreadItem[]
  loading: boolean
  loadingOlder: boolean
  hasMoreOlder: boolean
  onLoadOlder: () => void
  onRetry: (clientMessageId: string) => void
  reducedMotion: boolean
}) {
  const { t } = useLanguage()
  const containerRef = useRef<HTMLDivElement>(null)
  const autoStickRef = useRef(true)
  const prevScrollHeightRef = useRef<number | null>(null)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const [announcement, setAnnouncement] = useState('')

  // Track whether the reader is near the bottom, so a newly-arrived message
  // only auto-scrolls when they were already following along.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function handleScroll() {
      if (!el) return
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      autoStickRef.current = distanceFromBottom < 48
    }
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Loading older messages prepends content above the fold — restore the
    // reader's visual position instead of jumping anywhere.
    if (prevScrollHeightRef.current !== null) {
      el.scrollTop = el.scrollHeight - prevScrollHeightRef.current
      prevScrollHeightRef.current = null
      return
    }
    if (autoStickRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [items])

  // Announce only genuinely new incoming (non-user) messages — the user's own
  // optimistic send is never re-announced, since they already know what they
  // typed.
  useEffect(() => {
    const prevIds = prevIdsRef.current
    const newIncoming = items.filter(
      (item) => isMessageItem(item) && item.senderType !== 'user' && !prevIds.has(item.id)
    )
    if (newIncoming.length > 0) {
      const last = newIncoming[newIncoming.length - 1]
      if (isMessageItem(last)) {
        const senderLabel = last.senderType === 'ai' ? t('support.senderAi') : t('support.admin.pageTitle')
        setAnnouncement(`${senderLabel}: ${last.content}`)
      }
    }
    prevIdsRef.current = new Set(items.filter(isMessageItem).map((item) => item.id))
  }, [items, t])

  function handleLoadOlder() {
    const el = containerRef.current
    if (el) prevScrollHeightRef.current = el.scrollHeight
    onLoadOlder()
  }

  return (
    <div ref={containerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {loading && items.length === 0 && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative h-10 max-w-[85%] overflow-hidden rounded-2xl bg-zinc-100">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer-sweep" />
            </div>
          ))}
        </div>
      )}

      {hasMoreOlder && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleLoadOlder}
            disabled={loadingOlder}
            className="flex items-center gap-1 rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-60"
          >
            <ChevronUp className="h-3 w-3" />
            {t('support.loadOlder')}
          </button>
        </div>
      )}

      {items.map((item) => {
        if (isEscalationNotice(item)) {
          return (
            <div key={item.id} className="flex justify-center">
              <span className="rounded-full px-3 py-1 text-xs text-zinc-400">
                {t(item.variant === 'escalated' ? 'support.escalatedMessage' : 'support.humanHandlingMessage')}
              </span>
            </div>
          )
        }
        return (
          <div
            key={item.id}
            className={cn(!reducedMotion && 'starting:translate-y-1 starting:opacity-0 transition-all duration-150')}
          >
            <SupportMessage message={item} onRetry={onRetry} />
          </div>
        )
      })}
    </div>
  )
}
