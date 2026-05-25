'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Round  = { id: string; name: string; holes: number; format: string; sort_order: number }
type Match  = { id: string; round_id: string; match_number: number; team1_id: string; team2_id: string; team1_player_names: string[]; team2_player_names: string[] }
type HScore = { match_id: string; hole_number: number; team1_score: number | null; team2_score: number | null }
type Team   = { id: string; name: string; color: string; captain_name: string }
type Pars   = Record<number, number>

type Result = 'W' | 'L' | 'H' | null

interface RowStats {
  label: string
  color: string
  matchNumber: number
  result: Result
  f9: number | null
  b9: number | null
  total: number | null
  pars: number
  birdies: number
  bogeys: number
  doubles: number
}

interface TeamTotal {
  label: string
  color: string
  f9: number | null
  b9: number | null
  total: number | null
  pars: number
  birdies: number
  bogeys: number
  doubles: number
}

function calcStats(
  scores: { hole: number; score: number | null }[],
  pars: Pars,
  totalHoles: number,
): Omit<RowStats, 'label' | 'color' | 'matchNumber' | 'result'> {
  let f9 = 0, b9 = 0, parsCount = 0, birdies = 0, bogeys = 0, doubles = 0
  let f9Count = 0, b9Count = 0

  scores.forEach(({ hole, score }) => {
    if (!score || score <= 0) return
    if (hole <= 9) { f9 += score; f9Count++ }
    else           { b9 += score; b9Count++ }
    const par = pars[hole]
    if (par) {
      const d = score - par
      if (d <= -1) birdies++
      else if (d === 0) parsCount++
      else if (d === 1) bogeys++
      else doubles++
    }
  })

  const hasAny = f9Count + b9Count > 0
  return {
    f9:     f9Count > 0 ? f9 : null,
    b9:     totalHoles > 9 && b9Count > 0 ? b9 : null,
    total:  hasAny ? f9 + b9 : null,
    pars:   parsCount,
    birdies,
    bogeys,
    doubles,
  }
}

function calcMatchResult(matchScores: HScore[]): { t1: Result; t2: Result } {
  const scored = matchScores.filter(
    s => s.team1_score != null && s.team2_score != null && s.team1_score > 0 && s.team2_score > 0
  )
  if (scored.length === 0) return { t1: null, t2: null }

  let t1Holes = 0, t2Holes = 0
  scored.forEach(s => {
    if (s.team1_score! < s.team2_score!) t1Holes++
    else if (s.team2_score! < s.team1_score!) t2Holes++
  })

  if (t1Holes > t2Holes) return { t1: 'W', t2: 'L' }
  if (t2Holes > t1Holes) return { t1: 'L', t2: 'W' }
  return { t1: 'H', t2: 'H' }
}

function sumRows(rows: RowStats[], color: string): TeamTotal {
  const teamRows = rows.filter(r => r.color === color)
  let f9 = 0, b9 = 0, total = 0, pars = 0, birdies = 0, bogeys = 0, doubles = 0
  let hasF9 = false, hasB9 = false, hasTotal = false

  teamRows.forEach(r => {
    if (r.f9    !== null) { f9    += r.f9;    hasF9    = true }
    if (r.b9    !== null) { b9    += r.b9;    hasB9    = true }
    if (r.total !== null) { total += r.total; hasTotal = true }
    pars    += r.pars
    birdies += r.birdies
    bogeys  += r.bogeys
    doubles += r.doubles
  })

  return {
    label: 'Team Total',
    color,
    f9:    hasF9    ? f9    : null,
    b9:    hasB9    ? b9    : null,
    total: hasTotal ? total : null,
    pars,
    birdies,
    bogeys,
    doubles,
  }
}

function ResultChip({ result, matchNum }: { result: Result; matchNum: number }) {
  if (!result) return <span className="text-gray-300 font-medium">—</span>
  const style =
    result === 'W' ? 'bg-green-100 text-green-700' :
    result === 'L' ? 'bg-red-100   text-red-600'   :
                     'bg-gray-100  text-gray-500'
  return (
    <span className={`inline-block px-1 py-0.5 rounded font-bold leading-none ${style}`}>
      {result}{matchNum}
    </span>
  )
}

export default function StatsBoard() {
  const [rounds,  setRounds]  = useState<Round[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [scores,  setScores]  = useState<HScore[]>([])
  const [teams,   setTeams]   = useState<Team[]>([])
  const [pars,    setPars]    = useState<Record<string, Pars>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [rRes, mRes, sRes, tRes, cRes, chRes] = await Promise.all([
        supabase.from('rounds').select('*').order('sort_order'),
        supabase.from('matches').select('*').order('match_number'),
        supabase.from('hole_scores').select('*'),
        supabase.from('teams').select('*').order('created_at'),
        supabase.from('courses').select('id,round_id'),
        supabase.from('course_holes').select('course_id,hole_number,par'),
      ])
      const roundsData: Round[] = rRes.data ?? []
      const coursesData         = cRes.data  ?? []
      const holesData           = chRes.data ?? []

      const parsMap: Record<string, Pars> = {}
      roundsData.forEach(r => {
        const course = coursesData.find((c: { id: string; round_id: string }) => c.round_id === r.id)
        if (!course) return
        const hp: Pars = {}
        holesData
          .filter((h: { course_id: string; hole_number: number; par: number }) => h.course_id === course.id)
          .forEach((h: { course_id: string; hole_number: number; par: number }) => { hp[h.hole_number] = h.par })
        parsMap[r.id] = hp
      })

      setRounds(roundsData)
      setMatches(mRes.data ?? [])
      setScores(sRes.data ?? [])
      setTeams(tRes.data ?? [])
      setPars(parsMap)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-8 text-center text-[#2d5a3d]">Loading stats...</div>
  if (teams.length < 2) return <div className="p-8 text-center text-gray-400">No data yet.</div>

  const team1 = teams[0]
  const team2 = teams[1]

  return (
    <div className="space-y-6 pb-12">
      {rounds.map(round => {
        const roundMatches = matches
          .filter(m => m.round_id === round.id)
          .sort((a, b) => a.match_number - b.match_number)

        if (roundMatches.length === 0) return null

        const roundPars = pars[round.id] ?? {}
        const isSingles = round.format === 'singles'
        const show9Only = round.holes <= 9

        // Build rows
        const rows: RowStats[] = []

        roundMatches.forEach(m => {
          const matchScores = scores.filter(s => s.match_id === m.id)
          const { t1: t1Result, t2: t2Result } = calcMatchResult(matchScores)

          const t1Color = m.team1_id === team1.id ? team1.color : team2.color
          const t1Label = isSingles ? m.team1_player_names[0] : m.team1_player_names.join(' & ')
          const t1Raw   = matchScores.map(s => ({ hole: s.hole_number, score: s.team1_score }))
          rows.push({ label: t1Label, color: t1Color, matchNumber: m.match_number, result: t1Result, ...calcStats(t1Raw, roundPars, round.holes) })

          const t2Color = m.team2_id === team1.id ? team1.color : team2.color
          const t2Label = isSingles ? m.team2_player_names[0] : m.team2_player_names.join(' & ')
          const t2Raw   = matchScores.map(s => ({ hole: s.hole_number, score: s.team2_score }))
          rows.push({ label: t2Label, color: t2Color, matchNumber: m.match_number, result: t2Result, ...calcStats(t2Raw, roundPars, round.holes) })
        })

        // Sort by total ascending (nulls last)
        rows.sort((a, b) => {
          if (a.total === null && b.total === null) return 0
          if (a.total === null) return 1
          if (b.total === null) return -1
          return a.total - b.total
        })

        // Team totals — lower total on top
        const totals = [
          sumRows(rows, team1.color),
          sumRows(rows, team2.color),
        ].sort((a, b) => {
          if (a.total === null && b.total === null) return 0
          if (a.total === null) return 1
          if (b.total === null) return -1
          return a.total - b.total
        })

        const n = (v: number | null) => v !== null ? String(v) : '—'

        return (
          <div key={round.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Round header */}
            <div className="bg-[#1a3a2a] px-4 py-3">
              <div className="text-white font-bold text-sm">{round.name}</div>
              <div className="text-white/50 text-xs">{round.holes} holes</div>
            </div>

            {/* Table — text-[10px] + tight padding to fit all columns on mobile without scrolling */}
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-2 py-2 font-semibold text-gray-500 whitespace-nowrap">
                      {isSingles ? 'Player' : 'Pair'}
                    </th>
                    <th className="text-center px-1 py-2 font-semibold text-gray-500">Res</th>
                    <th className="text-center px-1 py-2 font-semibold text-gray-500">F9</th>
                    {!show9Only && <th className="text-center px-1 py-2 font-semibold text-gray-500">B9</th>}
                    <th className="text-center px-1 py-2 font-semibold text-gray-500">Tot</th>
                    <th className="text-center px-1 py-2 font-semibold text-gray-500">Par</th>
                    <th className="text-center px-1 py-2 font-semibold text-gray-500">Bir</th>
                    <th className="text-center px-1 py-2 font-semibold text-gray-500">Bog</th>
                    <th className="text-center px-1 py-2 font-semibold text-gray-500">Dbl+</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-2 py-2 font-semibold whitespace-nowrap" style={{ color: row.color }}>
                        {row.label}
                      </td>
                      <td className="text-center px-1 py-2">
                        <ResultChip result={row.result} matchNum={row.matchNumber} />
                      </td>
                      <td className="text-center px-1 py-2 font-medium" style={{ color: row.color }}>{n(row.f9)}</td>
                      {!show9Only && <td className="text-center px-1 py-2 font-medium" style={{ color: row.color }}>{n(row.b9)}</td>}
                      <td className="text-center px-1 py-2 font-bold"   style={{ color: row.color }}>{n(row.total)}</td>
                      <td className="text-center px-1 py-2 font-medium" style={{ color: row.color }}>{row.pars    || '—'}</td>
                      <td className="text-center px-1 py-2 font-medium" style={{ color: row.color }}>{row.birdies || '—'}</td>
                      <td className="text-center px-1 py-2 font-medium" style={{ color: row.color }}>{row.bogeys  || '—'}</td>
                      <td className="text-center px-1 py-2 font-medium" style={{ color: row.color }}>{row.doubles || '—'}</td>
                    </tr>
                  ))}
                  {totals.map((t, i) => (
                    <tr key={`total-${i}`} className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="px-2 py-2 font-bold whitespace-nowrap" style={{ color: t.color }}>
                        {t.label}
                      </td>
                      <td /> {/* empty result cell */}
                      <td className="text-center px-1 py-2 font-bold" style={{ color: t.color }}>{n(t.f9)}</td>
                      {!show9Only && <td className="text-center px-1 py-2 font-bold" style={{ color: t.color }}>{n(t.b9)}</td>}
                      <td className="text-center px-1 py-2 font-bold" style={{ color: t.color }}>{n(t.total)}</td>
                      <td className="text-center px-1 py-2 font-bold" style={{ color: t.color }}>{t.pars    || '—'}</td>
                      <td className="text-center px-1 py-2 font-bold" style={{ color: t.color }}>{t.birdies || '—'}</td>
                      <td className="text-center px-1 py-2 font-bold" style={{ color: t.color }}>{t.bogeys  || '—'}</td>
                      <td className="text-center px-1 py-2 font-bold" style={{ color: t.color }}>{t.doubles || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
