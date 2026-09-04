// Parses message content into a small, restricted markdown AST — never HTML.
// Pure, has no React import, and produces only data: strings and structured
// nodes. The renderer (SupportMessage.tsx) walks this AST into React elements
// directly; there is no string-concatenation or dangerouslySetInnerHTML step
// anywhere in the pipeline, so there is no path for a message (AI-authored or
// otherwise) to inject markup. See FR-012 / SR-006.
//
// Supported subset only: **bold**, `inline code`, "- " bullet lists, and
// links — either `[text](https://…)` or a bare `https://…` URL. The link
// patterns below require an http/https scheme in the regex itself, so a
// `javascript:`/`data:` "link" can never populate an anchor's href — it just
// falls through to the plain-text branch, same as any other unmatched input.

export type MdInline =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; text: string; href: string }

export type MdBlock =
  | { type: 'paragraph'; lines: MdInline[][] }
  | { type: 'list'; items: MdInline[][] }

// Order matters: bold/code/markdown-link are tried before the bare-URL
// fallback so `[text](https://x.com)` is never also matched as a bare URL.
//
// The bare-URL branch must not end on punctuation: a URL at the end of a
// sentence would otherwise absorb the full stop into its own href, producing a
// link that 404s. The final character class excludes the punctuation that ends
// a sentence or closes a bracket, so those stay in the surrounding text.
const INLINE_PATTERN =
  /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]*[^\s.,;:!?)\]}'"])/g

export function parseInline(line: string): MdInline[] {
  const tokens: MdInline[] = []
  let lastIndex = 0
  const pattern = new RegExp(INLINE_PATTERN.source, 'g')
  let match: RegExpExecArray | null

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: line.slice(lastIndex, match.index) })
    }
    const [, bold, code, linkText, linkHref, bareUrl] = match
    if (bold !== undefined) {
      tokens.push({ type: 'bold', value: bold })
    } else if (code !== undefined) {
      tokens.push({ type: 'code', value: code })
    } else if (linkText !== undefined && linkHref !== undefined) {
      tokens.push({ type: 'link', text: linkText, href: linkHref })
    } else if (bareUrl !== undefined) {
      tokens.push({ type: 'link', text: bareUrl, href: bareUrl })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < line.length) {
    tokens.push({ type: 'text', value: line.slice(lastIndex) })
  }
  if (tokens.length === 0) {
    tokens.push({ type: 'text', value: '' })
  }
  return tokens
}

export function parseRestrictedMarkdown(content: string): MdBlock[] {
  const rawLines = content.split(/\r\n|\n/)
  const blocks: MdBlock[] = []
  let paragraphLines: string[] = []
  let i = 0

  function flushParagraph() {
    if (paragraphLines.length === 0) return
    blocks.push({ type: 'paragraph', lines: paragraphLines.map(parseInline) })
    paragraphLines = []
  }

  while (i < rawLines.length) {
    const line = rawLines[i]

    if (line.trim() === '') {
      flushParagraph()
      i++
      continue
    }

    if (line.startsWith('- ')) {
      flushParagraph()
      const items: MdInline[][] = []
      while (i < rawLines.length && rawLines[i].startsWith('- ')) {
        items.push(parseInline(rawLines[i].slice(2)))
        i++
      }
      blocks.push({ type: 'list', items })
      continue
    }

    paragraphLines.push(line)
    i++
  }
  flushParagraph()

  return blocks
}
