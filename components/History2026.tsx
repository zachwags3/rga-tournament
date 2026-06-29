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

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <span className="text-lg font-bold text-[#091540]">2026</span>
        <span className={`text-[#091540]/60 text-2xl leading-none transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="px-4 pb-6 flex flex-col gap-10 border-t border-gray-100 pt-6">
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
              <CupMovement grayColor={cup.gray?.color ?? '#9ca3af'} cupS={cup.cupNow.s} seriesV={cup.seriesV} />
            </section>
          )}

          <section>
            <SectionLabel>Stat Sheet</SectionLabel>
            <StatsBoard snapshot={SEASON_2026} />
          </section>
        </div>
      )}
    </div>
  )
}
