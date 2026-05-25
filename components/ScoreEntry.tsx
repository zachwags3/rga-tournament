'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { calcMatchPlayStatus, holeWinner, calcRgaPoints } from '@/lib/matchplay'
import type { Match, Round, HoleScore, Team } from '@/types/database'

type Props = { matchId: string }

export default function ScoreEntry({ matchId }: Props) {
  const router = useRouter()
  const [match, setMatch] = useState<Match | null>(null)
  const [round, setRound] = useState<Round | null>(null)
  const [holeScores, setHoleScores] = useState<HoleScore[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [localScores, setLocalScores] = useState<Record<number, { t1: string; t2: string }>>({})
  const [pars, setPars] = useState<Record<number, number>>({}) // hole_number -> par

  const fetchData = useCallback(async () => {
    const [matchRes, scoresRes, teamsRes] = await Promise.all([
      supabase.from('matches').select('*').eq('id', matchId).single(),
      supabase.from('hole_scores').select('*').eq('match_id', matchId).order('hole_number'),
      supabase.from('teams').select('*').order('created_at'),
    ])
    if (matchRes.data) {
      setMatch(matchRes.data)
      const roundRes = await supabase.from('rounds').select('*').eq('id', matchRes.data.round_id).single()
      if (roundRes.data) {
        setRound(roundRes.data)
        // Load par data for this round's course
        const courseRes = await supabase.from('courses').select('*').eq('round_id', matchRes.data.round_id).single()
        if (courseRes.data) {
          const holesRes = await supabase.from('course_holes').select('*').eq('course_id', courseRes.data.id)
          if (holesRes.data) {
            const parsMap: Record<number, number> = {}
            holesRes.data.forEach((h: { hole_number: number; par: number }) => { parsMap[h.hole_number] = h.par })
            setPars(parsMap)
          }
        }
      }
    }
    if (scoresRes.data) setHoleScores(scoresRes.data)
    if (teamsRes.data) setTeams(teamsRes.data)
    setLoading(false)
  }, [matchId])

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel(`match-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_scores', filter: `match_id=eq.${matchId}` }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [matchId, fetchData])

  // Sync local input state from DB scores
  useEffect(() => {
    const init: Record<number, { t1: string; t2: string }> = {}
    holeScores.forEach(s => {
      init[s.hole_number] = {
        t1: s.team1_score?.toString() ?? '',
        t2: s.team2_score?.toString() ?? '',
      }
    })
    setLocalScores(init)
  }, [holeScores])

  async function saveHole(holeNumber: number, t1Raw: string, t2Raw: string) {
    const t1 = parseInt(t1Raw)
    const t2 = parseInt(t2Raw)
    if (isNaN(t1) || isNaN(t2) || t1 <= 0 || t2 <= 0) return

    const winner = holeWinner(t1, t2)
    setSaving(true)

    await supabase.from('hole_scores').upsert({
      match_id: matchId,
      hole_number: holeNumber,
      team1_score: t1,
      team2_score: t2,
      winner,
    }, { onConflict: 'match_id,hole_number' })

    // If match was pending, mark as in_progress
    if (match?.status === 'pending') {
      await supabase.from('matches').update({ status: 'in_progress' }).eq('id', matchId)
    }

    await fetchData()
    setSaving(false)
  }

  async function finalizeMatch() {
    if (!round) return
    const allScores = holeScores.filter(s => s.winner != null)
    const status = calcMatchPlayStatus(allScores, round.holes)

    if (!status.isComplete) {
      const confirmed = window.confirm(
        `Only ${status.holesPlayed} of ${round.holes} holes are scored. The match will be decided by current standing (${status.resultLabel}). Finalize anyway?`
      )
      if (!confirmed) return
    }

    const pts = calcRgaPoints(status.winner)
    let result: 'team1_win' | 'team2_win' | 'halved' = 'halved'
    if (status.winner === 'team1') result = 'team1_win'
    else if (status.winner === 'team2') result = 'team2_win'

    setSaving(true)
    await supabase.from('matches').update({
      status: 'complete',
      result,
      rga_points_team1: pts.team1,
      rga_points_team2: pts.team2,
    }).eq('id', matchId)

    setSaving(false)
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[#2d5a3d]">Loading...</p>
      </div>
    )
  }

  if (!match || !round) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center">
          <p className="text-gray-500">Match not found.</p>
          <Link href="/" className="text-[#2d5a3d] font-semibold mt-2 inline-block">← Back</Link>
        </div>
      </div>
    )
  }

  const team1 = teams.find(t => t.id === match.team1_id)
  const team2 = teams.find(t => t.id === match.team2_id)
  const mpStatus = calcMatchPlayStatus(holeScores, round.holes)

  const scoredHoles = holeScores.filter(h => h.winner !== null).length
  const isComplete = match.status === 'complete'
  const isReadOnly = isComplete && !isEditing

  return (
    <div className="max-w-lg mx-auto px-4 pb-16">
      {/* Match header */}
      <div className="bg-[#1a3a2a] rounded-2xl p-4 mb-5 shadow-lg">
        <div className="text-[#c9a84c] text-xs font-semibold tracking-widest uppercase mb-3 text-center">
          {round.name}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <div className="text-[10px] text-white/50 mb-1">{team1?.name ?? 'Team 1'}</div>
            <div className="text-white font-bold text-sm leading-tight">
              {match.team1_player_names.join('\n& ')}
            </div>
          </div>
          <div className="px-4 text-white/30 text-xl">vs</div>
          <div className="flex-1 text-center">
            <div className="text-[10px] text-white/50 mb-1">{team2?.name ?? 'Team 2'}</div>
            <div className="text-white font-bold text-sm leading-tight">
              {match.team2_player_names.join('\n& ')}
            </div>
          </div>
        </div>

        {/* Live match play status */}
        {scoredHoles > 0 && (
          <div className={`mt-4 text-center py-2.5 rounded-xl ${
            mpStatus.isComplete ? 'bg-[#c9a84c]/20' : 'bg-white/10'
          }`}>
            <span className="text-white font-bold text-lg">{mpStatus.resultLabel}</span>
            {!mpStatus.isComplete && (
              <span className="text-white/50 text-xs ml-2">thru {mpStatus.holesPlayed}</span>
            )}
          </div>
        )}
      </div>

      {isComplete && !isEditing && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-center text-sm text-green-700 font-medium">
          ✅ Match complete — viewing scorecard
        </div>
      )}
      {isComplete && isEditing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-center text-sm text-amber-700 font-medium">
          ✏️ Editing scores — re-finalize when done
        </div>
      )}

      {/* Score format hint */}
      <div className="text-xs text-gray-400 mb-3 px-1">
        <span className="font-semibold text-gray-500">Format:</span>{' '}
        {round.format === 'scramble' && '2v2 Scramble — enter the pair\'s gross score per hole'}
        {round.format === 'shamble' && 'Shamble — enter the lowest individual score per pair'}
        {round.format === 'singles' && '1v1 Singles — enter each player\'s gross score'}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[2rem_2rem_1fr_1fr_2.5rem] gap-1.5 mb-2 px-1 items-center">
        <div className="text-center text-xs text-gray-400 font-medium">Hole</div>
        <div className="text-center text-xs text-gray-400 font-medium">Par</div>
        <div className="text-center leading-tight">
          {match.team1_player_names.map((name, i) => (
            <div key={i} className="text-xs text-[#2d5a3d] font-semibold">{name.split(' ')[0]}</div>
          ))}
        </div>
        <div className="text-center leading-tight">
          {match.team2_player_names.map((name, i) => (
            <div key={i} className="text-xs text-[#c9a84c] font-semibold">{name.split(' ')[0]}</div>
          ))}
        </div>
        <div className="text-center text-xs text-gray-400 font-medium">Win</div>
      </div>

      {/* Hole rows */}
      <div className="space-y-1.5">
        {Array.from({ length: round.holes }, (_, i) => i + 1).map(hole => {
          const saved = holeScores.find(h => h.hole_number === hole)
          const local = localScores[hole] ?? { t1: '', t2: '' }
          const par = pars[hole] ?? null

          return (
            <HoleRow
              key={hole}
              hole={hole}
              par={par}
              local={local}
              saved={saved}
              isReadOnly={isReadOnly}
              onChange={(t1, t2) => {
                setLocalScores(prev => ({ ...prev, [hole]: { t1, t2 } }))
              }}
              onBlur={(t1, t2) => saveHole(hole, t1, t2)}
            />
          )
        })}
      </div>

      {/* Totals row */}
      {(() => {
        const totalPar = Object.values(pars).reduce((s, p) => s + p, 0)
        const t1Total = holeScores.reduce((s, h) => s + (h.team1_score ?? 0), 0)
        const t2Total = holeScores.reduce((s, h) => s + (h.team2_score ?? 0), 0)
        if (t1Total === 0 && t2Total === 0) return null
        return (
          <div className="grid grid-cols-[2rem_2rem_1fr_1fr_2.5rem] gap-1.5 items-center px-3 py-2.5 mt-1 rounded-xl border border-gray-200 bg-gray-50">
            <div className="text-center text-sm font-bold text-gray-600">T</div>
            <div className="text-center text-sm font-semibold text-gray-500">{totalPar || '—'}</div>
            <div className="flex justify-center">
              <div className="w-12 text-center text-lg font-bold py-2 rounded-lg border border-gray-300 bg-white text-[#1a3a2a]">
                {t1Total}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="w-12 text-center text-lg font-bold py-2 rounded-lg border border-gray-300 bg-white text-[#1a3a2a]">
                {t2Total}
              </div>
            </div>
            <div />
          </div>
        )
      })()}

      {/* Finalize / Edit buttons */}
      <div className="mt-6 space-y-3">
        {/* Active scoring or re-editing: show finalize */}
        {(!isComplete || isEditing) && (
          <>
            <button
              onClick={finalizeMatch}
              disabled={saving || scoredHoles === 0}
              className="w-full bg-[#2d5a3d] text-white py-4 rounded-xl font-bold text-base disabled:opacity-40 hover:bg-[#1a3a2a] transition-colors shadow-lg"
            >
              {saving ? 'Saving...' : '🏁 Finalize Match & Record Points'}
            </button>
            {scoredHoles > 0 && (
              <p className="text-center text-xs text-gray-400">
                {scoredHoles} of {round.holes} holes scored
              </p>
            )}
            {isEditing && (
              <button
                onClick={() => setIsEditing(false)}
                className="w-full border border-gray-300 text-gray-500 py-3 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel Edit
              </button>
            )}
          </>
        )}

        {/* Complete and not editing: show Edit + Back */}
        {isComplete && !isEditing && (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="w-full border-2 border-[#2d5a3d] text-[#2d5a3d] py-3.5 rounded-xl font-bold text-base hover:bg-[#2d5a3d]/5 transition-colors"
            >
              ✏️ Edit Scores
            </button>
            <Link href="/" className="block w-full text-center bg-[#1a3a2a] text-white py-4 rounded-xl font-bold text-base">
              ← Back to Leaderboard
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

function scoreInputClasses(score: number | null, par: number | null, isWinner: boolean, team: 'green' | 'gold'): string {
  const base = 'w-12 text-center text-lg font-bold py-2 outline-none transition-all disabled:opacity-60 focus:bg-white'

  if (score && par && score > 0) {
    const diff = score - par
    if (diff <= -2) return `${base} rounded-full border-2 border-red-500 bg-white text-[#1a3a2a]`
    if (diff === -1) return `${base} rounded-full border-2 border-red-500 bg-white text-[#1a3a2a]`
    if (diff === 0)  return `${base} rounded-lg  border   border-gray-200 bg-gray-50 text-[#1a3a2a]`
    if (diff === 1)  return `${base} rounded-[3px] border-2 border-gray-700 bg-gray-50 text-[#1a3a2a]`
    /* double bogey+ */
    return               `${base} rounded-[3px] border-2 border-gray-700 bg-gray-50 text-[#1a3a2a]`
  }

  // No par data — fall back to winner highlight
  if (isWinner) {
    return team === 'green'
      ? `${base} rounded-lg border border-[#2d5a3d] bg-[#2d5a3d]/10 text-[#2d5a3d]`
      : `${base} rounded-lg border border-[#c9a84c] bg-[#c9a84c]/10 text-[#c9a84c]`
  }
  return `${base} rounded-lg border border-gray-200 bg-gray-50 text-[#1a3a2a]`
}

function scoreInputStyle(score: number | null, par: number | null): React.CSSProperties {
  if (!score || !par || score <= 0) return {}
  const diff = score - par
  // Double circle for eagle: inner border + outer ring via box-shadow
  if (diff <= -2) return { boxShadow: '0 0 0 3px white, 0 0 0 5px #ef4444' }
  // Double square for double bogey+
  if (diff >= 2)  return { boxShadow: '0 0 0 3px white, 0 0 0 5px #374151' }
  return {}
}

function HoleRow({
  hole, par, local, saved, isReadOnly, onChange, onBlur
}: {
  hole: number
  par: number | null
  local: { t1: string; t2: string }
  saved?: HoleScore
  isReadOnly: boolean
  onChange: (t1: string, t2: string) => void
  onBlur: (t1: string, t2: string) => void
}) {
  const winner = saved?.winner
  const rowBg = winner === 'team1' ? 'bg-[#2d5a3d]/8 border-[#2d5a3d]/20'
    : winner === 'team2' ? 'bg-[#c9a84c]/8 border-[#c9a84c]/20'
    : winner === 'halved' ? 'bg-gray-50 border-gray-200'
    : 'bg-white border-gray-100'

  const winnerIcon = winner === 'team1' ? '🟢' : winner === 'team2' ? '🟡' : winner === 'halved' ? '—' : ''
  const t1Score = saved?.team1_score ?? null
  const t2Score = saved?.team2_score ?? null

  return (
    <div className={`grid grid-cols-[2rem_2rem_1fr_1fr_2.5rem] gap-1.5 items-center px-3 py-2.5 rounded-xl border ${rowBg} transition-colors`}>
      {/* Hole # */}
      <div className="text-center text-sm font-bold text-gray-500">{hole}</div>

      {/* Par */}
      <div className="text-center text-sm font-semibold text-gray-400">{par ?? '—'}</div>

      {/* Team 1 score */}
      <div className="flex justify-center">
        <input
          type="number"
          min="1"
          max="15"
          inputMode="numeric"
          value={local.t1}
          disabled={isReadOnly}
          onChange={e => onChange(e.target.value, local.t2)}
          onBlur={e => onBlur(e.target.value, local.t2)}
          className={scoreInputClasses(t1Score, par, winner === 'team1', 'green')}
          style={scoreInputStyle(t1Score, par)}
          placeholder="—"
        />
      </div>

      {/* Team 2 score */}
      <div className="flex justify-center">
        <input
          type="number"
          min="1"
          max="15"
          inputMode="numeric"
          value={local.t2}
          disabled={isReadOnly}
          onChange={e => onChange(local.t1, e.target.value)}
          onBlur={e => onBlur(local.t1, e.target.value)}
          className={scoreInputClasses(t2Score, par, winner === 'team2', 'gold')}
          style={scoreInputStyle(t2Score, par)}
          placeholder="—"
        />
      </div>

      <div className="text-center text-base">{winnerIcon}</div>
    </div>
  )
}
