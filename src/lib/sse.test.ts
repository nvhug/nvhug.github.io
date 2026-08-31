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
