'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CircleDot, Loader2, Plus, Tags, Trash2 } from 'lucide-react'
import { marked } from 'marked'

import { supabase } from '@/lib/supabase'
import { Post, Tag } from '@/types'
import { generateSlug, truncateHtml } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import RichEditor from '@/components/RichEditor'
import { useLanguage } from '@/lib/i18n/language-context'

// Block-level tags Quill uses to represent each line/paragraph.
const BLOCK_CLOSE_TAGS = /<\/(p|div|h[1-6]|li|blockquote|pre)>/gi

/**
 * Reduce Quill's editor HTML back to plain text, turning block boundaries
 * (and <br>) into real newlines so markdown syntax can be reliably detected
 * and re-parsed. This is necessary because pasted markdown lands in Quill
 * as one <p> per line (e.g. `<p># Heading</p><p>Some text</p>`), which is
 * not valid HTML for `marked` to interpret — each <p> hides the markdown
 * characters from block-level parsing.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(BLOCK_CLOSE_TAGS, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Matches common block-level markdown syntax at the start of a line:
// headings, blockquotes, bullet/numbered lists, fenced code blocks.
const MARKDOWN_PATTERN = /^ {0,3}(#{1,6}\s|>\s?|[-*+]\s|\d+[.)]\s|```)/m

// Detects if content is already formatted HTML (not just plain markdown).
// Checks for block-level HTML tags that Quill produces.
function isFormattedHTML(html: string): boolean {
  return /<(h[1-6]|p|li|blockquote|pre|div|ul|ol)(?:\s|>|\/)/i.test(html)
}

function isLikelyMarkdown(plainText: string): boolean {
  return MARKDOWN_PATTERN.test(plainText)
}

export interface PostFormValues {
  title: string
  slug: string
  excerpt: string
  content: string
  published: boolean
  tagIds: string[]
}

interface PostFormProps {
  mode: 'create' | 'edit'
  initialPost?: Post
  autotagName?: string
  submitting: boolean
  onSubmit: (values: PostFormValues) => Promise<void>
  onDelete?: () => Promise<void>
}

export default function PostForm({ mode, initialPost, autotagName, submitting, onSubmit, onDelete }: PostFormProps) {
  const { t } = useLanguage()

  const [title, setTitle] = useState(initialPost?.title ?? '')
  const [slug, setSlug] = useState(initialPost?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt ?? '')
  const [content, setContent] = useState(initialPost?.content ?? '')
  const [published, setPublished] = useState(initialPost?.published ?? false)
  const [tags, setTags] = useState<Tag[]>([])
  const [tagIds, setTagIds] = useState<string[]>(initialPost?.tags?.map((t) => t.id) ?? [])
  const [newTagName, setNewTagName] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Re-run when autotagName arrives after mount (e.g. search params
  // resolving post-hydration) so the auto-selected tag is still applied.
  useEffect(() => {
    fetchTags()
  }, [autotagName])

  async function fetchTags() {
    try {
      const { data, error } = await supabase.from('tags').select('*').order('name')
      if (error) throw error
      let loadedTags: Tag[] = data || []
      setTags(loadedTags)
      if (autotagName) {
        let match = loadedTags.find((t) => t.name === autotagName)
        if (!match) {
          // Tag doesn't exist yet for this user — create it automatically
          const { data: created, error: createError } = await supabase
            .from('tags')
            .insert([{ name: autotagName }])
            .select()
            .single()
          if (createError) console.error('Error auto-creating tag:', createError)
          if (created) {
            match = created as Tag
            loadedTags = [...loadedTags, match]
            setTags(loadedTags)
          }
        }
        if (match) setTagIds((prev) => (prev.includes(match!.id) ? prev : [...prev, match!.id]))
      }
    } catch (error) {
      console.error('Error fetching tags:', error)
    }
  }

  function handleTitleChange(value: string) {
    setTitle(value)
    if (!slugTouched) {
      setSlug(generateSlug(value))
    }
  }

  function toggleTag(tagId: string) {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  async function handleCreateTag() {
    const name = newTagName.trim()
    if (!name) return

    setCreatingTag(true)
    try {
      const { data, error } = await supabase.from('tags').insert([{ name }]).select().single()
      if (error) throw error
      setTags((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setTagIds((prev) => [...prev, data.id])
      setNewTagName('')
    } catch (error) {
      console.error('Error creating tag:', error)
    } finally {
      setCreatingTag(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !slug.trim() || !content.trim()) return

    let finalContent = content
    const plainText = htmlToPlainText(content)

    // Only convert if content is plain paragraphs — i.e. raw markdown pasted into Quill
    // (Quill wraps each line in <p> with no semantic tags).
    // If content already has semantic HTML from the toolbar or a prior save
    // (headings, lists, bold, code…), preserve it as-is; running marked.parse on the
    // stripped plain text would destroy the heading/formatting structure.
    const contentIsPlain = !/<(h[1-6]|ul|ol|li|blockquote|pre|strong|em|b|i|code)[\s>\/]/i.test(content)
    if (contentIsPlain && isLikelyMarkdown(plainText)) {
      try {
        finalContent = (await marked.parse(plainText, { breaks: true, gfm: true })) as string
      } catch (error) {
        console.error('Markdown conversion failed:', error)
      }
    }
    // If content already has formatted HTML, keep it as-is

    await onSubmit({
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim() || truncateHtml(finalContent),
      content: finalContent,
      published,
      tagIds,
    })
  }

  async function confirmDelete() {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#ffffff_0%,#f7fef9_45%,#ecfdf5_100%)] p-6 shadow-[0_30px_60px_-45px_rgba(16,185,129,0.45)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/admin"
              className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-white text-zinc-600 transition-colors hover:bg-emerald-50 hover:text-zinc-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">{t('admin.postForm.eyebrow')}</p>
              <h2 className="mt-1 font-poppins text-2xl font-semibold leading-tight text-zinc-900">
                {mode === 'create' ? t('admin.postForm.createHeading') : t('admin.postForm.updateHeading')}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                {mode === 'create'
                  ? t('admin.postForm.createSubtitle')
                  : t('admin.postForm.updateSubtitle')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:inline-flex">
              <CircleDot className="h-3.5 w-3.5" />
              {published ? t('admin.posts.badgePublished') : t('admin.postForm.draftMode')}
            </div>
            {mode === 'edit' && onDelete && (
              <Button
                type="button"
                variant="ghost"
                disabled={deleting}
                onClick={() => setConfirmOpen(true)}
                className="rounded-lg text-rose-300 hover:bg-rose-500/15"
              >
                <Trash2 />
                {t('common.delete')}
              </Button>
            )}
            <Button type="submit" disabled={submitting} className="rounded-lg bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500">
              {submitting && <Loader2 className="animate-spin" />}
              {mode === 'create' ? t('admin.postForm.createSubmit') : t('admin.postForm.saveSubmit')}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="space-y-4 rounded-2xl border border-emerald-100 bg-white p-6 shadow-[0_30px_60px_-45px_rgba(16,185,129,0.32)]">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-900">{t('admin.postForm.titleLabel')}</label>
              <Input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={t('admin.postForm.titlePlaceholder')}
                required
                className="border-emerald-200 bg-emerald-50/60 text-zinc-900 placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-900">{t('admin.postForm.slugLabel')}</label>
              <Input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setSlugTouched(true)
                }}
                placeholder={t('admin.postForm.slugPlaceholder')}
                required
                className="border-emerald-200 bg-emerald-50/60 text-zinc-900 placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-900">{t('admin.postForm.excerptLabel')}</label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder={t('admin.postForm.excerptPlaceholder')}
                rows={3}
                className="w-full rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus-visible:border-emerald-400"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-900">{t('admin.postForm.contentLabel')}</label>
              <RichEditor value={content} onChange={setContent} placeholder={t('admin.postForm.contentPlaceholder')} />
            </div>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-[0_30px_60px_-45px_rgba(16,185,129,0.32)]">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <CircleDot className="h-4 w-4" />
              {t('admin.postForm.visibilityHeading')}
            </h3>
            <button
              type="button"
              onClick={() => setPublished((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-sm"
            >
              <span className="font-medium text-zinc-900">
                {published ? t('admin.posts.badgePublished') : t('admin.posts.badgeDraft')}
              </span>
              <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  published ? 'bg-emerald-500' : 'bg-zinc-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    published ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>
          </section>

          <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-[0_30px_60px_-45px_rgba(16,185,129,0.32)]">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <Tags className="h-4 w-4" />
              {t('admin.postForm.tagsHeading')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const selected = tagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-emerald-200 bg-white text-zinc-600 hover:bg-emerald-50 hover:text-zinc-900'
                    }`}
                  >
                    {tag.name}
                  </button>
                )
              })}
              {tags.length === 0 && (
                <p className="text-xs text-zinc-500">{t('admin.postForm.noTags')}</p>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreateTag()
                  }
                }}
                placeholder={t('admin.tags.newTagPlaceholder')}
                className="h-8 border-emerald-200 bg-emerald-50/60 text-zinc-900 placeholder:text-zinc-500"
              />
              <Button
                type="button"
                variant="default"
                size="icon-sm"
                disabled={creatingTag || !newTagName.trim()}
                onClick={handleCreateTag}
                className="rounded-lg bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500"
              >
                <Plus />
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </form>

    <ConfirmModal
      open={confirmOpen}
      itemContent={initialPost?.title}
      loading={deleting}
      onConfirm={() => void confirmDelete()}
      onCancel={() => setConfirmOpen(false)}
    />
    </>
  )
}
