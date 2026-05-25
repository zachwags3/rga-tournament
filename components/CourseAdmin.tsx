'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Round } from '@/types/database'

type Course = { id: string; name: string; round_id: string }
type CourseHole = { id: string; course_id: string; hole_number: number; par: number }

export default function CourseAdmin() {
  const [rounds, setRounds] = useState<Round[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null) // round id being saved

  // Local draft state per round: { [roundId]: { name: string, pars: number[] } }
  const [drafts, setDrafts] = useState<Record<string, { name: string; pars: number[] }>>({})

  const fetchAll = useCallback(async () => {
    const timeout = new Promise<null>(res => setTimeout(() => res(null), 5000))
    const fetches = Promise.all([
      supabase.from('rounds').select('*').order('sort_order'),
      supabase.from('courses').select('*'),
      supabase.from('course_holes').select('*').order('hole_number'),
    ])
    const result = await Promise.race([fetches, timeout])
    if (!result) { setLoading(false); return }
    const [r, c, ch] = result
    const roundsData: Round[] = r.data ?? []
    const coursesData: Course[] = c.data ?? []
    const holesData: CourseHole[] = ch.data ?? []
    setRounds(roundsData)
    setCourses(coursesData)
    setCourseHoles(holesData)

    // Init draft state from existing data
    const initDrafts: Record<string, { name: string; pars: number[] }> = {}
    roundsData.forEach(round => {
      const course = coursesData.find(c => c.round_id === round.id)
      const holes = holesData.filter(h => h.course_id === course?.id).sort((a, b) => a.hole_number - b.hole_number)
      const defaultPars = Array.from({ length: round.holes }, (_, i) => holes[i]?.par ?? 4)
      initDrafts[round.id] = {
        name: course?.name ?? '',
        pars: defaultPars,
      }
    })
    setDrafts(initDrafts)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  function setPar(roundId: string, holeIdx: number, val: number) {
    setDrafts(prev => ({
      ...prev,
      [roundId]: {
        ...prev[roundId],
        pars: prev[roundId].pars.map((p, i) => i === holeIdx ? val : p),
      }
    }))
  }

  function setCourseName(roundId: string, name: string) {
    setDrafts(prev => ({ ...prev, [roundId]: { ...prev[roundId], name } }))
  }

  async function saveCourse(round: Round) {
    const draft = drafts[round.id]
    if (!draft?.name.trim()) { alert('Enter a course name first.'); return }
    setSaving(round.id)

    // Delete existing course for this round
    const existing = courses.find(c => c.round_id === round.id)
    if (existing) {
      await supabase.from('course_holes').delete().eq('course_id', existing.id)
      await supabase.from('courses').delete().eq('id', existing.id)
    }

    // Insert new course
    const { data: courseData } = await supabase.from('courses').insert({
      name: draft.name.trim(),
      round_id: round.id,
    }).select().single()

    if (courseData) {
      const holeInsertions = draft.pars.map((par, i) => ({
        course_id: courseData.id,
        hole_number: i + 1,
        par,
      }))
      await supabase.from('course_holes').insert(holeInsertions)
    }

    await fetchAll()
    setSaving(null)
  }

  if (loading) return <div className="p-8 text-center text-[#2d5a3d]">Loading courses...</div>

  return (
    <div className="max-w-lg mx-auto px-4 pb-12 space-y-5">
      <div className="bg-[#1a3a2a]/5 rounded-xl p-3 text-center text-xs text-gray-500">
        Enter the course and par info for each round. This enables scorecard symbols (○ birdie, □ bogey) during score entry.
      </div>

      {rounds.map(round => {
        const draft = drafts[round.id]
        if (!draft) return null
        const existing = courses.find(c => c.round_id === round.id)
        const isSaved = !!existing
        const holeCount = round.holes
        const totalPar = draft.pars.reduce((s, p) => s + p, 0)
        const outPar = draft.pars.slice(0, 9).reduce((s, p) => s + p, 0)
        const inPar = holeCount === 18 ? draft.pars.slice(9).reduce((s, p) => s + p, 0) : null

        return (
          <div key={round.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Round header */}
            <div className="bg-[#1a3a2a] px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-white font-bold text-sm">{round.name}</div>
                <div className="text-white/50 text-xs">{holeCount} holes</div>
              </div>
              {isSaved && (
                <span className="text-[#c9a84c] text-xs font-semibold">✅ {existing.name}</span>
              )}
            </div>

            <div className="p-4">
              {/* Course name */}
              <input
                type="text"
                value={draft.name}
                onChange={e => setCourseName(round.id, e.target.value)}
                placeholder="Course name (e.g. Pebble Beach)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-4 outline-none focus:border-[#2d5a3d]"
              />

              {/* Par grid — OUT (holes 1-9) */}
              <div className="mb-3">
                <div className="grid grid-cols-11 gap-0.5 text-center mb-0.5">
                  <div className="text-[10px] font-bold text-gray-400 py-1">HOLE</div>
                  {Array.from({ length: 9 }, (_, i) => (
                    <div key={i} className="text-[10px] font-semibold text-gray-500 py-1">{i + 1}</div>
                  ))}
                  <div className="text-[10px] font-bold text-gray-400 py-1">OUT</div>
                </div>
                <div className="grid grid-cols-11 gap-0.5">
                  <div className="text-[10px] font-bold text-gray-400 flex items-center justify-center bg-gray-50 rounded py-1">PAR</div>
                  {Array.from({ length: 9 }, (_, i) => (
                    <ParCell key={i} value={draft.pars[i]} onChange={v => setPar(round.id, i, v)} />
                  ))}
                  <div className="text-[11px] font-bold text-[#2d5a3d] flex items-center justify-center bg-[#2d5a3d]/5 rounded py-1">
                    {outPar}
                  </div>
                </div>
              </div>

              {/* Par grid — IN (holes 10-18) */}
              {holeCount === 18 && (
                <div className="mb-3">
                  <div className="grid grid-cols-11 gap-0.5 text-center mb-0.5">
                    <div className="text-[10px] font-bold text-gray-400 py-1">HOLE</div>
                    {Array.from({ length: 9 }, (_, i) => (
                      <div key={i} className="text-[10px] font-semibold text-gray-500 py-1">{i + 10}</div>
                    ))}
                    <div className="text-[10px] font-bold text-gray-400 py-1">IN</div>
                  </div>
                  <div className="grid grid-cols-11 gap-0.5">
                    <div className="text-[10px] font-bold text-gray-400 flex items-center justify-center bg-gray-50 rounded py-1">PAR</div>
                    {Array.from({ length: 9 }, (_, i) => (
                      <ParCell key={i} value={draft.pars[i + 9]} onChange={v => setPar(round.id, i + 9, v)} />
                    ))}
                    <div className="text-[11px] font-bold text-[#2d5a3d] flex items-center justify-center bg-[#2d5a3d]/5 rounded py-1">
                      {inPar}
                    </div>
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="flex justify-end mb-4">
                <div className="bg-[#1a3a2a] text-white text-xs font-bold px-3 py-1 rounded-lg">
                  Total Par: {totalPar}
                </div>
              </div>

              <button
                onClick={() => saveCourse(round)}
                disabled={saving === round.id || !draft.name.trim()}
                className="w-full bg-[#2d5a3d] text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-[#1a3a2a] transition-colors"
              >
                {saving === round.id ? 'Saving...' : isSaved ? '↺ Update Course' : '💾 Save Course'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ParCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <button
      onClick={() => onChange(value === 3 ? 4 : value === 4 ? 5 : 3)}
      className={`text-xs font-bold py-1 rounded transition-colors ${
        value === 3 ? 'bg-blue-100 text-blue-700' :
        value === 4 ? 'bg-gray-100 text-gray-700' :
        'bg-orange-100 text-orange-700'
      }`}
    >
      {value}
    </button>
  )
}
