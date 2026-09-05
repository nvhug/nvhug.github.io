/**
 * Synthesised audio (docs/DESIGN.md § No asset files; plan R11): no `<audio>`
 * element, no file, no decode step. A lazily-created `AudioContext` plus a
 * small library of oscillator "voices" for the required SFX and the four
 * persistent gain layers §18 asks for (base, speed, danger, chase), each
 * crossfading from deterministic game state.
 *
 * Never mutates gameplay state — it only reads what the page tells it
 * happened (plan R4's audio-adapter boundary), and it receives a Snapshot's
 * derived values, never a Run. Not unit-tested (project convention for
 * audio/DOM-adjacent code); verified by ear in QA.
 *
 * Every path degrades to silence rather than throwing: an unsupported or
 * autoplay-blocked browser leaves `ctx` null, every voice and every layer
 * setter returns immediately, and `isMuted()` reports the truth (§18, §25).
 */

import { TUNING } from '@/lib/games/lost-dog/config'
import type { FoodKind } from '@/lib/games/lost-dog/config'

type AudioContextCtor = typeof AudioContext

/** The four music layers §18 requires. */
export type MusicLayer = 'base' | 'speed' | 'danger' | 'chase'

/** 0..1 per layer; the page derives these from the snapshot's band/pursuitBand. */
export type LayerLevels = Readonly<Record<MusicLayer, number>>

function resolveAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  return ctor ?? null
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private muted = false
  private layers: Partial<Record<MusicLayer, GainNode>> = {}
  private levels: Record<MusicLayer, number> = { base: 1, speed: 0, danger: 0, chase: 0 }

  /** Call on the first user gesture (Start/tap). A blocked/unsupported browser
   *  degrades to permanently silent — never throws, never blocks gameplay. */
  ensureStarted(): void {
    if (this.ctx) return
    const Ctor = resolveAudioContextCtor()
    if (!Ctor) return
    try {
      const ctx = new Ctor()
      const layers: Partial<Record<MusicLayer, GainNode>> = {}
      for (const layer of ['base', 'speed', 'danger', 'chase'] as const) {
        const gain = ctx.createGain()
        gain.gain.value = 0
        gain.connect(ctx.destination)
        layers[layer] = gain
      }
      this.ctx = ctx
      this.layers = layers
      // A context created inside a blocked autoplay policy stays suspended;
      // resume is best-effort and its failure just means the game is silent.
      void ctx.resume?.().catch(() => undefined)
      this.applyLevels()
    } catch {
      this.ctx = null
      this.layers = {}
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.applyLevels()
  }

  /** The truthful state: muted by choice, or silent because audio never started. */
  isMuted(): boolean {
    return this.muted || this.ctx === null
  }

  /**
   * Whether a usable audio graph exists at all. False after `ensureStarted()`
   * means the browser refused (no `AudioContext`, or construction threw) — the
   * page shows the mute control as muted in that case, because it is (§18, §25).
   */
  isStarted(): boolean {
    return this.ctx !== null
  }

  /**
   * Crossfades all four layers to the given levels. §18's "layers crossfade
   * from deterministic game state; they do not restart abruptly" — the gains
   * move, the graph never restarts.
   */
  setLayers(levels: LayerLevels): void {
    this.levels = { ...levels }
    this.applyLevels()
  }

  /** Kept as the narrow entry point the play page already uses for pursuit pressure. */
  setDangerLevel(level: number): void {
    this.setLayers({ ...this.levels, danger: level, chase: level >= 1 ? 1 : 0 })
  }

  private applyLevels(): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    for (const layer of ['base', 'speed', 'danger', 'chase'] as const) {
      const node = this.layers[layer]
      if (!node) continue
      const target = this.muted ? 0 : TUNING.audio.layerGains[layer] * clamp01(this.levels[layer])
      node.gain.setTargetAtTime(target, now, TUNING.audio.crossfadeSec)
    }
  }

  private tone(freq: number, durationSec: number, type: OscillatorType): void {
    if (!this.ctx || this.muted) return
    try {
      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      osc.type = type
      osc.frequency.value = freq
      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0.22, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec)
      osc.connect(gain).connect(this.ctx.destination)
      osc.start(now)
      osc.stop(now + durationSec)
    } catch {
      // A voice that cannot be created is simply not heard.
    }
  }

  /** A short rising figure — used for the rarest food and for a directed event's arrival. */
  private arpeggio(freqs: readonly number[], stepSec: number): void {
    if (!this.ctx || this.muted) return
    freqs.forEach((freq, index) => {
      window.setTimeout(() => this.tone(freq, stepSec, 'square'), index * stepSec * 1000)
    })
  }

  playJump(): void {
    this.tone(560, 0.12, 'square')
  }

  playLand(): void {
    this.tone(160, 0.08, 'triangle')
  }

  playDuck(): void {
    this.tone(240, 0.06, 'triangle')
  }

  /**
   * One voice per food tier (§18's SFX list): the rarer the food, the higher
   * and longer the chime, so the three are told apart by ear as well as by
   * silhouette. Frequencies are this engine's instrument definition, not
   * gameplay tuning, so they live here rather than in `TUNING`.
   */
  playFoodCollect(kind: FoodKind): void {
    if (kind === 'bone') this.tone(740, 0.08, 'square')
    else if (kind === 'sausage') this.tone(880, 0.11, 'square')
    else this.arpeggio([880, 1175, 1568], 0.09)
  }

  playHit(): void {
    this.tone(100, 0.2, 'sawtooth')
  }

  /** The pursuit-band warning (§18) — audible, but never the only carrier (§22). */
  playWarning(): void {
    this.tone(330, 0.16, 'triangle')
  }

  /** Weather transition: a falling figure into rain, a rising one back to sun. */
  playWeatherTransition(toRain: boolean): void {
    this.arpeggio(toRain ? [660, 550, 440] : [440, 550, 660], 0.1)
  }

  playCatch(): void {
    this.tone(60, 0.45, 'sawtooth')
  }

  playUiAction(): void {
    this.tone(700, 0.05, 'square')
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
