// Derives a short conversation subject line for the admin inbox list (FR-062)
// from the conversation's first message. Never model-authored — this is a
// plain string transform, run once when a conversation is created.

const MAX_SUBJECT_LENGTH = 60
const ELLIPSIS = '…'

/** Shown when the first message yields no usable text (empty, whitespace-only). */
const FALLBACK_SUBJECT = 'New conversation'

/**
 * Takes the first line of `firstMessage`, collapses internal whitespace
 * (tabs, repeated spaces) to single spaces, and truncates to at most 60
 * characters total — including the ellipsis, so a cut string is 59 kept
 * characters plus `…`. Falls back to a fixed placeholder when the message
 * (or its first line, after collapsing) is empty.
 */
export function deriveSubject(firstMessage: string): string {
  const trimmedWhole = firstMessage.trim()
  if (trimmedWhole === '') return FALLBACK_SUBJECT

  const firstLine = trimmedWhole.split('\n')[0]
  const collapsed = firstLine.replace(/\s+/g, ' ').trim()
  if (collapsed === '') return FALLBACK_SUBJECT

  if (collapsed.length <= MAX_SUBJECT_LENGTH) return collapsed

  return `${collapsed.slice(0, MAX_SUBJECT_LENGTH - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`
}
