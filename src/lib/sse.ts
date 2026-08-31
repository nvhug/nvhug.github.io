// Server-sent-events framing, shared by the routes that stream a provider completion and
// by the browser code that reads them. Kept transport-only: nothing here knows what an
// event means, so both ends can be tested without a network.

/** One SSE frame. `data` is JSON-encoded — every consumer here parses it back. */
export function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export interface SseFrame {
  event: string
  data: unknown
}

/**
 * Splits whatever has arrived so far into whole frames plus the incomplete tail.
 * A chunk boundary can land mid-frame, so the caller keeps `rest` and prepends it to the
 * next chunk — dropping it would silently lose a section.
 */
export function splitSseFrames(buffer: string): { frames: string[]; rest: string } {
  const parts = buffer.split('\n\n')
  const rest = parts.pop() ?? ''
  return { frames: parts.filter(p => p.trim() !== ''), rest }
}

/**
 * Reads one frame's `event:` and `data:` lines. Returns null for a frame with no usable
 * data — a comment keep-alive, or a payload that will not parse — rather than throwing,
 * since one malformed frame must not abort a stream that is otherwise fine.
 */
export function parseSseFrame(frame: string): SseFrame | null {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (dataLines.length === 0) return null
  const raw = dataLines.join('\n')
  if (raw === '[DONE]') return { event, data: '[DONE]' }
  try {
    return { event, data: JSON.parse(raw) }
  } catch {
    return null
  }
}
