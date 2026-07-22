'use client'

import { useLanguage } from '@/lib/i18n/language-context'

export function LanguageSwitch() {
  const { lang, setLang } = useLanguage()

  return (
    <div className="relative inline-flex h-7 rounded-full bg-zinc-100 text-xs font-semibold">
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 w-1/2 rounded-full bg-emerald-100 shadow-sm transition-transform duration-200 ease-out ${
          lang === 'en' ? 'translate-x-full' : 'translate-x-0'
        }`}
      />
      <button
        type="button"
        onClick={() => setLang('vi')}
        className={`relative z-10 w-8 py-1 text-center text-sm transition-colors duration-150 sm:text-xs ${
          lang === 'vi' ? 'text-emerald-700' : 'text-zinc-400 hover:text-zinc-600'
        }`}
      >
        VI
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`relative z-10 w-8 py-1 text-center text-sm transition-colors duration-150 sm:text-xs ${
          lang === 'en' ? 'text-emerald-700' : 'text-zinc-400 hover:text-zinc-600'
        }`}
      >
        EN
      </button>
    </div>
  )
}
