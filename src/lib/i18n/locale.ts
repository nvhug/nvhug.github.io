import type { Lang } from './language-context'

export function getIntlLocale(lang: Lang): string {
  return lang === 'vi' ? 'vi-VN' : 'en-US'
}
