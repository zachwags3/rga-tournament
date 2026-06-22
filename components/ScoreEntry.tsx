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
  const team1Color = team1?.color ?? '#6b7280'
  const team2Color = team2?.color ?? '#1e3a8a'
  const mpStatus = calcMatchPlayStatus(holeScores, round.holes)

  const scoredHoles = holeScores.filter(h => h.winner !== null).length
  const isComplete = match.status === 'complete'
  const isReadOnly = isComplete && !isEditing

  return (
    <div className="max-w-lg mx-auto px-4 pb-16">
      {/* Match header */}
      <div className="bg-[#091540] rounded-2xl p-4 mb-5 shadow-lg">
        <div className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-3 text-center">
          {round.name}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <div className="text-[10px] text-white/50 mb-1">{team1?.name ?? 'Team 1'}</div>
            <div className="text-white font-bold text-sm leading-tight">
              {match.team1_player_names.join('\n& ')}
            </div>
          </div>
          <div className="px-3 flex flex-col items-center justify-center gap-0.5">
            {scoredHoles === 0 ? (
              <span className="text-white/30 text-sm font-light">vs</span>
            ) : mpStatus.holesUp > 0 ? (
              <span className="text-3xl font-bold leading-none" style={{ color: team1?.color, WebkitTextStroke: '1.5px white' }}>◀</span>
            ) : mpStatus.holesUp < 0 ? (
              <span className="text-3xl font-bold leading-none" style={{ color: team2?.color, WebkitTextStroke: '1.5px white' }}>▶</span>
            ) : (
              <span className="text-white/50 text-xs font-semibold">A/S</span>
            )}
          </div>
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
            mpStatus.isComplete ? 'bg-white/20' : 'bg-white/10'
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
            <div key={i} className="text-xs font-semibold" style={{ color: team1?.color }}>{name.split(' ')[0]}</div>
          ))}
        </div>
        <div className="text-center leading-tight">
          {match.team2_player_names.map((name, i) => (
            <div key={i} className="text-xs font-semibold" style={{ color: team2?.color }}>{name.split(' ')[0]}</div>
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
              team1Color={team1Color}
              team2Color={team2Color}
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
              className="w-full bg-[#091540] text-white py-4 rounded-xl font-bold text-base disabled:opacity-40 hover:bg-[#060e2e] transition-colors shadow-lg"
            >
              {saving ? 'Saving...' : 'Finalize Match & Record Points'}
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
              className="w-full border-2 border-[#091540] text-[#091540] py-3.5 rounded-xl font-bold text-base hover:bg-[#091540]/5 transition-colors"
            >
              ✏️ Edit Scores
            </button>
            <Link href="/" className="block w-full text-center bg-[#091540] text-white py-4 rounded-xl font-bold text-base">
              ← Back to Leaderboard
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

function scoreInputClasses(score: number | null, par: number | null): string {
  const base = 'w-12 text-center text-lg font-bold py-2 outline-none transition-all disabled:opacity-60 focus:bg-white'

  if (score && par && score > 0) {
    const diff = score - par
    if (diff <= -2) return `${base} rounded-full border-2 border-red-500 bg-white text-[#1a3a2a]`
    if (diff === -1) return `${base} rounded-full border-2 border-red-500 bg-white text-[#1a3a2a]`
    if (diff === 0)  return `${base} rounded-lg  border   border-gray-200 bg-gray-50 text-[#1a3a2a]`
    if (diff === 1)  return `${base} rounded-[3px] border-2 border-gray-700 bg-gray-50 text-[#1a3a2a]`
    return               `${base} rounded-[3px] border-2 border-gray-700 bg-gray-50 text-[#1a3a2a]`
  }

  return `${base} rounded-lg border border-gray-200 bg-gray-50 text-[#1a3a2a]`
}

function scoreInputStyle(
  score: number | null,
  par: number | null,
  isWinner: boolean,
  teamColor: string,
): React.CSSProperties {
  if (score && par && score > 0) {
    const diff = score - par
    if (diff <= -2) return { boxShadow: '0 0 0 3px white, 0 0 0 5px #ef4444' }
    if (diff >= 2)  return { boxShadow: '0 0 0 3px white, 0 0 0 5px #374151' }
    return {}
  }
  // No par data — winner highlight with team color
  if (isWinner) return { borderColor: teamColor, backgroundColor: teamColor + '1a', color: teamColor }
  return {}
}

function HoleRow({
  hole, par, local, saved, isReadOnly, team1Color, team2Color, onChange, onBlur
}: {
  hole: number
  par: number | null
  local: { t1: string; t2: string }
  saved?: HoleScore
  isReadOnly: boolean
  team1Color: string
  team2Color: string
  onChange: (t1: string, t2: string) => void
  onBlur: (t1: string, t2: string) => void
}) {
  const winner = saved?.winner
  const t1Score = saved?.team1_score ?? null
  const t2Score = saved?.team2_score ?? null

  const rowBaseClass = winner === 'halved' ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100'
  const rowStyle: React.CSSProperties = winner === 'team1'
    ? { backgroundColor: team1Color + '14', borderColor: team1Color + '33' }
    : winner === 'team2'
    ? { backgroundColor: team2Color + '30', borderColor: team2Color + '55' }
    : {}

  const winDot = winner === 'team1' ? '⚪️'
    : winner === 'team2' ? '🔵'
    : winner === 'halved' ? <span className="text-gray-400">—</span> : null

  // Flat input ordering across all holes: hole h, field f -> (h-1)*2 + f
  const t1Seq = (hole - 1) * 2
  const t2Seq = (hole - 1) * 2 + 1

  function focusSeq(seq: number) {
    const el = document.querySelector<HTMLInputElement>(`[data-score-seq="${seq}"]`)
    if (el && !el.disabled) {
      el.focus()
      el.select()
    }
  }

  // Advance to the next box once the score looks complete. A lone "1" waits, since
  // it may become 10–15; any 2–9 (or a 2+ digit value) jumps immediately.
  function maybeAdvance(value: string, currentSeq: number) {
    const n = value.trim()
    if (n.length >= 2 || (n.length === 1 && Number(n) >= 2)) focusSeq(currentSeq + 1)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>, currentSeq: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      focusSeq(currentSeq + 1)
    }
  }

  return (
    <div
      className={`grid grid-cols-[2rem_2rem_1fr_1fr_2.5rem] gap-1.5 items-center px-3 py-2.5 rounded-xl border ${rowBaseClass} transition-colors`}
      style={rowStyle}
    >
      <div className="text-center text-sm font-bold text-gray-500">{hole}</div>
      <div className="text-center text-sm font-semibold text-gray-400">{par ?? '—'}</div>

      <div className="flex justify-center">
        <input
          type="number" min="1" max="15" inputMode="numeric"
          data-score-seq={t1Seq}
          value={local.t1} disabled={isReadOnly} placeholder="—"
          onChange={e => { onChange(e.target.value, local.t2); maybeAdvance(e.target.value, t1Seq) }}
          onKeyDown={e => onKeyDown(e, t1Seq)}
          onBlur={e => onBlur(e.target.value, local.t2)}
          className={scoreInputClasses(t1Score, par)}
          style={scoreInputStyle(t1Score, par, winner === 'team1', team1Color)}
        />
      </div>

      <div className="flex justify-center">
        <input
          type="number" min="1" max="15" inputMode="numeric"
          data-score-seq={t2Seq}
          value={local.t2} disabled={isReadOnly} placeholder="—"
          onChange={e => { onChange(local.t1, e.target.value); maybeAdvance(e.target.value, t2Seq) }}
          onKeyDown={e => onKeyDown(e, t2Seq)}
          onBlur={e => onBlur(local.t1, e.target.value)}
          className={scoreInputClasses(t2Score, par)}
          style={scoreInputStyle(t2Score, par, winner === 'team2', team2Color)}
        />
      </div>

      <div className="text-center text-base">{winDot}</div>
    </div>
  )
}
