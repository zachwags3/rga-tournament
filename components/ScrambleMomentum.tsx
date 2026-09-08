'use client'

import { SCRAMBLE_TEAMS, teamName } from '@/lib/scramble/config'
import type { ProbSeries } from '@/lib/scramble/odds'

// Win-probability lines, one colour per pairing. y is the percent chance that team
// wins outright; the lines always sum to 100% across whatever teams are in the field.
export default function ScrambleMomentum({ data }: { data: ProbSeries }) {
  const W = 400, CH = 190, AX = 20, PL = 28, PR = 10, TOP = 10, BOT = 10
  const H = CH + AX
  const n = data.holeAt.length

  const all = SCRAMBLE_TEAMS.flatMap(t => data.series[t.slug] ?? [])
  const peak = all.length ? Math.max(...all) : 20
  const yMax = Math.min(100, Math.max(40, Math.ceil((peak * 1.2) / 10) * 10))
  const step = yMax <= 40 ? 10 : yMax <= 60 ? 20 : 25

  const xAt = (i: number) => (n <= 1 ? PL : PL + (i / (n - 1)) * (W - PL - PR))
  const yAt = (v: number) => TOP + (1 - v / yMax) * (CH - TOP - BOT)

  // Hole ticks where the field first reached 6 / 12 / 18
  const ticks: { x: number; label: string }[] = []
  for (const h of [6, 12, 18]) {
    const i = data.holeAt.findIndex(v => v >= h)
    if (i > 0) ticks.push({ x: xAt(i), label: String(h) })
  }

  const gridlines: number[] = []
  for (let v = 0; v <= yMax; v += step) gridlines.push(v)

  return (
    <div className="bg-[#091540] rounded-2xl shadow-sm px-4 py-4 mt-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#e8c96a] mb-2">Momentum</p>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }}>
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
