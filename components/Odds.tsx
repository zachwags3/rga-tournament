'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcMatchPlayStatus } from '@/lib/matchplay'
import { effectiveRatings, liveProbs, displayLine, moneyline, cupProbs, type CupProbs } from '@/lib/odds'
import type { Round, Match, HoleScore, Team } from '@/types/database'

type MatchWithScores = Match & { hole_scores: HoleScore[] }
type RoundWithMatches = Round & { matches: MatchWithScores[] }

// Static prop bets — no live movement, just a fixed board. A prop is either a
// simple list of outcomes (label + American odds) or a Yes/No table (per-row
// Yes and No odds). Odds are plain strings, e.g. "-130", "+220", "EV".
type Prop =
  | { title: string; outcomes: { label: string; odds: string }[] }
  | { title: string; yesNo: { label: string; yes: string; no: string }[] }
const PROPS: Prop[] = [
  {
    title: 'Longest Drive',
    outcomes: [
      { label: 'Sean / Jack / Pat', odds: '-160' },
      { label: 'The Field', odds: '+140' },
    ],
  },
  {
    title: 'Lowest Scramble Score (O/U 69.5)',
    outcomes: [
      { label: 'Under 69.5', odds: '-110' },
      { label: 'Over 69.5', odds: 'EV' },
    ],
  },
  {
    title: 'Lowest Singles Score',
    outcomes: [
      { label: 'Pat / Jack', odds: '-200' },
      { label: 'The Field', odds: '+180' },
    ],
  },
  {
    title: 'To Drive the Green',
    yesNo: [
      { label: 'Pat', yes: '-150', no: '+150' },
      { label: 'Sean, Nate, Jack, Mitch', yes: '-120', no: '+120' },
      { label: 'Danny, Zach, Charlie, Sam', yes: '+120', no: '-120' },
      { label: 'Michael, Joe, Henry', yes: '+150', no: '-150' },
    ],
  },
  {
    title: 'Hole 1 Special',
    outcomes: [
      { label: 'At least 1 eagle', odds: '+250' },
      { label: 'At least 1 birdie', odds: '-190' },
      { label: 'No bogeys', odds: '+130' },
    ],
  },
  {
    title: 'RGA MVP',
    outcomes: [
      { label: 'Pat / Jack', odds: '+150' },
      { label: 'Sean / Mitch / Nathan', odds: '+350' },
      { label: 'Danny / Zach / Charlie', odds: '+750' },
      { label: 'Sam / Michael', odds: '+1100' },
      { label: 'Joe / Henry', odds: '+2400' },
    ],
  },
]

function names(arr: string[]): string {
  if (!arr || arr.length === 0) return 'TBD'
  return arr.join(' & ')
}

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

export default function Odds() {
  const [teams, setTeams] = useState<Team[]>([])
  const [rounds, setRounds] = useState<RoundWithMatches[]>([])
  const [loading, setLoading] = useState(true)
  const [propsOpen, setPropsOpen] = useState(false)

  async function fetchAll() {
    const timeout = new Promise<null>(res => setTimeout(() => res(null), 5000))
    const fetches = Promise.all([
      supabase.from('teams').select('*').order('created_at'),
      supabase.from('rounds').select('*').order('sort_order'),
      supabase.from('matches').select('*').order('match_number'),
      supabase.from('hole_scores').select('*'),
    ])
    const result = await Promise.race([fetches, timeout])
    if (!result) { setLoading(false); return }
    const [teamsRes, roundsRes, matchesRes, scoresRes] = result

    const teamsData: Team[] = teamsRes.data ?? []
    const roundsData: Round[] = roundsRes.data ?? []
    const matchesData: Match[] = matchesRes.data ?? []
    const scoresData: HoleScore[] = scoresRes.data ?? []

    const withScores: MatchWithScores[] = matchesData.map(m => ({
      ...m,
      hole_scores: scoresData.filter(s => s.match_id === m.id),
    }))
    setTeams(teamsData)
    setRounds(roundsData.map(r => ({ ...r, matches: withScores.filter(m => m.round_id === r.id) })))
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('odds-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_scores' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const colorFor = (id: string | null) => (id && teams.find(t => t.id === id)?.color) || '#9ca3af'

  const gray = teams.find(t => t.name.toLowerCase().includes('gray')) ?? teams[0]
  const navy = teams.find(t => t.name.toLowerCase().includes('navy')) ?? teams[1]

  // Per-match Gray/Navy outcome probabilities, optionally as of a point in time.
  const matchProbsAt = (cutoff: number | null) => {
    const out: { pGray: number; pTie: number; pNavy: number }[] = []
    for (const round of rounds) {
      for (const m of round.matches) {
        if (!m.team1_id || !m.team2_id) continue
        if (!m.team1_player_names?.length || !m.team2_player_names?.length) continue
        const holes = cutoff === null ? m.hole_scores : m.hole_scores.filter(h => Date.parse(h.created_at) <= cutoff)
        const st = calcMatchPlayStatus(holes, round.holes)
        const complete = st.isComplete || (cutoff === null && m.status === 'complete')
        let p1: number, pt: number, p2: number
        if (complete) {
          const w = st.isComplete ? st.winner : m.result === 'team1_win' ? 'team1' : m.result === 'team2_win' ? 'team2' : 'halved'
          p1 = w === 'team1' ? 1 : 0
          p2 = w === 'team2' ? 1 : 0
          pt = w === 'halved' ? 1 : 0
        } else {
          const { rA, rB } = effectiveRatings(m.team1_player_names, m.team2_player_names)
          const lp = liveProbs(rA, rB, st.holesUp, st.holesRemaining, round.holes)
          p1 = lp.pA; pt = lp.pTie; p2 = lp.pB
        }
        const t1Gray = m.team1_id === gray?.id
        out.push(t1Gray ? { pGray: p1, pTie: pt, pNavy: p2 } : { pGray: p2, pTie: pt, pNavy: p1 })
      }
    }
    // Every match is worth exactly 1 RGA point, and the full tournament is a fixed
    // pool of points (sum of each round's points_available — 12 here). Points that
    // aren't drafted/scheduled yet are still up for grabs, so model them as neutral
    // coin-flips. Without this the Cup line treats only the *played* matches as the
    // entire tournament — e.g. 2-0 looks like a clinched cup instead of a small lead.
    const totalPoints = rounds.reduce((sum, r) => sum + (r.points_available ?? 0), 0)
    for (let i = out.length; i < totalPoints; i++) {
      out.push({ pGray: 0.5, pTie: 0, pNavy: 0.5 })
    }
    return out
  }

  // Anchor the opening Cup line to Gray 51 / Navy 48 / 1% draw, then let it move.
  const TARGET_GRAY = 51 / 99
  const share = (c: CupProbs) => (c.pGray + c.pNavy > 0 ? c.pGray / (c.pGray + c.pNavy) : 0.5)
  const bias = TARGET_GRAY - share(cupProbs(matchProbsAt(0)))
  const cupPct = (c: CupProbs) => {
    const sAdj = Math.min(0.999, Math.max(0.001, share(c) + bias))
    const tie = Math.min(0.01, c.pTie)
    const gp = Math.round(sAdj * (1 - tie) * 100)
    const np = Math.round((1 - sAdj) * (1 - tie) * 100)
    // s = Gray's draw-no-bet win share; feed it through moneyline() so the Cup
    // line carries the same house vig as the per-match lines (favorite's minus is
    // stronger than the underdog's plus). A tie retains the cup -> treated as a push.
    return { g: gp, n: np, draw: 100 - gp - np, pG: sAdj * (1 - tie), pN: (1 - sAdj) * (1 - tie), s: sAdj }
  }

  const hasMatches = matchProbsAt(null).length > 0
  const cupNow = cupPct(cupProbs(matchProbsAt(null)))

  // History: opening + one point per scored hole (replayed in timestamp order).
  const times = Array.from(
    new Set(rounds.flatMap(r => r.matches.flatMap(m => m.hole_scores.map(h => Date.parse(h.created_at)))))
  ).sort((a, b) => a - b)
  const seriesPts = [0, ...times].map(t => cupPct(cupProbs(matchProbsAt(t))))
  // Single line = Gray's share of the win (0–100, 50 = even).
  const seriesV = seriesPts.map(p => (p.g + p.n > 0 ? (p.g / (p.g + p.n)) * 100 : 50))

  return (
    <>
      <h1 className="text-2xl font-bold text-[#091540] mb-6">Odds</h1>

      {!loading && hasMatches && (
        <div className="bg-[#091540] rounded-2xl shadow-sm px-4 py-3 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">Cup Winner</p>
          {[{ team: gray, line: moneyline(cupNow.s), pct: cupNow.g }, { team: navy, line: moneyline(1 - cupNow.s), pct: cupNow.n }].map((c, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.team?.color ?? '#9ca3af' }} />
                <span className="text-sm font-semibold text-white">{c.team?.name ?? '—'}</span>
              </div>
              <span className="text-sm font-semibold text-[#e8c96a] tabular-nums w-14 text-right">{c.line}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-[#091540]/50 text-sm text-center py-8">Loading odds…</p>
      ) : rounds.every(r => r.matches.length === 0) ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <p className="text-[#091540]/50 text-sm">No matches set yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {rounds.filter(r => r.matches.length > 0).map(round => (
            <div key={round.id}>
              <h2 className="text-sm font-bold text-[#091540] mb-2">{round.name}</h2>
              <div className="flex flex-col gap-3">
                {round.matches.map(match => {
                  const status = calcMatchPlayStatus(match.hole_scores, round.holes)
                  const { rA, rB } = effectiveRatings(match.team1_player_names, match.team2_player_names)
                  const probs = liveProbs(rA, rB, status.holesUp, status.holesRemaining, round.holes)
                  const live = match.status === 'in_progress'
                  const done = status.isComplete || match.status === 'complete'

                  const tag = done ? 'FINAL' : live ? 'LIVE' : 'OPENING LINE'
                  const tagColor = done ? 'text-[#091540]/40' : live ? 'text-red-500' : 'text-[#091540]/40'

                  const line = displayLine(probs.pA, probs.pTie, probs.pB, status.holesRemaining)
                  const denom = line.pAd + line.pBd
                  const sA = denom > 0 ? line.pAd / denom : 0.5
                  const rows = [
                    { side: 'A' as const, name: names(match.team1_player_names), color: colorFor(match.team1_id), share: sA, pctNum: line.aPct, winner: status.winner === 'team1' },
                    { side: 'B' as const, name: names(match.team2_player_names), color: colorFor(match.team2_id), share: 1 - sA, pctNum: line.bPct, winner: status.winner === 'team2' },
                  ]

                  return (
                    <div key={match.id} className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        {live && (
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                          </span>
                        )}
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${tagColor}`}>{tag}</span>
                        {!done && status.holesPlayed > 0 && (
                          <span className="text-[10px] text-[#091540]/40">· {status.resultLabel}</span>
                        )}
                      </div>

                      {rows.map(row => (
                        <div key={row.side} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                            <span className={`text-sm truncate ${row.winner ? 'font-bold text-[#091540]' : 'text-[#091540]'}`}>
                              {row.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {done ? (
                              <span className="text-sm font-semibold text-[#091540]">
                                {row.winner ? 'Won' : status.winner === 'halved' ? 'Tie' : '—'}
                              </span>
                            ) : (
                              <span className="text-sm font-semibold text-[#1a3a2a] tabular-nums w-14 text-right">{moneyline(row.share)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && hasMatches && (
        <div className="bg-white rounded-2xl shadow-sm px-4 py-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#091540]/50">Cup Winner — Live Movement</p>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: gray?.color ?? '#9ca3af' }} />
                <span className="text-[#091540] tabular-nums">{moneyline(cupNow.s)}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: navy?.color ?? '#1e3a8a' }} />
                <span className="text-[#091540] tabular-nums">{moneyline(1 - cupNow.s)}</span>
              </span>
            </div>
          </div>
          <CupChart v={seriesV} grayColor={gray?.color ?? '#9ca3af'} navyColor={navy?.color ?? '#1e3a8a'} />
        </div>
      )}

      {!loading && PROPS.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm mt-6 overflow-hidden">
          <button
            onClick={() => setPropsOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-4"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#091540]/50">Props</p>
            <span
              className={`text-[#091540]/60 text-2xl leading-none transition-transform ${propsOpen ? 'rotate-180' : ''}`}
            >
              ▾
            </span>
          </button>
          {propsOpen && (
            <div className="px-4 pb-4 flex flex-col gap-5">
              {PROPS.map((prop, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold text-[#091540] mb-2">{prop.title}</p>
                  {'yesNo' in prop ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-end gap-4 pb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#091540]/40 w-12 text-right">Yes</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#091540]/40 w-12 text-right">No</span>
                      </div>
                      {prop.yesNo.map((o, j) => (
                        <div key={j} className="flex items-center justify-between py-1 border-b border-[#091540]/5 last:border-0">
                          <span className="text-sm text-[#091540]">{o.label}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-semibold text-[#1a3a2a] tabular-nums w-12 text-right">{o.yes}</span>
                            <span className="text-sm font-semibold text-[#1a3a2a] tabular-nums w-12 text-right">{o.no}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {prop.outcomes.map((o, j) => (
                        <div key={j} className="flex items-center justify-between py-1 border-b border-[#091540]/5 last:border-0">
                          <span className="text-sm text-[#091540]">{o.label}</span>
                          <span className="text-sm font-semibold text-[#1a3a2a] tabular-nums">{o.odds}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
