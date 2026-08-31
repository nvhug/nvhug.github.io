import { describe, expect, it } from 'vitest'
import { parseSseFrame, splitSseFrames, sseMessage } from './sse'

describe('sseMessage', () => {
  it('writes an event/data frame terminated by a blank line', () => {
    expect(sseMessage('progress', { percent: 40 }))
      .toBe('event: progress\ndata: {"percent":40}\n\n')
  })
})

describe('splitSseFrames', () => {
  it('returns whole frames and keeps the incomplete tail', () => {
    const { frames, rest } = splitSseFrames('event: a\ndata: 1\n\nevent: b\ndata: 2')
    expect(frames).toEqual(['event: a\ndata: 1'])
    expect(rest).toBe('event: b\ndata: 2')
  })

  it('has no frames yet when nothing is terminated', () => {
    expect(splitSseFrames('event: a\ndata: 1')).toEqual({ frames: [], rest: 'event: a\ndata: 1' })
  })

  it('drops the empty tail when the buffer ends on a boundary', () => {
    const { frames, rest } = splitSseFrames('event: a\ndata: 1\n\n')
    expect(frames).toEqual(['event: a\ndata: 1'])
    expect(rest).toBe('')
  })
})

describe('parseSseFrame', () => {
  it('reads the event name and JSON payload', () => {
    expect(parseSseFrame('event: section\ndata: {"key":"weight"}'))
      .toEqual({ event: 'section', data: { key: 'weight' } })
  })

  it('defaults to the message event when none is named', () => {
    expect(parseSseFrame('data: {"a":1}')).toEqual({ event: 'message', data: { a: 1 } })
  })

  it('passes the [DONE] sentinel through unparsed', () => {
    expect(parseSseFrame('data: [DONE]')).toEqual({ event: 'message', data: '[DONE]' })
  })

  it('returns null rather than throwing on a keep-alive or unparsable payload', () => {
    expect(parseSseFrame(': keep-alive')).toBeNull()
    expect(parseSseFrame('event: x\ndata: {not json')).toBeNull()
  })
})

// Gemini terminates its SSE frames with CRLF CRLF, DeepSeek with LF LF — both are valid
// per the spec, and a splitter that only knows one of them silently yields no frames at
// all rather than failing loudly. Verified against both live endpoints, 2026-08-31.
describe('splitSseFrames — line endings in the wild', () => {
  it('splits CRLF-terminated frames, the format Gemini actually sends', () => {
    const { frames, rest } = splitSseFrames('data: {"a":1}\r\n\r\ndata: {"b":2}\r\n\r\n')
    expect(frames).toEqual(['data: {"a":1}', 'data: {"b":2}'])
    expect(rest).toBe('')
  })

  it('keeps a CRLF tail that has not been terminated yet', () => {
    const { frames, rest } = splitSseFrames('data: {"a":1}\r\n\r\ndata: {"b"')
    expect(frames).toEqual(['data: {"a":1}'])
    expect(rest).toBe('data: {"b"')
  })

  it('splits bare-CR frames too', () => {
    expect(splitSseFrames('data: 1\r\rdata: 2\r\r').frames).toEqual(['data: 1', 'data: 2'])
  })
})

describe('parseSseFrame — line endings in the wild', () => {
  it('reads a frame whose lines end in CRLF', () => {
    expect(parseSseFrame('event: section\r\ndata: {"key":"weight"}'))
      .toEqual({ event: 'section', data: { key: 'weight' } })
  })
})
