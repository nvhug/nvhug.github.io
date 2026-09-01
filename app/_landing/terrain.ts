/**
 * The hero's record field — geometry and colour, with no three.js in sight.
 *
 * DESIGN.md § Public Landing Page, "Signature element 1": the visual is a grid of
 * points whose height is a deterministic function of position and time, emerald at
 * the floor and gold at the peaks. The maths lives here rather than inside the render
 * loop so it can be read and tested; `RecordField.tsx` only pushes these numbers into
 * a buffer.
 *
 * FR-020 holds because of this file: the geometry is computed, so the page needs no
 * model, texture or image asset to draw its signature.
 */

/** 96 x 48 = 4,608 points. The count is a fill-rate budget, not a taste choice (FR-024). */
export const TERRAIN = {
  cols: 96,
  rows: 48,
  /** World extent. Wider than deep, so the field reads as a run of entries seen edge-on. */
  width: 16,
  depth: 9,
} as const

export const TERRAIN_POINT_COUNT = TERRAIN.cols * TERRAIN.rows

/** Amplitudes of the three sines. Their sum is the height envelope below. */
const WAVES = [
  { amp: 0.55, sx: 0.55, sz: 0, st: 0.55 },
  { amp: 0.35, sx: 0, sz: 0.85, st: 0.32 },
  { amp: 0.22, sx: 0.42, sz: 0.42, st: -0.22 },
] as const

export const HEIGHT_MAX = WAVES.reduce((sum, w) => sum + w.amp, 0)
export const HEIGHT_MIN = -HEIGHT_MAX

/**
 * Height of the field at a world position and a time, in world units.
 *
 * Pure and total: same arguments, same answer, always within [HEIGHT_MIN, HEIGHT_MAX].
 * Three sines rather than noise so the surface is periodic — a visitor who watches for
 * a while sees a record that keeps its character instead of drifting into mush.
 */
export function terrainHeight(x: number, z: number, t: number): number {
  let h = 0
  for (const w of WAVES) {
    h += w.amp * Math.sin(w.sx * x + w.sz * z + w.st * t)
  }
  return h
}

/** Height mapped to 0 (floor) .. 1 (peak), for the colour ramp. Clamped. */
export function terrainNormalized(height: number): number {
  const t = (height - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN)
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/**
 * The x and z of every point, laid out row-major, y left at 0.
 *
 * Built once at mount; only the y components are rewritten per frame. Returned as the
 * flat xyz triples three.js wants, so the render loop never allocates.
 */
export function buildTerrainPositions(): Float32Array {
  const positions = new Float32Array(TERRAIN_POINT_COUNT * 3)
  const stepX = TERRAIN.width / (TERRAIN.cols - 1)
  const stepZ = TERRAIN.depth / (TERRAIN.rows - 1)
  let i = 0
  for (let row = 0; row < TERRAIN.rows; row++) {
    for (let col = 0; col < TERRAIN.cols; col++) {
      positions[i++] = -TERRAIN.width / 2 + col * stepX
      positions[i++] = 0
      positions[i++] = -TERRAIN.depth / 2 + row * stepZ
    }
  }
  return positions
}

/** `#RRGGBB` to the 0..1 triple three.js colours use. */
export function hexToRgb01(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** Floor and peak of the ramp — the two accents DESIGN.md allows, and no third. */
export const FLOOR_RGB = hexToRgb01('#10B981')
export const PEAK_RGB = hexToRgb01('#E3B04B')

/** Rewrites the y of every point for a given time. Allocates nothing. */
export function writeTerrainHeights(positions: Float32Array, time: number): void {
  for (let p = 0; p < TERRAIN_POINT_COUNT; p++) {
    const i = p * 3
    positions[i + 1] = terrainHeight(positions[i], positions[i + 2], time)
  }
}

/**
 * Per-point colours: emerald at the floor, gold at the peaks.
 *
 * Reads the height straight out of `positions[i + 1]`, so `writeTerrainHeights` must
 * run first for the same time. That ordering is the reason this does not take a time
 * argument: recomputing the sines here would double the field's per-frame trig for a
 * value the caller has already worked out.
 *
 * Writes into `target` and returns it, so the render loop allocates nothing.
 */
export function writeTerrainColors(positions: Float32Array, target: Float32Array): Float32Array {
  for (let p = 0; p < TERRAIN_POINT_COUNT; p++) {
    const i = p * 3
    const k = terrainNormalized(positions[i + 1])
    target[i] = FLOOR_RGB[0] + (PEAK_RGB[0] - FLOOR_RGB[0]) * k
    target[i + 1] = FLOOR_RGB[1] + (PEAK_RGB[1] - FLOOR_RGB[1]) * k
    target[i + 2] = FLOOR_RGB[2] + (PEAK_RGB[2] - FLOOR_RGB[2]) * k
  }
  return target
}
