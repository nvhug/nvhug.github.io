'use client'

import { useEffect, useRef, useState } from 'react'
import { Bug, ImagePlus, Lightbulb, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { JigsawSliderCaptcha } from '@/components/JigsawSliderCaptcha'
import { useLanguage } from '@/lib/i18n/language-context'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const MIN_DESCRIPTION_LENGTH = 10
const MIN_UNIQUE_CHARS = 3
type ReportType = 'bug' | 'feature'

export function BugReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage()
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

  // The honeypot timing check on the server measures how long the form was on
  // screen, so the clock starts when the modal opens - not when it mounts.
  useEffect(() => {
    if (open) setRenderedAt(Date.now())
  }, [open])

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

  function handleClose() {
    if (loading) return
    onClose()
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
      onClose()
      resetForm()
    } catch {
      toast.error(t('bugReport.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" onClick={handleClose}>
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
            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 sm:h-7 sm:w-7"
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
  )
}
