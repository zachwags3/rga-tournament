'use client'

import { moneyline } from '@/lib/odds'

// ESPN-style single win-probability line: 50% centered on the x-axis. Above the
// midline = Gray favored (gray line + gray shading); below = Navy favored (navy).
// `v` is Gray's share of the win (0–100, 50 = even), one point per scored hole.
// `markers` place round-start ticks + labels along the bottom axis.
function CupChart({ v, grayColor, navyColor, markers = [] }: { v: number[]; grayColor: string; navyColor: string; markers?: { label: string; frac: number }[] }) {
  const W = 400, CH = 180, AX = 26, P = 8 // CH = chart height, AX = axis-label band
  const H = CH + AX
  const dev = Math.max(0, ...v.map(x => Math.abs(x - 50)))
  const D = Math.min(50, Math.max(dev + 6, 12)) // symmetric half-span around 50
  const lo = 50 - D, hi = 50 + D
  const count = v.length
  const xAt = (i: number) => (count <= 1 ? W - P : P + (i / (count - 1)) * (W - 2 * P))
  const xFrac = (f: number) => P + f * (W - 2 * P)
  const y = (val: number) => P + (1 - (val - lo) / (hi - lo)) * (CH - 2 * P)
  const midY = y(50)
  const pts = count === 1 ? [{ x: P, v: v[0] }, { x: W - P, v: v[0] }] : v.map((val, i) => ({ x: xAt(i), v: val }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
  const first = pts[0].x, last = pts[pts.length - 1].x
  const areaPath = `${linePath} L ${last.toFixed(1)} ${midY.toFixed(1)} L ${first.toFixed(1)} ${midY.toFixed(1)} Z`
  const curV = v[v.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }}>
      <defs>
        <clipPath id="cupAbove"><rect x="0" y="0" width={W} height={midY} /></clipPath>
        <clipPath id="cupBelow"><rect x="0" y={midY} width={W} height={CH - midY} /></clipPath>
      </defs>
      <path d={areaPath} fill={grayColor} fillOpacity={0.22} clipPath="url(#cupAbove)" />
      <path d={areaPath} fill={navyColor} fillOpacity={0.22} clipPath="url(#cupBelow)" />
      {markers.map((m, i) => {
        const x = xFrac(m.frac)
        const anchor = m.frac < 0.06 ? 'start' : m.frac > 0.94 ? 'end' : 'middle'
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={P} y2={CH} stroke="#ffffff" strokeOpacity={0.18} strokeWidth={1} strokeDasharray="3 3" />
            <text x={x} y={CH + 17} fill="#cbd5e1" fontSize={11} fontWeight={600} textAnchor={anchor}>{m.label}</text>
          </g>
        )
      })}
      <line x1={P} x2={W - P} y1={midY} y2={midY} stroke="#cbd5e1" strokeWidth={1} />
      <path d={linePath} fill="none" stroke={grayColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" clipPath="url(#cupAbove)" />
      <path d={linePath} fill="none" stroke={navyColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" clipPath="url(#cupBelow)" />
      <circle cx={last} cy={y(curV)} r={3.5} fill={curV >= 50 ? grayColor : navyColor} />
    </svg>
  )
}

// The navy "Cup Winner — Live Movement" card: current line + the movement chart.
// `cupS` is Gray's draw-no-bet win share; `seriesV` is the per-hole movement line.
export default function CupMovement({
  grayColor,
  cupS,
  seriesV,
  markers = [],
  className = '',
  chartOnly = false,
}: {
  grayColor: string
  cupS: number
  seriesV: number[]
  markers?: { label: string; frac: number }[]
  className?: string
  chartOnly?: boolean // hide the title + odds header, show only the chart
}) {
  const navyChart = '#7aa2ff'
  return (
    <div className={`bg-[#091540] rounded-2xl shadow-sm px-4 py-4 ${className}`}>
      {!chartOnly && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-widest text-[#e8c96a]">Cup Winner — Live Movement</p>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: grayColor }} />
              <span className="text-[#e8c96a] tabular-nums">{moneyline(cupS)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: navyChart }} />
              <span className="text-[#e8c96a] tabular-nums">{moneyline(1 - cupS)}</span>
            </span>
          </div>
        </div>
      )}
      <CupChart v={seriesV} grayColor={grayColor} navyColor={navyChart} markers={markers} />
    </div>
  )
}
