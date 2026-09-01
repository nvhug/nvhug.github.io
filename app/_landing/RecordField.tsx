'use client'

import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { AdditiveBlending, type Points } from 'three'
import {
  TERRAIN,
  TERRAIN_POINT_COUNT,
  buildTerrainPositions,
  writeTerrainColors,
  writeTerrainHeights,
} from './terrain'

/**
 * The hero's record field — the only three.js on the site.
 *
 * DESIGN.md § "Signature element 1". This file is deliberately thin: all the geometry
 * and colour maths lives in `terrain.ts`, which is pure and unit-tested, and this
 * component only pushes those numbers into buffers. It is loaded through
 * `next/dynamic({ ssr: false })` by `HeroField`, so nothing here is in the
 * first-paint path (FR-024).
 */

function Field() {
  const points = useRef<Points>(null)

  // Allocated once. The render loop rewrites these in place and allocates nothing,
  // which is what keeps 4,608 points affordable on a phone.
  const { positions, colors } = useMemo(() => {
    const positions = buildTerrainPositions()
    const colors = new Float32Array(TERRAIN_POINT_COUNT * 3)
    writeTerrainHeights(positions, 0)
    writeTerrainColors(positions, colors)
    return { positions, colors }
  }, [])

  useFrame(({ clock }) => {
    const mesh = points.current
    if (!mesh) return
    const time = clock.elapsedTime
    // Heights first, then colours — `writeTerrainColors` reads the y this just wrote.
    writeTerrainHeights(positions, time)
    writeTerrainColors(positions, colors)
    mesh.geometry.attributes.position.needsUpdate = true
    mesh.geometry.attributes.color.needsUpdate = true
    // One slow yaw. No camera move, no parallax, no mouse tracking — the field is
    // meant to be read past, not played with.
    mesh.rotation.y = time * 0.05
  })

  return (
    <points ref={points} rotation={[0, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.052}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.7}
        // Additive on a near-black ground is what makes the peaks read as lit rather
        // than painted; depth writes off so overlapping points do not punch holes.
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

export default function RecordField({ active }: { active: boolean }) {
  return (
    <Canvas
      // `never` parks the loop without unmounting the scene, so scrolling back to the
      // hero resumes instantly instead of rebuilding 4,608 points (FR-024).
      frameloop={active ? 'always' : 'never'}
      // A 3x-density phone rendering additive points at full DPR is the one way this
      // becomes a battery complaint. 1.5 is the budget DESIGN.md fixes.
      dpr={[1, 1.5]}
      camera={{ position: [0, 2.1, TERRAIN.depth * 0.85], fov: 42 }}
      gl={{ antialias: false, powerPreference: 'low-power' }}
      style={{ pointerEvents: 'none' }}
    >
      <Field />
    </Canvas>
  )
}
