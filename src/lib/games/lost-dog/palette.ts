/**
 * The world-side palette (docs/DESIGN.md § Cún đi lạc — Palette). A canvas
 * cannot read a Tailwind class, so these live as TS literals; the four values
 * that also exist as `--games-*` CSS custom properties carry a comment
 * pointing at the matching token so the two do not drift (plan R13).
 */

export const PALETTE = Object.freeze({
  skyHigh: '#a8d3d8',
  skyHaze: '#f3dcc0',
  far: '#8fa5ad',
  mid: '#c2a68c',
  /** The foreground band: mid, darkened, so it reads as nearer without gaining an outline. */
  foreground: '#8f7a63',
  /** Rain streaks and the wet sheen; cool enough never to be mistaken for a hazard. */
  rain: '#9fc4d6',
  lane: '#6f7a76',
  kerb: '#e9e2d4',
  ink: '#2b2119',
  corgiBody: '#e08b3c',
  /** A shade darker than corgiBody — the back/ear-tip/leg shading, not a new hue. */
  corgiBodyShade: '#b5691f',
  corgiCream: '#fdf3e2',
  cat: '#3d3550',
  /** A shade darker than cat — the back/ear/tail shading, not a new hue. */
  catShade: '#2a2438',
  /** Cat eyes only — the one glowing accent on an otherwise silhouette mass. */
  catEye: '#d9a441',
  /** Must equal --games-brass in globals.css. */
  brass: '#d9a441',
  /** Must equal --games-ember in globals.css. */
  ember: '#e06c5b',
  /** Must equal --games-oak-light in globals.css. */
  cream: '#f5e2c4',
  /** Must equal --games-mat in globals.css. */
  mat: '#243038',
})
