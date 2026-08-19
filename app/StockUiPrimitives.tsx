import { type SortDir, type SortKey } from './stockTypes'

export function DonutChart({ slices }: { slices: { label: string; pct: number; color: string }[] }) {
  const R = 52, strokeW = 18, cx = 68, cy = 68, circ = 2 * Math.PI * R
  const arcs = slices.map((s, index) => ({
    ...s,
    len: circ * s.pct,
    offset: slices.slice(0, index).reduce((sum, item) => sum + circ * item.pct, 0),
  }))
  return (
    <svg width={136} height={136} viewBox="0 0 136 136">
      {arcs.map((a, i) => (
        <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={a.color} strokeWidth={strokeW}
          strokeDasharray={`${a.len} ${circ - a.len}`} strokeDashoffset={circ / 4 - a.offset} />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={11} fill="#71717a" fontWeight="600">{slices.length}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={10} fill="#a1a1aa">mã CP</text>
    </svg>
  )
}

export function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.15)]">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${accent}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-zinc-400">{sub}</p>
    </div>
  )
}

export function SortableHeader({ label, col, current, dir, onToggle, right = false }: {
  label: string; col: SortKey; current: SortKey; dir: SortDir; onToggle: (k: SortKey) => void; right?: boolean
}) {
  const active = current === col
  return (
    <th onClick={() => onToggle(col)}
      className={`cursor-pointer select-none whitespace-nowrap px-3 py-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800 ${right ? 'text-right' : 'text-left'}`}>
      {label}
      <span className={`ml-0.5 ${active ? 'text-emerald-500' : 'text-zinc-300'}`}>{active ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  )
}
