import { describe, expect, it } from 'vitest'
import { parseCompleteSections, sectionProgressPercent } from './json-stream'

describe('parseCompleteSections', () => {
  it('has nothing while the first value is still arriving', () => {
    expect(parseCompleteSections('{"summary": "three sen')).toBeNull()
    expect(parseCompleteSections('')).toBeNull()
  })

  it('returns a scalar entry once the comma after it arrives', () => {
    expect(parseCompleteSections('{"summary": "done", "weight": {"verd'))
      .toEqual({ summary: 'done' })
  })

  it('returns a nested object entry once it closes', () => {
    const buffer = '{"summary": "s", "weight": {"verdict": "ok", "points": ["a"]}, "gym": {'
    expect(parseCompleteSections(buffer)).toEqual({
      summary: 's',
      weight: { verdict: 'ok', points: ['a'] },
    })
  })

  it('is not fooled by braces or commas inside strings', () => {
    const buffer = '{"summary": "a, b} c", "weight": {"verdict": "x, y"}, "gym": {'
    expect(parseCompleteSections(buffer)).toEqual({
      summary: 'a, b} c',
      weight: { verdict: 'x, y' },
    })
  })

  it('is not fooled by an escaped quote', () => {
    expect(parseCompleteSections('{"summary": "he said \\"hi\\", then left", "weight": {'))
      .toEqual({ summary: 'he said "hi", then left' })
  })

  it('returns every entry once the object closes', () => {
    expect(parseCompleteSections('{"summary": "s", "pattern": "p"}'))
      .toEqual({ summary: 's', pattern: 'p' })
  })

  it('ignores a payload that is not an object', () => {
    expect(parseCompleteSections('["a", "b"]')).toBeNull()
    expect(parseCompleteSections('null')).toBeNull()
  })
})

describe('sectionProgressPercent', () => {
  it('scales seen/total onto a scale that stops short of 100', () => {
    expect(sectionProgressPercent(0, 10)).toBe(0)
    expect(sectionProgressPercent(5, 10)).toBe(48)
    expect(sectionProgressPercent(10, 10)).toBe(95)
  })

  it('never reaches 100, which is reserved for the done event', () => {
    expect(sectionProgressPercent(20, 10)).toBe(95)
  })

  it('is 0 rather than NaN when there are no sections', () => {
    expect(sectionProgressPercent(0, 0)).toBe(0)
  })
})
