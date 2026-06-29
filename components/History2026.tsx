'use client'

import { useState } from 'react'
import { SEASON_2026 } from '@/lib/history/season2026'
import { computeCup, assembleRounds } from '@/lib/cup'
import DraftHistory from './DraftHistory'
import Leaderboard from './Leaderboard'
import StatsBoard from './StatsBoard'
import CupMovement from './CupMovement'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#091540]/50 mb-3 px-1">{children}</h3>
}

// Frozen archive of the 2026 season, collapsed under a "2026" dropdown on the
// History page. Everything renders from the static snapshot (no live database).
export default function History2026() {
  const [open, setOpen] = useState(false)

  const cup = computeCup(
    SEASON_2026.teams,
    assembleRounds(SEASON_2026.rounds, SEASON_2026.matches, SEASON_2026.hole_scores)
  )

  // Final standings from completed matches -> champion + final score.
  const points: Record<string, number> = {}
  SEASON_2026.teams.forEach(t => { points[t.id] = 0 })
  SEASON_2026.matches.forEach(m => {
    if (m.status !== 'complete') return
    points[m.team1_id] = (points[m.team1_id] ?? 0) + Number(m.rga_points_team1)
    points[m.team2_id] = (points[m.team2_id] ?? 0) + Number(m.rga_points_team2)
  })
  const standings = [...SEASON_2026.teams].sort((a, b) => (points[b.id] ?? 0) - (points[a.id] ?? 0))
  const champ = standings[0]

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-base font-bold text-[#091540]">
          2026 <span className="font-semibold text-[#091540]/55">· Navy def. Gray, 7.5–4.5</span>
        </span>
        <span className={`shrink-0 text-[#091540]/60 text-2xl leading-none transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="px-2 pb-6 flex flex-col gap-10 border-t border-gray-100 pt-6">
          {champ && (
            <div
              className="rounded-2xl bg-[#091540] px-5 py-5 text-center shadow-sm border-[3px]"
              style={{ borderColor: champ.color }}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e8c96a] mb-1">2026 Champions</p>
              <p className="text-2xl font-bold text-white">🏆 {champ.name}</p>
              <p className="text-white/60 text-xs mt-1">Capt. {champ.captain_name}</p>
              <p className="text-white/60 text-xs">MVP Nate</p>
              <p className="text-white/45 text-xs mt-1">Mitch, Joe, Sam, Mike</p>
            </div>
          )}

          <section>
            <DraftHistory snapshot={SEASON_2026} />
          </section>

          <section>
            <SectionLabel>Scoreboard</SectionLabel>
            <Leaderboard snapshot={SEASON_2026} readOnly />
          </section>

          {cup.hasMatches && (
            <section>
              <SectionLabel>Cup Line Movement</SectionLabel>
              <CupMovement grayColor={cup.gray?.color ?? '#9ca3af'} cupS={cup.cupNow.s} seriesV={cup.seriesV} markers={cup.roundMarkers} chartOnly />
            </section>
          )}

          <section>
            <SectionLabel>Stats</SectionLabel>
            <StatsBoard snapshot={SEASON_2026} individualOnly />
          </section>
        </div>
      )}
    </div>
  )
}
