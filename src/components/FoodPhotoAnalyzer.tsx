'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronDown, ChevronUp, ImagePlus, LoaderCircle, Plus, Sparkles, TriangleAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { uploadFoodThumb } from '@/lib/storage'
import { TimePicker } from '@/components/ui/time-picker'
import { useLanguage } from '@/lib/i18n/language-context'

const MAX_EDGE_PX = 1024
const JPEG_QUALITY = 0.82
// 512 px: large enough to look sharp in a phone-sized lightbox, small enough for a DB TEXT column (~40-80 KB base64).
const THUMB_SIZE_PX = 512

interface AnalyzedItem {
  name: string
  portion: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  confidence: number
  assumptions: string
  normalized_by_internal_table?: boolean
  normalized_table_key?: 'white_rice' | 'tofu_plain' | 'tofu_fried' | 'braised_fish'
  normalized_source?: 'internal_table'
  normalization_version?: string
  normalization_confidence?: number
  normalization_warning?: 'ambiguous_match' | 'household_unit_converted'
}

interface AnalyzeResponse {
  items: AnalyzedItem[]
  confidence: number
  needsDetail: boolean
  questions: string[]
  notes: string
  focusBox?: [number, number, number, number] | null
}

interface EditableItem extends AnalyzedItem {
  key: string
  include: boolean
}

interface PickedImage {
  data: string
  mimeType: string
  previewUrl: string
}

interface FoodPhotoAnalyzerProps {
  date: string
  onAdded: () => Promise<void> | void
  inputMode?: 'photo' | 'text'
}

type FocusBox = [number, number, number, number]

function currentTimeStr() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

// Downscale before upload: phone photos are ~4 MB, the model only needs ~1024 px.
async function prepareImage(file: File): Promise<PickedImage> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    return { data: dataUrl.split(',')[1], mimeType: 'image/jpeg', previewUrl: dataUrl }
  } catch {
    // Formats the canvas cannot decode (some HEIC) are sent as-is.
    const dataUrl = await readAsDataURL(file)
    return {
      data: dataUrl.split(',')[1],
      mimeType: file.type || 'image/jpeg',
      previewUrl: dataUrl,
    }
  }
}

function confidenceTone(value: number) {
  if (value >= 0.75) return 'bg-emerald-100 text-emerald-700'
  if (value >= 0.5) return 'bg-amber-100 text-amber-700'
  return 'bg-rose-100 text-rose-700'
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

function toFocusCrop(width: number, height: number, focusBox?: FocusBox | null) {
  const shortest = Math.min(width, height)
  if (!focusBox || focusBox.length !== 4) {
    const size = Math.round(shortest * 0.9)
    return {
      x: Math.round((width - size) / 2),
      y: Math.round((height - size) / 2),
      size,
    }
  }

  const [yMinN, xMinN, yMaxN, xMaxN] = focusBox
  const xMin = clamp((xMinN / 1000) * width, 0, width)
  const xMax = clamp((xMaxN / 1000) * width, 0, width)
  const yMin = clamp((yMinN / 1000) * height, 0, height)
  const yMax = clamp((yMaxN / 1000) * height, 0, height)

  const boxW = Math.max(1, xMax - xMin)
  const boxH = Math.max(1, yMax - yMin)
  const cx = (xMin + xMax) / 2
  const cy = (yMin + yMax) / 2

  const padded = Math.max(boxW, boxH) * 1.25
  const size = clamp(Math.round(padded), Math.round(shortest * 0.35), shortest)
  const x = Math.round(clamp(cx - size / 2, 0, width - size))
  const y = Math.round(clamp(cy - size / 2, 0, height - size))
  return { x, y, size }
}

async function buildThumbnailDataUrl(image: PickedImage, focusBox?: FocusBox | null): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(await (await fetch(image.previewUrl)).blob())
    const crop = toFocusCrop(bitmap.width, bitmap.height, focusBox)

    const canvas = document.createElement('canvas')
    canvas.width = THUMB_SIZE_PX
    canvas.height = THUMB_SIZE_PX
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')

    ctx.drawImage(bitmap, crop.x, crop.y, crop.size, crop.size, 0, 0, THUMB_SIZE_PX, THUMB_SIZE_PX)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.88)
  } catch {
    return null
  }
}

export function FoodPhotoAnalyzer({ date, onAdded, inputMode = 'photo' }: FoodPhotoAnalyzerProps) {
  const { t, lang } = useLanguage()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [image, setImage] = useState<PickedImage | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [items, setItems] = useState<EditableItem[]>([])
  const [detail, setDetail] = useState('')
  const [detailOpen, setDetailOpen] = useState(inputMode === 'text')
  const [time, setTime] = useState(currentTimeStr)
  const [saving, setSaving] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Manual quick-add state (text mode only)
  const [manualName, setManualName] = useState('')
  const [manualCalories, setManualCalories] = useState('')
  const [manualProtein, setManualProtein] = useState('')
  const [manualCarbs, setManualCarbs] = useState('')
  const [manualFat, setManualFat] = useState('')
  const [manualTime, setManualTime] = useState(currentTimeStr)
  const [manualSaving, setManualSaving] = useState(false)
  const [isManualExpanded, setIsManualExpanded] = useState(() => {
    try { return localStorage.getItem('foodphoto:manual:expanded') !== 'false' } catch { return true }
  })

  function toggleManualExpanded() {
    const next = !isManualExpanded
    setIsManualExpanded(next)
    try { localStorage.setItem('foodphoto:manual:expanded', String(next)) } catch { /* ignore */ }
  }

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  }, [])

  const included = items.filter((i) => i.include)
  const totals = included.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein: Math.round((acc.protein + i.protein_g) * 10) / 10,
      carbs: Math.round((acc.carbs + i.carbs_g) * 10) / 10,
      fat: Math.round((acc.fat + i.fat_g) * 10) / 10,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  function resetAll() {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    setImage(null)
    setResult(null)
    setItems([])
    setDetail('')
    setDetailOpen(inputMode === 'text')
    setAnalysisProgress(0)
    if (cameraRef.current) cameraRef.current.value = ''
    if (galleryRef.current) galleryRef.current.value = ''
  }

  function startProgressTicker() {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    setAnalysisProgress(6)
    progressTimerRef.current = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 88) return prev
        const step = prev < 35 ? 8 : prev < 65 ? 5 : 2
        return Math.min(88, prev + step)
      })
    }, 400)
  }

  function stopProgressTicker(finalPercent = 100) {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    setAnalysisProgress(finalPercent)
  }

  async function pickImage(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error(t('foodPhoto.notAnImage'))
      return
    }
    try {
      const prepared = await prepareImage(file)
      setImage(prepared)
      setResult(null)
      setItems([])
      setDetailOpen(false)
      setTime(currentTimeStr())
      void analyze('image', prepared)
    } catch {
      toast.error(t('foodPhoto.readImageError'))
    }
  }

  async function analyze(mode: 'image' | 'text', imageOverride?: PickedImage) {
    if (analyzing) return
    const picked = imageOverride ?? image
    setAnalyzing(true)
    startProgressTicker()
    try {
      const res = await fetch('/api/notes/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          image: mode === 'image' && picked ? { data: picked.data, mimeType: picked.mimeType } : undefined,
          description: detail.trim() || undefined,
          lang,
        }),
      })

      const payload = await res.json()
      if (!res.ok) {
        stopProgressTicker(0)
        toast.error(payload?.error || t('foodPhoto.analyzeError'))
        setDetailOpen(true)
        return
      }

      const data = payload as AnalyzeResponse
      setResult(data)
      setItems(
        data.items.map((item, index) => ({
          ...item,
          key: `${index}-${item.name}`,
          include: true,
        }))
      )
      // The tab can sit open for hours, so stamp the meal at analysis time.
      setTime(currentTimeStr())
      setDetailOpen(inputMode === 'text' || data.needsDetail)
      stopProgressTicker(100)
      if (data.items.length === 0) {
        toast.error(t('foodPhoto.nothingDetected'))
        setDetailOpen(true)
      }
    } catch {
      stopProgressTicker(0)
      toast.error(t('foodPhoto.analyzeError'))
      setDetailOpen(true)
    } finally {
      setAnalyzing(false)
    }
  }

  function patchItem(key: string, patch: Partial<EditableItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  }

  async function addManual() {
    const name = manualName.trim()
    const cal = Number(manualCalories)
    if (!name || !cal || cal <= 0) return
    setManualSaving(true)
    try {
      const createdAt = new Date(`${date}T${manualTime}:00`).toISOString()
      const { error } = await supabase.from('daily_foods').insert([{
        date,
        custom_food_name: name,
        quantity: 1,
        total_calories: Math.round(cal),
        protein_g: Number(manualProtein) || null,
        carbs_g: Number(manualCarbs) || null,
        fat_g: Number(manualFat) || null,
        created_at: createdAt,
      }])
      if (error) throw error
      await onAdded()
      setManualName('')
      setManualCalories('')
      setManualProtein('')
      setManualCarbs('')
      setManualFat('')
      setManualTime(currentTimeStr())
      toast.success(t('foodPhoto.addedCount', { n: 1 }))
    } catch {
      toast.error(t('foodPhoto.saveError'))
    } finally {
      setManualSaving(false)
    }
  }

  async function saveToDiary() {
    if (included.length === 0) return
    setSaving(true)
    try {
      const createdAt = new Date(`${date}T${time}:00`).toISOString()
      const { data: { user } } = await supabase.auth.getUser()
      let thumbUrl: string | null = null
      if (image && user) {
        try {
          const dataUrl = await buildThumbnailDataUrl(image, result?.focusBox ?? null)
          if (dataUrl) thumbUrl = await uploadFoodThumb(dataUrl, user.id)
        } catch {
          // Thumbnail upload failed — save the entry without the photo rather than blocking.
        }
      }
      const rows = included.map((i) => ({
        date,
        custom_food_name: i.name.trim(),
        quantity: 1,
        total_calories: Math.round(i.calories),
        protein_g: i.protein_g,
        carbs_g: i.carbs_g,
        fat_g: i.fat_g,
        image_thumb: thumbUrl,
        notes: i.portion || null,
        normalized_by_internal_table: i.normalized_by_internal_table ?? false,
        normalized_table_key: i.normalized_table_key ?? null,
        normalized_source: i.normalized_source ?? null,
        normalization_version: i.normalization_version ?? null,
        normalization_confidence: i.normalization_confidence ?? null,
        normalization_warning: i.normalization_warning ?? null,
        created_at: createdAt,
      }))

      const { error } = await supabase.from('daily_foods').insert(rows)
      if (error) {
        const message = String(error.message || '')
        const columnMissing = /column .* does not exist|could not find the '(normalized_by_internal_table|normalized_table_key|normalized_source|normalization_version|normalization_confidence|normalization_warning)' column .* in the schema cache/i.test(message)
        if (!columnMissing) throw error

        const legacyRows = included.map((i) => ({
          date,
          custom_food_name: i.name.trim(),
          quantity: 1,
          total_calories: Math.round(i.calories),
          protein_g: i.protein_g,
          carbs_g: i.carbs_g,
          fat_g: i.fat_g,
          image_thumb: thumbUrl,
          notes: i.portion || null,
          created_at: createdAt,
        }))

        const { error: fallbackError } = await supabase.from('daily_foods').insert(legacyRows)
        if (fallbackError) throw fallbackError
      }

      await onAdded()
      resetAll()
      toast.success(t('foodPhoto.addedCount', { n: rows.length }))
    } catch {
      toast.error(t('foodPhoto.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void pickImage(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pickImage(e.target.files?.[0])}
      />

      {!image ? (
        inputMode === 'text' ? null : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 px-3 py-5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            <Camera className="h-5 w-5" />
            {t('foodPhoto.takePhoto')}
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 px-3 py-5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            <ImagePlus className="h-5 w-5" />
            {t('foodPhoto.uploadPhoto')}
          </button>
        </div>
        )
      ) : (
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.previewUrl}
            alt={t('foodPhoto.previewAlt')}
            className="h-24 w-24 shrink-0 rounded-lg border border-emerald-200 object-cover"
          />
          <div className="flex flex-1 flex-col gap-2">
              {result && (
                <button
                  type="button"
                  onClick={() => void analyze('image')}
                  disabled={analyzing}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                >
                  {analyzing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {analyzing ? t('foodPhoto.analyzing') : t('foodPhoto.reanalyze')}
                </button>
              )}
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-emerald-50"
            >
              <X className="h-3.5 w-3.5" />
              {t('foodPhoto.removePhoto')}
            </button>
          </div>
        </div>
      )}

      {analyzing && (
        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full border border-emerald-200 bg-emerald-50">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
          <p className="text-center text-xs text-zinc-500">
            {t('foodPhoto.analyzingHint')} ({analysisProgress}%)
          </p>
        </div>
      )}

      {/* Detail fallback / text-mode primary input */}
      {(detailOpen || result?.needsDetail) && (
        <div className={`space-y-2 rounded-lg border p-3 ${
          inputMode === 'text'
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-amber-200 bg-amber-50'
        }`}>
          {inputMode !== 'text' && (
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-800">{t('foodPhoto.needDetailTitle')}</p>
                <p className="text-[11px] leading-relaxed text-amber-700">{t('foodPhoto.needDetailHint')}</p>
              </div>
            </div>
          )}

          {result?.questions && result.questions.length > 0 && (
            <ul className={`ml-6 list-disc space-y-0.5 text-[11px] ${inputMode === 'text' ? 'text-emerald-800' : 'text-amber-800'}`}>
              {result.questions.map((q, index) => (
                <li key={`${index}-${q}`}>{q}</li>
              ))}
            </ul>
          )}

          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={inputMode === 'text' ? 4 : 3}
            autoFocus={inputMode === 'text' && items.length === 0}
            placeholder={t('foodPhoto.detailPlaceholder')}
            className={`w-full resize-y rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 ${
              inputMode === 'text'
                ? 'border-emerald-200 focus:border-emerald-400'
                : 'border-amber-200 focus:border-amber-400'
            }`}
          />

          <button
            type="button"
            onClick={() => void analyze(image ? 'image' : 'text')}
            disabled={analyzing || !detail.trim()}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50 ${
              inputMode === 'text'
                ? 'bg-emerald-500 hover:bg-emerald-600'
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {analyzing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {image ? t('foodPhoto.reanalyzeWithDetail') : t('foodPhoto.analyzeDetailOnly')}
          </button>

          {inputMode === 'text' && (
            <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/40 px-4 py-2.5">
              {/* header — click to toggle */}
              <button
                type="button"
                onClick={toggleManualExpanded}
                className={`flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-emerald-600 hover:text-emerald-700 ${isManualExpanded ? 'mb-2' : ''}`}
              >
                <span className="flex items-center gap-1.5"><span>⚡</span>{t('foodPhoto.orManual')}</span>
                {isManualExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {isManualExpanded && (
              <>

              {/* name */}
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void addManual() }}
                placeholder={t('foodPhoto.manualNamePlaceholder')}
                className="mb-2 w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200 outline-none placeholder:font-normal placeholder:text-zinc-400 focus:ring-2 focus:ring-emerald-400"
              />

              {/* nutrient chips */}
              <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                {([
                  {
                    key: 'kcal',
                    label: 'kcal',
                    icon: '🔥',
                    value: manualCalories,
                    setValue: setManualCalories,
                    unit: '',
                    min: '1',
                    step: '1',
                    chip: 'bg-orange-100 ring-orange-200 focus-within:ring-orange-400',
                    labelColor: 'text-orange-700',
                    inputColor: 'text-orange-700 placeholder:text-orange-300',
                  },
                  {
                    key: 'protein',
                    label: t('foodPhoto.protein'),
                    icon: '',
                    value: manualProtein,
                    setValue: setManualProtein,
                    unit: 'g',
                    min: '0',
                    step: '0.1',
                    chip: 'bg-blue-50 ring-blue-200 focus-within:ring-blue-400',
                    labelColor: 'text-blue-700',
                    inputColor: 'text-blue-700 placeholder:text-blue-300',
                  },
                  {
                    key: 'carbs',
                    label: t('foodPhoto.carbs'),
                    icon: '',
                    value: manualCarbs,
                    setValue: setManualCarbs,
                    unit: 'g',
                    min: '0',
                    step: '0.1',
                    chip: 'bg-amber-50 ring-amber-200 focus-within:ring-amber-400',
                    labelColor: 'text-amber-700',
                    inputColor: 'text-amber-700 placeholder:text-amber-300',
                  },
                  {
                    key: 'fat',
                    label: t('foodPhoto.fat'),
                    icon: '',
                    value: manualFat,
                    setValue: setManualFat,
                    unit: 'g',
                    min: '0',
                    step: '0.1',
                    chip: 'bg-rose-50 ring-rose-200 focus-within:ring-rose-400',
                    labelColor: 'text-rose-700',
                    inputColor: 'text-rose-700 placeholder:text-rose-300',
                  },
                ] as const).map((field) => (
                  <label key={field.key} className={`rounded-lg px-2 py-2 ring-1 ${field.chip}`}>
                    <span className={`mb-1 block text-[11px] font-medium ${field.labelColor}`}>{field.icon}{field.label}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={field.min}
                        step={field.step}
                        value={field.value}
                        onChange={(e) => field.setValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void addManual() }}
                        placeholder="0"
                        className={`min-w-0 flex-1 bg-transparent text-sm font-semibold tabular-nums outline-none ${field.inputColor}`}
                      />
                      {field.unit && <span className={`shrink-0 text-[11px] ${field.labelColor}`}>{field.unit}</span>}
                    </div>
                  </label>
                ))}
              </div>

              {/* time + submit */}
              <div className="flex items-center gap-2">
                <TimePicker value={manualTime} onChange={setManualTime} />
                <button
                  type="button"
                  onClick={() => void addManual()}
                  disabled={manualSaving || !manualName.trim() || !manualCalories || Number(manualCalories) <= 0}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-500 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600 sm:rounded-xl disabled:opacity-40"
                >
                  {manualSaving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {t('foodPhoto.manualAddButton')}
                </button>
              </div>
              </>
              )}
            </div>
          )}
        </div>
      )}

      {!image && !detailOpen && inputMode === 'photo' && (
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="w-full text-center text-[11px] text-emerald-600 underline decoration-dashed underline-offset-2 hover:text-emerald-700"
        >
          {t('foodPhoto.noPhotoCta')}
        </button>
      )}

      {/* Editable results */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-700">{t('foodPhoto.resultHeading')}</p>
            {result && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${confidenceTone(result.confidence)}`}>
                {t('foodPhoto.confidence', { n: Math.round(result.confidence * 100) })}
              </span>
            )}
          </div>

          {result?.notes && <p className="text-[11px] italic text-zinc-500">{result.notes}</p>}

          {items.map((item) => (
            <div
              key={item.key}
              className={`space-y-2 rounded-lg border p-2.5 transition-colors ${
                item.include ? 'border-emerald-200 bg-emerald-50/60' : 'border-zinc-200 bg-zinc-50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.include}
                  onChange={(e) => patchItem(item.key, { include: e.target.checked })}
                  className="h-4 w-4 shrink-0 accent-emerald-500"
                  aria-label={t('foodPhoto.includeItem')}
                />
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => patchItem(item.key, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded border border-emerald-200 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-emerald-400"
                />
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${confidenceTone(item.confidence)}`}>
                  {Math.round(item.confidence * 100)}%
                </span>
                {item.normalized_by_internal_table ? (
                  <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                    {t('foodPhoto.internalTableBadge')}
                  </span>
                ) : null}
              </div>

              <input
                type="text"
                value={item.portion}
                onChange={(e) => patchItem(item.key, { portion: e.target.value })}
                placeholder={t('foodPhoto.portionPlaceholder')}
                className="w-full rounded border border-emerald-200 bg-white px-2 py-1 text-xs text-zinc-600 outline-none placeholder:text-zinc-400 focus:border-emerald-400"
              />

              <div className="grid grid-cols-4 gap-1.5">
                {([
                  ['calories', t('foodPhoto.kcal')],
                  ['protein_g', t('foodPhoto.protein')],
                  ['carbs_g', t('foodPhoto.carbs')],
                  ['fat_g', t('foodPhoto.fat')],
                ] as const).map(([field, label]) => (
                  <label key={field} className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-zinc-500">{label}</span>
                    <input
                      type="number"
                      min="0"
                      step={field === 'calories' ? '5' : '0.1'}
                      value={item[field]}
                      onChange={(e) => patchItem(item.key, { [field]: Number(e.target.value) || 0 })}
                      className="w-full rounded border border-emerald-200 bg-white px-1.5 py-1 text-xs tabular-nums text-zinc-900 outline-none focus:border-emerald-400"
                    />
                  </label>
                ))}
              </div>

              {item.assumptions && (
                <p className="text-[10px] leading-relaxed text-zinc-500">{item.assumptions}</p>
              )}
              {item.normalization_warning && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] leading-relaxed text-amber-700">
                  {item.normalization_warning === 'household_unit_converted'
                    ? t('foodPhoto.internalTableWarningHousehold')
                    : t('foodPhoto.internalTableWarningAmbiguous')}
                </p>
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2">
            <span className="text-xs font-semibold text-zinc-900">
              {totals.calories} kcal
            </span>
            <span className="text-[11px] tabular-nums text-zinc-500">
              {t('foodPhoto.protein')} {totals.protein}g · {t('foodPhoto.carbs')} {totals.carbs}g · {t('foodPhoto.fat')} {totals.fat}g
            </span>
          </div>

          <div className="flex items-center gap-2">
            <TimePicker value={time} onChange={setTime} />
            <button
              type="button"
              onClick={() => void saveToDiary()}
              disabled={saving || included.length === 0}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('foodPhoto.addSelected', { n: included.length })}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
