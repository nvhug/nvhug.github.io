// Restricted-markdown renderer for the ADMIN inbox's message bubbles
// (DESIGN.md "Message rendering", SR-006).
//
// The parsing itself is NOT done here. It is delegated to
// `parseRestrictedMarkdown`, the same parser the user-facing widget uses,
// which has its own unit tests covering the hostile cases (a `javascript:`
// or `data:` payload can never populate an href, a raw `<script>` stays
// literal text). A second copy of that logic living here would be a
// security parser with two implementations and one test suite — the shape
// where somebody fixes the tested one and the untested one keeps the bug.
//
// What remains here is only what actually differs between the two surfaces:
// the JSX and the Tailwind classes. Every message string is still treated
// as hostile, and nothing in this file uses dangerouslySetInnerHTML — the
// AST is walked into React elements, so no string ever becomes markup.
//
// UI rendering, so no co-located unit test per CLAUDE.md §7; the logic that
// warrants one lives in the shared parser and is tested there.

import type { ReactNode } from 'react'
import { parseRestrictedMarkdown, type MdInline } from '@/components/support/restricted-markdown'

function renderInline(nodes: MdInline[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}-${i}`
    switch (node.type) {
      case 'bold':
        return <strong key={key}>{node.value}</strong>
      case 'code':
        return (
          <code key={key} className="rounded bg-zinc-100 px-1 font-mono text-xs">
            {node.value}
          </code>
        )
      case 'link':
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener nofollow"
            className="text-emerald-700 underline"
            style={{ overflowWrap: 'anywhere' }}
          >
            {node.text}
          </a>
        )
      default:
        return <span key={key}>{node.value}</span>
    }
  })
}

/** Renders one message's content as restricted-markdown React nodes (never raw HTML). */
export function renderMessageContent(content: string): ReactNode {
  const blocks = parseRestrictedMarkdown(content)

  return (
    <div className="space-y-1">
      {blocks.map((block, b) =>
        block.type === 'list' ? (
          <ul key={`ul-${b}`} className="list-disc space-y-0.5 pl-4">
            {block.items.map((item, i) => (
              <li key={i}>{renderInline(item, `li-${b}-${i}`)}</li>
            ))}
          </ul>
        ) : (
          <p key={`p-${b}`} className="[overflow-wrap:anywhere]">
            {block.lines.map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {renderInline(line, `p-${b}-${i}`)}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  )
}
