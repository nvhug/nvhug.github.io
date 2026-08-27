'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Voluntary donation prompt. It unlocks NOTHING — no role change, no quota grant,
 * no page reload waiting for access to appear. The app is free for everyone and
 * this is a tip jar, which is what keeps it clear of Vercel's commercial-use rule.
 * See ADR-017. Do not wire an entitlement to this component.
 */
export function DonateModal({ open, onClose }: Props) {
  const { t } = useLanguage()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (!open) return null

  function close() {
    setSent(false)
    onClose()
  }

  async function handleConfirm() {
    setSending(true)
    try {
      const { data: { user } } = await getSupabaseBrowserClient().auth.getUser()
      await fetch('/api/donate-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName:  user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '',
          userEmail: user?.email ?? '',
          ts: new Date().toLocaleString('vi-VN'),
        }),
      })
    } catch {
      // A failed thank-you note is not the donor's problem — still thank them.
    } finally {
      setSending(false)
      setSent(true)
    }
  }

  return (
    // Scroll on the backdrop, not the flex box: centering a panel taller than the
    // viewport clips its top instead of letting it scroll into view.
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4"
      onClick={close}
    >
      <div className="flex min-h-full items-center justify-center">
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl sm:p-8 dark:bg-zinc-900"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="text-center text-lg font-bold text-zinc-800 dark:text-white">
          {t('donate.title')}
        </h3>
        <p className="mt-3 text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {t('donate.body')}
        </p>
        <div className="mt-5 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/dnm.jpg" alt="Donate QR" className="h-44 w-44 rounded-xl object-cover sm:h-56 sm:w-56" />
        </div>

        {sent ? (
          <p className="mt-5 text-center text-base font-semibold text-violet-600">
            {t('donate.thanks')}
          </p>
        ) : (
          <div className="mt-5 flex gap-3">
            <button
              onClick={close}
              className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {t('donate.close')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={sending}
              className="flex-1 rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              {sending ? t('donate.confirming') : t('donate.confirm')}
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
