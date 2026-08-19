export const formatVNPrice = (n: number) => new Intl.NumberFormat('vi-VN').format(n)
export const alertArrow = (direction: 'rise' | 'fall') => direction === 'rise' ? '▲' : '▼'
export const alertTeamsColor = (direction: 'rise' | 'fall') => direction === 'rise' ? 'Good' : 'Attention'
export const formatPct = (pct: number) => Math.abs(pct).toFixed(2)
