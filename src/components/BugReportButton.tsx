'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Bug, Check, ImagePlus, Lightbulb, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/language-context'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const MIN_DESCRIPTION_LENGTH = 10
const MIN_UNIQUE_CHARS = 3
const HANDLE_SIZE = 40
const TRACK_PADDING = 4
const CANVAS_W = 300
const CANVAS_H = 150
const MAX_OFFSET = CANVAS_W - HANDLE_SIZE - TRACK_PADDING * 2
const PIECE_SIZE = 42
const TAB = 8
const PIECE_PAD = TAB + 4
const PIECE_BOX = PIECE_SIZE + PIECE_PAD * 2
const MATCH_TOLERANCE = 6
type ReportType = 'bug' | 'feature'

function tracePiecePath(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const r = TAB
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.arc(x + PIECE_SIZE / 2, y - r + 2, r, 0.72 * Math.PI, 2.26 * Math.PI)
  ctx.lineTo(x + PIECE_SIZE, y)
  ctx.arc(x + PIECE_SIZE + r - 2, y + PIECE_SIZE / 2, r, 1.21 * Math.PI, 2.78 * Math.PI)
  ctx.lineTo(x + PIECE_SIZE, y + PIECE_SIZE)
  ctx.lineTo(x, y + PIECE_SIZE)
  ctx.arc(x + r - 2, y + PIECE_SIZE / 2, r + 0.4, 2.76 * Math.PI, 1.24 * Math.PI, true)
  ctx.lineTo(x, y)
  ctx.closePath()
}

function paintScene(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H)
  gradient.addColorStop(0, '#34d399')
  gradient.addColorStop(1, '#0d9488')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  const blobs: Array<[number, number, number]> = [
    [40, 30, 38], [230, 40, 46], [130, 100, 50], [270, 110, 30], [60, 115, 26],
  ]
  blobs.forEach(([bx, by, br]) => {
    ctx.beginPath()
    ctx.arc(bx, by, br, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fill()
  })
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function JigsawSliderCaptcha({
  onVerify,
  label,
  verifiedLabel,
  refreshLabel,
}: {
  onVerify: () => void
  label: string
  verifiedLabel: string
  refreshLabel: string
}) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const pieceCanvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<HTMLCanvasElement | null>(null)
  const targetRef = useRef({ px: 0, py: 0 })
  const [pieceTop, setPieceTop] = useState(0)
  const [position, setPosition] = useState(0)
  const positionRef = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [verified, setVerified] = useState(false)
  const dragState = useRef<{ startX: number; startPos: number } | null>(null)

  function updatePosition(value: number) {
    positionRef.current = value
    setPosition(value)
  }

  function generateChallenge() {
    const bgCtx = bgCanvasRef.current?.getContext('2d')
    const pieceCtx = pieceCanvasRef.current?.getContext('2d')
    if (!bgCtx || !pieceCtx) return

    if (!sceneRef.current) sceneRef.current = document.createElement('canvas')
    const scene = sceneRef.current
    scene.width = CANVAS_W
    scene.height = CANVAS_H
    const sceneCtx = scene.getContext('2d')
    if (!sceneCtx) return
    paintScene(sceneCtx)

    const px = randomBetween(PIECE_PAD + 20, MAX_OFFSET - 10)
    const py = randomBetween(PIECE_PAD, CANVAS_H - PIECE_SIZE - PIECE_PAD)
    targetRef.current = { px, py }
    setPieceTop(py - PIECE_PAD)

    bgCtx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    bgCtx.drawImage(scene, 0, 0)
    tracePiecePath(bgCtx, px, py)
    bgCtx.fillStyle = 'rgba(15, 23, 42, 0.4)'
    bgCtx.fill()
    bgCtx.strokeStyle = 'rgba(255,255,255,0.85)'
    bgCtx.lineWidth = 1.5
    bgCtx.stroke()

    pieceCtx.clearRect(0, 0, PIECE_BOX, PIECE_BOX)
    pieceCtx.save()
    tracePiecePath(pieceCtx, PIECE_PAD, PIECE_PAD)
    pieceCtx.clip()
    pieceCtx.drawImage(scene, px - PIECE_PAD, py - PIECE_PAD, PIECE_BOX, PIECE_BOX, 0, 0, PIECE_BOX, PIECE_BOX)
    pieceCtx.restore()
    tracePiecePath(pieceCtx, PIECE_PAD, PIECE_PAD)
    pieceCtx.strokeStyle = 'rgba(255,255,255,0.95)'
    pieceCtx.lineWidth = 1.5
    pieceCtx.stroke()

    updatePosition(0)
    setVerified(false)
  }

  useEffect(() => {
    generateChallenge()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePointerDown(e: React.PointerEvent) {
    if (verified) return
    dragState.current = { startX: e.clientX, startPos: positionRef.current }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current) return
    const { startX, startPos } = dragState.current
    updatePosition(Math.min(Math.max(0, startPos + (e.clientX - startX)), MAX_OFFSET))
  }

  function handlePointerUp() {
    if (!dragState.current) return
    setDragging(false)
    if (Math.abs(positionRef.current - targetRef.current.px) <= MATCH_TOLERANCE) {
      updatePosition(targetRef.current.px)
      setVerified(true)
      onVerify()
    } else {
      generateChallenge()
    }
    dragState.current = null
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
        <canvas ref={bgCanvasRef} width={CANVAS_W} height={CANVAS_H} className="block rounded-xl" />
        <canvas
          ref={pieceCanvasRef}
          width={PIECE_BOX}
          height={PIECE_BOX}
          className="pointer-events-none absolute"
          style={{
            left: -PIECE_PAD,
            top: pieceTop,
            transform: `translateX(${position}px)`,
            transition: dragging ? 'none' : 'transform 0.2s ease',
          }}
        />
        <button
          type="button"
          onClick={generateChallenge}
          aria-label={refreshLabel}
          title={refreshLabel}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/45"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className={cn(
          'relative h-11 touch-none select-none overflow-hidden rounded-2xl transition-colors',
          verified ? 'bg-emerald-600' : 'bg-emerald-500'
        )}
        style={{ width: CANVAS_W }}
      >
        <div
          className="absolute inset-y-0 left-0 bg-black/10 transition-[width]"
          style={{ width: `${position + TRACK_PADDING + HANDLE_SIZE}px`, transitionDuration: dragging ? '0ms' : '200ms' }}
        />
        {!verified && !dragging && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-shimmer-sweep bg-linear-to-r from-transparent via-white/35 to-transparent" />
        )}
        <div
          className="pointer-events-none absolute inset-0 flex items-center text-sm font-medium text-white"
          style={{ paddingLeft: TRACK_PADDING + HANDLE_SIZE + 10, paddingRight: 12 }}
        >
          {verified ? (
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4" />
              {verifiedLabel}
            </span>
          ) : (
            <span className="truncate">{label}</span>
          )}
        </div>
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            left: TRACK_PADDING,
            top: TRACK_PADDING,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            transform: `translateX(${position}px)`,
            transition: dragging ? 'none' : 'transform 0.2s ease',
          }}
          className="absolute flex cursor-grab touch-none items-center justify-center rounded-xl bg-white text-emerald-600 shadow-md active:cursor-grabbing"
        >
          {verified ? <Check className="h-5 w-5" /> : <ArrowRight className="h-5 w-5 animate-slider-hint" />}
        </div>
      </div>
    </div>
  )
}

export function BugReportButton() {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<ReportType>('bug')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [sliderVerified, setSliderVerified] = useState(false)
  const [sliderKey, setSliderKey] = useState(0)
  const [renderedAt, setRenderedAt] = useState(0)
  const [accountEmail, setAccountEmail] = useState('')
  const [accountName, setAccountName] = useState('')
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getSupabaseBrowserClient().auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      setAccountEmail(data.user?.email ?? '')
      setAccountName((data.user?.user_metadata?.full_name as string | undefined)?.trim() ?? '')
    })
  }, [])

  function resetSlider() {
    setSliderVerified(false)
    setSliderKey((k) => k + 1)
  }

  function resetForm() {
    setType('bug')
    setDescription('')
    setDescriptionError(null)
    setImage(null)
    resetSlider()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleOpen() {
    setRenderedAt(Date.now())
    setOpen(true)
  }

  function handleClose() {
    if (loading) return
    setOpen(false)
    resetForm()
  }

  function handleImageChange(file: File | null) {
    if (!file) {
      setImage(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error(t('bugReport.errorImageType'))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t('bugReport.errorImageSize'))
      return
    }
    setImage(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedDescription = description.trim()
    if (!trimmedDescription) {
      setDescriptionError(t('bugReport.errorDescriptionRequired'))
      toast.error(t('bugReport.errorDescriptionRequired'))
      return
    }
    const meaningfulChars = trimmedDescription.replace(/\s/g, '')
    const uniqueChars = new Set(meaningfulChars.toLowerCase()).size
    if (meaningfulChars.length < MIN_DESCRIPTION_LENGTH || uniqueChars < MIN_UNIQUE_CHARS) {
      setDescriptionError(t('bugReport.errorDescriptionTooShort'))
      toast.error(t('bugReport.errorDescriptionTooShort'))
      return
    }
    setDescriptionError(null)
    if (!sliderVerified) {
      toast.error(t('bugReport.errorCaptcha'))
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.set('type', type)
      formData.set('description', trimmedDescription)
      formData.set('reporterEmail', accountEmail)
      formData.set('reporterName', accountName)
      formData.set('pageUrl', window.location.href)
      formData.set('userAgent', navigator.userAgent)
      formData.set('sliderVerified', String(sliderVerified))
      formData.set('renderedAt', String(renderedAt))
      formData.set('website', '') // honeypot — left blank by real users
      if (image) formData.set('image', image)

      const res = await fetch('/api/report-bug', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        toast.error(t(`bugReport.${data.error || 'errorGeneric'}`))
        if (data.error === 'errorCaptcha') resetSlider()
        if (data.error === 'errorDescriptionRequired' || data.error === 'errorDescriptionTooShort') {
          setDescriptionError(t(`bugReport.${data.error}`))
        }
        return
      }

      toast.success(t('bugReport.successMessage'))
      setOpen(false)
      resetForm()
    } catch {
      toast.error(t('bugReport.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t('bugReport.buttonLabel')}
        className="fixed bottom-5 right-5 z-40 hidden h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 transition-colors hover:bg-emerald-500 sm:flex"
      >
        <Bug className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pb-24 sm:p-6 sm:pb-24" onClick={handleClose}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                  <Bug className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="font-poppins text-sm font-semibold text-zinc-900">{t('bugReport.modalTitle')}</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('bug')}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition-colors',
                      type === 'bug'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                    )}
                  >
                    <Bug className="h-4 w-4" />
                    {t('bugReport.typeBug')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('feature')}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition-colors',
                      type === 'feature'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                    )}
                  >
                    <Lightbulb className="h-4 w-4" />
                    {t('bugReport.typeFeature')}
                  </button>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600">
                    {t('bugReport.descriptionLabel')}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value)
                      if (descriptionError) setDescriptionError(null)
                    }}
                    placeholder={t(type === 'bug' ? 'bugReport.descriptionPlaceholderBug' : 'bugReport.descriptionPlaceholderFeature')}
                    rows={4}
                    aria-invalid={descriptionError ? true : undefined}
                    className={cn(
                      'w-full resize-none rounded-lg border px-2.5 py-2 text-sm outline-none placeholder:text-zinc-400',
                      descriptionError
                        ? 'border-rose-400 focus-visible:border-rose-400 focus-visible:ring-3 focus-visible:ring-rose-100'
                        : 'border-zinc-200 focus-visible:border-emerald-400 focus-visible:ring-3 focus-visible:ring-emerald-100'
                    )}
                  />
                  {descriptionError && (
                    <p className="mt-1.5 text-xs text-rose-600">{descriptionError}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600">
                    {t('bugReport.imageLabel')}
                  </label>
                  {image ? (
                    <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-2.5 py-1.5">
                      <span className="truncate text-sm text-zinc-700">{image.name}</span>
                      <button
                        type="button"
                        onClick={() => handleImageChange(null)}
                        className="ml-2 shrink-0 text-xs font-medium text-rose-600 hover:underline"
                      >
                        {t('bugReport.imageRemove')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-2.5 py-2 text-sm text-zinc-500 transition-colors hover:border-emerald-400 hover:text-emerald-600"
                    >
                      <ImagePlus className="h-4 w-4" />
                      {t('bugReport.imageLabel')}
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                  />
                </div>

                <JigsawSliderCaptcha
                  key={sliderKey}
                  onVerify={() => setSliderVerified(true)}
                  label={t('bugReport.captchaLabel')}
                  verifiedLabel={t('bugReport.captchaVerifiedLabel')}
                  refreshLabel={t('bugReport.captchaRefreshLabel')}
                />

                {/* Honeypot — hidden from real users, bots often fill it in */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute -left-[9999px] h-0 w-0 opacity-0"
                />
              </div>

              <div className="flex gap-2 border-t border-zinc-100 px-5 py-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  disabled={loading}
                  onClick={handleClose}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:ring-emerald-300"
                  disabled={loading || !sliderVerified}
                >
                  {loading ? t('bugReport.submitting') : t('bugReport.submit')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
