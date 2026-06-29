'use client'

import { moneyline } from '@/lib/odds'

// ESPN-style single win-probability line: 50% centered on the x-axis. Above the
// midline = Gray favored (gray line + gray shading); below = Navy favored (navy).
// `v` is Gray's share of the win (0–100, 50 = even), one point per scored hole.
function CupChart({ v, grayColor, navyColor }: { v: number[]; grayColor: string; navyColor: string }) {
  const W = 400, H = 180, P = 8
  const dev = Math.max(0, ...v.map(x => Math.abs(x - 50)))
  const D = Math.min(50, Math.max(dev + 6, 12)) // symmetric half-span around 50
  const lo = 50 - D, hi = 50 + D
  const count = v.length
  const xAt = (i: number) => (count <= 1 ? W - P : P + (i / (count - 1)) * (W - 2 * P))
  const y = (val: number) => P + (1 - (val - lo) / (hi - lo)) * (H - 2 * P)
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
        <clipPath id="cupBelow"><rect x="0" y={midY} width={W} height={H - midY} /></clipPath>
      </defs>
      <path d={areaPath} fill={grayColor} fillOpacity={0.22} clipPath="url(#cupAbove)" />
      <path d={areaPath} fill={navyColor} fillOpacity={0.22} clipPath="url(#cupBelow)" />
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
  className = '',
}: {
  grayColor: string
  cupS: number
  seriesV: number[]
  className?: string
}) {
  const navyChart = '#7aa2ff'
  return (
    <div className={`bg-[#091540] rounded-2xl shadow-sm px-4 py-4 ${className}`}>
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
      <CupChart v={seriesV} grayColor={grayColor} navyColor={navyChart} />
    </div>
  )
}
