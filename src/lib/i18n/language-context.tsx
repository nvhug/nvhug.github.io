'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { vi } from './dictionaries/vi'
import { en } from './dictionaries/en'

export type Lang = 'vi' | 'en'

const STORAGE_KEY = 'nvhug:lang'

const dictionaries = { vi, en }

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = vars[name]
    return value === undefined ? match : String(value)
  })
}

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  list: (key: string) => string[]
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'vi'
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'vi' || stored === 'en' ? stored : 'vi'
  })

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  function setLang(next: Lang) {
    setLangState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  function t(key: string, vars?: Record<string, string | number>) {
    const value = getByPath(dictionaries[lang], key)
    if (typeof value !== 'string') return key
    return interpolate(value, vars)
  }

  function list(key: string): string[] {
    const value = getByPath(dictionaries[lang], key)
    return Array.isArray(value) ? (value as string[]) : []
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, list }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}
