'use client'

import { useLanguage } from '@/lib/i18n/language-context'

/**
 * `tone="dark"` is for the public landing page, the only surface with a dark ground.
 * The default is unchanged, so every existing call site keeps the light pill it has.
 */
export function LanguageSwitch({ tone = 'light' }: { tone?: 'light' | 'dark' } = {}) {
  const { lang, setLang } = useLanguage()
  const dark = tone === 'dark'

  return (
    <div
      className={`relative inline-flex h-7 rounded-full text-xs font-semibold ${
        dark ? 'bg-[#16211A]' : 'bg-zinc-100'
      }`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 w-1/2 rounded-full shadow-sm transition-transform duration-200 ease-out ${
          dark ? 'bg-[#1E3A2C]' : 'bg-emerald-100'
        } ${lang === 'en' ? 'translate-x-full' : 'translate-x-0'}`}
      />
      <button
        type="button"
        onClick={() => setLang('vi')}
        className={`relative z-10 w-8 py-1 text-center text-sm transition-colors duration-150 sm:text-xs ${
          lang === 'vi'
            ? dark
              ? 'text-[#34D399]'
              : 'text-emerald-700'
            : dark
              ? 'text-[#8FA394] hover:text-[#EAF2EC]'
              : 'text-zinc-400 hover:text-zinc-600'
        }`}
      >
        VI
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`relative z-10 w-8 py-1 text-center text-sm transition-colors duration-150 sm:text-xs ${
          lang === 'en'
            ? dark
              ? 'text-[#34D399]'
              : 'text-emerald-700'
            : dark
              ? 'text-[#8FA394] hover:text-[#EAF2EC]'
              : 'text-zinc-400 hover:text-zinc-600'
        }`}
      >
        EN
      </button>
    </div>
  )
}
