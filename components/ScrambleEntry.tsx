'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COURSE, COURSE_PAR, teamBySlug, teamName } from '@/lib/scramble/config'
import { fmtToPar } from '@/lib/scramble/scoring'
import { Rings, golfMark } from './golfMarks'

export default function ScrambleEntry({ slug }: { slug: string }) {
  const team = teamBySlug(slug)
  const [strokes, setStrokes] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [savingHole, setSavingHole] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('scramble_scores')
      .select('hole_number,strokes')
      .eq('team_slug', slug)
    if (error) setError('Scoring table not set up yet — run supabase/scramble.sql.')
    else {
      const next: Record<number, number> = {}
      for (const r of data ?? []) if (r.strokes != null) next[r.hole_number] = r.strokes
      setStrokes(next)
    }
    setLoading(false)
  }, [slug])

  useEffect(() => { load() }, [load])

  async function save(hole: number, raw: string) {
    const val = parseInt(raw, 10)
    setSavingHole(hole)
    if (!raw || Number.isNaN(val) || val <= 0) {
      setStrokes(s => { const n = { ...s }; delete n[hole]; return n })
      await supabase.from('scramble_scores').delete().eq('team_slug', slug).eq('hole_number', hole)
    } else {
      setStrokes(s => ({ ...s, [hole]: val }))
      const { error } = await supabase
        .from('scramble_scores')
        .upsert({ team_slug: slug, hole_number: hole, strokes: val }, { onConflict: 'team_slug,hole_number' })
      if (error) setError(error.message)
    }
    setSavingHole(null)
  }

  if (!team) return <p className="text-center text-gray-400 text-sm py-10">Unknown team.</p>

  const played = COURSE.filter(h => strokes[h.hole] != null)
  const total = played.reduce((s, h) => s + strokes[h.hole], 0)
  const parPlayed = played.reduce((s, h) => s + h.par, 0)
  const toPar = total - parPlayed
  const thru = played.length ? Math.max(...played.map(h => h.hole)) : 0

  return (
    <div className="max-w-lg mx-auto px-3 pb-16">
      {/* Sticky running summary */}
      <div className="sticky top-[52px] z-10 bg-[#091540] rounded-2xl px-4 py-3 shadow-sm mb-4">
        <p className="text-white font-bold text-base">{teamName(team)}</p>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-white/50 text-xs">{team.teeTime} AM</span>
          <span className="text-white/50 text-xs">Thru {thru}</span>
          <span className="text-xs font-bold" style={{ color: toPar < 0 ? '#fca5a5' : '#e8c96a' }}>
            {played.length ? fmtToPar(toPar) : 'E'}
          </span>
          <span className="text-white/70 text-xs ml-auto tabular-nums">{total || 0} strokes</span>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
          <p className="text-amber-800 text-xs">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-8">Loading…</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {COURSE.map(h => {
            const v = strokes[h.hole]
            const mark = golfMark(v != null ? v - h.par : null)
            return (
              <div key={h.hole} className="flex items-center gap-3 px-3 py-2.5 border-t border-gray-50 first:border-t-0">
                <span className="w-7 shrink-0 text-sm font-bold text-[#091540] tabular-nums">{h.hole}</span>
                <span className="w-16 shrink-0 text-[11px] text-gray-400">
                  Par {h.par} · {h.yards}y
                </span>
                <div className="flex-1" />
                {savingHole === h.hole && <span className="text-[10px] text-gray-400">saving…</span>}
                <div className="relative w-16 h-11 shrink-0">
                  <Rings mark={mark} size={32} />
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={1}
                    defaultValue={v ?? ''}
                    onBlur={e => save(h.hole, e.target.value)}
                    className="absolute inset-0 w-full h-full rounded-xl border border-gray-200 bg-transparent text-center text-lg font-bold focus:outline-none focus:border-[#1e3a8a]"
                    style={{ color: mark?.color ?? '#091540' }}
                    aria-label={`Strokes for hole ${h.hole}`}
                  />
                </div>
              </div>
            )
          })}
          <div className="flex items-center justify-between px-3 py-3 bg-gray-50 border-t border-gray-100">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Total · par {COURSE_PAR}</span>
            <span className="text-lg font-bold text-[#091540] tabular-nums">{total || '–'}</span>
          </div>
        </div>
      )}
      <p className="text-center text-[11px] text-gray-400 mt-3">Scores save automatically and appear live on the scoreboard.</p>
    </div>
  )
}
