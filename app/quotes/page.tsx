'use client'

import { useEffect, useState } from 'react'
import { Check, Pencil, Quote, Sparkles, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Quote as QuoteType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useLanguage } from '@/lib/i18n/language-context'

export default function QuotesPage() {
  const { t } = useLanguage()
  const [quotes, setQuotes] = useState<QuoteType[]>([])
  const [currentQuote, setCurrentQuote] = useState<QuoteType | null>(null)
  const [loading, setLoading] = useState(true)
  const [newQuote, setNewQuote] = useState('')
  const [newAuthor, setNewAuthor] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [editingAuthor, setEditingAuthor] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<QuoteType | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function fetchQuotes() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setQuotes((data || []) as QuoteType[])
      if (data && data.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.length)
        setCurrentQuote(data[randomIndex])
      }
    } catch (error) {
      console.error('Error fetching quotes:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuotes()
  }, [])

  useEffect(() => {
    if (quotes.length === 0) return

    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * quotes.length)
      setCurrentQuote(quotes[randomIndex])
    }, 60000)

    return () => clearInterval(interval)
  }, [quotes])

  async function addQuote() {
    if (!newQuote.trim()) return

    setSaving(true)
    try {
      const { error } = await supabase.from('quotes').insert([
        {
          content: newQuote.trim(),
          author: newAuthor.trim() || null,
        },
      ])
      if (error) throw error
      setNewQuote('')
      setNewAuthor('')
      await fetchQuotes()
    } catch (error) {
      console.error('Error adding quote:', error)
      toast.error(t('quotes.addError'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('quotes').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setQuotes((prev) => prev.filter((q) => q.id !== deleteTarget.id))
      if (currentQuote?.id === deleteTarget.id) setCurrentQuote(null)
      setDeleteTarget(null)
      toast.success(t('quotes.deleteSuccess'))
    } catch (error) {
      console.error('Error deleting quote:', error)
      toast.error(t('quotes.deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  function startEdit(quote: QuoteType) {
    setEditingId(quote.id)
    setEditingContent(quote.content)
    setEditingAuthor(quote.author || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingContent('')
    setEditingAuthor('')
  }

  async function saveEdit(quote: QuoteType) {
    const content = editingContent.trim()
    if (!content) return

    const update = { content, author: editingAuthor.trim() || null }

    setBusyId(quote.id)
    try {
      const { error } = await supabase.from('quotes').update(update).eq('id', quote.id)
      if (error) throw error
      setQuotes((prev) => prev.map((q) => (q.id === quote.id ? { ...q, ...update, author: update.author ?? undefined } : q)))
      setCurrentQuote((prev) => (prev && prev.id === quote.id ? { ...prev, ...update, author: update.author ?? undefined } : prev))
      cancelEdit()
    } catch (error) {
      console.error('Error updating quote:', error)
      toast.error(t('quotes.updateError'))
    } finally {
      setBusyId(null)
    }
  }

  function getRandomQuote() {
    if (quotes.length === 0) return
    const randomIndex = Math.floor(Math.random() * quotes.length)
    setCurrentQuote(quotes[randomIndex])
  }

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_35%),radial-gradient(circle_at_80%_18%,rgba(52,211,153,0.16),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f6fef9_100%)] px-4 pb-10 pt-24 text-zinc-900 sm:px-6 sm:pt-28">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        {/* Header */}
        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#ffffff_0%,#f7fef9_45%,#ecfdf5_100%)] p-6 shadow-[0_30px_60px_-45px_rgba(16,185,129,0.45)]">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_16px_28px_-16px_rgba(16,185,129,0.9)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">{t('quotes.eyebrow')}</p>
              <h2 className="mt-1 font-poppins text-2xl font-semibold leading-tight text-zinc-900">{t('quotes.heading')}</h2>
              <p className="mt-1 text-sm text-zinc-600">{t('quotes.subheading')}</p>
            </div>
          </div>
        </section>

        {/* Current Quote Display */}
        {loading ? (
          <div className="rounded-2xl border border-emerald-100 bg-white p-12 text-center text-sm text-zinc-500">
            {t('common.loading')}
          </div>
        ) : currentQuote ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 shadow-[0_20px_42px_-32px_rgba(16,185,129,0.28)]">
            <div className="mb-6 flex justify-center">
              <Quote className="h-8 w-8 text-emerald-400" />
            </div>
            <blockquote className="mb-6 text-center">
              <p className="whitespace-pre-wrap font-poppins text-2xl font-semibold leading-relaxed text-zinc-900">&ldquo;{currentQuote.content}&rdquo;</p>
              {currentQuote.author && (
                <p className="mt-4 text-sm font-medium text-zinc-600">— {currentQuote.author}</p>
              )}
            </blockquote>
            <div className="flex justify-center">
              <Button
                onClick={getRandomQuote}
                className="bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500"
              >
                {t('quotes.nextQuote')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-100 bg-white p-12 text-center text-sm text-zinc-500">
            {t('quotes.emptyState')}
          </div>
        )}

        {/* Add Quote Form */}
        <section className="rounded-2xl border border-emerald-100 bg-white shadow-[0_30px_60px_-45px_rgba(16,185,129,0.32)]">
          <div className="border-b border-emerald-100 px-6 py-4">
            <p className="text-sm font-semibold text-zinc-900">{t('quotes.addNewTitle')}</p>
          </div>
          <div className="space-y-4 p-6">
            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-600">{t('quotes.contentLabel')}</label>
              <textarea
                rows={3}
                value={newQuote}
                onChange={(e) => setNewQuote(e.target.value)}
                placeholder={t('quotes.contentPlaceholder')}
                className="w-full resize-y rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus-visible:border-emerald-400"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-600">{t('quotes.authorLabel')}</label>
              <Input
                type="text"
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                placeholder={t('quotes.authorPlaceholder')}
                className="border-emerald-200 bg-white text-zinc-900"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  setNewQuote('')
                  setNewAuthor('')
                }}
                variant="ghost"
                className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700"
              >
                {t('common.cancel')}
              </Button>
              <Button
                disabled={saving || !newQuote.trim()}
                onClick={addQuote}
                className="bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500"
              >
                {t('quotes.addQuote')}
              </Button>
            </div>
          </div>
        </section>

        {/* Quotes List */}
        {quotes.length > 0 && (
          <section className="rounded-2xl border border-emerald-100 bg-white shadow-[0_30px_60px_-45px_rgba(16,185,129,0.32)]">
            <div className="border-b border-emerald-100 px-6 py-4">
              <p className="text-sm font-semibold text-zinc-900">{t('quotes.allQuotes', { count: quotes.length })}</p>
            </div>
            <div className="divide-y divide-emerald-50">
              {quotes.map((quote) => (
                <div key={quote.id} className="flex items-start gap-3 px-6 py-4">
                  <Quote className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  {editingId === quote.id ? (
                    <div className="min-w-0 flex-1 space-y-2">
                      <textarea
                        autoFocus
                        rows={3}
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        className="w-full resize-y rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus-visible:border-emerald-400"
                      />
                      <Input
                        type="text"
                        value={editingAuthor}
                        onChange={(e) => setEditingAuthor(e.target.value)}
                        placeholder={t('quotes.authorPlaceholder')}
                        className="border-emerald-200 bg-white text-zinc-900"
                      />
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busyId === quote.id || !editingContent.trim()}
                          onClick={() => saveEdit(quote)}
                          className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700"
                        >
                          <Check />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={cancelEdit} className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700">
                          <X />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap text-sm text-zinc-800">&ldquo;{quote.content}&rdquo;</p>
                        {quote.author && (
                          <p className="mt-1 text-xs text-zinc-600">— {quote.author}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busyId === quote.id}
                          onClick={() => startEdit(quote)}
                          className="text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busyId === quote.id}
                          onClick={() => setDeleteTarget(quote)}
                          className="text-rose-300 hover:bg-rose-500/15"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      <ConfirmModal
        open={!!deleteTarget}
        itemContent={deleteTarget?.content}
        itemMeta={deleteTarget?.author ? `— ${deleteTarget.author}` : undefined}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  )
}
