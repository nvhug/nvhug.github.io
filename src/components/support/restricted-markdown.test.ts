import { describe, expect, it } from 'vitest'

import { parseInline, parseRestrictedMarkdown } from './restricted-markdown'

describe('parseInline', () => {
  it('passes plain text through untouched', () => {
    expect(parseInline('hello world')).toEqual([{ type: 'text', value: 'hello world' }])
  })

  it('parses bold', () => {
    expect(parseInline('**bold** text')).toEqual([
      { type: 'bold', value: 'bold' },
      { type: 'text', value: ' text' },
    ])
  })

  it('parses inline code', () => {
    expect(parseInline('run `npm run test` now')).toEqual([
      { type: 'text', value: 'run ' },
      { type: 'code', value: 'npm run test' },
      { type: 'text', value: ' now' },
    ])
  })

  it('parses a markdown link', () => {
    expect(parseInline('see [Notez](https://example.com/docs)')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'link', text: 'Notez', href: 'https://example.com/docs' },
    ])
  })

  it('autolinks a bare http(s) URL', () => {
    expect(parseInline('visit https://example.com now')).toEqual([
      { type: 'text', value: 'visit ' },
      { type: 'link', text: 'https://example.com', href: 'https://example.com' },
      { type: 'text', value: ' now' },
    ])
  })

  it('handles mixed bold, code, and link in one line', () => {
    expect(parseInline('**Bold** and `code` and [link](https://x.com)')).toEqual([
      { type: 'bold', value: 'Bold' },
      { type: 'text', value: ' and ' },
      { type: 'code', value: 'code' },
      { type: 'text', value: ' and ' },
      { type: 'link', text: 'link', href: 'https://x.com' },
    ])
  })

  it('leaves unterminated bold markers as literal text', () => {
    expect(parseInline('**bold with no closing marker')).toEqual([
      { type: 'text', value: '**bold with no closing marker' },
    ])
  })

  // Security: the link patterns require an http/https scheme in the regex
  // itself, so a javascript:/data: "link" can never become an anchor href —
  // it must fall through to the plain-text branch instead.
  it('never treats a javascript: scheme as a link', () => {
    const result = parseInline('[click me](javascript:alert(1))')
    expect(result.some((token) => token.type === 'link')).toBe(false)
    expect(result).toEqual([{ type: 'text', value: '[click me](javascript:alert(1))' }])
  })

  it('never treats a data: scheme as a link', () => {
    const result = parseInline('[open](data:text/html,<script>alert(1)</script>)')
    expect(result.some((token) => token.type === 'link')).toBe(false)
  })

  // Security: raw markup is never interpreted — it is preserved as a literal
  // text token, which React renders as escaped text, never as markup.
  it('preserves a raw script tag as literal text, not markup', () => {
    const result = parseInline('<script>alert(1)</script>')
    expect(result).toEqual([{ type: 'text', value: '<script>alert(1)</script>' }])
  })

  it('preserves a raw img onerror payload as literal text', () => {
    const result = parseInline('<img src=x onerror=alert(1)>')
    expect(result).toEqual([{ type: 'text', value: '<img src=x onerror=alert(1)>' }])
  })
})

describe('parseRestrictedMarkdown', () => {
  it('wraps a single line of text in one paragraph block', () => {
    expect(parseRestrictedMarkdown('hello')).toEqual([
      { type: 'paragraph', lines: [[{ type: 'text', value: 'hello' }]] },
    ])
  })

  it('groups consecutive "- " lines into a list block', () => {
    const blocks = parseRestrictedMarkdown('- one\n- two\n- three')
    expect(blocks).toEqual([
      {
        type: 'list',
        items: [
          [{ type: 'text', value: 'one' }],
          [{ type: 'text', value: 'two' }],
          [{ type: 'text', value: 'three' }],
        ],
      },
    ])
  })

  it('inline-parses bullet item content', () => {
    const blocks = parseRestrictedMarkdown('- **bold** item')
    expect(blocks).toEqual([
      {
        type: 'list',
        items: [[{ type: 'bold', value: 'bold' }, { type: 'text', value: ' item' }]],
      },
    ])
  })

  it('separates blank-line-delimited paragraphs and joins consecutive lines within one', () => {
    const blocks = parseRestrictedMarkdown('line one\nline two\n\nsecond paragraph')
    expect(blocks).toEqual([
      {
        type: 'paragraph',
        lines: [
          [{ type: 'text', value: 'line one' }],
          [{ type: 'text', value: 'line two' }],
        ],
      },
      { type: 'paragraph', lines: [[{ type: 'text', value: 'second paragraph' }]] },
    ])
  })

  it('mixes a paragraph, a list, and another paragraph in one message', () => {
    const blocks = parseRestrictedMarkdown('Here is what you can do:\n- one\n- two\nThanks!')
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'list', 'paragraph'])
  })

  it('returns an empty array for empty content', () => {
    expect(parseRestrictedMarkdown('')).toEqual([])
  })
})

describe('bare URLs do not swallow sentence punctuation', () => {
  it('leaves a trailing full stop outside the href', () => {
    const tokens = parseInline('Xem tai https://notez.vn/help.')
    const link = tokens.find((t) => t.type === 'link')

    expect(link).toEqual({ type: 'link', text: 'https://notez.vn/help', href: 'https://notez.vn/help' })
    expect(tokens[tokens.length - 1]).toEqual({ type: 'text', value: '.' })
  })

  it('leaves a trailing comma and closing bracket outside too', () => {
    const hrefs = parseInline('(https://notez.vn/a), https://notez.vn/b!')
      .filter((t) => t.type === 'link')
      .map((t) => (t.type === 'link' ? t.href : ''))

    expect(hrefs).toEqual(['https://notez.vn/a', 'https://notez.vn/b'])
  })

  it('still keeps punctuation that is genuinely part of the path', () => {
    const tokens = parseInline('https://notez.vn/a.b/c')
    expect(tokens).toEqual([{ type: 'link', text: 'https://notez.vn/a.b/c', href: 'https://notez.vn/a.b/c' }])
  })
})
