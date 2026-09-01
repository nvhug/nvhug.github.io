import { describe, expect, it } from 'vitest'
import {
  FLOOR_RGB,
  HEIGHT_MAX,
  HEIGHT_MIN,
  PEAK_RGB,
  TERRAIN,
  TERRAIN_POINT_COUNT,
  buildTerrainPositions,
  hexToRgb01,
  terrainHeight,
  terrainNormalized,
  writeTerrainColors,
  writeTerrainHeights,
} from './terrain'

describe('terrainHeight', () => {
  it('is deterministic — the same position and time give the same height', () => {
    expect(terrainHeight(1.5, -2.25, 3.5)).toBe(terrainHeight(1.5, -2.25, 3.5))
  })

  it('stays inside the declared envelope everywhere on the field, over time', () => {
    // The envelope is what the camera framing and the colour ramp are both built
    // against. A height outside it would clip the field or flatten the ramp.
    for (let t = 0; t < 40; t += 0.37) {
      for (let x = -TERRAIN.width / 2; x <= TERRAIN.width / 2; x += 0.5) {
        for (let z = -TERRAIN.depth / 2; z <= TERRAIN.depth / 2; z += 0.5) {
          const h = terrainHeight(x, z, t)
          expect(h).toBeGreaterThanOrEqual(HEIGHT_MIN)
          expect(h).toBeLessThanOrEqual(HEIGHT_MAX)
        }
      }
    }
  })

  it('actually moves with time — a still field is not a signature', () => {
    expect(terrainHeight(0, 0, 0)).not.toBeCloseTo(terrainHeight(0, 0, 2.5), 3)
  })

  it('varies across the field at a fixed time, so the surface has relief', () => {
    const heights = [-6, -3, 0, 3, 6].map((x) => terrainHeight(x, 0, 0))
    expect(new Set(heights.map((h) => h.toFixed(4))).size).toBeGreaterThan(1)
  })
})

describe('terrainNormalized', () => {
  it('maps the envelope onto 0..1', () => {
    expect(terrainNormalized(HEIGHT_MIN)).toBe(0)
    expect(terrainNormalized(HEIGHT_MAX)).toBe(1)
    expect(terrainNormalized(0)).toBeCloseTo(0.5, 10)
  })

  it('clamps rather than extrapolating, so no colour can leave the ramp', () => {
    expect(terrainNormalized(HEIGHT_MIN - 5)).toBe(0)
    expect(terrainNormalized(HEIGHT_MAX + 5)).toBe(1)
  })
})

describe('buildTerrainPositions', () => {
  const positions = buildTerrainPositions()

  it('emits one xyz triple per point', () => {
    expect(positions).toHaveLength(TERRAIN_POINT_COUNT * 3)
    expect(TERRAIN_POINT_COUNT).toBe(TERRAIN.cols * TERRAIN.rows)
  })

  it('centres the field on the origin, within the declared extent', () => {
    for (let i = 0; i < positions.length; i += 3) {
      expect(Math.abs(positions[i])).toBeLessThanOrEqual(TERRAIN.width / 2 + 1e-6)
      expect(Math.abs(positions[i + 2])).toBeLessThanOrEqual(TERRAIN.depth / 2 + 1e-6)
    }
  })

  it('spans the full extent in both axes, corner to corner', () => {
    const xs = [...positions.filter((_, i) => i % 3 === 0)]
    const zs = [...positions.filter((_, i) => i % 3 === 2)]
    expect(Math.min(...xs)).toBeCloseTo(-TERRAIN.width / 2, 6)
    expect(Math.max(...xs)).toBeCloseTo(TERRAIN.width / 2, 6)
    expect(Math.min(...zs)).toBeCloseTo(-TERRAIN.depth / 2, 6)
    expect(Math.max(...zs)).toBeCloseTo(TERRAIN.depth / 2, 6)
  })

  it('leaves y at zero — height is written per frame, not baked in', () => {
    for (let i = 1; i < positions.length; i += 3) expect(positions[i]).toBe(0)
  })
})

describe('writeTerrainHeights', () => {
  it('writes the height function into y and leaves x and z alone', () => {
    const positions = buildTerrainPositions()
    const before = Float32Array.from(positions)
    writeTerrainHeights(positions, 1.25)
    for (let i = 0; i < positions.length; i += 3) {
      expect(positions[i]).toBe(before[i])
      expect(positions[i + 2]).toBe(before[i + 2])
      expect(positions[i + 1]).toBeCloseTo(
        terrainHeight(positions[i], positions[i + 2], 1.25),
        5,
      )
    }
  })
})

describe('hexToRgb01', () => {
  it('converts to the 0..1 triple three.js wants', () => {
    expect(hexToRgb01('#000000')).toEqual([0, 0, 0])
    expect(hexToRgb01('#FFFFFF')).toEqual([1, 1, 1])
  })

  it('reads the design tokens, not some other green', () => {
    // DESIGN.md fixes emerald-deep as the floor and gold as the peak. If either
    // token is edited in the doc and not here, this is where it surfaces.
    expect(FLOOR_RGB).toEqual(hexToRgb01('#10B981'))
    expect(PEAK_RGB).toEqual(hexToRgb01('#E3B04B'))
  })
})

describe('writeTerrainColors', () => {
  const positions = buildTerrainPositions()
  writeTerrainHeights(positions, 0)
  const colors = writeTerrainColors(positions, new Float32Array(TERRAIN_POINT_COUNT * 3))

  it('fills one rgb triple per point, all inside the ramp', () => {
    expect(colors).toHaveLength(TERRAIN_POINT_COUNT * 3)
    const lo = FLOOR_RGB.map((c, i) => Math.min(c, PEAK_RGB[i]))
    const hi = FLOOR_RGB.map((c, i) => Math.max(c, PEAK_RGB[i]))
    for (let i = 0; i < colors.length; i += 3) {
      for (let c = 0; c < 3; c++) {
        expect(colors[i + c]).toBeGreaterThanOrEqual(lo[c] - 1e-6)
        expect(colors[i + c]).toBeLessThanOrEqual(hi[c] + 1e-6)
      }
    }
  })

  it('reuses the buffer it is handed, so the render loop allocates nothing', () => {
    const target = new Float32Array(TERRAIN_POINT_COUNT * 3)
    expect(writeTerrainColors(positions, target)).toBe(target)
  })

  it('colours a point from the height already written into y, not from a fresh sine', () => {
    // The render loop writes heights, then colours. If this function recomputed the
    // height itself the two could disagree by a frame, and the trig bill would double.
    const flat = buildTerrainPositions()
    const mid = writeTerrainColors(flat, new Float32Array(TERRAIN_POINT_COUNT * 3))
    const midpoint = FLOOR_RGB.map((c, i) => c + (PEAK_RGB[i] - c) * 0.5)
    for (let c = 0; c < 3; c++) expect(mid[c]).toBeCloseTo(midpoint[c], 6)
  })

  it('gives the field more than one colour — a flat ramp would waste the gradient', () => {
    const reds = new Set<string>()
    for (let i = 0; i < colors.length; i += 3) reds.add(colors[i].toFixed(3))
    expect(reds.size).toBeGreaterThan(4)
  })
})
