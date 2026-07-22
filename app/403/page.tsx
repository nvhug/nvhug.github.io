'use client'

import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'

export default function ForbiddenPage() {
  const { t } = useLanguage()

  return (
    <main className="flex min-h-svh items-center justify-center px-4 pt-20">
      <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-[0_30px_60px_-45px_rgba(16,185,129,0.32)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-poppins text-xl font-semibold text-zinc-900">{t('forbidden.heading')}</h1>
        <p className="mt-2 text-sm text-zinc-600">{t('forbidden.message')}</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-linear-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:from-emerald-400 hover:to-emerald-500"
        >
          {t('forbidden.backHome')}
        </Link>
      </div>
    </main>
  )
}
