'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/language-context'

export default function PrivacyContent() {
  const { t, list } = useLanguage()

  return (
    <main className="min-h-svh bg-[#f7fef9] pb-16 pt-24">
      <section className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <div className="rounded-3xl border border-emerald-200/70 bg-white/85 p-6 shadow-[0_20px_42px_-32px_rgba(16,185,129,0.28)] sm:p-8">
          <Link href="/" className="text-sm font-medium text-zinc-500 transition-colors hover:text-emerald-700">
            {t('common.backLink')}
          </Link>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">{t('privacy.eyebrow')}</p>
          <h1 className="mt-2 font-poppins text-4xl font-semibold leading-tight text-zinc-900">{t('privacy.title')}</h1>
          <p className="mt-3 text-sm text-zinc-500">{t('privacy.lastUpdated')}</p>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
            <h2 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">{t('privacy.overviewTitle')}</h2>
            <p className="leading-relaxed text-zinc-600">
              {t('privacy.overviewBody')}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
            <h2 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">{t('privacy.dataCollectTitle')}</h2>
            <p className="mb-3 leading-relaxed text-zinc-600">
              {t('privacy.dataCollectIntro')}
            </p>
            <ul className="space-y-2">
              {list('privacy.dataItems').map((item, i) => (
                <li key={i} className="flex gap-3 text-zinc-600">
                  <span className="text-emerald-500">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 leading-relaxed text-zinc-600">
              {t('privacy.dataCollectNote')}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
            <h2 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">{t('privacy.useTitle')}</h2>
            <p className="leading-relaxed text-zinc-600">
              {t('privacy.useBody')}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
            <h2 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">{t('privacy.storageTitle')}</h2>
            <p className="leading-relaxed text-zinc-600">
              {t('privacy.storageBody')}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
            <h2 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">{t('privacy.deletionTitle')}</h2>
            <p className="mb-3 leading-relaxed text-zinc-600">
              {t('privacy.deletionIntro')}
            </p>
            <a
              href="mailto:nvhug001@gmail.com"
              className="font-medium text-emerald-700 hover:underline"
            >
              nvhug001@gmail.com
            </a>
            <p className="mt-3 leading-relaxed text-zinc-600">
              {t('privacy.deletionBody')}{' '}
              <a
                href="https://www.facebook.com/settings?tab=applications"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-700 hover:underline"
              >
                {t('privacy.facebookSettingsLink')}
              </a>.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
            <h2 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">{t('privacy.contactTitle')}</h2>
            <p className="leading-relaxed text-zinc-600">
              {t('privacy.contactBody')}{' '}
              <a href="mailto:nvhug001@gmail.com" className="font-medium text-emerald-700 hover:underline">
                nvhug001@gmail.com
              </a>.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
