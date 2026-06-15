'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Team } from '@/types/database'

const ALL_12 = ['Charlie', 'Danny', 'Henry', 'Jack', 'Joe', 'Mike', 'Mitch', 'Nate', 'Pat', 'Sam', 'Sean', 'Zach']

// Snake draft: 1-2 | 2-1 | 1-2 | 2-1 | 1-2
const SNAKE_ORDER = [
  { team: 0, slot: 1 },
  { team: 1, slot: 1 },
  { team: 1, slot: 2 },
  { team: 0, slot: 2 },
  { team: 0, slot: 3 },
  { team: 1, slot: 3 },
  { team: 1, slot: 4 },
  { team: 0, slot: 4 },
  { team: 0, slot: 5 },
  { team: 1, slot: 5 },
]

type Phase = 'loading' | 'select-captains' | 'drafting' | 'name-teams' | 'saved'

// Returns "1.01", "2.02" etc. for a given team/slot within a pick order
function pickLabel(teamIdx: number, slot: number, order: typeof SNAKE_ORDER): string {
  const overall = order.findIndex(p => p.team === teamIdx && p.slot === slot) + 1
  if (overall === 0) return `${slot}`
  const round = Math.ceil(overall / 2)
  const pos = ((overall - 1) % 2) + 1
  return `${round}.0${pos}`
}

export default function DraftBoard({ onDraftSaved }: { onDraftSaved?: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [captains, setCaptains] = useState<string[]>([])
  const [cap1First, setCap1First] = useState(true)
  const [picks, setPicks] = useState<(string | null)[][]>([
    [null, null, null, null, null],
    [null, null, null, null, null],
  ])
  const [teams, setTeams] = useState<Team[]>([])
  const [teamName0, setTeamName0] = useState('')
  const [teamName1, setTeamName1] = useState('')
  const [saving, setSaving] = useState(false)

  const loadExisting = useCallback(async () => {
    const timeout = new Promise<null>(res => setTimeout(() => res(null), 5000))
    const fetches = Promise.all([
      supabase.from('teams').select('*').order('created_at'),
      supabase.from('players').select('*').order('pick_number'),
    ])
    const result = await Promise.race([fetches, timeout])
    if (!result) { setPhase('select-captains'); return }
    const [t, p] = result

    const teamsData: Team[] = t.data ?? []
    const playersData = p.data ?? []

    if (teamsData.length >= 2 && playersData.length > 0) {
      setTeams(teamsData)
      setTeamName0(teamsData[0].name)
      setTeamName1(teamsData[1].name)
      const newPicks: (string | null)[][] = [
        [null, null, null, null, null],
        [null, null, null, null, null],
      ]
      playersData.filter((pl: { is_captain: boolean }) => !pl.is_captain).forEach((pl: { team_id: string; pick_number: number; name: string }) => {
        const ti = teamsData.findIndex((tm: Team) => tm.id === pl.team_id)
        if (ti >= 0 && pl.pick_number >= 1 && pl.pick_number <= 5) {
          newPicks[ti][pl.pick_number - 1] = pl.name
        }
      })
      setPicks(newPicks)
      setCaptains([teamsData[0].captain_name, teamsData[1].captain_name])
      setPhase('saved')
    } else {
      setPhase('select-captains')
    }
  }, [])

  useEffect(() => { loadExisting() }, [loadExisting])

  // Effective snake order based on who picks first
  const effectiveOrder = cap1First
    ? SNAKE_ORDER
    : SNAKE_ORDER.map(p => ({ team: p.team === 0 ? 1 : 0, slot: p.slot }))

  const currentPickIndex = effectiveOrder.findIndex(
    ({ team, slot }) => picks[team][slot - 1] === null
  )
  const isDraftComplete = currentPickIndex === -1

  const pickedNames = new Set([
    ...(picks.flat().filter(Boolean) as string[]),
    ...(captains as string[]),
  ])
  const remaining = ALL_12.filter(n => !pickedNames.has(n))

  function toggleCaptain(name: string) {
    setCaptains(prev => {
      if (prev.includes(name)) return prev.filter(c => c !== name)
      if (prev.length >= 2) return prev
      return [...prev, name]
    })
  }

  function startDraft() {
    if (captains.length !== 2) return
    setPicks([[null, null, null, null, null], [null, null, null, null, null]])
    setPhase('drafting')
  }

  function selectPlayer(name: string) {
    if (currentPickIndex === -1) return
    const { team, slot } = effectiveOrder[currentPickIndex]
    const newPicks = picks.map(row => [...row])
    newPicks[team][slot - 1] = name
    setPicks(newPicks)
  }

  function undoLastPick() {
    for (let i = effectiveOrder.length - 1; i >= 0; i--) {
      const { team, slot } = effectiveOrder[i]
      if (picks[team][slot - 1] !== null) {
        const newPicks = picks.map(row => [...row])
        newPicks[team][slot - 1] = null
        setPicks(newPicks)
        return
      }
    }
  }

  async function saveDraft() {
    if (captains.length !== 2) return
    setSaving(true)

    // Clear everything first
    await supabase.from('hole_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Create teams
    const cap0 = cap1First ? captains[0] : captains[1]
    const cap1 = cap1First ? captains[1] : captains[0]

    const { data: teamsData } = await supabase.from('teams').insert([
      { name: `Team ${cap0}`, captain_name: cap0, color: '#6b7280' },
      { name: `Team ${cap1}`, captain_name: cap1, color: '#1e3a8a' },
    ]).select()

    if (!teamsData || teamsData.length < 2) { setSaving(false); return }
    setTeams(teamsData)

    // Insert captains as players (pick_number 0)
    const playerInsertions: { name: string; team_id: string; pick_number: number; is_captain: boolean }[] = [
      { name: cap0, team_id: teamsData[0].id, pick_number: 0, is_captain: true },
      { name: cap1, team_id: teamsData[1].id, pick_number: 0, is_captain: true },
    ]

    // Insert drafted players
    for (let teamIdx = 0; teamIdx < 2; teamIdx++) {
      for (let slot = 0; slot < 5; slot++) {
        const name = picks[teamIdx][slot]
        if (name) {
          playerInsertions.push({
            name,
            team_id: teamsData[teamIdx].id,
            pick_number: slot + 1,
            is_captain: false,
          })
        }
      }
    }
    await supabase.from('players').insert(playerInsertions)

    // Auto-generate Sunday singles pairings
    const roundRes = await supabase.from('rounds').select('*').eq('format', 'singles').single()
    if (roundRes.data) {
      const matchInsertions = []
      for (let slot = 0; slot < 5; slot++) {
        const p0 = picks[0][slot]
        const p1 = picks[1][slot]
        if (p0 && p1) {
          matchInsertions.push({
            round_id: roundRes.data.id,
            match_number: slot + 1,
            team1_player_names: [p0],
            team2_player_names: [p1],
            team1_id: teamsData[0].id,
            team2_id: teamsData[1].id,
            status: 'pending' as const,
            rga_points_team1: 0,
            rga_points_team2: 0,
          })
        }
      }
      // Captain anchor match (always match 6)
      matchInsertions.push({
        round_id: roundRes.data.id,
        match_number: 6,
        team1_player_names: [cap0],
        team2_player_names: [cap1],
        team1_id: teamsData[0].id,
        team2_id: teamsData[1].id,
        status: 'pending' as const,
        rga_points_team1: 0,
        rga_points_team2: 0,
      })
      await supabase.from('matches').insert(matchInsertions)
    }

    // Pre-fill name inputs with defaults
    setTeamName0(`Team ${cap0}`)
    setTeamName1(`Team ${cap1}`)
    setSaving(false)
    setPhase('name-teams')
  }

  async function saveTeamNames() {
    if (teams.length < 2) return
    setSaving(true)
    await Promise.all([
      supabase.from('teams').update({ name: teamName0 || `Team ${teams[0].captain_name}` }).eq('id', teams[0].id),
      supabase.from('teams').update({ name: teamName1 || `Team ${teams[1].captain_name}` }).eq('id', teams[1].id),
    ])
    const updated = [
      { ...teams[0], name: teamName0 || teams[0].name },
      { ...teams[1], name: teamName1 || teams[1].name },
    ]
    setTeams(updated)
    setSaving(false)
    setPhase('saved')
    onDraftSaved?.()
  }

  async function deleteDraft() {
    if (!confirm('Delete the entire draft? This will clear all teams, players, pairings, and scores.')) return
    setSaving(true)
    await supabase.from('hole_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setCaptains([])
    setPicks([[null,null,null,null,null],[null,null,null,null,null]])
    setTeams([])
    setSaving(false)
    setPhase('select-captains')
  }

  const cap0Name = captains[0] ?? ''
  const cap1Name = captains[1] ?? ''
  const displayCap0 = cap1First ? cap0Name : cap1Name
  const displayCap1 = cap1First ? cap1Name : cap0Name

  if (phase === 'loading') {
    return <div className="p-8 text-center text-[#2d5a3d]">Loading...</div>
  }

  // ── PHASE 1: Select Captains ──────────────────────────────
  if (phase === 'select-captains') {
    return (
      <div className="max-w-lg mx-auto px-4 pb-12">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          <h2 className="font-bold text-[#1a3a2a] text-base mb-1">Step 1 — Select Captains</h2>
          <p className="text-gray-400 text-xs mb-4">Tap 2 players to be captains. They lead the snake draft.</p>
          <div className="flex flex-wrap gap-2">
            {ALL_12.map(name => {
              const isCap = (captains as string[]).includes(name)
              const capIdx = (captains as string[]).indexOf(name)
              return (
                <button
                  key={name}
                  onClick={() => toggleCaptain(name)}
                  className={`px-4 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all ${
                    isCap
                      ? capIdx === 0
                        ? 'bg-[#2d5a3d] border-[#2d5a3d] text-white'
                        : 'bg-[#c9a84c] border-[#c9a84c] text-white'
                      : 'bg-white border-gray-200 text-[#1a3a2a] hover:border-gray-400'
                  }`}
                >
                  {isCap && '👑 '}{name}
                </button>
              )
            })}
          </div>
        </div>

        {captains.length === 2 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <h2 className="font-bold text-[#1a3a2a] text-base mb-1">Step 2 — Who picks 1st?</h2>
            <p className="text-gray-400 text-xs mb-3">Winner of the coin flip gets 1st overall pick.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setCap1First(true)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                  cap1First ? 'bg-[#2d5a3d] text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {cap0Name} picks 1st
              </button>
              <button
                onClick={() => setCap1First(false)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                  !cap1First ? 'bg-[#c9a84c] text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {cap1Name} picks 1st
              </button>
            </div>
          </div>
        )}

        <button
          onClick={startDraft}
          disabled={captains.length !== 2}
          className="w-full bg-[#2d5a3d] text-white py-4 rounded-xl font-bold text-base disabled:opacity-30 hover:bg-[#1a3a2a] transition-colors shadow-lg"
        >
          Start Draft →
        </button>
      </div>
    )
  }

  // ── PHASE 2: Snake Draft ──────────────────────────────────
  if (phase === 'drafting') {
    const currentPick = currentPickIndex !== -1 ? effectiveOrder[currentPickIndex] : null
    const currentCapName = currentPick
      ? (currentPick.team === 0 ? displayCap0 : displayCap1)
      : null

    return (
      <div className="max-w-lg mx-auto px-4 pb-12">
        {/* Current pick indicator */}
        {!isDraftComplete && currentCapName && (
          <div className="text-center mb-4">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
              currentPick?.team === 0 ? 'bg-[#2d5a3d] text-white' : 'bg-[#c9a84c] text-white'
            }`}>
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Pick {currentPickIndex + 1} of 10 — {currentCapName}&apos;s turn
            </div>
          </div>
        )}
        {isDraftComplete && (
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-green-600 text-white">
              ✅ Draft Complete — save to lock in pairings
            </div>
          </div>
        )}

        {/* Board */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[0, 1].map(teamIdx => {
            const capName = teamIdx === 0 ? displayCap0 : displayCap1
            const color = teamIdx === 0 ? '#6b7280' : '#1e3a8a'
            return (
              <div key={teamIdx}>
                <div className="text-center py-3 rounded-xl font-bold text-white text-sm mb-2 shadow-sm" style={{ backgroundColor: color }}>
                  <div className="text-lg">👑</div>
                  <div>{capName}</div>
                  <div className="text-white/70 text-xs font-normal">Captain</div>
                </div>
                <div className="space-y-2">
                  {[1,2,3,4,5].map(slot => {
                    const player = picks[teamIdx][slot - 1]
                    const isCurrentSlot = currentPick?.team === teamIdx && currentPick?.slot === slot
                    return (
                      <div key={slot} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${
                        isCurrentSlot ? 'border-dashed border-gray-400 bg-gray-50 animate-pulse'
                        : player ? 'border-transparent bg-white shadow-sm'
                        : 'border-transparent bg-gray-100'
                      }`}>
                        <span className={`text-xs font-bold w-8 shrink-0 ${player ? 'text-gray-400' : 'text-gray-300'}`}>{pickLabel(teamIdx, slot, effectiveOrder)}</span>
                        {player
                          ? <span className="font-semibold text-[#1a3a2a] text-sm">{player}</span>
                          : <span className="text-gray-300 text-sm">{isCurrentSlot ? 'picking...' : '—'}</span>
                        }
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Player buttons */}
        {remaining.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 mb-2 text-center">TAP TO DRAFT</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {remaining.map(name => (
                <button key={name} onClick={() => selectPlayer(name)} disabled={isDraftComplete}
                  className="px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl font-semibold text-sm text-[#1a3a2a] hover:border-[#2d5a3d] active:scale-95 transition-all disabled:opacity-40">
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mb-2">
          <button onClick={undoLastPick} disabled={picks.flat().every(p => p === null)}
            className="flex-1 border border-gray-200 text-gray-500 py-3 rounded-xl font-semibold text-sm disabled:opacity-30 hover:bg-gray-50">
            ↩ Undo
          </button>
          <button onClick={saveDraft} disabled={saving || !isDraftComplete}
            className="flex-[2] bg-[#2d5a3d] text-white px-4 py-3 rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-[#1a3a2a] transition-colors">
            {saving ? 'Saving...' : '💾 Save & Set Sunday Pairings'}
          </button>
        </div>
        <button onClick={deleteDraft} disabled={saving}
          className="w-full border border-red-200 text-red-400 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-50 disabled:opacity-40">
          🗑 Delete Draft
        </button>
      </div>
    )
  }

  // ── PHASE 3: Name Your Teams ─────────────────────────────
  if (phase === 'name-teams') {
    const cap0 = cap1First ? captains[0] : captains[1]
    const cap1 = cap1First ? captains[1] : captains[0]
    return (
      <div className="max-w-lg mx-auto px-4 pb-12">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
          <div className="text-center mb-5">
            <div className="text-3xl mb-2">🏆</div>
            <h2 className="font-bold text-[#1a3a2a] text-lg">Name Your Teams</h2>
            <p className="text-gray-400 text-xs mt-1">These names show on the leaderboard. Leave blank to use default.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#2d5a3d] block mb-1">
                👑 {cap0}&apos;s Team (Green)
              </label>
              <input
                type="text"
                value={teamName0}
                onChange={e => setTeamName0(e.target.value)}
                placeholder={`Team ${cap0}`}
                className="w-full border-2 border-[#2d5a3d]/30 focus:border-[#2d5a3d] rounded-xl px-4 py-3 text-sm outline-none font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#c9a84c] block mb-1">
                👑 {cap1}&apos;s Team (Gold)
              </label>
              <input
                type="text"
                value={teamName1}
                onChange={e => setTeamName1(e.target.value)}
                placeholder={`Team ${cap1}`}
                className="w-full border-2 border-[#c9a84c]/30 focus:border-[#c9a84c] rounded-xl px-4 py-3 text-sm outline-none font-semibold"
              />
            </div>
          </div>
        </div>
        <button
          onClick={saveTeamNames}
          disabled={saving}
          className="w-full bg-[#2d5a3d] text-white py-4 rounded-xl font-bold text-base disabled:opacity-40 hover:bg-[#1a3a2a] transition-colors shadow-lg"
        >
          {saving ? 'Saving...' : '✅ Save Team Names & Finish Draft'}
        </button>
      </div>
    )
  }

  // ── PHASE 4: Saved / View ─────────────────────────────────
  const team0 = teams[0]
  const team1 = teams[1]

  return (
    <div className="max-w-lg mx-auto px-4 pb-12">
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-center text-sm text-green-700 font-semibold">
        ✅ Draft saved — Sunday pairings set
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {[team0, team1].map((team, teamIdx) => {
          if (!team) return null
          return (
            <div key={team.id}>
              <div className="text-center py-3 rounded-xl font-bold text-white text-sm mb-2 shadow-sm" style={{ backgroundColor: team.color }}>
                <div className="text-lg">👑</div>
                <div>{team.captain_name}</div>
                <div className="text-white/70 text-xs font-normal">{team.name}</div>
              </div>
              <div className="space-y-2">
                {[1,2,3,4,5].map(slot => {
                  const player = picks[teamIdx][slot - 1]
                  return (
                    <div key={slot} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white shadow-sm">
                      <span className="text-xs font-bold w-8 shrink-0 text-gray-400">{pickLabel(teamIdx, slot, SNAKE_ORDER)}</span>
                      <span className="font-semibold text-[#1a3a2a] text-sm">{player ?? '—'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-[#1a3a2a]/5 rounded-xl p-3 mb-4 text-center text-xs text-gray-500">
        Sunday matchups auto-set: Pick 1 vs Pick 1 … Pick 5 vs Pick 5 · Captains anchor match 6
      </div>

      <button onClick={deleteDraft} disabled={saving}
        className="w-full border border-red-200 text-red-500 py-3 rounded-xl text-sm font-bold hover:bg-red-50 disabled:opacity-40">
        🗑 Delete Draft & Start Over
      </button>
    </div>
  )
}
