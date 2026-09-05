'use client'

/**
 * The dialog focus contract both panels owe (spec 015 FR-031/FR-033, DESIGN §
 * Accessibility): focus enters on the heading, Tab and Shift+Tab cycle inside
 * the panel and never escape to the frozen game behind it, and — for the pause
 * panel — focus returns to the control that opened it.
 *
 * Not unit-tested (DOM-bound hook, project convention); the contract it
 * implements is checked by hand in the Quickstart's keyboard pass.
 */

import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  headingRef: RefObject<HTMLElement | null>,
  /** Focused again when the panel closes; omit for a panel with nothing to return to. */
  returnFocusRef?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    headingRef.current?.focus()
  }, [headingRef])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !container) return
      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null

      // Anything outside the panel (including the heading, which is only
      // programmatically focusable) lands on the first control.
      if (!active || !container.contains(active) || active === last) {
        if (!event.shiftKey) {
          event.preventDefault()
          first.focus()
          return
        }
      }
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      }
    }

    container.ownerDocument.addEventListener('keydown', onKeyDown)
    return () => container.ownerDocument.removeEventListener('keydown', onKeyDown)
  }, [containerRef])

  useEffect(() => {
    const target = returnFocusRef?.current
    return () => {
      target?.focus()
    }
  }, [returnFocusRef])
}
