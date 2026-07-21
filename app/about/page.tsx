'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/language-context'

export default function AboutPage() {
  const { t } = useLanguage()
  return (
    <main className="min-h-svh bg-[#f7fef9] pb-16 pt-24">
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl border border-emerald-200/70 bg-white/85 p-6 shadow-[0_20px_42px_-32px_rgba(16,185,129,0.28)] sm:p-8">
          <Link href="/" className="text-sm font-medium text-zinc-500 transition-colors hover:text-emerald-700">
            {t('common.backLink')}
          </Link>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">{t('about.eyebrow')}</p>
          <h1 className="mt-2 font-poppins text-4xl font-semibold leading-tight text-zinc-900">{t('about.title')}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-snug text-zinc-600">
            {t('about.intro1')}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-snug text-zinc-600">
            {t('about.intro2')}
          </p>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 sm:p-7">
              <h2 className="mb-4 font-poppins text-2xl font-semibold text-zinc-900">{t('about.whoIAmTitle')}</h2>
              <p className="mb-3 leading-snug text-zinc-700">
                {t('about.whoIAmP1')}
              </p>
              <p className="leading-snug text-zinc-700">
                {t('about.whoIAmP2')}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
              <h2 className="mb-4 font-poppins text-2xl font-semibold text-zinc-900">{t('about.focusTitle')}</h2>
              <p className="mb-4 leading-snug text-zinc-600">{t('about.focusIntro')}</p>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <span className="text-emerald-500">•</span>
                  <span className="leading-snug text-zinc-600"><strong className="text-zinc-900">{t('about.focusItem1Title')}</strong> - {t('about.focusItem1Desc')}</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-emerald-500">•</span>
                  <span className="leading-snug text-zinc-600"><strong className="text-zinc-900">{t('about.focusItem2Title')}</strong> - {t('about.focusItem2Desc')}</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-emerald-500">•</span>
                  <span className="leading-snug text-zinc-600"><strong className="text-zinc-900">{t('about.focusItem3Title')}</strong> - {t('about.focusItem3Desc')}</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-emerald-500">•</span>
                  <span className="leading-snug text-zinc-600"><strong className="text-zinc-900">{t('about.focusItem4Title')}</strong> - {t('about.focusItem4Desc')}</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
              <h2 className="mb-4 font-poppins text-2xl font-semibold text-zinc-900">{t('about.beyondCodeTitle')}</h2>
              <p className="mb-4 leading-snug text-zinc-600">{t('about.beyondCodeIntro')}</p>
              <div className="space-y-2 leading-snug text-zinc-600">
                <p>{t('about.beyondCodeItem1')}</p>
                <p>{t('about.beyondCodeItem2')}</p>
                <p>{t('about.beyondCodeItem3')}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-100 bg-white p-6">
              <h3 className="mb-4 font-poppins text-xl font-semibold text-zinc-900">{t('about.skillsTitle')}</h3>
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-sm font-medium text-zinc-900">{t('about.coreStackLabel')}</p>
                  <p className="text-sm leading-snug text-zinc-600">NestJS, React.js</p>
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-zinc-900">{t('about.additionalLangLabel')}</p>
                  <p className="text-sm leading-snug text-zinc-600">PHP, Ruby, Python, Node.js</p>
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-zinc-900">{t('about.toolingLabel')}</p>
                  <p className="text-sm leading-snug text-zinc-600">VS Code, Git, Docker (foundational), Next.js, Supabase, Vercel</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-6">
              <h3 className="mb-4 font-poppins text-xl font-semibold text-zinc-900">{t('about.statsTitle')}</h3>
              <div className="space-y-3 text-sm text-zinc-700">
                <div className="flex items-center justify-between">
                  <span>{t('about.statStarted')}</span>
                  <span className="font-semibold text-zinc-900">2015</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('about.statExperience')}</span>
                  <span className="font-semibold text-zinc-900">{t('about.statExperienceValue')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('about.statCompany')}</span>
                  <span className="font-semibold text-zinc-900">{t('about.statCompanyValue')}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <h3 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">{t('about.box3Title')}</h3>
              <p className="mb-4 text-sm leading-snug text-zinc-600">{t('about.box3Desc')}</p>
              <Link
                href="mailto:nvhug001@gmail.com"
                className="inline-flex w-full items-center justify-center rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:from-emerald-400 hover:to-emerald-500"
              >
                {t('about.sendEmail')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-8">
          <h2 className="mb-4 font-poppins text-3xl font-semibold text-zinc-900">{t('about.closingTitle')}</h2>
          <p className="mb-8 max-w-2xl leading-snug text-zinc-600">
            {t('about.closingDesc')}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:from-emerald-400 hover:to-emerald-500"
            >
              {t('about.readArticles')}
            </Link>
            <Link
              href="mailto:nvhug001@gmail.com"
              className="inline-flex items-center rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-emerald-50"
            >
              {t('about.contactMe')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
