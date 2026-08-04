export type BuyPickDetail = {
  id: string
  name: string
  price: number
  recommendation: 'worth_buying' | 'neutral' | 'not_worth_buying'
}

type BuyPickNotePayload = {
  noteText?: string
  purchaseDetails?: BuyPickDetail[]
}

export type ParsedBuyPickNote = {
  noteText: string
  purchaseDetails: BuyPickDetail[]
}

const EMPTY_PARSED: ParsedBuyPickNote = {
  noteText: '',
  purchaseDetails: [],
}

function sanitizeDetails(raw: unknown): BuyPickDetail[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null

      const candidate = entry as { id?: unknown; name?: unknown; price?: unknown; recommendation?: unknown }
      const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''
      const price = typeof candidate.price === 'number' ? candidate.price : Number(candidate.price)
      const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : `detail-${index}`
      const recommendation = candidate.recommendation === 'not_worth_buying'
        ? 'not_worth_buying'
        : candidate.recommendation === 'neutral'
          ? 'neutral'
          : 'worth_buying'

      if (!name || !Number.isFinite(price) || price < 0) return null

      return {
        id,
        name,
        price,
        recommendation,
      }
    })
    .filter((entry): entry is BuyPickDetail => entry !== null)
}

export function parseBuyPickNote(note: string | null | undefined): ParsedBuyPickNote {
  if (!note) return EMPTY_PARSED

  const trimmed = note.trim()
  if (!trimmed) return EMPTY_PARSED

  if (!trimmed.startsWith('{')) {
    return {
      noteText: note,
      purchaseDetails: [],
    }
  }

  try {
    const parsed = JSON.parse(trimmed) as BuyPickNotePayload
    return {
      noteText: typeof parsed.noteText === 'string' ? parsed.noteText : '',
      purchaseDetails: sanitizeDetails(parsed.purchaseDetails),
    }
  } catch {
    return {
      noteText: note,
      purchaseDetails: [],
    }
  }
}

export function serializeBuyPickNote(input: ParsedBuyPickNote): string | null {
  const noteText = input.noteText.trim()
  const purchaseDetails = sanitizeDetails(input.purchaseDetails)

  if (!noteText && purchaseDetails.length === 0) return null
  if (purchaseDetails.length === 0) return noteText

  return JSON.stringify({
    noteText: noteText || undefined,
    purchaseDetails,
  })
}

export function sumBuyPickDetails(details: BuyPickDetail[]): number {
  return details.reduce((sum, detail) => sum + detail.price, 0)
}
