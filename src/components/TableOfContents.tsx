'use client'

import { useEffect, useMemo, useState } from 'react'

interface TocItem {
  id: string
  text: string
  level: number
}

// Parse TOC items from pre-processed HTML (headings already have id attributes)
function parseToc(html: string): TocItem[] {
  const matches = [...html.matchAll(/<h([23])[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h[23]>/gi)]
  return matches.map((m) => ({
    level: parseInt(m[1]),
    id: m[2],
    text: m[3].replace(/<[^>]*>/g, '').trim(),
  }))
}

export function TableOfContents({ content }: { content: string }) {
  const [activeId, setActiveId] = useState<string>('')
  const items = useMemo(() => parseToc(content), [content])

  useEffect(() => {
    if (items.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-15% 0px -75% 0px' }
    )

    items.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [items])

  if (items.length < 2) return null

  return (
    <div className="sticky top-28">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
        Nội dung
      </p>
      <div className="flex flex-col border-l border-[#e5e0d5]">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            style={{ paddingLeft: item.level === 3 ? '1.25rem' : '0.75rem' }}
            className={`border-l-2 py-1 text-[13px] leading-snug transition-colors hover:text-[#8a4a2a] ${
              activeId === item.id
                ? '-ml-px border-[#a05b35] font-medium text-[#8a4a2a]'
                : 'border-transparent text-zinc-500'
            }`}
          >
            {item.text}
          </a>
        ))}
      </div>
    </div>
  )
}
