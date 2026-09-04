'use client'

// FR-065: the thread plus admin actions (reply, internal note, status, priority,
// assignment, hand-back-to-AI — the last is just a status transition to `ai_active`,
// so it rides the same status control rather than a bespoke button).
//
// Two safety-relevant rules from DESIGN.md:
//  - An internal note renders as a full-width dashed amber block with a Lock icon,
//    never a bubble — an admin must never mistake it for something the user can see.
//  - The composer itself changes appearance in note mode (amber toggle + amber send
//    button + amber textarea ring), not just at the moment of sending — the failure
//    this guards against is an admin typing a private note that looks like a reply.
//
// Status changes go through PATCH; ALLOWED_TRANSITIONS (status.ts) is used only to
// populate the *options offered*, not to accept/reject the change — the server still
// owns legality, and a rejection surfaces via toast.error(), never a silent no-op.

import { useEffect, useRef, useState } from 'react'
import { Bot, ChevronLeft, Lock, MoreVertical, Send } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/i18n/language-context'
import type { AdminMessage, Conversation, ConversationStatus, Priority } from '@/lib/support/types'
import type { AdminConversationPatch, AdminConversationSummary } from '@/lib/support/service'
import { ALLOWED_TRANSITIONS } from '@/lib/support/status'
import type { UserProfile } from '@/types'
import { renderMessageContent } from '../_lib/message-content'

const MAX_LEN = 4000
const CHAR_WARN_THRESHOLD = MAX_LEN - 200
const COMPOSER_MAX_HEIGHT = 130
/** Three lines at rest. A one-line reply box reads as an afterthought next to a
 *  thread of paragraphs, and an admin writing a real answer should not have to
 *  watch the box grow under them from a single line. */
const COMPOSER_MIN_HEIGHT = 78

type ComposerMode = 'reply' | 'note'

function statusOptionKey(status: ConversationStatus): 'waitingAdmin' | 'adminActive' | 'aiActive' | 'resolved' | 'closed' {
  if (status === 'waiting_admin') return 'waitingAdmin'
  if (status === 'admin_active') return 'adminActive'
  if (status === 'ai_active') return 'aiActive'
  return status
}

function legalNextStatuses(current: ConversationStatus): ConversationStatus[] {
  return ALLOWED_TRANSITIONS.filter(([from]) => from === current).map(([, to]) => to)
}

function avatarLetter(email: string | null, userId: string): string {
  const source = (email ?? '').trim() || userId
  return source.slice(0, 1).toUpperCase()
}

export function InboxThread({
  conversationId,
  fallbackSummary,
  admins,
  currentAdminId,
  onBack,
  onChanged,
  className,
}: {
  conversationId: string | null
  fallbackSummary: AdminConversationSummary | null
  admins: UserProfile[]
  currentAdminId: string | null
  onBack: () => void
  onChanged: () => void
  className?: string
}) {
  const { t } = useLanguage()

  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<AdminMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false)

  const [mode, setMode] = useState<ComposerMode>('reply')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const listEndRef = useRef<HTMLDivElement>(null)

  async function loadThread(id: string) {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/admin/support/conversations/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { conversation: Conversation; messages: AdminMessage[] }
      setConversation(data.conversation)
      setMessages(data.messages)
    } catch (err) {
      console.error('[support-inbox] thread load failed:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMode('reply')
    setText('')
    setMobileControlsOpen(false)
    if (conversationId) void loadThread(conversationId)
    else {
      setConversation(null)
      setMessages([])
    }
  }, [conversationId])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    // el is border-box, but scrollHeight only measures content + padding — leaving the
    // border out under-sizes the box by exactly its border width, which makes the
    // textarea 1px shorter than its own content and shows a permanent, content-less
    // scrollbar. Adding the border back in gives an exact fit at rest.
    const style = getComputedStyle(el)
    const borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
    el.style.height = 'auto'
    const fitted = Math.min(
      Math.max(el.scrollHeight + borderY, COMPOSER_MIN_HEIGHT),
      COMPOSER_MAX_HEIGHT,
    )
    el.style.height = `${fitted}px`
    // Only scroll once the content genuinely outgrows the box. Leaving
    // `overflow-y: auto` on permanently is what puts a scrollbar next to an
    // empty composer — the browser reserves it the moment scrollHeight ties
    // clientHeight, which it does at every size below the cap.
    el.style.overflowY = fitted >= COMPOSER_MAX_HEIGHT ? 'auto' : 'hidden'
  }, [text])

  async function patchConversation(patch: AdminConversationPatch) {
    if (!conversation) return
    setActionBusy(true)
    try {
      const res = await fetch(`/api/admin/support/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        toast.error(t('support.admin.thread.actionError'))
        return
      }
      const data = (await res.json()) as { conversation: Conversation }
      setConversation(data.conversation)
      onChanged()
    } catch (err) {
      console.error('[support-inbox] patch failed:', err)
      toast.error(t('support.admin.thread.actionError'))
    } finally {
      setActionBusy(false)
    }
  }

  async function submitComposer() {
    if (!conversation || sending) return
    const content = text.trim()
    if (!content || content.length > MAX_LEN) return

    setSending(true)
    try {
      const res = await fetch(`/api/admin/support/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, kind: mode === 'note' ? 'note' : 'reply' }),
      })
      if (!res.ok) {
        toast.error(t('support.sendFailed'))
        return
      }
      setText('')
      await loadThread(conversation.id)
      onChanged()
    } catch (err) {
      console.error('[support-inbox] send failed:', err)
      toast.error(t('support.sendFailed'))
    } finally {
      setSending(false)
    }
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submitComposer()
    }
  }

  if (!conversationId) {
    return (
      <div className={`flex items-center justify-center p-8 ${className ?? ''}`}>
        <p className="text-sm text-zinc-400">{t('support.admin.thread.empty')}</p>
      </div>
    )
  }

  if (loading && !conversation) {
    return (
      <div className={`space-y-2 p-4 ${className ?? ''}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-shimmer-sweep rounded-lg bg-zinc-50" />
        ))}
      </div>
    )
  }

  if (error || !conversation) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 p-8 ${className ?? ''}`}>
        <p className="text-sm text-zinc-500">{t('support.admin.loadError')}</p>
        <button
          type="button"
          onClick={() => void loadThread(conversationId)}
          className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          {t('support.admin.retry')}
        </button>
      </div>
    )
  }

  const userEmail = fallbackSummary?.userEmail ?? null
  const nextStatuses = legalNextStatuses(conversation.status)
  const charCount = text.length
  const overLimit = charCount > MAX_LEN

  const controls = (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={conversation.status}
        disabled={actionBusy}
        onChange={(e) => void patchConversation({ status: e.target.value as ConversationStatus })}
        aria-label={t('support.admin.filters.status')}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 outline-none focus-visible:border-emerald-400 disabled:opacity-50"
      >
        <option value={conversation.status}>{t(`support.admin.statusOptions.${statusOptionKey(conversation.status)}`)}</option>
        {nextStatuses.map((s) => (
          <option key={s} value={s}>
            {t(`support.admin.statusOptions.${statusOptionKey(s)}`)}
          </option>
        ))}
      </select>
      <select
        value={conversation.priority}
        disabled={actionBusy}
        onChange={(e) => void patchConversation({ priority: e.target.value as Priority })}
        aria-label={t('support.admin.filters.priority')}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 outline-none focus-visible:border-emerald-400 disabled:opacity-50"
      >
        {(['low', 'normal', 'high', 'urgent'] as Priority[]).map((p) => (
          <option key={p} value={p}>
            {t(`support.admin.priorityOptions.${p}`)}
          </option>
        ))}
      </select>
      <select
        value={conversation.assignedAdminId ?? ''}
        disabled={actionBusy}
        onChange={(e) => void patchConversation({ assignedAdminId: e.target.value || null })}
        aria-label={t('support.admin.list.assignee')}
        className="min-w-0 max-w-40 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 outline-none focus-visible:border-emerald-400 disabled:opacity-50"
      >
        <option value="">{t('support.admin.assignmentOptions.unassigned')}</option>
        {admins.map((a) => (
          <option key={a.id} value={a.id}>
            {a.id === currentAdminId ? t('support.admin.list.you') : a.full_name || a.email || a.id}
          </option>
        ))}
      </select>
    </div>
  )

  // The pane itself is `flex-1` with no cap of its own, but the admin shell
  // (app/admin/layout.tsx) already bounds the whole page to `max-w-7xl`, so the pane
  // realistically never exceeds ~895px (1280 minus the 384px list column and its
  // border) — the "1000px+ wide" case a plain `flex-1` cap would allow doesn't happen
  // in this app. `max-w-4xl` (896px) uses that available width comfortably (with the
  // surrounding `px-3`/`p-3` gutters, the interior is ~871px, just under the cap) while
  // still being a real ceiling if the admin shell ever gets more room. Every region
  // below wraps its content in the same `mx-auto max-w-4xl` column so the header,
  // messages and composer all share one readable measure and stay aligned to the same
  // left/right edges — only the borders/backgrounds span the full pane.
  return (
    <div className={`flex min-h-0 flex-col ${className ?? ''}`}>
      <div className="border-b border-zinc-100 px-3 py-2.5">
        <div className="mx-auto flex max-w-4xl items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label={t('support.admin.thread.backToList')}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 sm:p-1 md:hidden"
          >
            <ChevronLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          </button>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600">
            {avatarLetter(userEmail, conversation.userId)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900">
            {userEmail || conversation.userId}
          </span>
          <button
            type="button"
            onClick={() => setMobileControlsOpen((v) => !v)}
            aria-label={t('support.admin.thread.moreActions')}
            aria-expanded={mobileControlsOpen}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 sm:p-1 md:hidden"
          >
            <MoreVertical className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          </button>
        </div>
        <div className="mx-auto mt-2 hidden max-w-4xl md:block">{controls}</div>
        {mobileControlsOpen ? <div className="mx-auto mt-2 max-w-4xl md:hidden">{controls}</div> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mx-auto max-w-4xl space-y-3">
          {messages.map((msg) => {
            if (msg.senderType === 'system') {
              return (
                <div
                  key={msg.id}
                  className="flex items-start gap-2 rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-2"
                >
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-amber-700">{t('support.admin.internalNoteHint')}</p>
                    <div className="mt-0.5 text-sm text-amber-900">{renderMessageContent(msg.content)}</div>
                  </div>
                </div>
              )
            }
            if (msg.senderType === 'admin') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white">
                    {renderMessageContent(msg.content)}
                  </div>
                </div>
              )
            }
            const isAi = msg.senderType === 'ai'
            return (
              <div key={msg.id} className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-1.5 pl-0.5">
                  {isAi ? (
                    <>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100">
                        <Bot className="h-3 w-3 text-zinc-500" />
                      </span>
                      <span className="text-[11px] font-medium text-zinc-400">{t('support.senderAi')}</span>
                    </>
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-600">
                      {avatarLetter(userEmail, conversation.userId)}
                    </span>
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    isAi ? 'border border-zinc-200 bg-white text-zinc-800' : 'border border-zinc-100 bg-zinc-50 text-zinc-800'
                  }`}
                >
                  {renderMessageContent(msg.content)}
                </div>
              </div>
            )
          })}
          <div ref={listEndRef} />
        </div>
      </div>

      <div className={`border-t p-3 transition-colors duration-150 ${mode === 'note' ? 'border-amber-200 bg-amber-50/60' : 'border-zinc-100 bg-white'}`}>
        <div className="mx-auto max-w-4xl">
          <div className="mb-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('reply')}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                mode === 'reply' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              {t('support.admin.reply')}
            </button>
            <button
              type="button"
              onClick={() => setMode('note')}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                mode === 'note' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              {t('support.admin.internalNote')}
            </button>
          </div>

          {/* Textarea + send button sit on one row (mirrors SupportComposer's widget
              layout per DESIGN.md's "mirroring the widget's own hierarchy") so they read
              as one composed control rather than an input with a button floating below it. */}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={mode === 'note' ? t('support.admin.thread.notePlaceholder') : t('support.composer.placeholder')}
              rows={3}
              disabled={sending}
              className={`min-w-0 flex-1 resize-none overflow-y-hidden rounded-lg border px-2.5 py-2 text-sm outline-none placeholder:text-zinc-400 ${
                mode === 'note'
                  ? 'border-amber-300 bg-white focus-visible:border-amber-400 focus-visible:ring-3 focus-visible:ring-amber-100'
                  : 'border-zinc-200 focus-visible:border-emerald-400 focus-visible:ring-3 focus-visible:ring-emerald-100'
              }`}
            />
            <button
              type="button"
              onClick={() => void submitComposer()}
              disabled={sending || !text.trim() || overLimit}
              aria-label={mode === 'note' ? t('support.admin.thread.sendNote') : t('support.composer.send')}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9 ${
                mode === 'note' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              <Send className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </button>
          </div>

          {charCount > CHAR_WARN_THRESHOLD ? (
            <p className={`mt-1.5 text-right text-[11px] tabular-nums ${overLimit ? 'text-rose-600' : 'text-zinc-400'}`}>
              {t('support.composer.charHint', { count: String(charCount) })}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
