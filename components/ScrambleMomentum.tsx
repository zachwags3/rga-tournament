'use client'

import { useRef, useState } from 'react'
import { SCRAMBLE_TEAMS, teamName } from '@/lib/scramble/config'
import type { ProbSeries } from '@/lib/scramble/odds'

// Win-probability lines, one colour per pairing. y is the percent chance that team
// wins outright; the lines always sum to 100% across whatever teams are in the field.
export default function ScrambleMomentum({ data }: { data: ProbSeries }) {
  const W = 400, CH = 190, AX = 20, PL = 28, PR = 10, TOP = 10, BOT = 10
  const H = CH + AX
  const n = data.holeAt.length

  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const all = SCRAMBLE_TEAMS.flatMap(t => data.series[t.slug] ?? [])
  const peak = all.length ? Math.max(...all) : 20
  const yMax = Math.min(100, Math.max(40, Math.ceil((peak * 1.2) / 10) * 10))
  const step = yMax <= 40 ? 10 : yMax <= 60 ? 20 : 25

  const xAt = (i: number) => (n <= 1 ? PL : PL + (i / (n - 1)) * (W - PL - PR))
  const yAt = (v: number) => TOP + (1 - v / yMax) * (CH - TOP - BOT)

  const handleMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (n <= 1) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const localX = ((e.clientX - rect.left) / rect.width) * W
    const t = (localX - PL) / (W - PL - PR)
    const i = Math.round(t * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  // Hole ticks where the field first reached 6 / 12 / 18
  const ticks: { x: number; label: string }[] = []
  for (const h of [6, 12, 18]) {
    const i = data.holeAt.findIndex(v => v >= h)
    if (i > 0) ticks.push({ x: xAt(i), label: String(h) })
  }

  const gridlines: number[] = []
  for (let v = 0; v <= yMax; v += step) gridlines.push(v)

  const hoverRows = hover == null ? null : [...SCRAMBLE_TEAMS]
    .map(t => ({ team: t, v: data.series[t.slug]?.[hover] ?? 0 }))
    .sort((a, b) => b.v - a.v)
  const hoverLabel = hover == null ? '' : (data.holeAt[hover] > 0 ? `Thru ${data.holeAt[hover]}` : 'Pre-round')

  const tipW = 132, tipRowH = 13, tipPad = 7
  const tipH = hoverRows ? tipPad * 2 + 14 + hoverRows.length * tipRowH : 0
  const hoverX = hover == null ? 0 : xAt(hover)
  const tipX = hover == null ? 0 : (hoverX + 10 + tipW > W - PR ? hoverX - 10 - tipW : hoverX + 10)
  const tipY = TOP + 4

  return (
    <div className="bg-[#091540] rounded-2xl shadow-sm px-4 py-4 mt-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#e8c96a] mb-2">Momentum</p>

      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }}>
        {gridlines.map(v => (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={yAt(v)} y2={yAt(v)} stroke="#ffffff" strokeOpacity={0.1} strokeWidth={1} />
            <text x={PL - 5} y={yAt(v) + 3} fill="#ffffff" fillOpacity={0.35} fontSize={9} textAnchor="end">{v}%</text>
          </g>
        ))}
        {ticks.map(t => (
          <g key={t.label}>
            <line x1={t.x} x2={t.x} y1={TOP} y2={CH - BOT} stroke="#ffffff" strokeOpacity={0.12} strokeWidth={1} strokeDasharray="3 3" />
            <text x={t.x} y={CH + 12} fill="#ffffff" fillOpacity={0.4} fontSize={9} textAnchor="middle">{t.label}</text>
          </g>
        ))}
        {SCRAMBLE_TEAMS.map(t => {
          const v = data.series[t.slug] ?? []
          if (v.length === 0) return null
          const pts = v.length === 1
            ? [{ x: PL, v: v[0] }, { x: W - PR, v: v[0] }]
            : v.map((val, i) => ({ x: xAt(i), v: val }))
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${yAt(p.v).toFixed(1)}`).join(' ')
          const last = pts[pts.length - 1]
          return (
            <g key={t.slug}>
              <path d={d} fill="none" stroke={t.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <circle cx={last.x} cy={yAt(last.v)} r={3} fill={t.color} />
            </g>
          )
        })}

        {hover != null && (
          <g pointerEvents="none">
            <line x1={hoverX} x2={hoverX} y1={TOP} y2={CH - BOT} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2 2" />
            {SCRAMBLE_TEAMS.map(t => {
              const v = data.series[t.slug]?.[hover]
              if (v == null) return null
              return <circle key={t.slug} cx={hoverX} cy={yAt(v)} r={3.5} fill={t.color} stroke="#091540" strokeWidth={1.5} />
            })}
          </g>
        )}

        {hoverRows && (
          <g pointerEvents="none">
            <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={6} fill="#050b2e" stroke="#ffffff" strokeOpacity={0.15} />
            <text x={tipX + tipPad} y={tipY + 13} fill="#ffffff" fillOpacity={0.5} fontSize={9} fontWeight={700}>{hoverLabel}</text>
            {hoverRows.map((r, i) => (
              <g key={r.team.slug} transform={`translate(${tipX + tipPad}, ${tipY + 14 + tipRowH * (i + 1) - 3})`}>
                <circle cx={2} cy={-3} r={2.5} fill={r.team.color} />
                <text x={9} y={0} fill="#ffffff" fillOpacity={0.75} fontSize={9}>{teamName(r.team)}</text>
                <text x={tipW - tipPad * 2} y={0} fill="#ffffff" fontSize={9} fontWeight={700} textAnchor="end">{Math.round(r.v)}%</text>
              </g>
            ))}
          </g>
        )}

        <rect
          x={PL} y={TOP} width={W - PL - PR} height={CH - TOP - BOT}
          fill="transparent"
          style={{ cursor: 'crosshair' }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      {/* Legend — current win chance per pairing */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3">
        {[...SCRAMBLE_TEAMS]
          .sort((a, b) => (data.series[b.slug]?.at(-1) ?? 0) - (data.series[a.slug]?.at(-1) ?? 0))
          .map(t => {
            const cur = data.series[t.slug]?.at(-1) ?? 0
            return (
              <div key={t.slug} className="flex items-center gap-1.5 min-w-0">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <span className="text-[11px] text-white/70 truncate">{teamName(t)}</span>
                <span className="text-[11px] font-bold text-white ml-auto tabular-nums">{Math.round(cur)}%</span>
              </div>
            )
          })}
      </div>
    </div>
  )
}
