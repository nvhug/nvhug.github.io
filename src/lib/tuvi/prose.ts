/**
 * The AI returns each "detail" reading as one unbroken paragraph. At 3-5
 * sentences of dense astrology prose that is a wall of text on a phone, so the
 * overview splits it into short paragraphs before rendering.
 *
 * Splitting happens here, on the client, rather than by asking the model for
 * structured output: it also fixes the readings already cached for this lunar
 * day, which a prompt change cannot reach.
 */

/** A sentence ends at . ! ? followed by space and a capital letter. Requiring a
    capital is what keeps decimals intact — the character after the dot in
    "chia đôi còn -1.5, đạt 46" is a digit, so it is not a boundary. */
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=\p{Lu})/u

const SENTENCES_PER_PARAGRAPH = 2

/**
 * Splits one reading into paragraphs of at most two sentences. Returns a single
 * entry for text with no boundary, so the caller never has to special-case a
 * one-sentence reading.
 */
export function splitReadingParagraphs(text: string): string[] {
  const sentences = text
    .split(SENTENCE_BOUNDARY)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '')

  if (sentences.length === 0) return []

  const paragraphs: string[] = []
  for (let index = 0; index < sentences.length; index += SENTENCES_PER_PARAGRAPH) {
    paragraphs.push(sentences.slice(index, index + SENTENCES_PER_PARAGRAPH).join(' '))
  }
  return paragraphs
}
