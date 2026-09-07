'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toAmerican } from '@/lib/odds'
import { SCRAMBLE, teamName } from '@/lib/scramble/config'
import { buildLeaderboard, fmtToPar, type ScrambleScore } from '@/lib/scramble/scoring'
import { projections, winProbabilities } from '@/lib/scramble/odds'

// Cap longshots at +5000 so a mathematically-buried team doesn't print an
// unreadable price (books cap their boards the same way).
const price = (p: number) => toAmerican(Math.max(p, 1 / 51))

export default function ScrambleOdds() {
  const [scores, setScores] = useState<ScrambleScore[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('scramble_scores').select('team_slug,hole_number,strokes')
    setScores(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('scramble-odds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scramble_scores' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const board = buildLeaderboard(scores)
  const probs = winProbabilities(board)
  const proj = new Map(projections(board).map(p => [p.slug, p]))
  const ranked = [...board].sort((a, b) => (probs.get(b.team.slug) ?? 0) - (probs.get(a.team.slug) ?? 0))
  const anyStarted = board.some(r => r.started)

  return (
    <div className="max-w-2xl mx-auto px-3 pb-12">
      <h1 className="text-2xl font-bold text-[#091540] mb-1">Odds</h1>
      <p className="text-[#091540]/50 text-xs mb-5">{SCRAMBLE.shortName}</p>

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-8">Loading…</p>
      ) : (
        <>
          <div className="bg-[#091540] rounded-2xl shadow-sm px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#e8c96a] mb-2">
              Outright Winner
            </p>
            {ranked.map(r => {
              const p = probs.get(r.team.slug) ?? 0
              const pr = proj.get(r.team.slug)
              return (
                <div key={r.team.slug} className="flex items-center justify-between py-1.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{teamName(r.team)}</p>
                    <p className="text-[11px] text-white/40">
                      {anyStarted && r.started
                        ? `${fmtToPar(r.toPar)} thru ${r.thru}`
                        : `proj ${fmtToPar(Math.round(pr?.mean ?? 0))}`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-[#e8c96a] tabular-nums shrink-0 ml-3">
                    {price(p)}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
