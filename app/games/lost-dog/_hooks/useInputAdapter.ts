'use client'

/**
 * Keyboard + pointer/touch -> Intent (plan R4 layer 2, spec 015 §6/FR-031).
 * Jump is edge-triggered (buffered for exactly the tick it's consumed);
 * duck is level-triggered. Cleared on pointercancel/blur/visibility-loss —
 * never leaked into the next run (§29). Not unit-tested (hook, DOM-bound).
 */

import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { Intent } from '@/lib/games/lost-dog/types'

export interface InputAdapter {
  /** Called once per fixed step; clears the edge-triggered jump/pause flags after reading. */
  consume: () => Intent
  jump: () => void
  duckStart: () => void
  duckEnd: () => void
  /** Drops everything pending, so no keystroke survives a pause or a replay (§29). */
  clearPending: () => void
}

/**
 * Whether the keystroke belongs to a real control rather than to the game.
 * Gameplay keys are only claimed — and `preventDefault`ed — while the game
 * itself owns focus (FR-032): Space on a focused `Bắt đầu` must activate the
 * button, and `Escape` inside the pause dialog belongs to the dialog.
 */
function targetsAControl(target: EventTarget | null): boolean {
  const element = target as Element | null
  if (!element || typeof element.closest !== 'function') return false
  return element.closest('a, button, input, textarea, select, [role="dialog"]') !== null
}

export function useInputAdapter(apertureRef: RefObject<HTMLElement | null>): InputAdapter {
  const jumpRequestedRef = useRef(false)
  const duckHeldRef = useRef(false)
  const pauseRequestedRef = useRef(false)

  const jump = useCallback(() => {
    jumpRequestedRef.current = true
  }, [])
  const duckStart = useCallback(() => {
    duckHeldRef.current = true
  }, [])
  const duckEnd = useCallback(() => {
    duckHeldRef.current = false
  }, [])
  const requestPause = useCallback(() => {
    pauseRequestedRef.current = true
  }, [])

  const clearHeld = useCallback(() => {
    duckHeldRef.current = false
    jumpRequestedRef.current = false
  }, [])

  const clearPending = useCallback(() => {
    duckHeldRef.current = false
    jumpRequestedRef.current = false
    pauseRequestedRef.current = false
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // A control has focus: this keystroke is the control's, not the game's.
      if (targetsAControl(event.target)) return
      if (event.code === 'Space' || event.code === 'ArrowUp') {
        event.preventDefault()
        jump()
      } else if (event.code === 'ArrowDown') {
        event.preventDefault()
        duckStart()
      } else if (event.code === 'Escape') {
        requestPause()
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code === 'ArrowDown') duckEnd()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clearHeld)
    document.addEventListener('visibilitychange', clearHeld)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clearHeld)
      document.removeEventListener('visibilitychange', clearHeld)
    }
  }, [jump, duckStart, duckEnd, requestPause, clearHeld])

  useEffect(() => {
    const el = apertureRef.current
    if (!el) return
    function onPointerDown(event: PointerEvent) {
      event.preventDefault()
      jump()
    }
    el.addEventListener('pointerdown', onPointerDown)
    return () => el.removeEventListener('pointerdown', onPointerDown)
  }, [apertureRef, jump])

  const consume = useCallback((): Intent => {
    const intent: Intent = {
      jumpRequested: jumpRequestedRef.current,
      duckHeld: duckHeldRef.current,
      pauseRequested: pauseRequestedRef.current,
    }
    jumpRequestedRef.current = false
    pauseRequestedRef.current = false
    return intent
  }, [])

  return { consume, jump, duckStart, duckEnd, clearPending }
}
