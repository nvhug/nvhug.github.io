import { describe, expect, it } from 'vitest'

import {
  parseBuyPickNote,
  serializeBuyPickNote,
  sumBuyPickDetails,
} from './buyPickDetails'
import type { BuyPickDetail } from './buyPickDetails'

// ─── helpers ────────────────────────────────────────────────────────────────

function detail(overrides: Partial<BuyPickDetail> = {}): BuyPickDetail {
  return {
    id: 'd1',
    name: 'Protein powder',
    price: 500_000,
    recommendation: 'worth_buying',
    ...overrides,
  }
}

// ─── parseBuyPickNote ────────────────────────────────────────────────────────

describe('parseBuyPickNote', () => {
  it('returns empty for null', () => {
    expect(parseBuyPickNote(null)).toEqual({ noteText: '', purchaseDetails: [] })
  })

  it('returns empty for undefined', () => {
    expect(parseBuyPickNote(undefined)).toEqual({ noteText: '', purchaseDetails: [] })
  })

  it('returns empty for blank string', () => {
    expect(parseBuyPickNote('   ')).toEqual({ noteText: '', purchaseDetails: [] })
  })

  it('returns plain text note when content does not start with {', () => {
    const result = parseBuyPickNote('Just a plain note')
    expect(result).toEqual({ noteText: 'Just a plain note', purchaseDetails: [] })
  })

  it('parses valid JSON with noteText and purchaseDetails', () => {
    const raw = JSON.stringify({
      noteText: 'Good deal',
      purchaseDetails: [{ id: 'd1', name: 'Whey', price: 300_000, recommendation: 'worth_buying' }],
    })
    const result = parseBuyPickNote(raw)
    expect(result.noteText).toBe('Good deal')
    expect(result.purchaseDetails).toHaveLength(1)
    expect(result.purchaseDetails[0].name).toBe('Whey')
    expect(result.purchaseDetails[0].price).toBe(300_000)
    expect(result.purchaseDetails[0].recommendation).toBe('worth_buying')
  })

  it('handles JSON with missing noteText gracefully', () => {
    const raw = JSON.stringify({ purchaseDetails: [{ id: 'd1', name: 'Item', price: 100, recommendation: 'neutral' }] })
    const result = parseBuyPickNote(raw)
    expect(result.noteText).toBe('')
    expect(result.purchaseDetails).toHaveLength(1)
  })

  it('handles JSON with missing purchaseDetails gracefully', () => {
    const raw = JSON.stringify({ noteText: 'Only text' })
    const result = parseBuyPickNote(raw)
    expect(result.noteText).toBe('Only text')
    expect(result.purchaseDetails).toHaveLength(0)
  })

  it('returns raw text as noteText when JSON parsing fails', () => {
    const result = parseBuyPickNote('{bad json}')
    expect(result).toEqual({ noteText: '{bad json}', purchaseDetails: [] })
  })

  it('filters out purchaseDetails entries with missing name', () => {
    const raw = JSON.stringify({
      purchaseDetails: [
        { id: 'd1', name: '', price: 100, recommendation: 'neutral' },
        { id: 'd2', name: 'Valid', price: 200, recommendation: 'neutral' },
      ],
    })
    const result = parseBuyPickNote(raw)
    expect(result.purchaseDetails).toHaveLength(1)
    expect(result.purchaseDetails[0].id).toBe('d2')
  })

  it('filters out purchaseDetails entries with negative price', () => {
    const raw = JSON.stringify({
      purchaseDetails: [
        { id: 'd1', name: 'Bad', price: -1, recommendation: 'neutral' },
        { id: 'd2', name: 'Good', price: 0, recommendation: 'neutral' },
      ],
    })
    const result = parseBuyPickNote(raw)
    // price 0 is valid (not negative), price -1 is not
    expect(result.purchaseDetails).toHaveLength(1)
    expect(result.purchaseDetails[0].id).toBe('d2')
  })

  it('defaults missing recommendation to worth_buying', () => {
    const raw = JSON.stringify({
      purchaseDetails: [{ name: 'Item', price: 100 }],
    })
    const result = parseBuyPickNote(raw)
    expect(result.purchaseDetails[0].recommendation).toBe('worth_buying')
  })

  it('generates fallback id when id is missing', () => {
    const raw = JSON.stringify({
      purchaseDetails: [{ name: 'Item', price: 100, recommendation: 'neutral' }],
    })
    const result = parseBuyPickNote(raw)
    expect(result.purchaseDetails[0].id).toBe('detail-0')
  })

  it('coerces string price to number', () => {
    const raw = JSON.stringify({
      purchaseDetails: [{ id: 'd1', name: 'Item', price: '250000', recommendation: 'neutral' }],
    })
    const result = parseBuyPickNote(raw)
    expect(result.purchaseDetails[0].price).toBe(250_000)
  })

  it('filters out non-object entries in purchaseDetails', () => {
    const raw = JSON.stringify({ purchaseDetails: [null, 42, 'string', { name: 'Valid', price: 100 }] })
    const result = parseBuyPickNote(raw)
    expect(result.purchaseDetails).toHaveLength(1)
  })
})

// ─── serializeBuyPickNote ────────────────────────────────────────────────────

describe('serializeBuyPickNote', () => {
  it('returns null when both fields are empty', () => {
    expect(serializeBuyPickNote({ noteText: '', purchaseDetails: [] })).toBeNull()
    expect(serializeBuyPickNote({ noteText: '   ', purchaseDetails: [] })).toBeNull()
  })

  it('returns plain text when only noteText is provided', () => {
    const result = serializeBuyPickNote({ noteText: 'Just a note', purchaseDetails: [] })
    expect(result).toBe('Just a note')
  })

  it('serializes noteText + purchaseDetails as JSON', () => {
    const input = {
      noteText: 'Ghi chú',
      purchaseDetails: [detail()],
    }
    const raw = serializeBuyPickNote(input)!
    const parsed = JSON.parse(raw)
    expect(parsed.noteText).toBe('Ghi chú')
    expect(parsed.purchaseDetails).toHaveLength(1)
    expect(parsed.purchaseDetails[0].name).toBe('Protein powder')
  })

  it('omits noteText from JSON when it is empty', () => {
    const raw = serializeBuyPickNote({ noteText: '', purchaseDetails: [detail()] })!
    const parsed = JSON.parse(raw)
    expect(parsed.noteText).toBeUndefined()
    expect(parsed.purchaseDetails).toHaveLength(1)
  })

  it('round-trips through parseBuyPickNote', () => {
    const original = {
      noteText: 'Test note',
      purchaseDetails: [
        detail({ id: 'a', name: 'Item A', price: 100_000, recommendation: 'worth_buying' }),
        detail({ id: 'b', name: 'Item B', price: 200_000, recommendation: 'not_worth_buying' }),
      ],
    }
    const raw = serializeBuyPickNote(original)!
    const restored = parseBuyPickNote(raw)
    expect(restored.noteText).toBe(original.noteText)
    expect(restored.purchaseDetails).toHaveLength(2)
    expect(restored.purchaseDetails[0].name).toBe('Item A')
    expect(restored.purchaseDetails[1].recommendation).toBe('not_worth_buying')
  })

  it('strips invalid details before serializing', () => {
    const raw = serializeBuyPickNote({
      noteText: 'note',
      purchaseDetails: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'd1', name: '', price: 100, recommendation: 'neutral' as any },
        detail({ id: 'd2' }),
      ],
    })!
    const parsed = JSON.parse(raw)
    expect(parsed.purchaseDetails).toHaveLength(1)
    expect(parsed.purchaseDetails[0].id).toBe('d2')
  })
})

// ─── sumBuyPickDetails ───────────────────────────────────────────────────────

describe('sumBuyPickDetails', () => {
  it('returns 0 for empty array', () => {
    expect(sumBuyPickDetails([])).toBe(0)
  })

  it('sums prices of all details', () => {
    expect(sumBuyPickDetails([
      detail({ price: 100_000 }),
      detail({ price: 250_000 }),
      detail({ price: 50_000 }),
    ])).toBe(400_000)
  })

  it('handles a single detail', () => {
    expect(sumBuyPickDetails([detail({ price: 75_000 })])).toBe(75_000)
  })
})
