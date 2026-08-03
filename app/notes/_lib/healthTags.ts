export const HEALTH_TAG_ALIASES = ['suc khoe', 'suc-khoe', 'health'] as const

export function normalizeHealthTagName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim()
}

export function isHealthTagAlias(name: string): boolean {
  return HEALTH_TAG_ALIASES.includes(normalizeHealthTagName(name) as (typeof HEALTH_TAG_ALIASES)[number])
}
