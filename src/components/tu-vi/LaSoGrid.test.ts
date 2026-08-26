import { describe, expect, it } from 'vitest'
import type { Palace } from '@/lib/tuvi/types'
import { palaceTone } from './LaSoGrid'

function palace(marks: Partial<Pick<Palace, 'isMenh' | 'isThan' | 'isDaiVan'>>): Palace {
  return {
    index: 0,
    name: 'Mệnh',
    pillar: { stem: 0, branch: 0 },
    stars: [],
    trangSinh: null,
    tuan: false,
    triet: false,
    isMenh: false,
    isThan: false,
    isDaiVan: false,
    ...marks,
  }
}

describe('palaceTone', () => {
  it('gives an unmarked palace no fill', () => {
    expect(palaceTone(palace({}))).toBe('plain')
  })

  it('fills each mark on its own', () => {
    expect(palaceTone(palace({ isMenh: true }))).toBe('menh')
    expect(palaceTone(palace({ isThan: true }))).toBe('than')
    expect(palaceTone(palace({ isDaiVan: true }))).toBe('daiVan')
  })

  it('keeps the identity fill when the reader is living that palace as a decade', () => {
    // Đại vận reports itself with its own chip instead. Letting it win the fill
    // would visually erase the Mệnh palace for the ten years it is current —
    // the one palace a reader looks for first.
    expect(palaceTone(palace({ isMenh: true, isDaiVan: true }))).toBe('menh')
    expect(palaceTone(palace({ isThan: true, isDaiVan: true }))).toBe('than')
  })

  it('prefers Mệnh when one palace is both Mệnh and Thân', () => {
    expect(palaceTone(palace({ isMenh: true, isThan: true }))).toBe('menh')
  })
})
