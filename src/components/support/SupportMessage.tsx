'use client'

// One message bubble. Sender treatment follows docs/DESIGN.md's Message
// rendering table exactly (position + a small icon/label chip, never a new
// hue). Content is rendered exclusively through parseRestrictedMarkdown's AST
// walked into React elements below — there is no dangerouslySetInnerHTML
// anywhere in this file, and there never can be: every branch of the switch
// below either emits a plain string child (auto-escaped by React) or a
// judiciously-typed element (`<strong>`, `<code>`, `<a>`) built from AST
// fields, never from an HTML string. See restricted-markdown.ts for why an
// href can never carry anything but an http(s) URL.

import { Bot, Clock, LifeBuoy } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils'
import type { SupportMessageData } from '@/hooks/useSupportConversation'
import { parseRestrictedMarkdown, type MdInline } from './restricted-markdown'

function InlineNodes({ nodes }: { nodes: MdInline[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.type) {
          case 'bold':
            return (
              <strong key={i} className="font-semibold">
                {node.value}
              </strong>
            )
          case 'code':
            return (
              <code key={i} className="rounded bg-zinc-100 px-1 font-mono text-xs">
                {node.value}
              </code>
            )
          case 'link':
            return (
              <a
                key={i}
                href={node.href}
                target="_blank"
                rel="noopener nofollow"
                className="text-emerald-700 underline"
              >
                {node.text}
              </a>
            )
          case 'text':
          default:
            return node.value
        }
      })}
    </>
  )
}

function MessageContent({ content }: { content: string }) {
  const blocks = parseRestrictedMarkdown(content)
  return (
    <div className="space-y-1.5 [overflow-wrap:anywhere]">
      {blocks.map((block, bi) => {
        if (block.type === 'list') {
          return (
            <ul key={bi} className="list-disc space-y-0.5 pl-4">
              {block.items.map((item, ii) => (
                <li key={ii}>
                  <InlineNodes nodes={item} />
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={bi}>
            {block.lines.map((line, li) => (
              <span key={li}>
                {li > 0 && <br />}
                <InlineNodes nodes={line} />
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

export function SupportMessage({
  message,
  onRetry,
}: {
  message: SupportMessageData
  onRetry: (clientMessageId: string) => void
}) {
  const { t } = useLanguage()

  if (message.senderType === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <div
            className={cn(
              'rounded-2xl bg-emerald-600 px-3 py-2 text-sm text-white',
              message.status === 'pending' && 'opacity-70'
            )}
          >
            <MessageContent content={message.content} />
          </div>
          {message.status === 'pending' && (
            <div className="mt-1 flex items-center justify-end gap-1 text-zinc-400">
              <Clock className="h-3 w-3" />
            </div>
          )}
          {message.status === 'failed' && (
            <button
              type="button"
              onClick={() => message.clientMessageId && onRetry(message.clientMessageId)}
              className="mt-1 block w-full text-right text-xs font-medium text-rose-600 hover:underline"
            >
              {t('support.retry')}
            </button>
          )}
        </div>
      </div>
    )
  }

  const isAi = message.senderType === 'ai'
  const Icon = isAi ? Bot : LifeBuoy
  const label = isAi ? t('support.senderAi') : t('support.admin.pageTitle')

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100">
            <Icon className="h-3 w-3 text-zinc-500" />
          </span>
          {label}
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800">
          <MessageContent content={message.content} />
        </div>
      </div>
    </div>
  )
}
