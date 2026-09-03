import { describe, expect, it } from 'vitest'
import { BOARD_FRAME_PX, MIN_CELL_PX, computeBoardMetrics, type MetricsInput } from './metrics'

function input(over: Partial<MetricsInput> = {}): MetricsInput {
  return {
    viewportWidth: 320,
    viewportHeight: 900,
    headerPx: 69,
    chromePx: 96,
    grid: 8,
    looseCount: 10,
    slotCells: { w: 3, h: 3 },
    ...over,
  }
}

describe('computeBoardMetrics', () => {
  it('stacks the tray below the board in portrait and beside it in landscape', () => {
    expect(computeBoardMetrics(input({ viewportWidth: 390, viewportHeight: 844 })).trayPlacement).toBe('below')
    expect(computeBoardMetrics(input({ viewportWidth: 844, viewportHeight: 390 })).trayPlacement).toBe('beside')
    expect(computeBoardMetrics(input({ viewportWidth: 1440, viewportHeight: 900 })).trayPlacement).toBe('beside')
  })

  it('fills a 320px phone: board plus frame is exactly the 288px the page has', () => {
    const m = computeBoardMetrics(input({ viewportWidth: 320, viewportHeight: 900 }))
    expect(m.cellPx).toBe(34)
    expect(m.boardPx + BOARD_FRAME_PX).toBe(288)
  })

  it('takes the width when the height allows it', () => {
    const m = computeBoardMetrics(input({ viewportWidth: 430, viewportHeight: 1000 }))
    expect(m.cellPx).toBe(47)
    expect(m.boardPx).toBe(47 * 8)
  })

  it('shrinks to the cell floor rather than past it when the viewport is short', () => {
    const m = computeBoardMetrics(input({ viewportWidth: 500, viewportHeight: 600 }))
    expect(m.cellPx).toBe(MIN_CELL_PX)
    expect(m.boardPx).toBe(MIN_CELL_PX * 8)
  })

  it('never lets the board exceed the viewport width, even below the cell floor', () => {
    const m = computeBoardMetrics(input({ viewportWidth: 288, viewportHeight: 900 }))
    expect(m.cellPx).toBeLessThan(MIN_CELL_PX)
    expect(m.boardPx + BOARD_FRAME_PX).toBeLessThanOrEqual(288 - 32)
  })

  it('keeps the board plus its frame inside the width on every viewport asked about', () => {
    for (const viewportWidth of [320, 360, 390, 430, 768, 1024, 1440, 2560]) {
      for (const viewportHeight of [568, 700, 844, 900, 1400]) {
        for (const grid of [5, 6, 7, 8]) {
          for (const looseCount of [3, 6, 10]) {
            const m = computeBoardMetrics(input({ viewportWidth, viewportHeight, grid, looseCount }))
            expect(m.boardPx + BOARD_FRAME_PX).toBeLessThanOrEqual(viewportWidth - 32)
            expect(m.cellPx).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('caps the desktop board at 60% of the viewport width and leaves a tray column', () => {
    const m = computeBoardMetrics(input({ viewportWidth: 2560, viewportHeight: 1400 }))
    expect(m.boardPx).toBeLessThanOrEqual(2560 * 0.6)
    expect(m.trayWidthPx).toBeGreaterThanOrEqual(160)
    expect(m.trayWidthPx).toBeLessThanOrEqual(460)
    expect(m.trayMinHeightPx).toBe(0)
  })

  it('reserves the tray height up front from the level piece count', () => {
    const many = computeBoardMetrics(input({ looseCount: 10 }))
    const few = computeBoardMetrics(input({ looseCount: 3 }))
    expect(many.trayMinHeightPx).toBeGreaterThan(few.trayMinHeightPx)
    expect(few.trayMinHeightPx).toBeGreaterThan(0)
    expect(many.trayColumns).toBe(2)
  })

  it('never returns a smaller cell for a strictly larger viewport', () => {
    let previous = 0
    for (const size of [320, 360, 420, 600, 900, 1200]) {
      const m = computeBoardMetrics(input({ viewportWidth: size, viewportHeight: size * 2 }))
      expect(m.cellPx).toBeGreaterThanOrEqual(previous)
      previous = m.cellPx
    }
  })
})
