'use client'

// Launcher + panel shell for the "Chat with Us" widget (spec 014, WP-4).
// The only fixed launcher on the page: the bug-report button that used to sit
// above it at bottom-20 is now a footer menu item (BugReportModal), so the
// z-index/vertical-band split in docs/DESIGN.md “Launcher vs BugReportButton”
// no longer has a second occupant to resolve against.

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { useUser } from '@/hooks/useUser'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useSupportConversation } from '@/hooks/useSupportConversation'
import { cn } from '@/lib/utils'
import { StatusBanner, TypingIndicator } from './StatusBanner'
import { SupportThread } from './SupportThread'
import { SupportComposer } from './SupportComposer'

/**
 * Fired on `window` to open the chat panel from somewhere else in the layout —
 * today, the header bell. A custom event rather than a controlled `open` prop
 * on purpose: `openPanel` drives `visible` and `animateIn` imperatively from
 * the click that causes them, and the comment on those transitions warns
 * against an effect watching `open` instead. Making `open` a prop would force
 * exactly that effect.
 */
export const SUPPORT_OPEN_EVENT = 'notez:support:open'

export function SupportWidget({ onUnreadChange }: { onUnreadChange?: (count: number) => void } = {}) {
  const { t } = useLanguage()
  const { user } = useUser()
  const reducedMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)

  const {
    conversation,
    items,
    loadingThread,
    loadingOlder,
    hasMoreOlder,
    sending,
    aiTyping,
    waitingAdmin,
    offline,
    unreadCount,
    sendMessage,
    retryMessage,
    loadOlder,
    markClosed,
  } = useSupportConversation(open, Boolean(user))

  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  // The header bell renders the same count this widget already polls for, so
  // it is published rather than fetched a second time — one poll, two places
  // showing it.
  useEffect(() => {
    onUnreadChange?.(unreadCount)
  }, [unreadCount, onUnreadChange])

  // Panel mount/unmount with a 200ms fade + translate (FR-114); reduced
  // motion collapses both the entrance and the exit to an instant state
  // change. Both transitions are driven directly from the user action that
  // causes them (the launcher click, the close button, or Escape) rather
  // than from an effect watching `open`, since the visible/animateIn state
  // has nowhere else to come from — there is no external system to
  // synchronize with here, just this interaction.
  function openPanel() {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = undefined
    }
    setOpen(true)
    setVisible(true)
    requestAnimationFrame(() => setAnimateIn(true))
  }

  const close = useCallback(() => {
    markClosed()
    setOpen(false)
    setAnimateIn(false)
    if (reducedMotion) {
      setVisible(false)
    } else {
      hideTimeoutRef.current = setTimeout(() => setVisible(false), 200)
    }
  }, [markClosed, reducedMotion])

  // Held in a ref so the listener below can be registered once and still call
  // the current closure — re-subscribing on every render would churn a window
  // listener for nothing.
  const openPanelRef = useRef(openPanel)
  openPanelRef.current = openPanel

  useEffect(() => {
    function handleOpenRequest() {
      openPanelRef.current()
    }
    window.addEventListener(SUPPORT_OPEN_EVENT, handleOpenRequest)
    return () => window.removeEventListener(SUPPORT_OPEN_EVENT, handleOpenRequest)
  }, [])

  // Focus trap + Escape + return focus to the launcher (FR-112, FR-113).
  useEffect(() => {
    if (!open) return
    // Only on the OPEN transition, never on a re-run. This effect also depends
    // on `close`, so it re-runs while the panel is already open — and by then
    // `document.activeElement` is the composer inside the panel, not the
    // launcher. Overwriting the ref there meant Escape returned focus to an
    // element that was about to unmount, dropping focus to <body> and sending
    // a keyboard user back to the top of the page (FR-113).
    if (previousFocusRef.current === null) {
      previousFocusRef.current = document.activeElement as HTMLElement | null
    }

    function getFocusable(): HTMLElement[] {
      const panel = panelRef.current
      if (!panel) return []
      return Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null)
    }

    const raf = requestAnimationFrame(() => {
      getFocusable()[0]?.focus()
    })

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'Tab') return
      const focusable = getFocusable()
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, close])

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true
      return
    }
    // Only after an actual close. Without this the effect's first run (on
    // mount, where `open` is already false) would steal focus to the launcher
    // on every page load.
    if (!wasOpenRef.current) return
    wasOpenRef.current = false
    previousFocusRef.current = null
    // Focus the launcher directly rather than whatever held focus before the
    // panel opened. Two reasons the indirect version did not work: the exit
    // animation keeps the panel mounted for 200ms after `open` flips, so
    // focus is still inside it when this runs; and the panel's own trap has
    // already moved focus to the composer by then, so the remembered element
    // is not the launcher anyway. The launcher is where a keyboard user
    // expects to land — it is the control they activated (FR-113).
    //
    // Deferred a frame so it lands after React has finished this commit;
    // focusing mid-commit is silently undone by the panel still unmounting.
    const raf = requestAnimationFrame(() => launcherRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [open])

  if (!user) return null

  const hasConversation = conversation !== null || items.length > 0

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={openPanel}
        aria-label={t('support.launcher.label')}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 transition-colors hover:bg-emerald-500"
      >
        <MessageCircle className="h-6 w-6" />
        {unreadCount > 0 && (
          <span
            className={cn(
              'absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white ring-2 ring-white scale-100',
              !reducedMotion && 'starting:scale-0 transition-transform duration-150'
            )}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {visible && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('support.panel.title')}
          tabIndex={-1}
          className={cn(
            'fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-white',
            'sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[560px] sm:max-h-[calc(100svh-8rem)] sm:w-[380px] sm:rounded-2xl sm:border sm:border-zinc-200 sm:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)]',
            animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
            !reducedMotion && 'transition-all duration-200 ease-out'
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                <MessageCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="font-poppins text-sm font-semibold text-zinc-900">{t('support.panel.title')}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t('support.panel.close')}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 sm:h-7 sm:w-7"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {offline && (
            <div className="shrink-0 bg-zinc-100 px-4 py-1.5 text-xs text-zinc-500">{t('support.offline')}</div>
          )}

          {conversation && <StatusBanner status={conversation.status} />}

          {hasConversation ? (
            <SupportThread
              items={items}
              loading={loadingThread}
              loadingOlder={loadingOlder}
              hasMoreOlder={hasMoreOlder}
              onLoadOlder={loadOlder}
              onRetry={retryMessage}
              reducedMotion={reducedMotion}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-zinc-400">
              {t('support.emptyState')}
            </div>
          )}

          <TypingIndicator aiTyping={aiTyping} waitingAdmin={waitingAdmin} reducedMotion={reducedMotion} />

          <div className="shrink-0 border-t border-zinc-100 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            <SupportComposer disabled={sending} onSend={sendMessage} autoFocus={open} />
          </div>
        </div>
      )}
    </>
  )
}
