'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcMatchPlayStatus } from '@/lib/matchplay'
import { effectiveRatings, matchWinProbs, displayLine, toAmerican } from '@/lib/odds'
import type { Round, Match, HoleScore, Team } from '@/types/database'

type MatchWithScores = Match & { hole_scores: HoleScore[] }
type RoundWithMatches = Round & { matches: MatchWithScores[] }

function names(arr: string[]): string {
  if (!arr || arr.length === 0) return 'TBD'
  return arr.join(' & ')
}

export default function Odds() {
  const [teams, setTeams] = useState<Team[]>([])
  const [rounds, setRounds] = useState<RoundWithMatches[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <>
      <h1 className="text-2xl font-bold text-[#091540] mb-1">Odds</h1>
      <p className="text-[#091540]/50 text-xs mb-6">
        Live win odds — model estimate, for entertainment only.
      </p>

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
                  const probs = matchWinProbs(rA, rB, status.holesUp, status.holesRemaining)
                  const live = match.status === 'in_progress'
                  const done = status.isComplete || match.status === 'complete'

                  const tag = done ? 'FINAL' : live ? 'LIVE' : 'OPENING LINE'
                  const tagColor = done ? 'text-[#091540]/40' : live ? 'text-red-500' : 'text-[#091540]/40'

                  // Three-way: two sides + a small split, all summing to 100%.
                  const line = displayLine(probs.pA, probs.pTie, probs.pB)
                  const rows = [
                    { side: 'A' as const, name: names(match.team1_player_names), color: colorFor(match.team1_id), p: line.pAd, pctNum: line.aPct, winner: status.winner === 'team1' },
                    { side: 'B' as const, name: names(match.team2_player_names), color: colorFor(match.team2_id), p: line.pBd, pctNum: line.bPct, winner: status.winner === 'team2' },
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
                              <>
                                <span className="text-sm font-bold text-[#091540] tabular-nums w-10 text-right">{row.pctNum}%</span>
                                <span className="text-sm font-semibold text-[#1a3a2a] tabular-nums w-14 text-right">{toAmerican(row.p)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}

                      {!done && line.tiePct > 0 && (
                        <p className="text-[11px] text-[#091540]/40 mt-1">Split {line.tiePct}%</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
