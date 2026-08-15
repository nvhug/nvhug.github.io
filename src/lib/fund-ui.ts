export function formatDigitInput(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return new Intl.NumberFormat('vi-VN').format(Number(digits))
}

export function getAssetBreakdownEmptyText(options: { hasTransactions: boolean; vi: boolean }) {
  if (options.hasTransactions) {
    return options.vi ? 'Chưa có tài sản để phân bổ.' : 'No assets available for allocation yet.'
  }

  return options.vi ? 'Chưa có tài sản.' : 'No assets yet.'
}