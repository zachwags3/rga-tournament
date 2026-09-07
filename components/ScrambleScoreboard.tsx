'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { COURSE, COURSE_PAR, SCRAMBLE, teamName, teeGroups } from '@/lib/scramble/config'
import { buildLeaderboard, fmtToPar, scoreMap, splits, type ScrambleScore } from '@/lib/scramble/scoring'

// Stroke colour vs par — matches the 2026 archive scorecard.
function strokeStyle(diff: number | null): React.CSSProperties {
  if (diff === null) return { backgroundColor: '#ffffff', color: '#d1d5db' }
  if (diff <= -2) return { backgroundColor: '#fde68a', color: '#713f12' }
  if (diff === -1) return { backgroundColor: '#bbf7d0', color: '#14532d' }
  if (diff === 0) return { backgroundColor: '#f3f4f6', color: '#374151' }
  if (diff === 1) return { backgroundColor: '#fecaca', color: '#7f1d1d' }
  return { backgroundColor: '#fca5a5', color: '#7f1d1d' }
}

export default function ScrambleScoreboard() {
  const [scores, setScores] = useState<ScrambleScore[]>([])
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('scramble_scores').select('team_slug,hole_number,strokes')
    if (error) setNeedsSetup(true)
    else { setNeedsSetup(false); setScores(data ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('scramble-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scramble_scores' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const board = buildLeaderboard(scores)
  const map = scoreMap(scores)
  const anyStarted = board.some(r => r.started)

  return (
    <div className="max-w-2xl mx-auto px-3 pb-12">
      {/* Banner */}
      <div className="bg-[#091540] rounded-2xl px-4 py-5 text-center shadow-sm">
        <Image src="/rga-logo.png" alt="RGA" width={52} height={52} className="mx-auto mb-3 drop-shadow-md" />
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e8c96a]">{SCRAMBLE.shortName}</p>
        <p className="text-white/60 text-[11px] leading-relaxed mt-2 max-w-xs mx-auto">{SCRAMBLE.fullName}</p>
        <p className="text-white/35 text-[10px] mt-1">{SCRAMBLE.presentedBy}</p>
        <p className="text-white/45 text-[11px] mt-3">
          {SCRAMBLE.dateLabel} · {SCRAMBLE.formatLabel} · par {COURSE_PAR}
        </p>
      </div>

      {needsSetup && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mt-4">
          <p className="text-amber-800 text-xs font-semibold">Scoring table not set up yet</p>
          <p className="text-amber-700 text-[11px] mt-1">
            Run <span className="font-mono">supabase/scramble.sql</span> in the Supabase SQL editor to enable score entry.
          </p>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-white rounded-2xl shadow-sm mt-4 overflow-hidden">
        <div className="flex px-3 py-2 bg-gray-50 text-[10px] font-bold tracking-wider text-gray-500">
          <span className="w-8 shrink-0">POS</span>
          <span className="flex-1 min-w-0">TEAM</span>
          <span className="w-11 shrink-0 text-center">THRU</span>
          <span className="w-11 shrink-0 text-right">SCORE</span>
          <span className="w-9 shrink-0 text-right">TOT</span>
        </div>
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-8">Loading…</p>
        ) : (
          board.map((r, i) => (
            <div
              key={r.team.slug}
              className="flex items-center px-3 py-3 border-t border-gray-50"
              style={i === 0 && anyStarted ? { backgroundColor: '#fbfaf5' } : undefined}
            >
              <span className="w-8 shrink-0 text-sm font-semibold text-[#091540]">{anyStarted ? r.pos : '—'}</span>
              <span className="flex-1 min-w-0 text-sm font-semibold text-[#091540] truncate">{teamName(r.team)}</span>
              <span className="w-11 shrink-0 text-center text-xs text-gray-500">
                {r.complete ? 'F' : r.started ? r.thru : r.team.teeTime}
              </span>
              <span
                className="w-11 shrink-0 text-right text-sm font-bold tabular-nums"
                style={{ color: r.toPar < 0 ? '#c0392b' : '#091540' }}
              >
                {r.started ? fmtToPar(r.toPar) : '–'}
              </span>
              <span className="w-9 shrink-0 text-right text-xs text-gray-600 tabular-nums">
                {r.started ? r.strokes : '–'}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Tee groups → score entry */}
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#091540]/50 mt-6 mb-2 px-1">
        Tee groups · tap to enter scores
      </p>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {teeGroups().map(g => (
          <div key={g.time}>
            <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-[#091540] border-t border-gray-100 first:border-t-0">
              {g.time} AM
            </div>
            {g.teams.map(t => (
              <Link
                key={t.slug}
                href={`/scramble/${t.slug}`}
                className="flex items-center justify-between px-3 py-3.5 border-t border-gray-50 active:bg-gray-50"
              >
                <span className="text-sm font-semibold text-[#091540]">{teamName(t)}</span>
                <span className="text-xs font-medium text-[#1e3a8a]">Enter scores ›</span>
              </Link>
            ))}
          </div>
        ))}
      </div>

      {/* Full scorecard */}
      {anyStarted && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#091540]/50 mt-6 mb-2 px-1">Scorecard</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-max">
                <div className="flex bg-[#091540]">
                  <div className="w-24 shrink-0 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 border-r border-white/10">Hole</div>
                  {COURSE.map(h => (
                    <div key={h.hole} className="w-7 shrink-0 py-1.5 text-center text-[10px] font-bold text-white/80 border-r border-white/10">{h.hole}</div>
                  ))}
                  {['Out', 'In', 'Tot'].map(l => (
                    <div key={l} className="w-9 shrink-0 py-1.5 text-center text-[10px] font-bold text-[#e8c96a]">{l}</div>
                  ))}
                </div>
                <div className="flex border-t border-gray-100 bg-gray-50">
                  <div className="w-24 shrink-0 px-2 py-1.5 text-[11px] font-semibold text-gray-500 border-r border-gray-200">Par</div>
                  {COURSE.map(h => (
                    <div key={h.hole} className="w-7 h-7 shrink-0 flex items-center justify-center text-[11px] text-gray-500 border-r border-gray-100">{h.par}</div>
                  ))}
                  <div className="w-9 shrink-0 flex items-center justify-center text-[11px] font-bold text-gray-600">35</div>
                  <div className="w-9 shrink-0 flex items-center justify-center text-[11px] font-bold text-gray-600">35</div>
                  <div className="w-9 shrink-0 flex items-center justify-center text-[11px] font-bold text-gray-600">{COURSE_PAR}</div>
                </div>
                {board.map(r => {
                  const s = splits(r.team.slug, map)
                  return (
                    <div key={r.team.slug} className="flex border-t border-gray-100">
                      <div className="w-24 shrink-0 px-2 py-1.5 text-[11px] font-semibold text-[#091540] border-r border-gray-200 truncate">
                        {teamName(r.team)}
                      </div>
                      {COURSE.map(h => {
                        const v = map.get(`${r.team.slug}:${h.hole}`)
                        return (
                          <div
                            key={h.hole}
                            className="w-7 h-7 shrink-0 flex items-center justify-center text-[11px] font-semibold border-r border-gray-100"
                            style={strokeStyle(v != null ? v - h.par : null)}
                          >
                            {v ?? ''}
                          </div>
                        )
                      })}
                      <div className="w-9 shrink-0 flex items-center justify-center text-[11px] font-bold text-[#091540] bg-gray-50">{s.out || '–'}</div>
                      <div className="w-9 shrink-0 flex items-center justify-center text-[11px] font-bold text-[#091540] bg-gray-50">{s.in || '–'}</div>
                      <div className="w-9 shrink-0 flex items-center justify-center text-[11px] font-bold text-[#091540] bg-gray-50">{s.total || '–'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
