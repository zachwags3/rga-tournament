'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcMatchPlayStatus } from '@/lib/matchplay'
import { effectiveRatings, liveProbs, displayLine, moneyline, pinnedShare } from '@/lib/odds'
import { computeCup, type MatchWithScores, type RoundWithMatches } from '@/lib/cup'
import CupMovement from './CupMovement'
import type { Round, Match, HoleScore, Team } from '@/types/database'

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
      { label: 'Sean / Jack / Pat', odds: '-140' },
      { label: 'The Field', odds: '+140' },
    ],
  },
  {
    title: 'Lowest Scramble Score (O/U 69.5)',
    outcomes: [
      { label: 'Under 69.5', odds: '-110' },
      { label: 'Over 69.5', odds: '+110' },
    ],
  },
  {
    title: 'Lowest Singles Score',
    outcomes: [
      { label: 'Pat / Jack', odds: '-200' },
      { label: 'The Field', odds: '+200' },
    ],
  },
  {
    title: 'To Drive the Green (Comm Hole 1, 6, 10, 14)',
    yesNo: [
      { label: 'Pat', yes: '-150', no: '+150' },
      { label: 'Sean, Nate, Jack, Mitch', yes: '-120', no: '+120' },
      { label: 'Danny, Zach, Charlie, Sam', yes: '+120', no: '-120' },
      { label: 'Michael, Joe, Henry', yes: '+150', no: '-150' },
    ],
  },
  {
    title: 'Hole 1 Special',
    yesNo: [
      { label: 'At least 1 eagle', yes: '+250', no: '-250' },
      { label: 'At least 1 birdie', yes: '-190', no: '+190' },
      { label: 'No bogeys', yes: '+130', no: '-130' },
    ],
  },
  {
    title: 'Saturday Low Foursome',
    outcomes: [
      { label: 'Zach & Danny / Jack & Sam', odds: '+140' },
      { label: 'Sean & Charlie / Mitch & Joe', odds: '+190' },
      { label: 'Pat & Henry / Nathan & Mike', odds: '+240' },
    ],
  },
  {
    title: 'Earliest Closeout (O/U 14.5 holes)',
    outcomes: [
      { label: 'Under 14.5', odds: '-140' },
      { label: 'Over 14.5', odds: '+140' },
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

  const { gray, navy, hasMatches, cupNow, seriesV, roundMarkers } = computeCup(teams, rounds)

  return (
    <>
      <h1 className="text-2xl font-bold text-[#091540] mb-6">Odds</h1>

      {!loading && hasMatches && (
        <div className="bg-[#091540] rounded-2xl shadow-sm px-4 py-3 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#e8c96a] mb-2">Cup Winner</p>
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

                  // Side A win share. Pinned matchups open at the pin line and then
                  // move symmetrically with the holes (equal-rated movement shifted so
                  // the 0-0 opening equals the pin); others use the rating model.
                  const shareFrom = (p: typeof probs) => {
                    const l = displayLine(p.pA, p.pTie, p.pB, status.holesRemaining)
                    const d = l.pAd + l.pBd
                    return d > 0 ? l.pAd / d : 0.5
                  }
                  const pin = pinnedShare(match.team1_player_names, match.team2_player_names)
                  let sA: number
                  if (pin != null) {
                    const mid = (rA + rB) / 2
                    const eq = liveProbs(mid, mid, status.holesUp, status.holesRemaining, round.holes)
                    sA = Math.min(0.97, Math.max(0.03, shareFrom(eq) + (pin - 0.5)))
                  } else {
                    sA = shareFrom(probs)
                  }
                  const rows = [
                    { side: 'A' as const, name: names(match.team1_player_names), color: colorFor(match.team1_id), share: sA, winner: status.winner === 'team1' },
                    { side: 'B' as const, name: names(match.team2_player_names), color: colorFor(match.team2_id), share: 1 - sA, winner: status.winner === 'team2' },
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
        <CupMovement grayColor={gray?.color ?? '#9ca3af'} cupS={cupNow.s} seriesV={seriesV} markers={roundMarkers} className="mt-6" />
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
