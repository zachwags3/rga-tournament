'use client'

import { SEASON_2026 } from '@/lib/history/season2026'
import { calcMatchPlayStatus } from '@/lib/matchplay'
import type { Match, HoleScore, Round } from '@/types/database'

// Background + text color for a stroke relative to par (birdie / par / bogey / etc).
function scoreStyle(diff: number | null): React.CSSProperties {
  if (diff === null) return { backgroundColor: '#ffffff', color: '#9ca3af' }
  if (diff <= -2) return { backgroundColor: '#fde68a', color: '#713f12' } // eagle+
  if (diff === -1) return { backgroundColor: '#bbf7d0', color: '#14532d' } // birdie
  if (diff === 0) return { backgroundColor: '#f3f4f6', color: '#374151' } // par
  if (diff === 1) return { backgroundColor: '#fecaca', color: '#7f1d1d' } // bogey
  return { backgroundColor: '#fca5a5', color: '#7f1d1d' } // double+
}

function MatchScorecard({
  match, round, holeScores, teamName, teamColor, parAt,
}: {
  match: Match
  round: Round
  holeScores: HoleScore[]
  teamName: (id: string) => string
  teamColor: (id: string) => string
  parAt: (hole: number) => number | null
}) {
  const status = calcMatchPlayStatus(holeScores, round.holes)
  const byHole = new Map(holeScores.map(h => [h.hole_number, h]))
  const holes = Array.from({ length: round.holes }, (_, i) => i + 1)

  const label1 = match.team1_player_names.join(' & ')
  const label2 = match.team2_player_names.join(' & ')

  // Totals over the holes that were actually played.
  let par = 0, t1 = 0, t2 = 0
  holes.forEach(h => {
    const hs = byHole.get(h)
    if (!hs || hs.team1_score == null || hs.team2_score == null) return
    const p = parAt(h)
    if (p) par += p
    t1 += hs.team1_score
    t2 += hs.team2_score
  })

  const cell = 'w-7 h-7 shrink-0 flex items-center justify-center text-[11px] font-semibold border-r border-gray-100'

  const row = (
    label: string,
    color: string | undefined,
    total: number,
    render: (h: number) => { text: string; style: React.CSSProperties },
  ) => (
    <div className="flex items-stretch border-t border-gray-100">
      <div className="w-24 shrink-0 px-2 flex items-center text-[11px] font-semibold border-r border-gray-200 truncate" style={{ color }}>
        {label}
      </div>
      {holes.map(h => {
        const { text, style } = render(h)
        return <div key={h} className={cell} style={style}>{text}</div>
      })}
      <div className="w-9 shrink-0 flex items-center justify-center text-[11px] font-bold text-[#1a3a2a] bg-gray-50">
        {total || '—'}
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#1a3a2a] truncate">
          <span style={{ color: teamColor(match.team1_id) }}>{label1}</span>
          <span className="text-gray-400"> vs </span>
          <span style={{ color: teamColor(match.team2_id) }}>{label2}</span>
        </span>
        <span className="text-xs font-bold text-[#091540] shrink-0">{status.resultLabel || '—'}</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Hole numbers */}
          <div className="flex items-stretch bg-[#091540]">
            <div className="w-24 shrink-0 px-2 flex items-center text-[10px] font-bold uppercase tracking-wider text-white/70 border-r border-white/10">Hole</div>
            {holes.map(h => (
              <div key={h} className="w-7 h-6 shrink-0 flex items-center justify-center text-[10px] font-bold text-white/80 border-r border-white/10">{h}</div>
            ))}
            <div className="w-9 shrink-0 flex items-center justify-center text-[10px] font-bold text-[#e8c96a]">Tot</div>
          </div>
          {/* Par */}
          {row('Par', '#6b7280', par, h => ({ text: parAt(h)?.toString() ?? '', style: { backgroundColor: '#fafafa', color: '#6b7280' } }))}
          {/* Team 1 strokes */}
          {row(teamName(match.team1_id), teamColor(match.team1_id), t1, h => {
            const hs = byHole.get(h)
            const s = hs?.team1_score
            const p = parAt(h)
            return { text: s?.toString() ?? '', style: scoreStyle(s != null && p ? s - p : null) }
          })}
          {/* Team 2 strokes */}
          {row(teamName(match.team2_id), teamColor(match.team2_id), t2, h => {
            const hs = byHole.get(h)
            const s = hs?.team2_score
            const p = parAt(h)
            return { text: s?.toString() ?? '', style: scoreStyle(s != null && p ? s - p : null) }
          })}
        </div>
      </div>
    </div>
  )
}

// Full 2026 tournament archive: every round, every match, hole-by-hole strokes
// coloured by score-to-par. Reads entirely from the committed snapshot.
export default function SeasonHistory2026() {
  const snap = SEASON_2026
  const teamName = (id: string) => snap.teams.find(t => t.id === id)?.name ?? '—'
  const teamColor = (id: string) => snap.teams.find(t => t.id === id)?.color ?? '#6b7280'

  const courseByRound = new Map(snap.courses.map(c => [c.round_id, c.id]))
  const parAt = (roundId: string, hole: number): number | null => {
    const cid = courseByRound.get(roundId)
    if (!cid) return null
    return snap.course_holes.find(h => h.course_id === cid && h.hole_number === hole)?.par ?? null
  }

  const rounds = [...snap.rounds].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-6">
      <div className="bg-[#091540] rounded-xl px-4 py-3">
        <p className="text-[#e8c96a] text-xs font-bold uppercase tracking-widest">2026 · Complete Archive</p>
        <p className="text-white/60 text-xs mt-1">Team Navy def. Team Gray, 7.5–4.5 · hole-by-hole scores below</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
        {[
          { t: 'Eagle+', c: '#fde68a', tc: '#713f12' },
          { t: 'Birdie', c: '#bbf7d0', tc: '#14532d' },
          { t: 'Par', c: '#f3f4f6', tc: '#374151' },
          { t: 'Bogey', c: '#fecaca', tc: '#7f1d1d' },
          { t: 'Double+', c: '#fca5a5', tc: '#7f1d1d' },
        ].map(x => (
          <span key={x.t} className="px-2 py-1 rounded" style={{ backgroundColor: x.c, color: x.tc }}>{x.t}</span>
        ))}
      </div>

      {rounds.map(round => {
        const matches = snap.matches
          .filter(m => m.round_id === round.id)
          .sort((a, b) => a.match_number - b.match_number)
        return (
          <div key={round.id}>
            <h2 className="font-bold text-[#1a3a2a] text-sm mb-2">{round.name}</h2>
            <div className="space-y-3">
              {matches.map(m => (
                <MatchScorecard
                  key={m.id}
                  match={m}
                  round={round}
                  holeScores={snap.hole_scores.filter(h => h.match_id === m.id)}
                  teamName={teamName}
                  teamColor={teamColor}
                  parAt={hole => parAt(round.id, hole)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
