'use client'

import { useLanguage } from '@/lib/i18n/language-context'

export function LanguageSwitch() {
  const { lang, setLang } = useLanguage()

  return (
    <div className="flex items-center rounded-lg border border-emerald-100 p-0.5 text-xs font-semibold">
      <button
        type="button"
        onClick={() => setLang('vi')}
        className={`rounded-md px-1.5 py-1 transition-colors ${
          lang === 'vi' ? 'bg-emerald-100 text-emerald-700' : 'text-zinc-500 hover:text-zinc-900'
        }`}
      >
        VI
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`rounded-md px-1.5 py-1 transition-colors ${
          lang === 'en' ? 'bg-emerald-100 text-emerald-700' : 'text-zinc-500 hover:text-zinc-900'
        }`}
      >
        EN
      </button>
    </div>
  )
}
