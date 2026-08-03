'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, PlayCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { GymVideo } from '@/types'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/lib/i18n/language-context'
import { getIntlLocale } from '@/lib/i18n/locale'

type VideoPlatform = 'youtube' | 'tiktok' | 'facebook'
const GYM_VIDEOS_BUCKET = 'gym-videos'

type ParsedVideoUrl = {
  normalizedUrl: string
  platform: VideoPlatform
  videoId?: string
}

function safeParseUrl(rawUrl: string) {
  try {
    return new URL(rawUrl)
  } catch {
    return null
  }
}

function extractYoutubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase()
  if (host.includes('youtu.be')) {
    const id = url.pathname.split('/').filter(Boolean)[0]
    return id || null
  }

  if (!host.includes('youtube.com')) return null

  const v = url.searchParams.get('v')
  if (v) return v

  const parts = url.pathname.split('/').filter(Boolean)
  const shortsIndex = parts.indexOf('shorts')
  if (shortsIndex >= 0 && parts[shortsIndex + 1]) return parts[shortsIndex + 1]

  const embedIndex = parts.indexOf('embed')
  if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1]

  return null
}

function extractTiktokId(url: URL): string | null {
  const match = url.pathname.match(/\/video\/(\d+)/)
  return match?.[1] ?? null
}

function looksLikeFacebookVideo(url: URL) {
  const host = url.hostname.toLowerCase()
  return host.includes('facebook.com') || host.includes('fb.watch')
}

function parseVideoUrl(rawInput: string): ParsedVideoUrl | null {
  const raw = rawInput.trim()
  if (!raw) return null

  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  const parsed = safeParseUrl(normalized)
  if (!parsed) return null

  const youtubeId = extractYoutubeId(parsed)
  if (youtubeId) {
    return { normalizedUrl: parsed.toString(), platform: 'youtube', videoId: youtubeId }
  }

  const tiktokId = extractTiktokId(parsed)
  if (tiktokId) {
    return { normalizedUrl: parsed.toString(), platform: 'tiktok', videoId: tiktokId }
  }

  if (looksLikeFacebookVideo(parsed)) {
    return { normalizedUrl: parsed.toString(), platform: 'facebook' }
  }

  return null
}

function buildEmbedUrl(video: { platform: string; video_id?: string | null; source_url: string }) {
  if (video.platform === 'youtube' && video.video_id) {
    return `https://www.youtube.com/embed/${video.video_id}`
  }

  if (video.platform === 'tiktok' && video.video_id) {
    return `https://www.tiktok.com/embed/v2/${video.video_id}`
  }

  if (video.platform === 'facebook') {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(video.source_url)}&show_text=false&width=560`
  }

  return null
}

function getPlatformBadge(platform: string) {
  if (platform === 'youtube') return { label: 'YouTube', className: 'border-rose-200 bg-rose-50 text-rose-700' }
  if (platform === 'tiktok') return { label: 'TikTok', className: 'border-zinc-300 bg-zinc-50 text-zinc-700' }
  return { label: 'Facebook Reel', className: 'border-blue-200 bg-blue-50 text-blue-700' }
}

function isShortStyle(video: GymVideo) {
  if (video.platform === 'tiktok') return true
  if (video.platform === 'youtube' && video.source_url.toLowerCase().includes('/shorts/')) return true
  if (video.platform === 'facebook') {
    const lower = video.source_url.toLowerCase()
    return lower.includes('/reel/') || lower.includes('fb.watch')
  }
  return false
}

function getFileExtension(file: File) {
  const dotExt = file.name.split('.').pop()?.trim().toLowerCase()
  if (dotExt) return dotExt
  const mimePart = file.type.split('/').pop()?.trim().toLowerCase()
  return mimePart || 'mp4'
}

export function GymVideoLibrary() {
  const { t, lang } = useLanguage()
  const [videos, setVideos] = useState<GymVideo[]>([])
  const [urlDraft, setUrlDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [backupFile, setBackupFile] = useState<File | null>(null)
  const [isSavePanelExpanded, setIsSavePanelExpanded] = useState(true)
  const [preferencesUserId, setPreferencesUserId] = useState<string | null>(null)
  const [preferencesReady, setPreferencesReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<GymVideo | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function fetchVideos() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('gym_videos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setVideos((data || []) as GymVideo[])
    } catch {
      toast.error(t('notes.trackerVideos.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchVideos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const {
          data: { user },
        } = await getSupabaseBrowserClient().auth.getUser()
        setPreferencesUserId(user?.id ?? null)
      } finally {
        setPreferencesReady(true)
      }
    })()
  }, [])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      const scope = preferencesUserId ? `user:${preferencesUserId}` : 'user:anonymous'
      const key = `notes:${scope}:tracker:videos:save-panel:expanded`
      const stored = window.localStorage.getItem(key)
      if (stored !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsSavePanelExpanded(stored === 'true')
      }
    } catch {
      // Ignore storage read errors.
    }
  }, [preferencesReady, preferencesUserId])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      const scope = preferencesUserId ? `user:${preferencesUserId}` : 'user:anonymous'
      const key = `notes:${scope}:tracker:videos:save-panel:expanded`
      window.localStorage.setItem(key, String(isSavePanelExpanded))
    } catch {
      // Ignore storage write errors.
    }
  }, [isSavePanelExpanded, preferencesReady, preferencesUserId])

  async function addVideo() {
    const parsed = parseVideoUrl(urlDraft)
    if (!parsed) {
      toast.error(t('notes.trackerVideos.invalidUrl'))
      return
    }

    setSaving(true)
    let uploadedBackupPath: string | null = null
    try {
      const {
        data: { user },
      } = await getSupabaseBrowserClient().auth.getUser()

      if (!user?.id) {
        toast.error(t('notes.trackerVideos.authRequired'))
        return
      }

      let backupStoragePath: string | null = null
      let backupPublicUrl: string | null = null

      if (backupFile) {
        const ext = getFileExtension(backupFile)
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await supabase.storage(GYM_VIDEOS_BUCKET).upload(path, backupFile, {
          upsert: false,
          contentType: backupFile.type || undefined,
        })

        if (uploadError) {
          toast.error(t('notes.trackerVideos.backupUploadError'))
          return
        }

        backupStoragePath = path
        uploadedBackupPath = path
        const { data: publicUrlData } = supabase.storage(GYM_VIDEOS_BUCKET).getPublicUrl(path)
        backupPublicUrl = publicUrlData.publicUrl
      }

      const { data, error } = await supabase
        .from('gym_videos')
        .insert([
          {
            user_id: user.id,
            source_url: parsed.normalizedUrl,
            platform: parsed.platform,
            video_id: parsed.videoId ?? null,
            note: noteDraft.trim() || null,
            backup_storage_path: backupStoragePath,
            backup_public_url: backupPublicUrl,
          },
        ])
        .select('*')
        .single()

      if (error || !data) throw error

      setVideos((prev) => [data as GymVideo, ...prev])
      setUrlDraft('')
      setNoteDraft('')
      setBackupFile(null)
      uploadedBackupPath = null
      toast.success(t('notes.trackerVideos.addSuccess'))
    } catch {
      if (uploadedBackupPath) {
        try {
          await supabase.storage(GYM_VIDEOS_BUCKET).remove([uploadedBackupPath])
        } catch {
          // Best-effort cleanup: avoid masking original insert failure.
        }
      }
      toast.error(t('notes.trackerVideos.addError'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      if (deleteTarget.backup_storage_path) {
        const { error: storageError } = await supabase
          .storage(GYM_VIDEOS_BUCKET)
          .remove([deleteTarget.backup_storage_path])
        if (storageError) throw storageError
      }

      const { error } = await supabase.from('gym_videos').delete().eq('id', deleteTarget.id)
      if (error) throw error

      setVideos((prev) => prev.filter((video) => video.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success(t('notes.trackerVideos.deleteSuccess'))
    } catch {
      toast.error(t('notes.trackerVideos.deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  const cards = useMemo(() => {
    return videos.map((video) => ({
      ...video,
      embedUrl: buildEmbedUrl(video),
      isShort: isShortStyle(video),
      badge: getPlatformBadge(video.platform),
      createdText: new Date(video.created_at).toLocaleDateString(getIntlLocale(lang), {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    }))
  }, [videos, lang])

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.38)] sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">{t('notes.trackerVideos.formLabel')}</label>
          <button
            type="button"
            onClick={() => setIsSavePanelExpanded((prev) => !prev)}
            aria-label={isSavePanelExpanded ? t('notes.trackerVideos.collapseForm') : t('notes.trackerVideos.expandForm')}
            title={isSavePanelExpanded ? t('notes.trackerVideos.collapseForm') : t('notes.trackerVideos.expandForm')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100"
          >
            {isSavePanelExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {isSavePanelExpanded && (
        <>
          <div className="mt-2 grid gap-2">
            <Input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder={t('notes.trackerVideos.urlPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addVideo()
                }
              }}
            />
            <Input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder={t('notes.trackerVideos.notePlaceholder')}
            />
            <label className="mt-1 text-xs font-medium text-zinc-600">{t('notes.trackerVideos.backupLabel')}</label>
            <Input
              type="file"
              accept="video/*"
              onChange={(e) => setBackupFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-zinc-500">{t('notes.trackerVideos.backupHint')}</p>
            {backupFile && (
              <p className="text-xs font-medium text-emerald-700">{t('notes.trackerVideos.backupReady', { name: backupFile.name })}</p>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-zinc-500">{t('notes.trackerVideos.supportHint')} {t('notes.trackerVideos.shortLayoutHint')}</p>
            <Button size="sm" onClick={() => void addVideo()} disabled={saving || !urlDraft.trim()} className="gap-1.5">
              <PlayCircle className="h-4 w-4" />
              {saving ? t('common.saving') : t('notes.trackerVideos.addButton')}
            </Button>
          </div>
        </>
        )}
      </section>

      {loading ? (
        <p className="py-4 text-center text-sm text-zinc-500">{t('common.loading')}</p>
      ) : cards.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center">
          <p className="text-sm font-medium text-zinc-700">{t('notes.trackerVideos.empty')}</p>
          <p className="mt-1 text-xs text-zinc-500">{t('notes.trackerVideos.emptySubtext')}</p>
        </section>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <div className="flex snap-x snap-mandatory gap-0 sm:gap-5">
          {cards.map((video) => (
            <article
              key={video.id}
              className="min-w-full snap-center overflow-hidden rounded-none border border-zinc-200 bg-white shadow-[0_12px_28px_-24px_rgba(15,23,42,0.4)] sm:w-screen sm:min-w-115 sm:max-w-3xl sm:snap-start sm:rounded-2xl"
            >
              <div className="flex items-start gap-2 border-b border-zinc-100 px-3 py-2.5">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${video.badge.className}`}>
                  {video.badge.label}
                </span>
                <span className="text-[11px] text-zinc-500">{video.createdText}</span>
                <div className="ml-auto flex items-center gap-1">
                  <a
                    href={video.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
                    aria-label={t('notes.trackerVideos.openAria')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(video)}
                    className="text-rose-300 hover:bg-rose-500/15"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="p-3">
                {video.backup_public_url ? (
                  <div className="overflow-hidden rounded-xl border border-emerald-200 bg-zinc-950">
                    <video
                      controls
                      preload="metadata"
                      src={video.backup_public_url}
                      className={video.isShort ? 'mx-auto aspect-9/16 w-full max-w-115' : 'aspect-video w-full'}
                    />
                  </div>
                ) : video.embedUrl ? (
                  <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                    <div className={video.isShort ? 'mx-auto aspect-9/16 w-full max-w-115' : 'aspect-video'}>
                      <iframe
                        src={video.embedUrl}
                        title={video.note || video.badge.label}
                        className="h-full w-full"
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-400">
                    {t('notes.trackerVideos.noPreview')}
                  </div>
                )}

                {video.backup_public_url && (
                  <p className="mt-2 text-xs text-emerald-700">{t('notes.trackerVideos.sourceUnavailable')}</p>
                )}

                {video.note && <p className="mt-2 text-sm leading-relaxed text-zinc-700">{video.note}</p>}
              </div>
            </article>
          ))}
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        itemContent={deleteTarget?.source_url}
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
