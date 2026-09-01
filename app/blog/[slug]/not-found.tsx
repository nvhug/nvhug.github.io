'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/language-context'

// Same response for "no such post" and "that post is private" (see the
// invariant comment in page.tsx) — this card must not say which one it is,
// or a stranger could enumerate an account's slugs by watching which return
// this page and which don't.
export default function BlogPostNotFound() {
  const { t } = useLanguage()

  return (
    <main className="min-h-svh bg-[#f7f4ed] px-4 pb-16 pt-24 sm:px-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#e5e0d5] bg-white/75 p-16 text-center">
        <h1 className="font-poppins text-xl font-semibold text-zinc-900">
          {t('blogPostNotFound.heading')}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">{t('blogPostNotFound.message')}</p>
        <Link
          href="/blog"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-linear-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:from-emerald-400 hover:to-emerald-500"
        >
          {t('blogPostNotFound.backHome')}
        </Link>
      </div>
    </main>
  )
}
