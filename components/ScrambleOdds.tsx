'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toAmerican } from '@/lib/odds'
import { SCRAMBLE, teamName } from '@/lib/scramble/config'
import { buildLeaderboard, fmtToPar, type ScrambleScore } from '@/lib/scramble/scoring'
import { probabilitySeries, projections, winProbabilities } from '@/lib/scramble/odds'
import ScrambleMomentum from './ScrambleMomentum'

// Cap longshots at +5000 so a mathematically-buried team doesn't print an
// unreadable price (books cap their boards the same way).
const price = (p: number) => toAmerican(Math.max(p, 1 / 51))

type Row = ScrambleScore & { created_at: string }

export default function ScrambleOdds() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('scramble_scores')
      .select('team_slug,hole_number,strokes,created_at')
    setRows(data ?? [])
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

  const board = useMemo(() => buildLeaderboard(rows), [rows])
  const probs = useMemo(() => winProbabilities(board), [board])
  const series = useMemo(() => probabilitySeries(rows), [rows])
  const proj = useMemo(() => new Map(projections(board).map(p => [p.slug, p])), [board])

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
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#e8c96a]">Outright Winner</p>
              <p className="text-[10px] text-white/30">chance to win</p>
            </div>
            {ranked.map(r => {
              const p = probs.get(r.team.slug) ?? 0
              const pr = proj.get(r.team.slug)
              return (
                <div key={r.team.slug} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.team.color }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{teamName(r.team)}</p>
                      <p className="text-[11px] text-white/40">
                        {anyStarted && r.started
                          ? `${fmtToPar(r.toPar)} thru ${r.thru}`
                          : `proj ${fmtToPar(Math.round(pr?.mean ?? 0))}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-base font-bold text-[#e8c96a] tabular-nums leading-none">
                      {Math.round(p * 100)}%
                    </p>
                    <p className="text-[11px] text-white/40 tabular-nums mt-0.5">{price(p)}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <ScrambleMomentum data={series} />
        </>
      )}
    </div>
  )
}
