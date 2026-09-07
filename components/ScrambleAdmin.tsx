'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COURSE, COURSE_PAR, SCRAMBLE, SCRAMBLE_TEAMS, teamName } from '@/lib/scramble/config'
import { fmtToPar } from '@/lib/scramble/scoring'

type Row = { team_slug: string; hole_number: number; strokes: number | null }

export default function ScrambleAdmin() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('scramble_scores').select('team_slug,hole_number,strokes')
    if (error) setNote(error.message)
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const map = new Map<string, number>()
  for (const r of rows) if (r.strokes != null) map.set(`${r.team_slug}:${r.hole_number}`, r.strokes)

  async function setScore(slug: string, hole: number, raw: string) {
    const val = parseInt(raw, 10)
    setBusy(true)
    if (!raw || Number.isNaN(val) || val <= 0) {
      await supabase.from('scramble_scores').delete().eq('team_slug', slug).eq('hole_number', hole)
    } else {
      await supabase
        .from('scramble_scores')
        .upsert({ team_slug: slug, hole_number: hole, strokes: val }, { onConflict: 'team_slug,hole_number' })
    }
    await load()
    setBusy(false)
  }

  async function clearTeam(slug: string, label: string) {
    if (!window.confirm(`Delete all scores for ${label}?`)) return
    setBusy(true)
    await supabase.from('scramble_scores').delete().eq('team_slug', slug)
    await load()
    setBusy(false)
    setNote(`Cleared ${label}.`)
  }

  async function resetAll() {
    if (!window.confirm('Delete EVERY score in the Kickoff Classic? This cannot be undone.')) return
    if (!window.confirm('Really reset all scores?')) return
    setBusy(true)
    await supabase.from('scramble_scores').delete().gte('hole_number', 1)
    await load()
    setBusy(false)
    setNote('All scores reset.')
  }

  if (loading) return <p className="text-center text-gray-400 text-sm py-8">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="bg-[#091540] rounded-xl px-4 py-3">
        <p className="text-[#e8c96a] text-xs font-bold uppercase tracking-widest">{SCRAMBLE.shortName}</p>
        <p className="text-white/60 text-xs mt-1">
          Edit any cell to fix a score. Clear a cell to delete that hole. {rows.length} scores entered.
        </p>
      </div>

      {note && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
          <p className="text-blue-800 text-xs">{note}</p>
        </div>
      )}

      {/* Editable grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <div className="flex bg-[#091540]">
              <div className="w-24 shrink-0 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 border-r border-white/10">Hole</div>
              {COURSE.map(h => (
                <div key={h.hole} className="w-10 shrink-0 py-1.5 text-center text-[10px] font-bold text-white/80 border-r border-white/10">{h.hole}</div>
              ))}
              <div className="w-10 shrink-0 py-1.5 text-center text-[10px] font-bold text-[#e8c96a]">Tot</div>
              <div className="w-14 shrink-0" />
            </div>
            <div className="flex bg-gray-50 border-t border-gray-100">
              <div className="w-24 shrink-0 px-2 py-1.5 text-[11px] font-semibold text-gray-500 border-r border-gray-200">Par</div>
              {COURSE.map(h => (
                <div key={h.hole} className="w-10 h-8 shrink-0 flex items-center justify-center text-[11px] text-gray-500 border-r border-gray-100">{h.par}</div>
              ))}
              <div className="w-10 shrink-0 flex items-center justify-center text-[11px] font-bold text-gray-600">{COURSE_PAR}</div>
              <div className="w-14 shrink-0" />
            </div>
            {SCRAMBLE_TEAMS.map(t => {
              const played = COURSE.filter(h => map.get(`${t.slug}:${h.hole}`) != null)
              const tot = played.reduce((s, h) => s + (map.get(`${t.slug}:${h.hole}`) ?? 0), 0)
              const par = played.reduce((s, h) => s + h.par, 0)
              return (
                <div key={t.slug} className="flex border-t border-gray-100">
                  <div className="w-24 shrink-0 px-2 py-1.5 text-[11px] font-semibold text-[#091540] border-r border-gray-200 truncate flex items-center">
                    {teamName(t)}
                  </div>
                  {COURSE.map(h => (
                    <div key={h.hole} className="w-10 shrink-0 border-r border-gray-100">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        defaultValue={map.get(`${t.slug}:${h.hole}`) ?? ''}
                        onBlur={e => setScore(t.slug, h.hole, e.target.value)}
                        className="w-10 h-8 text-center text-[12px] font-semibold text-[#091540] focus:outline-none focus:bg-blue-50"
                        aria-label={`${teamName(t)} hole ${h.hole}`}
                      />
                    </div>
                  ))}
                  <div className="w-10 shrink-0 flex items-center justify-center text-[11px] font-bold text-[#091540] bg-gray-50">
                    {tot || '–'}
                  </div>
                  <div className="w-14 shrink-0 flex items-center justify-center">
                    <button
                      onClick={() => clearTeam(t.slug, teamName(t))}
                      disabled={busy || played.length === 0}
                      className="text-[10px] font-semibold text-red-500 disabled:text-gray-300 px-1"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Per-team summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Totals</h3>
        {SCRAMBLE_TEAMS.map(t => {
          const played = COURSE.filter(h => map.get(`${t.slug}:${h.hole}`) != null)
          const tot = played.reduce((s, h) => s + (map.get(`${t.slug}:${h.hole}`) ?? 0), 0)
          const par = played.reduce((s, h) => s + h.par, 0)
          return (
            <div key={t.slug} className="flex items-center justify-between py-1 text-sm">
              <span className="text-[#091540]">{teamName(t)}</span>
              <span className="text-gray-500 text-xs">
                {played.length ? `${tot} · ${fmtToPar(tot - par)} · thru ${Math.max(...played.map(h => h.hole))}` : 'no scores'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Danger zone */}
      <div className="bg-red-50 rounded-xl border border-red-200 p-4">
        <h2 className="font-bold text-red-700 mb-1">Danger Zone</h2>
        <p className="text-red-500 text-xs mb-3">
          Deletes every Kickoff Classic score. Teams and tee times are defined in code and are not affected.
        </p>
        <button
          onClick={resetAll}
          disabled={busy || rows.length === 0}
          className="w-full border border-red-300 text-red-600 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 hover:bg-red-100"
        >
          Reset All Scramble Scores
        </button>
      </div>
    </div>
  )
}
