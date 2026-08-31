// Reading a JSON object while it is still arriving.
//
// A streamed completion is one JSON object whose top-level keys are the UI's cards. Waiting
// for the closing brace means the reader stares at nothing for the whole generation, so this
// finds the keys whose values have fully arrived and hands them over early. Everything here
// is string scanning — no provider, no network — so the interesting cases are testable.

/**
 * Index of the last comma that separates two complete top-level entries, or -1.
 *
 * Tracks string and escape state, so a brace or comma inside a value (`"points": ["a, b"]`)
 * is never mistaken for structure — the bug that would otherwise cut a section in half.
 */
function lastTopLevelComma(buffer: string): number {
  let depth = 0
  let inString = false
  let escaped = false
  let last = -1

  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i]
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { if (inString) escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') depth--
    else if (ch === ',' && depth === 1) last = i
  }
  return last
}

/**
 * Every top-level entry that has fully arrived in a partially-received JSON object.
 * Returns null while nothing is complete yet, and the whole object once it closes.
 */
export function parseCompleteSections(buffer: string): Record<string, unknown> | null {
  if (buffer.trimStart()[0] !== '{') return null

  const whole = tryParseObject(buffer)
  if (whole) return whole

  const comma = lastTopLevelComma(buffer)
  if (comma < 0) return null
  return tryParseObject(buffer.slice(0, comma) + '}')
}

function tryParseObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/**
 * Percent to show for `seen` of `total` sections. Deliberately stops short of 100: the
 * completion is not the whole request — usage logging and the history insert still follow —
 * so 100 is reserved for the `done` event.
 */
export function sectionProgressPercent(seen: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(95, Math.round((seen / total) * 95))
}
