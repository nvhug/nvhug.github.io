'use client'

// Plain-language status (FR-052) and the two typing affordances (FR-053).
// The two indicators are deliberately different: the AI one is a real,
// animated three-dot bubble bound to an in-flight request (`aiTyping`); the
// "support is reviewing" one is a static, non-animated label, because polling
// gives no real presence signal and animating it would fake one — see
// docs/DESIGN.md "Status and typing affordances".

import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils'
import type { ConversationStatus } from '@/lib/support/types'

const STATUS_KEY: Record<ConversationStatus, string> = {
  ai_active: 'support.status.aiActive',
  waiting_admin: 'support.status.waitingAdmin',
  admin_active: 'support.status.adminActive',
  resolved: 'support.status.resolved',
  closed: 'support.status.closed',
}

const STATUS_CLASSES: Record<ConversationStatus, string> = {
  ai_active: 'bg-zinc-100 text-zinc-600',
  waiting_admin: 'bg-amber-50 text-amber-700',
  admin_active: 'bg-emerald-50 text-emerald-700',
  resolved: 'bg-zinc-100 text-zinc-500',
  closed: 'bg-zinc-100 text-zinc-400',
}

export function StatusBanner({ status }: { status: ConversationStatus }) {
  const { t } = useLanguage()
  return (
    <div className="shrink-0 border-b border-zinc-100 px-4 py-2">
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150',
          STATUS_CLASSES[status]
        )}
      >
        {t(STATUS_KEY[status])}
      </span>
    </div>
  )
}

export function TypingIndicator({
  aiTyping,
  waitingAdmin,
  reducedMotion,
}: {
  aiTyping: boolean
  waitingAdmin: boolean
  reducedMotion: boolean
}) {
  const { t } = useLanguage()

  if (aiTyping) {
    return (
      <div className="flex shrink-0 items-center gap-2 px-4 py-1.5 text-xs text-zinc-500">
        <span className="flex items-center gap-0.5" aria-hidden="true">
          {reducedMotion ? (
            <span>…</span>
          ) : (
            [0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))
          )}
        </span>
        {t('support.typingAi')}
      </div>
    )
  }

  if (waitingAdmin) {
    return <div className="shrink-0 px-4 py-1.5 text-xs text-zinc-500">{t('support.typingAdmin')}</div>
  }

  return null
}
