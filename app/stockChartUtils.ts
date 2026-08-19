import { type DailyPricePoint, type RangeKey } from './stockTypes'

export function fmt(v: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(v))
}

export function compact(v: number) {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}T`
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`
  return `${sign}${Math.round(abs)}`
}

export function pnlCls(v: number) {
  return v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-500' : 'text-zinc-400'
}

export function filterByRange(points: DailyPricePoint[], key: RangeKey): DailyPricePoint[] {
  if (points.length === 0 || key === 'ALL') return points
  if (key === '5D') return points.slice(-5)
  const latest = new Date(points.at(-1)!.date)
  const cutoff = new Date(latest)
  if (key === 'YTD') cutoff.setUTCMonth(0, 1)
  else cutoff.setUTCDate(cutoff.getUTCDate() - { '1M': 30, '3M': 91, '6M': 182, '1Y': 365, '5Y': 365 * 5 }[key])
  return points.filter((p) => new Date(p.date) >= cutoff)
}

export function pctChangeForRange(points: DailyPricePoint[], key: RangeKey): number | null {
  const subset = filterByRange(points, key)
  if (subset.length < 2) return null
  const first = subset[0].close
  const last = subset.at(-1)!.close
  return first !== 0 ? ((last - first) / first) * 100 : null
}

export function downsample(points: DailyPricePoint[], maxPoints: number): DailyPricePoint[] {
  if (points.length <= maxPoints) return points
  const step = points.length / maxPoints
  const result: DailyPricePoint[] = []
  for (let i = 0; i < maxPoints; i++) result.push(points[Math.floor(i * step)])
  const last = points.at(-1)!
  if (result.at(-1) !== last) result.push(last)
  return result
}

// Catmull-Rom → cubic bezier smoothing for a modern curved line/area
export function smoothPath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return ''
  if (coords.length === 1) return `M${coords[0].x},${coords[0].y}`
  let d = `M${coords[0].x},${coords[0].y}`
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] ?? coords[i]
    const p1 = coords[i]
    const p2 = coords[i + 1]
    const p3 = coords[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }
  return d
}

export function formatAxisLabel(dateStr: string, key: RangeKey): string {
  const d = new Date(dateStr)
  if (key === 'ALL' || key === '5Y') return `${d.getUTCFullYear()}`
  if (key === '5D') return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
  return `${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(2)}`
}

export function formatTooltipDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

export function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(dateStr))
}
