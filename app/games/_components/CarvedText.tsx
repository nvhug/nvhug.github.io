/**
 * Carved wood lettering — the games surface's signature (DESIGN § Signature
 * element). Letters routed into the wood: a dark upper inner edge and a light
 * lower edge, with the glyph filled in the darker oak tone so contrast does not
 * rely on the emboss shadows.
 *
 * Used in exactly three places: the level badge, the hub title plaque and the
 * number on a map tile.
 */

import { cn } from '@/lib/utils'

export function CarvedText({
  as: Tag = 'span',
  children,
  className,
}: {
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'div'
  children: React.ReactNode
  className?: string
}) {
  return (
    <Tag className={cn('games-carved font-tuvi-sans font-semibold uppercase tracking-[0.08em]', className)}>
      {children}
    </Tag>
  )
}
