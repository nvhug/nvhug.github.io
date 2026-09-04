'use client'

// Owns all data flow for the "Chat with Us" widget (spec 014, WP-4).
//
// The response shapes are NOT restated here. They live in
// src/lib/support/types.ts (ConversationListResponse, ThreadResponse,
// SendMessageResponse) and are imported by both this hook and the routes
// that produce them, so a change on either side fails to compile on the
// other. A comment describing the contract is what this file had before,
// and it drifted out of step with the route without anything noticing.
//
// No fetch here ever *generates* anything on mount — the one mount-time call
// (listing the user's own conversations) is a read, allowed per C5/ADR-015. A
// conversation row is only created as a direct consequence of the user
// actually sending a message (see performSend).

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/i18n/language-context'
import type {
  ConversationListResponse,
  Conversation,
  SendMessageResponse,
  ThreadResponse,
  UserMessage,
} from '@/lib/support/types'

export type MessageStatus = 'sent' | 'pending' | 'failed'

export interface SupportMessageData extends UserMessage {
  status: MessageStatus
}

/**
 * A client-only marker rendered in the thread the moment a send response
 * shows the conversation just transitioned into `waiting_admin` — the
 * "Đã chuyển cho đội hỗ trợ…" pill (FR-025/FR-040). Never a real message row:
 * the widget cannot and must not distinguish an AI escalation from a
 * provider-failure escalation, so this is purely a client-rendered notice
 * keyed to the status transition, not something the server returns.
 */
export interface EscalationNotice {
  kind: 'escalation-notice'
  id: string
  createdAt: string
  /**
   * `escalated` — this send is what handed the conversation over.
   * `human-handling` — it was already a human's before this send, so no AI ran
   *   and none was going to. Without this the user got literal silence: their
   *   message appeared, nothing answered it, and the only clue was a small chip
   *   at the top of the panel that had not changed since they opened it. Its
   *   copy names the AI's absence, which is the part that is surprising; the
   *   persistent indicator below the thread says who holds the conversation.
   */
  variant: 'escalated' | 'human-handling'
}

export type SupportThreadItem = SupportMessageData | EscalationNotice

export function isEscalationNotice(item: SupportThreadItem): item is EscalationNotice {
  return 'kind' in item && item.kind === 'escalation-notice'
}

export function isMessageItem(item: SupportThreadItem): item is SupportMessageData {
  return !isEscalationNotice(item)
}

const POLL_INTERVAL_MS = 8000
const POLL_BACKOFF_MS = 30000
const POLL_BACKOFF_AFTER_MS = 5 * 60 * 1000
/** Closed-panel badge check. Much slower than the open-panel poll on purpose:
 *  it runs on every signed-in page, and a badge that is a minute late costs
 *  nothing, while a request every 8s from every tab does. */
const BADGE_POLL_INTERVAL_MS = 60_000
const LAST_SEEN_KEY = 'nvhug:support:lastSeenAt'
const OLDER_PAGE_SIZE = 30

// Statuses under which sending a message triggers a synchronous AI triage
// call: a brand-new conversation (FR-002) and reopening a resolved/closed one
// (FR-006) both start/return to `ai_active`. While `waiting_admin` or
// `admin_active`, a new user message is just appended for a human to read —
// no AI call happens, so the "AI is typing" indicator must not claim one is
// in flight for those statuses.
function expectsAiResponse(status: Conversation['status'] | null): boolean {
  return status === null || status === 'ai_active' || status === 'resolved' || status === 'closed'
}

function toDisplayMessages(messages: UserMessage[]): SupportMessageData[] {
  return messages.map((m) => ({ ...m, status: 'sent' as const }))
}

/**
 * Folds a server page into what the thread already shows.
 *
 * A UNION, not a replacement. The server returns only the newest page
 * (THREAD_PAGE_SIZE), so rebuilding the list from it would throw away
 * everything "load older" had fetched — the reader watching a poll tick
 * every 8s would see their scrolled-back history vanish under them.
 * Previously-delivered messages the page does not mention are kept and the
 * whole set is re-sorted by time; nothing in this feature deletes a message,
 * so a row absent from the page means "older than the page", never "gone".
 */
function mergeServerMessages(server: UserMessage[], previous: SupportThreadItem[]): SupportThreadItem[] {
  const serverClientIds = new Set(server.map((m) => m.clientMessageId).filter(Boolean))
  const serverIds = new Set(server.map((m) => m.id))
  const notices = previous.filter(isEscalationNotice)

  const keptOlder = previous.filter(
    (item): item is SupportMessageData =>
      isMessageItem(item) && item.status === 'sent' && !serverIds.has(item.id)
  )
  const stillPending = previous.filter(
    (item): item is SupportMessageData =>
      isMessageItem(item) &&
      (item.status === 'pending' || item.status === 'failed') &&
      !(item.clientMessageId && serverClientIds.has(item.clientMessageId))
  )

  const delivered = [...keptOlder, ...toDisplayMessages(server)].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
  )
  return [...delivered, ...stillPending, ...notices]
}

/**
 * @param isOpen  the panel is showing — gates polling and the thread fetch.
 * @param enabled there is a signed-in user. Separate from `isOpen` because
 *   the mount-time conversation read (which seeds the unread badge) runs
 *   whether or not the panel is open, and hooks cannot be skipped by the
 *   caller's `if (!user) return null` — without this every page load, signed
 *   out included, fired a GET the server could only answer with 401.
 */
export function useSupportConversation(isOpen: boolean, enabled: boolean) {
  const { t, lang } = useLanguage()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [items, setItems] = useState<SupportThreadItem[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [sending, setSending] = useState(false)
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)
  const [rawUnreadCount, setRawUnreadCount] = useState(0)

  const conversationRef = useRef<Conversation | null>(null)
  const itemsRef = useRef<SupportThreadItem[]>([])
  const notifiedEscalationRef = useRef(false)
  const notifiedHumanHandlingRef = useRef(false)
  const initialListDoneRef = useRef(false)

  // "Latest value" refs for the async callbacks below (performSend, polling,
  // offline flush) to read without going stale — synced after render, never
  // mutated during it.
  useEffect(() => {
    conversationRef.current = conversation
  }, [conversation])
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  function markFailed(clientMessageId: string) {
    setItems((prev) =>
      prev.map((item) =>
        isMessageItem(item) && item.clientMessageId === clientMessageId
          ? { ...item, status: 'failed' as const }
          : item
      )
    )
  }

  const performSend = useCallback(
    async (content: string, clientMessageId: string) => {
      setSending(true)
      try {
        let convId = conversationRef.current?.id
        const prevStatus = conversationRef.current?.status ?? null

        if (!convId) {
          const createRes = await fetch('/api/support/conversations', { method: 'POST' })
          if (createRes.status === 429) {
            // Creating a conversation is rate-limited too
            // (RATE_LIMITS.conversationsPerHour) — same copy as the
            // message-send 429 below, not the generic "send failed" catch.
            toast.error(t('support.rateLimited'))
            markFailed(clientMessageId)
            return
          }
          if (!createRes.ok) throw new Error('create-failed')
          const created: { conversation: Conversation } = await createRes.json()
          setConversation(created.conversation)
          conversationRef.current = created.conversation
          convId = created.conversation.id
        }

        const res = await fetch(`/api/support/conversations/${convId}/messages`, {
          method: 'POST',
          // The reply language travels as a header, not in the body: the
          // route reads exactly `content` and `clientMessageId` from the body
          // and nothing else (SR-003), and the language toggle is
          // localStorage-only so the server has no other way to know it.
          headers: { 'Content-Type': 'application/json', 'X-Support-Lang': lang },
          body: JSON.stringify({ content, clientMessageId }),
        })

        if (res.status === 429) {
          toast.error(t('support.rateLimited'))
          markFailed(clientMessageId)
          return
        }
        if (!res.ok) throw new Error('send-failed')

        // Typed against the shared contract, not an inline shape: this is the
        // seam that broke once, and an inline annotation on an `any` is a
        // guess the compiler will happily agree with.
        const data: SendMessageResponse = await res.json()
        setConversation(data.conversation)
        setItems((prev) => mergeServerMessages(data.messages, prev))

        const status = data.conversation.status
        const escalatedJustNow = prevStatus !== 'waiting_admin' && status === 'waiting_admin'
        // A human already owned it when this message was sent, so step 7 of the
        // route returned before any provider call. Nothing is coming, and the
        // user is owed that fact rather than a silent thread.
        const humanAlreadyHandling =
          !escalatedJustNow && (status === 'admin_active' || status === 'waiting_admin')

        if (escalatedJustNow && !notifiedEscalationRef.current) {
          notifiedEscalationRef.current = true
          setItems((prev) => [
            ...prev,
            {
              kind: 'escalation-notice',
              id: `escalation-${clientMessageId}`,
              createdAt: new Date().toISOString(),
              variant: 'escalated',
            },
          ])
        } else if (humanAlreadyHandling && !notifiedHumanHandlingRef.current) {
          notifiedHumanHandlingRef.current = true
          setItems((prev) => [
            ...prev,
            {
              kind: 'escalation-notice',
              id: `human-${clientMessageId}`,
              createdAt: new Date().toISOString(),
              variant: 'human-handling',
            },
          ])
        }

        if (status !== 'waiting_admin') {
          notifiedEscalationRef.current = false
        }
        // Said once per stretch of human ownership, not once per message: a
        // reader who has been told does not need telling again three lines later.
        if (status !== 'admin_active' && status !== 'waiting_admin') {
          notifiedHumanHandlingRef.current = false
        }
      } catch {
        markFailed(clientMessageId)
        toast.error(t('support.sendFailed'))
      } finally {
        setSending(false)
      }
    },
    [t, lang]
  )

  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      const clientMessageId = crypto.randomUUID()
      const optimistic: SupportMessageData = {
        id: clientMessageId,
        senderType: 'user',
        content: trimmed,
        clientMessageId,
        createdAt: new Date().toISOString(),
        status: 'pending',
      }
      setItems((prev) => [...prev, optimistic])
      void performSend(trimmed, clientMessageId)
    },
    [performSend]
  )

  const retryMessage = useCallback(
    (clientMessageId: string) => {
      const target = itemsRef.current.find(
        (item): item is SupportMessageData => isMessageItem(item) && item.clientMessageId === clientMessageId
      )
      if (!target || target.status !== 'failed') return
      setItems((prev) =>
        prev.map((item) =>
          isMessageItem(item) && item.clientMessageId === clientMessageId
            ? { ...item, status: 'pending' as const }
            : item
        )
      )
      void performSend(target.content, clientMessageId)
    },
    [performSend]
  )

  const loadOlder = useCallback(() => {
    const conv = conversationRef.current
    if (!conv || loadingOlder) return
    const oldest = itemsRef.current.find(isMessageItem)
    const before = oldest?.createdAt
    const url = before
      ? `/api/support/conversations/${conv.id}?before=${encodeURIComponent(before)}`
      : `/api/support/conversations/${conv.id}`

    setLoadingOlder(true)
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { messages: UserMessage[] } | null) => {
        if (!data) return
        // Computed from itemsRef (kept in sync after every render, see the
        // effect above) rather than inside the setItems updater below: an
        // updater function runs during React's render phase, so calling
        // setHasMoreOlder from inside one is a state update during render.
        const existingIds = new Set(itemsRef.current.filter(isMessageItem).map((i) => i.id))
        const olderOnes = toDisplayMessages(data.messages).filter((m) => !existingIds.has(m.id))
        if (olderOnes.length < OLDER_PAGE_SIZE) setHasMoreOlder(false)
        setItems((prev) => [...olderOnes, ...prev])
      })
      .catch(() => {})
      .finally(() => setLoadingOlder(false))
  }, [loadingOlder])

  // ---- Initial read: list the user's own conversations once, to recover the
  // most recent one (if any) and to seed the unread badge from a prior
  // session. A read, never a generation — allowed on mount per C5.
  useEffect(() => {
    if (!enabled) return
    if (initialListDoneRef.current) return
    initialListDoneRef.current = true
    let cancelled = false
    fetch('/api/support/conversations')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ConversationListResponse | null) => {
        if (cancelled || !data || data.conversations.length === 0) return
        const latest = data.conversations.reduce((a, b) => (a.lastMessageAt > b.lastMessageAt ? a : b))
        setConversation(latest)
        const lastSeen = window.localStorage.getItem(LAST_SEEN_KEY) ?? ''
        if (latest.lastMessageAt > lastSeen) setRawUnreadCount(1)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [enabled])

  // ---- Badge poll, for while the panel is CLOSED.
  //
  // The thread poll below only runs while the panel is open, so without this
  // an admin's reply produced no badge until the user happened to reload the
  // page — the notification the badge exists to give arrives only for someone
  // who was already going to look. Deliberately slower than the open-panel
  // poll and visibility-gated: this runs for every signed-in page view, so it
  // is sized to be cheap rather than prompt.
  useEffect(() => {
    if (!enabled || isOpen) return
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    async function checkOnce() {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/support/conversations')
        if (!res.ok || cancelled) return
        const data: ConversationListResponse = await res.json()
        if (data.conversations.length === 0) return
        const latest = data.conversations.reduce((a, b) => (a.lastMessageAt > b.lastMessageAt ? a : b))
        setConversation(latest)
        const lastSeen = window.localStorage.getItem(LAST_SEEN_KEY) ?? ''
        if (latest.lastMessageAt > lastSeen) setRawUnreadCount(1)
      } catch {
        // Silent: the next tick retries.
      }
    }

    function scheduleNext() {
      timeoutId = setTimeout(async () => {
        await checkOnce()
        if (!cancelled) scheduleNext()
      }, BADGE_POLL_INTERVAL_MS)
    }

    scheduleNext()
    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [enabled, isOpen])

  // ---- Offline detection + auto-flush of anything that failed while offline.
  // (Initial value comes from the lazy useState initializer above.)
  useEffect(() => {
    function goOnline() {
      setOffline(false)
      itemsRef.current.forEach((item) => {
        if (isMessageItem(item) && item.status === 'failed' && item.clientMessageId) {
          retryMessage(item.clientMessageId)
        }
      })
    }
    function goOffline() {
      setOffline(true)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [retryMessage])

  // markClosed is called from SupportWidget's own close handler (a real user
  // event — the X button, or the Escape keydown listener), not from an effect
  // reacting to `isOpen`: FR-055's unread badge is derived from the newest
  // non-user message against this "last seen" timestamp, and the timestamp
  // only ever needs to move the moment the user actually closes the panel.
  const markClosed = useCallback(() => {
    window.localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString())
    setRawUnreadCount(0)
  }, [])

  // ---- Fetch the thread on open (the server marks it read as a side effect
  // of this GET, per plan §3).
  useEffect(() => {
    if (!isOpen) return
    const convId = conversation?.id
    if (!convId) return

    let cancelled = false

    async function fetchThread() {
      setLoadingThread(true)
      try {
        const res = await fetch(`/api/support/conversations/${convId}`)
        const data: ThreadResponse | null = res.ok
          ? await res.json()
          : null
        if (cancelled || !data) return
        setConversation(data.conversation)
        // Merge, never replace. This effect also fires the moment a brand-new
        // conversation gets its id — which is mid-send, while the user's own
        // optimistic message is sitting in `items` as `pending`. Replacing the
        // list there deletes the message they just typed along with the Retry
        // affordance, so a failed first send loses the text with nothing to
        // click.
        setItems((prev) => mergeServerMessages(data.messages, prev))
        setHasMoreOlder(data.messages.length >= OLDER_PAGE_SIZE)
      } catch {
        // Stale-while-revalidate: leave whatever the thread already showed.
      } finally {
        if (!cancelled) setLoadingThread(false)
      }
    }

    void fetchThread()
    return () => {
      cancelled = true
    }
  }, [isOpen, conversation?.id])

  // ---- Polling (FR-054): every 8s while open and visible; backs off to 30s
  // after 5 minutes with no change; fully stops (no scheduled timer at all)
  // when hidden, resuming immediately on the next visibilitychange.
  useEffect(() => {
    if (!isOpen || !conversation) return
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let lastActivityAt = Date.now()
    let lastKnownMessageAt = conversation.lastMessageAt
    const conversationId = conversation.id

    function computeDelay() {
      return Date.now() - lastActivityAt > POLL_BACKOFF_AFTER_MS ? POLL_BACKOFF_MS : POLL_INTERVAL_MS
    }

    async function fetchOnce() {
      try {
        const res = await fetch(`/api/support/conversations/${conversationId}`)
        if (res.ok && !cancelled) {
          const data: ThreadResponse = await res.json()
          if (data.conversation.lastMessageAt !== lastKnownMessageAt) {
            lastActivityAt = Date.now()
            lastKnownMessageAt = data.conversation.lastMessageAt
          }
          setConversation(data.conversation)
          setItems((prev) => mergeServerMessages(data.messages, prev))
        }
      } catch {
        // Network hiccups during polling are silent — the next tick retries.
      }
    }

    function scheduleNext() {
      timeoutId = undefined
      if (cancelled || document.visibilityState !== 'visible') return
      timeoutId = setTimeout(async () => {
        await fetchOnce()
        scheduleNext()
      }, computeDelay())
    }

    function handleVisibility() {
      if (cancelled) return
      if (document.visibilityState === 'visible' && timeoutId === undefined) {
        void (async () => {
          await fetchOnce()
          scheduleNext()
        })()
      }
    }

    scheduleNext()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
    // Deliberately keyed on the conversation id, not the conversation object:
    // every poll tick calls setConversation with a fresh object reference, and
    // depending on the object itself would tear down and restart this effect
    // on every tick, resetting the backoff clock each time instead of letting
    // it accumulate. The mutable closures above (lastActivityAt,
    // lastKnownMessageAt) are what actually track activity across ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, conversation?.id])

  return {
    conversation,
    items,
    loadingThread,
    loadingOlder,
    hasMoreOlder,
    sending,
    aiTyping: sending && expectsAiResponse(conversation?.status ?? null),
    // Both human-owned statuses, not just `waiting_admin`. A conversation an
    // admin has already replied in is `admin_active`, and that showed no
    // indicator whatsoever — the state in which a user is most likely to keep
    // typing was the state with the least feedback.
    waitingAdmin: conversation?.status === 'waiting_admin' || conversation?.status === 'admin_active',
    offline,
    // 0 while the panel is open — the reader is looking at it, so nothing
    // outstanding counts as unread until it's closed again.
    unreadCount: isOpen ? 0 : rawUnreadCount,
    sendMessage,
    retryMessage,
    loadOlder,
    markClosed,
  }
}
