import { describe, expect, it } from 'vitest'
import { AI_FEATURE_COUNT, BLOCKS, COUNTS, PRODUCT_AREA_IDS, blockById } from './blocks'
import { vi as viDict } from '@/lib/i18n/dictionaries/vi'
import { en as enDict } from '@/lib/i18n/dictionaries/en'

describe('BLOCKS — the page structure FR-022 fixes', () => {
  it('is in the order the spec requires', () => {
    // The order is a priority claim: what a visitor does daily comes before the
    // deeper-but-rarer money features. Changing it means changing FR-022.
    expect(BLOCKS.map((b) => b.id)).toEqual([
      'life',
      'blog',
      'fate',
      'money',
      'invest',
      'quotes',
      'privacy',
    ])
  })

  it('leads with the daily-notes block, not with money', () => {
    expect(BLOCKS[0].id).toBe('life')
  })

  it('numbers the entries 01 upward with no gaps or repeats', () => {
    expect(BLOCKS.map((b) => b.index)).toEqual([
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
    ])
  })

  it('spends the emphasis treatment on exactly the two claims that must land', () => {
    // What the visitor opens every day, and the promise that it stays theirs. A third
    // emphasised block would mean none of them is emphasised.
    expect(BLOCKS.filter((b) => b.emphasis).map((b) => b.id)).toEqual(['life', 'privacy'])
  })

  it('gives each emphasised block an explicit capability layout', () => {
    // life has eight capabilities and the room from its mockup row to spread them;
    // privacy has four and reads better as a short vertical list.
    expect(BLOCKS.filter((b) => b.emphasis).map((b) => b.capsLayout)).toEqual([
      'columns',
      'list',
    ])
  })

  it('gives every block at least three capabilities — FR-025 forbids a one-liner', () => {
    for (const block of BLOCKS) {
      expect(block.caps.length, block.id).toBeGreaterThanOrEqual(3)
    }
  })

  it('never repeats a capability inside a block', () => {
    for (const block of BLOCKS) {
      expect(new Set(block.caps).size, block.id).toBe(block.caps.length)
    }
  })

  it('never reuses a capability key across blocks', () => {
    const all = BLOCKS.flatMap((b) => b.caps)
    expect(new Set(all).size).toBe(all.length)
  })

  it('restricts the gold accent to the horoscope block', () => {
    // DESIGN.md Tokens: gold means metal, or the tử vi block. It is never a
    // general-purpose highlight, and this is the cheapest place to hold that line.
    expect(BLOCKS.filter((b) => b.accent === 'gold').map((b) => b.id)).toEqual(['fate'])
  })

  it('gives each block that carries a mockup its own, and the rest none', () => {
    expect(BLOCKS.filter((b) => b.mockup).map((b) => b.mockup)).toEqual([
      'day',
      'blog',
      'palace',
      'asset',
      'stock',
      'quote',
    ])
  })
})

describe('COUNTS — the count strip', () => {
  it('claims five product areas even though six blocks carry a mockup', () => {
    // Not a contradiction: investing has its own block, but PRODUCT.md puts Stocks
    // inside /finance, so it is not a separate surface. The strip claims surfaces.
    expect(COUNTS.areas).toBe(5)
    expect(PRODUCT_AREA_IDS).toEqual(['life', 'blog', 'fate', 'money', 'quotes'])
    expect(BLOCKS.filter((b) => b.mockup)).toHaveLength(6)
    expect(PRODUCT_AREA_IDS).not.toContain('invest')
  })

  it('lists the product areas in the order the page shows them', () => {
    const order = BLOCKS.map((b) => b.id)
    const positions = PRODUCT_AREA_IDS.map((id) => order.indexOf(id))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('claims eight dashboard areas, and lists exactly eight', () => {
    // PRODUCT.md: the dashboard has 8 tabs — the five-meal plan is a sub-panel of
    // calorie tracking, not a ninth. The strip's number is derived from the list, so
    // this test fails if a capability is added without the claim moving with it.
    expect(COUNTS.dashboardAreas).toBe(8)
    expect(COUNTS.dashboardAreas).toBe(blockById('life').caps.length)
  })

  it('claims only the AI features a signed-up stranger can actually reach', () => {
    // Five, not PRODUCT.md's six: stock_suggestions is admin-only, enforced on the
    // server (ADR-015). Advertising it would be false for every reader of this page.
    // There is no dedicated AI block any more — each of the five is already named
    // inside its own area's capability list — so this is a plain count, not a length.
    expect(COUNTS.aiFeatures).toBe(5)
    expect(COUNTS.aiFeatures).toBe(AI_FEATURE_COUNT)
  })
})

describe('capability copy', () => {
  const keys = BLOCKS.flatMap((b) => b.caps)

  it('exists in Vietnamese for every capability listed', () => {
    for (const key of keys) {
      expect(viDict.landing.cap, key).toHaveProperty(key)
    }
  })

  it('exists in English for every capability listed — FR-015, no untranslated fragment', () => {
    for (const key of keys) {
      expect(enDict.landing.cap, key).toHaveProperty(key)
    }
  })

  it('leaves no orphan copy behind when a capability is dropped', () => {
    expect(Object.keys(viDict.landing.cap).sort()).toEqual([...keys].sort())
  })

  it('says something in both languages — an empty string renders as a blank row', () => {
    for (const key of keys) {
      const cap = viDict.landing.cap as Record<string, string>
      const capEn = enDict.landing.cap as Record<string, string>
      expect(cap[key].trim().length, `vi.${key}`).toBeGreaterThan(0)
      expect(capEn[key].trim().length, `en.${key}`).toBeGreaterThan(0)
    }
  })
})

describe('blockById', () => {
  it('returns the block asked for', () => {
    expect(blockById('fate').index).toBe('03')
  })

  it('throws rather than returning undefined, so a typo cannot render an empty block', () => {
    // @ts-expect-error — the point of the test is the runtime guard behind the type
    expect(() => blockById('nope')).toThrow(/unknown landing block/)
  })
})
