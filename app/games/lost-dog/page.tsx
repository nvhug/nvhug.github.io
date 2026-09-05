'use client'

/**
 * Cún đi lạc — the whole route (spec 015). Unlike the block puzzle there is
 * no level map: this page's root IS the play page (docs/DESIGN.md § Layout).
 *
 * The shell owns the five things §23 assigns it: the accessible controls and
 * panels, responsive sizing, the fixed-step loop, progress I/O, and the
 * analytics flush. Everything it draws or plays comes from a `Snapshot`; it
 * never reaches into the simulation's RNG streams.
 *
 * Known simplifications for Release 1, recorded rather than hidden:
 * - The countdown shows a static "get ready" line, not per-beat numerals.
 * - Canvas draws are piggy-backed on React's render cycle (one draw per
 *   simulation tick) rather than a separately-decoupled render rAF. Correct,
 *   and inside budget for a 960x540 primitive-only frame, but it does couple
 *   render rate to tick rate — the first thing to change if profiling ever
 *   shows frame pressure (§24).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/i18n/language-context'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  GAMEPLAY_VERSION,
  TUNING,
  bandForElapsed,
  bandIndexForElapsed,
  comboMultiplierFor,
  pursuitBandFor,
  type PursuitBand,
} from '@/lib/games/lost-dog/config'
import { metresTravelled } from '@/lib/games/lost-dog/combo'
import { advance, initialRun } from '@/lib/games/lost-dog/run'
import { toSnapshot } from '@/lib/games/lost-dog/snapshot'
import { transition } from '@/lib/games/lost-dog/state-machine'
import type { Run } from '@/lib/games/lost-dog/types'
import { enqueue, list, pendingFor, remove } from '@/lib/games/pending-completions'
import { recordCompletion, withPending } from '@/lib/games/progress'
import { LOST_DOG_ID, LOST_DOG_LEVEL_KEY } from '@/lib/games/registry'
import type { GameProgressRecord } from '@/types'
import { GamesShell } from '../_components/GamesShell'
import { CarvedText } from '../_components/CarvedText'
import { OAK_BUTTON, QUIET_BUTTON, type SaveState } from '../_components/gameChrome'
import { useGameProgress } from '../_hooks/useGameProgress'
import { durationBucket, flushLostDogEvents, scoreBucket, trackLostDogEvent } from './_analytics/track'
import { AudioEngine } from './_audio/AudioEngine'
import { Hud } from './_components/Hud'
import { HowToPlayPanel } from './_components/HowToPlayPanel'
import { LiveRegion } from './_components/LiveRegion'
import { PausePanel } from './_components/PausePanel'
import { ResultPanel } from './_components/ResultPanel'
import { SecondaryLine } from './_components/SecondaryLine'
import { TouchPads } from './_components/TouchPads'
import { useAperture } from './_hooks/useAperture'
import { useCoarsePointer } from './_hooks/useCoarsePointer'
import { useDevicePixelRatio } from './_hooks/useDevicePixelRatio'
import { useGameLoop } from './_hooks/useGameLoop'
import { useInputAdapter } from './_hooks/useInputAdapter'
import { APERTURE_HEIGHT, APERTURE_WIDTH, MAX_DPR, drawFrame } from './_render/drawFrame'

const GAMES_PATH = '/games'
const COUNTDOWN_MS = 700 * 3
const CATCH_BEAT_MS = 700

/** Everything the result panel and the save flow need, frozen at the moment the run ended. */
interface FinishedRun {
  score: number
  elapsedMs: number
  distance: number
  foodCollected: number
  bestComboCount: number
  hitsTaken: number
  bestScoreBefore: number | null
}

function newSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0
}

export default function LostDogPage() {
  useRequireAuth()
  const { t } = useLanguage()
  const router = useRouter()
  const scale = useAperture()
  const reducedMotion = useReducedMotion()
  const coarsePointer = useCoarsePointer()
  const dpr = useDevicePixelRatio(MAX_DPR)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const apertureRef = useRef<HTMLDivElement>(null)
  const pauseButtonRef = useRef<HTMLButtonElement>(null)
  const howToButtonRef = useRef<HTMLButtonElement>(null)
  /** Aggregate action counters for the post-run analytics batch (§26 forbids one event per action). */
  const actionsRef = useRef({ first: false, jumps: 0, ducks: 0 })
  const audioRef = useRef<AudioEngine | null>(null)
  if (audioRef.current === null) {
    audioRef.current = new AudioEngine()
  }

  // No async loading blocks Start (FR-028), so BOOT -> LOADING -> READY is
  // computed once up front rather than through a mount effect.
  const [run, setRun] = useState<Run>(() => {
    const booted = transition(initialRun(newSeed()), { type: 'INIT' })
    return transition(booted, { type: 'LOADING_COMPLETE' })
  })
  /**
   * The loop's own authoritative copy of the run. React state is a mirror of
   * it, kept in step by `applyRun`. The tick needs the latest run *inside* a
   * callback (to notice a game over and start the save there rather than in an
   * effect), and a functional `setRun` updater cannot hand it back — updaters
   * must stay pure and may run more than once.
   */
  const runRef = useRef(run)
  const applyRun = useCallback((next: Run) => {
    runRef.current = next
    setRun(next)
  }, [])
  const [muted, setMuted] = useState(false)
  /** True when the browser gave us no audio graph at all; folded into the mute display. */
  const [audioUnavailable, setAudioUnavailable] = useState(false)
  const [liveMessage, setLiveMessage] = useState('')
  const [prevGameState, setPrevGameState] = useState(run.state)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  /**
   * The run just finished, captured at the instant it ended. It is what the
   * save flow and the result panel read, so neither depends on `run` still
   * holding those values after a replay.
   */
  const [finished, setFinished] = useState<FinishedRun | null>(null)
  const [prevPursuitBand, setPrevPursuitBand] = useState<PursuitBand>(() => pursuitBandFor(run.pursuitGap))
  const [prevEventKey, setPrevEventKey] = useState<string | null>(null)
  const [howToOpen, setHowToOpen] = useState(false)

  const input = useInputAdapter(apertureRef)

  // Loaded beside play, never in front of it: a slow or failed progress load
  // leaves the best-score slot unknown and the game fully playable (FR-028).
  const { records, loadFailed, retry, merge } = useGameProgress(LOST_DOG_ID)
  // Not memoized on purpose (matching block-puzzle's own `bestMs`, computed the
  // same way every render): `pendingFor()` reads a module-level queue that is
  // not React state, so a `useMemo([records])` here would go stale the moment
  // a save failed and never merged — `records` stays the same reference while
  // the pending queue gains a newer entry, and the memo would never see it.
  const bestScore =
    records === null
      ? null
      : (withPending(records, pendingFor(LOST_DOG_ID)).find((row) => row.level_key === LOST_DOG_LEVEL_KEY)?.best_score ?? null)

  // The save toast reads the current language from a ref: `t` is a new function
  // on every provider render, and the save flow must not re-run because of that.
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])

  /**
   * One save per finished run, plus whatever earlier runs never got through —
   * the same `save()` shape the block puzzle's play page uses, with a score
   * instead of (only) a time. Split into an enqueue step (`save`) and a
   * flush step (`flushPending`) so the "Lưu lại" retry button can re-send
   * whatever is already queued without enqueueing a second entry for the
   * same completion.
   */
  const flushPending = useCallback(async () => {
    const queued = list()
    const results = await Promise.allSettled(
      queued.map((entry) =>
        recordCompletion({
          gameId: entry.gameId,
          levelKey: entry.levelKey,
          timeMs: entry.timeMs,
          score: entry.score,
        }),
      ),
    )

    const saved: GameProgressRecord[] = []
    let failed = false
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failed = true
        return
      }
      saved.push(result.value)
      remove(queued[index].id)
    })

    // Only this game's rows belong in this page's records; another game's
    // queued entry was flushed, not adopted.
    const mine = saved.filter((row) => row.game_id === LOST_DOG_ID)
    if (mine.length > 0) merge(mine)

    if (failed) {
      setSaveState('unsaved')
      toast.error(tRef.current('games.errors.saveFailed'))
      return
    }
    setSaveState('saved')
    window.setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1500)
  }, [merge])

  const save = useCallback(
    async (score: number, timeMs: number) => {
      enqueue({ gameId: LOST_DOG_ID, levelKey: LOST_DOG_LEVEL_KEY, timeMs, score })
      await flushPending()
    },
    [flushPending],
  )

  // COUNTDOWN: three beats, then RUNNING.
  useEffect(() => {
    if (run.state !== 'COUNTDOWN') return
    const timer = window.setTimeout(() => {
      applyRun(transition(runRef.current, { type: 'COUNTDOWN_COMPLETE' }))
    }, COUNTDOWN_MS)
    return () => window.clearTimeout(timer)
  }, [run.state, applyRun])

  // GAME_OVER: the bounded catch beat, then RESULT.
  useEffect(() => {
    if (run.state !== 'GAME_OVER') return
    const timer = window.setTimeout(() => {
      applyRun(transition(runRef.current, { type: 'CATCH_RESOLVED' }))
    }, CATCH_BEAT_MS)
    return () => window.clearTimeout(timer)
  }, [run.state, applyRun])

  // Discrete live-region announcements — never per-frame. This adjusts state
  // during render (React's documented pattern for deriving one state value
  // from a change in another) rather than in an effect, since it is a pure
  // derivation with no external system to synchronize with.
  if (prevGameState !== run.state) {
    const prev = prevGameState
    const cur = run.state
    setPrevGameState(cur)
    if (cur === 'RUNNING' && prev === 'COUNTDOWN') setLiveMessage(t('games.lostDog.liveRegion.started'))
    else if (cur === 'PAUSED') setLiveMessage(t('games.lostDog.liveRegion.paused'))
    else if (prev === 'PAUSED') setLiveMessage(t('games.lostDog.liveRegion.resumed'))
    else if (cur === 'GAME_OVER') setLiveMessage(t('games.lostDog.liveRegion.gameOver', { score: run.score }))

  }

  // Each pursuit-band change is announced once (DESIGN § Accessibility); the gap
  // itself, which changes every frame, never is.
  const pursuitBand = pursuitBandFor(run.pursuitGap)
  if (pursuitBand !== prevPursuitBand) {
    setPrevPursuitBand(pursuitBand)
    if (pursuitBand !== 'caught') setLiveMessage(t(`games.lostDog.pursuit.${pursuitBand}`))
  }

  // The event banner is painted on the canvas, so it is invisible to assistive
  // tech — this mirror is the price of drawing it, paid explicitly (DESIGN).
  const eventKey = run.activeEvent ? `${run.activeEvent.kind}@${run.activeEvent.startedAtMs}` : null
  if (eventKey !== prevEventKey) {
    setPrevEventKey(eventKey)
    if (run.activeEvent) setLiveMessage(t(`games.lostDog.events.${run.activeEvent.kind}`))
  }

  const isTicking =
    run.state === 'RUNNING' || run.state === 'CAT_WARNING' || run.state === 'CAT_CHASE' || run.state === 'HIT_REACTION'

  const onTick = useCallback(() => {
    const prev = runRef.current
    const intent = input.consume()
    let next = advance(prev, intent, TUNING.frame.fixedStepMs)
    if (intent.pauseRequested) next = transition(next, { type: 'PAUSE' })
    applyRun(next)

    const audio = audioRef.current!
    if (!prev.dog.grounded && next.dog.grounded) audio.playLand()
    if (prev.dog.grounded && !next.dog.grounded) audio.playJump()
    if (prev.state !== 'HIT_REACTION' && next.state === 'HIT_REACTION') audio.playHit()
    if (prev.state !== 'GAME_OVER' && next.state === 'GAME_OVER') audio.playCatch()
    if (next.foodCollected > prev.foodCollected) {
      const collectedBefore = new Set(prev.food.filter((f) => f.collected).map((f) => f.id))
      for (const item of next.food) {
        if (item.collected && !collectedBefore.has(item.id)) audio.playFoodCollect(item.kind)
      }
    }
    if (prev.weather !== next.weather) audio.playWeatherTransition(next.weather === 'rain')
    if (prev.state !== 'CAT_WARNING' && next.state === 'CAT_WARNING') audio.playWarning()

    // All four layers crossfade from state the simulation already decided:
    // the difficulty band drives 'speed', the pursuit band drives the other
    // two (§18). No timer, no RNG, nothing the audio adapter decides itself.
    const band = bandForElapsed(next.elapsedActiveMs)
    audio.setLayers({
      base: 1,
      speed: Math.min(1, (band.speed - 1) / 0.65),
      danger: next.state === 'CAT_WARNING' || next.state === 'CAT_CHASE' ? 1 : 0,
      chase: next.state === 'CAT_CHASE' ? 1 : 0,
    })

    // Analytics: buffered in memory, zero requests, coarse fields only (§26).
    if (!actionsRef.current.first && (intent.jumpRequested || intent.duckHeld)) {
      actionsRef.current.first = true
      trackLostDogEvent('lost_dog_first_action', { inputMode: 'keyboard' })
    }
    if (intent.jumpRequested) actionsRef.current.jumps += 1
    if (intent.duckHeld && !prev.dog.duckProgress) actionsRef.current.ducks += 1
    if (next.foodCollected > prev.foodCollected) {
      trackLostDogEvent('lost_dog_food_collected', { difficultyBand: bandIndexForElapsed(next.elapsedActiveMs) })
    }
    if (next.hitsTaken > prev.hitsTaken) {
      trackLostDogEvent('lost_dog_hit', { pursuitBand: pursuitBandFor(next.pursuitGap) })
    }
    if (next.activeEvent && next.activeEvent !== prev.activeEvent) {
      trackLostDogEvent('lost_dog_event_triggered', { eventKind: next.activeEvent.kind })
    }

    // The run ended: capture it and start its one save here, in the tick that
    // produced the game over. This is the same "save from the handler that
    // finished the attempt" shape the block puzzle's play page uses.
    if (prev.state !== 'GAME_OVER' && next.state === 'GAME_OVER') {
      const finishedRun: FinishedRun = {
        score: next.score,
        elapsedMs: next.elapsedActiveMs,
        // FinishedRun.distance is player-facing metres, not run.distance's raw
        // world-position scale — see metresTravelled's own doc.
        distance: metresTravelled(next.distance),
        foodCollected: next.foodCollected,
        bestComboCount: next.bestComboCount,
        hitsTaken: next.hitsTaken,
        // The account's best as it stood *before* this run's save — which is
        // what the result panel's record line is about.
        bestScoreBefore: bestScore,
      }
      setFinished(finishedRun)
      setSaveState('saving')
      void save(finishedRun.score, finishedRun.elapsedMs)

      trackLostDogEvent('lost_dog_cat_catch', { pursuitBand: 'caught' })
      trackLostDogEvent('lost_dog_completed', {
        gameplayVersion: GAMEPLAY_VERSION,
        durationBucket: durationBucket(finishedRun.elapsedMs),
        scoreBucket: scoreBucket(finishedRun.score),
        jumpCount: actionsRef.current.jumps,
        duckCount: actionsRef.current.ducks,
      })
      // Nowhere to send it yet, by design (§26 / plan R14) — draining is what
      // stops one run's events being counted again in the next one.
      flushLostDogEvents()
    }
  }, [input, applyRun, bestScore, save])

  useGameLoop(onTick, isTicking)

  const snapshot = useMemo(() => toSnapshot(run, 1), [run])
  const eventBannerText = run.activeEvent ? t(`games.lostDog.events.${run.activeEvent.kind}`) : null

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawFrame(ctx, snapshot, { reducedMotion, eventBannerText, dpr })
  }, [snapshot, reducedMotion, eventBannerText, dpr])

  const start = useCallback(() => {
    const audio = audioRef.current!
    audio.ensureStarted()
    // If the browser refused to give us an AudioContext, the mute control must
    // say "muted", because that is the truth (§18, §25).
    setAudioUnavailable(!audio.isStarted())
    actionsRef.current = { first: false, jumps: 0, ducks: 0 }
    trackLostDogEvent('lost_dog_started', { gameplayVersion: GAMEPLAY_VERSION })
    applyRun(transition(runRef.current, { type: 'START' }))
  }, [applyRun])

  const pause = useCallback(() => applyRun(transition(runRef.current, { type: 'PAUSE' })), [applyRun])

  /**
   * Visibility loss and blur pause the run before another step is taken (§25).
   * Without this the game keeps playing in an unfocused window, and a tab that
   * is hidden and restored takes up to one clamped frame (50ms) of catch-up —
   * small, but not the "exactly 0" SC-010 asks for. `useInputAdapter` already
   * clears held input on the same two events; this adds the pause itself.
   */
  useEffect(() => {
    function pauseIfActive() {
      applyRun(transition(runRef.current, { type: 'PAUSE' }))
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') pauseIfActive()
    }
    window.addEventListener('blur', pauseIfActive)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('blur', pauseIfActive)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [applyRun])
  const resume = useCallback(() => {
    // The Escape that closed the panel must not also arrive as a fresh pause
    // request on the first resumed tick (§29's "a release cannot activate the
    // next state", applied to the key that ended the pause).
    input.clearPending()
    applyRun(transition(runRef.current, { type: 'RESUME' }))
  }, [applyRun, input])

  const replay = useCallback(() => {
    // A fresh seed, the previous run's result/save status cleared with it, and
    // no held or buffered input carried across (§29).
    input.clearPending()
    trackLostDogEvent('lost_dog_replay', {})
    actionsRef.current = { first: false, jumps: 0, ducks: 0 }
    setFinished(null)
    setSaveState('idle')
    const fresh = transition(initialRun(newSeed()), { type: 'INIT' })
    applyRun(transition(fresh, { type: 'LOADING_COMPLETE' }))
  }, [applyRun, input])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      audioRef.current?.setMuted(!m)
      return !m
    })
  }, [])

  return (
    <GamesShell contentClassName="flex max-w-none flex-col items-center gap-3">
      <CarvedText as="h1" className="text-lg sm:text-xl">
        {t('games.lostDog.ready.title')}
      </CarvedText>

      {(run.state === 'RUNNING' ||
        run.state === 'CAT_WARNING' ||
        run.state === 'CAT_CHASE' ||
        run.state === 'HIT_REACTION' ||
        run.state === 'PAUSED') && (
        <Hud
          pursuitGap={run.pursuitGap}
          score={run.score}
          comboMultiplier={snapshot.comboMultiplier}
          muted={muted || audioUnavailable}
          pauseRef={pauseButtonRef}
          onPause={pause}
          onToggleMute={toggleMute}
        />
      )}

      <div
        ref={apertureRef}
        className="games-play-area relative overflow-hidden rounded-xl border-10 border-transparent bg-linear-to-b from-(--games-walnut) to-(--games-walnut-deep) shadow-[inset_0_6px_14px_rgba(0,0,0,0.55)]"
        style={{ width: APERTURE_WIDTH * scale, height: APERTURE_HEIGHT * scale, touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          width={APERTURE_WIDTH * dpr}
          height={APERTURE_HEIGHT * dpr}
          aria-hidden
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {run.state === 'READY' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-(--games-mat)/70 p-4 text-center">
            <p className="text-sm text-(--games-mat-text)">
              {t(coarsePointer ? 'games.lostDog.ready.promptTouch' : 'games.lostDog.ready.promptKeyboard')}
            </p>
            <div className="flex gap-2">
              <Button type="button" className={OAK_BUTTON} onClick={start}>
                {t('games.lostDog.ready.start')}
              </Button>
              <Link href={GAMES_PATH} className={cn(buttonVariants({ variant: 'ghost' }), QUIET_BUTTON)}>
                {t('games.lostDog.ready.back')}
              </Link>
              <Button
                type="button"
                ref={howToButtonRef}
                variant="ghost"
                className={cn(buttonVariants({ variant: 'ghost' }), QUIET_BUTTON, 'px-3')}
                aria-label={t('games.lostDog.howTo.openLabel')}
                onClick={() => setHowToOpen(true)}
              >
                ?
              </Button>
            </div>
          </div>
        )}

        {run.state === 'COUNTDOWN' && (
          <div className="absolute inset-0 flex items-center justify-center bg-(--games-mat)/40">
            <CarvedText className="text-3xl">...</CarvedText>
          </div>
        )}
      </div>

      <SecondaryLine
        bestScore={bestScore}
        distance={metresTravelled(run.distance)}
        elapsedMs={run.elapsedActiveMs}
        saveState={saveState}
        loadFailed={loadFailed}
        onRetryLoad={retry}
      />

      {(run.state === 'RUNNING' || run.state === 'CAT_WARNING' || run.state === 'CAT_CHASE' || run.state === 'HIT_REACTION') && (
        <TouchPads onJump={input.jump} onDuckStart={input.duckStart} onDuckEnd={input.duckEnd} />
      )}

      {run.state === 'PAUSED' && (
        <PausePanel onResume={resume} onQuit={() => router.push(GAMES_PATH)} returnFocusRef={pauseButtonRef} />
      )}

      {howToOpen && <HowToPlayPanel onClose={() => setHowToOpen(false)} returnFocusRef={howToButtonRef} />}

      {run.state === 'RESULT' && finished && (
        <ResultPanel
          score={finished.score}
          distance={finished.distance}
          elapsedMs={finished.elapsedMs}
          foodCollected={finished.foodCollected}
          bestCombo={comboMultiplierFor(finished.bestComboCount)}
          hitsTaken={finished.hitsTaken}
          bestScoreBefore={finished.bestScoreBefore}
          saveState={saveState}
          onReplay={replay}
          onBack={() => router.push(GAMES_PATH)}
          onRetrySave={() => {
            setSaveState('saving')
            void flushPending()
          }}
        />
      )}

      <LiveRegion message={liveMessage} />
    </GamesShell>
  )
}
