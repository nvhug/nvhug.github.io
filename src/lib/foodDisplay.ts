function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function buildFoodDisplayName(name?: string | null, portion?: string | null): string {
  const baseName = (name ?? '').trim()
  const portionText = (portion ?? '').trim()

  if (!baseName && !portionText) return '-'
  if (!portionText) return baseName || '-'
  if (!baseName) return portionText

  const normalizedName = normalizeText(baseName)
  const normalizedPortion = normalizeText(portionText)

  if (normalizedName.includes(normalizedPortion)) return baseName

  if (/\d/.test(portionText)) {
    return `${baseName} ${portionText}`
  }

  return `${baseName} (${portionText})`
}