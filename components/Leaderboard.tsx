'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { calcMatchPlayStatus, calcRgaPoints } from '@/lib/matchplay'
import type { Round, Match, HoleScore, Team } from '@/types/database'

type MatchWithScores = Match & { hole_scores: HoleScore[] }
type RoundWithMatches = Round & { matches: MatchWithScores[]; courseName: string | null }

export default function Leaderboard() {
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
      supabase.from('courses').select('id,name,round_id'),
    ])
    const result = await Promise.race([fetches, timeout])
    if (!result) { setLoading(false); return }
    const [teamsRes, roundsRes, matchesRes, scoresRes, coursesRes] = result

    const teamsData: Team[] = teamsRes.data ?? []
    const roundsData: Round[] = roundsRes.data ?? []
    const matchesData: Match[] = matchesRes.data ?? []
    const scoresData: HoleScore[] = scoresRes.data ?? []
    const coursesData: { id: string; name: string; round_id: string }[] = coursesRes.data ?? []

    const matchesWithScores: MatchWithScores[] = matchesData.map(m => ({
      ...m,
      hole_scores: scoresData.filter(s => s.match_id === m.id),
    }))

    const roundsWithMatches: RoundWithMatches[] = roundsData.map(r => ({
      ...r,
      matches: matchesWithScores.filter(m => m.round_id === r.id),
      courseName: coursesData.find(c => c.round_id === r.id)?.name ?? null,
    }))

    setTeams(teamsData)
    setRounds(roundsWithMatches)
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()

    const channel = supabase
      .channel('leaderboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_scores' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, fetchAll)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Calculate overall RGA points per team (complete = finalized, in_progress = live tentative)
  const teamPoints: Record<string, number> = {}
  teams.forEach(t => { teamPoints[t.id] = 0 })
  rounds.forEach(r =>
    r.matches.forEach(m => {
      if (m.status === 'complete') {
        if (m.team1_id) teamPoints[m.team1_id] = (teamPoints[m.team1_id] ?? 0) + Number(m.rga_points_team1)
        if (m.team2_id) teamPoints[m.team2_id] = (teamPoints[m.team2_id] ?? 0) + Number(m.rga_points_team2)
      } else if (m.status === 'in_progress') {
        const liveStatus = calcMatchPlayStatus(m.hole_scores, r.holes)
        if (liveStatus.holesPlayed > 0) {
          const tentativeWinner = liveStatus.holesUp > 0 ? 'team1'
            : liveStatus.holesUp < 0 ? 'team2'
            : 'halved'
          const pts = calcRgaPoints(tentativeWinner)
          if (m.team1_id) teamPoints[m.team1_id] = (teamPoints[m.team1_id] ?? 0) + pts.team1
          if (m.team2_id) teamPoints[m.team2_id] = (teamPoints[m.team2_id] ?? 0) + pts.team2
        }
      }
    })
  )

  // Count total holes won per team across all matches (live, not just complete)
  let holesWon1 = 0
  let holesWon2 = 0
  rounds.forEach(r =>
    r.matches.forEach(m =>
      m.hole_scores.forEach(h => {
        if (h.winner === 'team1') holesWon1++
        else if (h.winner === 'team2') holesWon2++
      })
    )
  )

  const team1 = teams[0]
  const team2 = teams[1]
  const pts1 = team1 ? (teamPoints[team1.id] ?? 0) : 0
  const pts2 = team2 ? (teamPoints[team2.id] ?? 0) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-3">⛳</div>
          <p className="text-[#2d5a3d] font-semibold">Loading leaderboard...</p>
        </div>
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full">
          <div className="text-5xl mb-4">⛳</div>
          <h2 className="text-xl font-bold text-[#1a3a2a] mb-2">Tournament not set up yet</h2>
          <p className="text-gray-500 text-sm mb-6">
            An admin needs to configure teams and pairings before scores can be tracked.
          </p>
          <Link href="/admin" className="inline-block bg-[#2d5a3d] text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-[#1a3a2a] transition-colors">
            Go to Admin Setup →
          </Link>
        </div>
      </div>
    )
  }

  const borderColor = pts1 > pts2 ? (team1?.color ?? '#e5e7eb')
    : pts2 > pts1 ? (team2?.color ?? '#e5e7eb')
    : '#e5e7eb'

  // Lighter variants of team colors for readability on dark navy background
  const cardColor1 = '#a8b4c4'  // lighter gray
  const cardColor2 = '#6b8fe0'  // lighter navy blue

  return (
    <div className="max-w-2xl mx-auto px-4 pb-12">
      {/* Overall scoreboard */}
      <div className="bg-[#091540] rounded-2xl overflow-hidden shadow-sm mb-6 border-[5px]" style={{ borderColor }}>
        <div className="px-5 pt-5 pb-3 text-center">
          <p className="text-white text-sm font-semibold tracking-widest uppercase mb-1">Inaugural RGA Cup · 2026</p>
        </div>
        <div className="flex items-stretch">
          {/* Team 1 */}
          <div className="flex-1 flex flex-col items-center justify-center py-6"
            style={pts1 > pts2 ? { backgroundColor: 'rgba(255,255,255,0.08)' } : {}}>
            <div className="text-5xl font-bold text-white mb-1">{pts1 % 1 === 0 ? pts1 : pts1.toFixed(1)}</div>
            <div className="text-sm font-semibold" style={{ color: cardColor1 }}>{team1?.name ?? 'Team 1'}</div>
            <div className="text-white/50 text-xs mt-1">Capt. {team1?.captain_name}</div>
            <div className="text-xs mt-0.5" style={{ color: cardColor1 }}>{holesWon1} holes won</div>
          </div>
          {/* Divider */}
          <div className="flex items-center justify-center px-4">
            <div className="text-white/20 text-2xl font-light">–</div>
          </div>
          {/* Team 2 */}
          <div className="flex-1 flex flex-col items-center justify-center py-6"
            style={pts2 > pts1 ? { backgroundColor: 'rgba(255,255,255,0.08)' } : {}}>
            <div className="text-5xl font-bold text-white mb-1">{pts2 % 1 === 0 ? pts2 : pts2.toFixed(1)}</div>
            <div className="text-sm font-semibold" style={{ color: cardColor2 }}>{team2?.name ?? 'Team 2'}</div>
            <div className="text-white/50 text-xs mt-1">Capt. {team2?.captain_name}</div>
            <div className="text-xs mt-0.5" style={{ color: cardColor2 }}>{holesWon2} holes won</div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-white/10 text-center">
          <p className="text-white/30 text-xs">Need 6.5 pts to win</p>
        </div>
      </div>

      {/* Individual stats */}
      <IndividualStats rounds={rounds} teams={teams} />

      {/* Rounds */}
      {rounds.map(round => (
        <RoundSection key={round.id} round={round} team1={team1} team2={team2} />
      ))}
    </div>
  )
}

type PersonStat = {
  name: string
  color: string
  total: number
  hasScores: boolean
  byRound: (number | null)[] // [Sat AM, Sat PM, Sun]
  w: number
  l: number
  t: number
}

// Per-player totals: strokes are a player's side score in their match each round
// (one match per round), summed across rounds; W-L-T from completed match results.
function computeIndividualStats(rounds: RoundWithMatches[], teams: Team[]): PersonStat[] {
  const ordered = [...rounds].sort((a, b) => a.sort_order - b.sort_order)
  const roundIndex = new Map<string, number>()
  ordered.slice(0, 3).forEach((r, i) => roundIndex.set(r.id, i))

  const stats = new Map<string, PersonStat>()
  const ensure = (name: string): PersonStat => {
    const key = name.toLowerCase()
    let s = stats.get(key)
    if (!s) {
      s = { name, color: '#9ca3af', total: 0, hasScores: false, byRound: [null, null, null], w: 0, l: 0, t: 0 }
      stats.set(key, s)
    }
    return s
  }

  for (const round of rounds) {
    const ri = roundIndex.get(round.id)
    for (const m of round.matches) {
      const sides = [
        { names: m.team1_player_names ?? [], teamId: m.team1_id, isTeam1: true },
        { names: m.team2_player_names ?? [], teamId: m.team2_id, isTeam1: false },
      ]
      for (const side of sides) {
        let strokes = 0
        let any = false
        for (const h of m.hole_scores) {
          const v = side.isTeam1 ? h.team1_score : h.team2_score
          if (v != null) { strokes += v; any = true }
        }
        const color = teams.find(t => t.id === side.teamId)?.color ?? '#9ca3af'
        let outcome: 'w' | 'l' | 't' | null = null
        if (m.status === 'complete' && m.result) {
          if (m.result === 'halved') outcome = 't'
          else outcome = (m.result === 'team1_win') === side.isTeam1 ? 'w' : 'l'
        }
        for (const rawName of side.names) {
          const name = rawName.trim()
          if (!name) continue
          const s = ensure(name)
          s.color = color
          if (ri != null && any) {
            s.byRound[ri] = (s.byRound[ri] ?? 0) + strokes
            s.total += strokes
            s.hasScores = true
          }
          if (outcome === 'w') s.w++
          else if (outcome === 'l') s.l++
          else if (outcome === 't') s.t++
        }
      }
    }
  }

  return [...stats.values()].sort((a, b) => {
    if (a.hasScores !== b.hasScores) return a.hasScores ? -1 : 1
    if (a.hasScores && b.hasScores) return a.total - b.total
    return a.name.localeCompare(b.name)
  })
}

function IndividualStats({ rounds, teams }: { rounds: RoundWithMatches[]; teams: Team[] }) {
  const stats = computeIndividualStats(rounds, teams)
  if (stats.length === 0) return null
  const cell = (n: number | null) => (n == null ? '–' : n)

  return (
    <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-[#1a3a2a] font-bold text-base">Individual Stats</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
              <th className="text-left font-semibold px-4 py-2">Player</th>
              <th className="text-right font-semibold px-2 py-2">Total</th>
              <th className="text-right font-semibold px-2 py-2 whitespace-nowrap">W/L</th>
              <th className="text-right font-semibold px-2 py-2 whitespace-nowrap">Sat AM</th>
              <th className="text-right font-semibold px-2 py-2 whitespace-nowrap">Sat PM</th>
              <th className="text-right font-semibold px-4 py-2">Sun</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(s => (
              <tr key={s.name} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="font-medium text-[#1a3a2a] capitalize">{s.name}</span>
                  </div>
                </td>
                <td className="text-right px-2 py-2 font-semibold tabular-nums text-[#1a3a2a]">{s.hasScores ? s.total : '–'}</td>
                <td className="text-right px-2 py-2 tabular-nums text-gray-600">{s.w}-{s.l}-{s.t}</td>
                <td className="text-right px-2 py-2 tabular-nums text-gray-600">{cell(s.byRound[0])}</td>
                <td className="text-right px-2 py-2 tabular-nums text-gray-600">{cell(s.byRound[1])}</td>
                <td className="text-right px-4 py-2 tabular-nums text-gray-600">{cell(s.byRound[2])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RoundSection({ round, team1, team2 }: { round: RoundWithMatches; team1?: Team; team2?: Team }) {
  const hasMatches = round.matches.length > 0
  const roundPts1 = round.matches.reduce((sum, m) => sum + (m.status === 'complete' ? Number(m.rga_points_team1) : 0), 0)
  const roundPts2 = round.matches.reduce((sum, m) => sum + (m.status === 'complete' ? Number(m.rga_points_team2) : 0), 0)

  return (
    <div className="mb-5">
      <div className="flex items-start justify-between mb-2 px-1">
        <div className="flex-1 min-w-0 mr-3">
          <h2 className="text-[#1a3a2a] font-bold text-base">{round.name}</h2>
          <p className="text-gray-400 text-xs">
            {round.holes} holes · {round.points_available} RGA pts available
            {round.courseName && <> · <span className="text-gray-400">@ {round.courseName}</span></>}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-sm font-semibold whitespace-nowrap">
            <span style={{ color: team1?.color }}>{roundPts1.toFixed(roundPts1 % 1 === 0 ? 0 : 1)}</span>
            <span className="text-gray-900"> – </span>
            <span style={{ color: team2?.color }}>{roundPts2.toFixed(roundPts2 % 1 === 0 ? 0 : 1)}</span>
          </span>
        </div>
      </div>

      {!hasMatches ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center text-gray-400 text-sm">
          Pairings not set yet
        </div>
      ) : (
        <div className="space-y-3">
          {round.matches.map(match => (
            <MatchCard key={match.id} match={match} round={round} team1={team1} team2={team2} />
          ))}
        </div>
      )}
    </div>
  )
}

function MatchCard({ match, round, team1, team2 }: {
  match: MatchWithScores
  round: Round
  team1?: Team
  team2?: Team
}) {
  const status = calcMatchPlayStatus(match.hole_scores, round.holes)
  const isComplete = match.status === 'complete'

  let statusColor = 'bg-gray-100 text-gray-500'
  let statusDot = 'bg-gray-300'
  if (match.status === 'in_progress') {
    statusColor = 'bg-blue-50 text-blue-600'
    statusDot = 'bg-blue-500 animate-pulse'
  } else if (isComplete) {
    statusColor = 'bg-green-50 text-green-700'
    statusDot = 'bg-green-500'
  }

  const leadingTeam = status.holesUp > 0 ? team1 : status.holesUp < 0 ? team2 : null
  const isAS = status.holesUp === 0 && status.holesPlayed > 0

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4">
        {/* Players */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-0.5" style={{ color: team1?.color }}>
              {team1?.name ?? 'Team 1'}
            </div>
            <div className="font-semibold text-sm leading-tight" style={{ color: team1?.color }}>
              {match.team1_player_names.join(' & ')}
            </div>
          </div>
          <div className="px-2 flex flex-col items-center justify-center gap-0.5">
            {status.holesPlayed === 0 ? (
              <span className="text-gray-300 font-light text-sm">vs</span>
            ) : status.holesUp > 0 ? (
              <span className="text-2xl font-bold leading-none" style={{ color: team1?.color }}>◀</span>
            ) : status.holesUp < 0 ? (
              <span className="text-2xl font-bold leading-none" style={{ color: team2?.color }}>▶</span>
            ) : (
              // All square
              <span className="text-gray-400 text-xs font-semibold tracking-tight">A/S</span>
            )}
          </div>
          <div className="flex-1 text-right">
            <div className="text-xs text-gray-400 mb-0.5" style={{ color: team2?.color }}>
              {team2?.name ?? 'Team 2'}
            </div>
            <div className="font-semibold text-sm leading-tight" style={{ color: team2?.color }}>
              {match.team2_player_names.join(' & ')}
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            {match.status === 'pending' ? 'Not started' : match.status === 'in_progress' ? 'In progress' : 'Complete'}
          </div>

          {status.holesPlayed > 0 && (
            <div className="text-right">
              {isComplete || isAS ? (
                <span
                  className="font-bold text-sm"
                  style={{ color: isAS ? undefined : leadingTeam?.color ?? undefined }}
                >
                  {status.resultLabel}
                </span>
              ) : (
                <span
                  className="font-bold text-sm"
                  style={{ color: leadingTeam?.color }}
                >
                  {status.resultLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Hole progress bar */}
        {status.holesPlayed > 0 && (
          <div className="mt-3">
            <div className="flex gap-2 flex-wrap justify-center">
              {Array.from({ length: round.holes }).map((_, i) => {
                const holeScore = match.hole_scores.find(h => h.hole_number === i + 1)
                const bgColor = holeScore?.winner === 'team1' ? team1?.color
                  : holeScore?.winner === 'team2' ? team2?.color
                  : holeScore?.winner === 'halved' ? '#f59e0b55'
                  : '#e5e7eb'
                const textColor = holeScore?.winner === 'team1' || holeScore?.winner === 'team2' ? '#fff'
                  : holeScore?.winner === 'halved' ? '#92620a'
                  : '#9ca3af'
                return (
                  <div
                    key={i}
                    className="flex items-center justify-center rounded text-[9px] font-semibold transition-colors"
                    style={{ backgroundColor: bgColor, color: textColor, width: 26, height: 26 }}
                  >
                    {i + 1}
                  </div>
                )
              })}
            </div>
            <div className="mt-1 text-[10px] text-gray-400 text-center">
              {status.holesPlayed} / {round.holes} played
            </div>
          </div>
        )}
      </div>

      {/* Score entry button */}
      <Link
        href={`/score/${match.id}`}
        className="flex items-center justify-center gap-1 py-2.5 bg-[#f5f2eb] hover:bg-[#ede8dc] transition-colors border-t border-gray-100 text-sm font-medium text-[#1e3a8a]"
      >
        {match.status === 'pending' ? '▶ Start & Enter Scores' : match.status === 'in_progress' ? '✏️ Update Scores' : '📋 View Scorecard'}
      </Link>
    </div>
  )
}
