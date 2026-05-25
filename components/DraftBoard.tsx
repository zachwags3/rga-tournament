'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Team, Player } from '@/types/database'

const ALL_PLAYERS = ['Charlie', 'Danny', 'Henry', 'Joe', 'Mike', 'Mitch', 'Nate', 'Sam', 'Sean', 'Zach']

// Snake draft: 1-2 | 2-1 | 1-2 | 2-1 | 1-2
// team index: 0 = Jack (C1), 1 = Pat (C2)
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

export default function DraftBoard() {
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [jackFirst, setJackFirst] = useState(true)
  const [picks, setPicks] = useState<(string | null)[][]>([
    [null, null, null, null, null], // team 0 slots 1-5
    [null, null, null, null, null], // team 1 slots 1-5
  ])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const timeout = new Promise<null>(res => setTimeout(() => res(null), 5000))
    const fetches = Promise.all([
      supabase.from('teams').select('*').order('created_at'),
      supabase.from('players').select('*').order('pick_number'),
    ])
    const result = await Promise.race([fetches, timeout])
    if (!result) { setLoading(false); return }
    const [t, p] = result
    setTeams(t.data ?? [])

    // Pre-fill picks from existing player data
    const existingPlayers: Player[] = p.data ?? []
    const newPicks: (string | null)[][] = [
      [null, null, null, null, null],
      [null, null, null, null, null],
    ]
    existingPlayers.filter(p => !p.is_captain).forEach(player => {
      const teamIndex = t.data?.findIndex((team: Team) => team.id === player.team_id) ?? -1
      if (teamIndex >= 0 && player.pick_number && player.pick_number >= 1 && player.pick_number <= 5) {
        newPicks[teamIndex][player.pick_number - 1] = player.name
      }
    })
    setPicks(newPicks)
    setPlayers(existingPlayers)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Determine the effective snake order based on who picks first
  const effectiveOrder = jackFirst ? SNAKE_ORDER : SNAKE_ORDER.map(p => ({ team: p.team === 0 ? 1 : 0, slot: p.slot }))

  // Find current pick index (first unfilled slot in order)
  const currentPickIndex = effectiveOrder.findIndex(
    ({ team, slot }) => picks[team][slot - 1] === null
  )
  const isDraftComplete = currentPickIndex === -1

  // Which players are already picked
  const pickedNames = new Set(picks.flat().filter(Boolean) as string[])
  const remaining = ALL_PLAYERS.filter(n => !pickedNames.has(n))

  function selectPlayer(name: string) {
    if (currentPickIndex === -1) return
    const { team, slot } = effectiveOrder[currentPickIndex]
    const newPicks = picks.map(row => [...row])
    newPicks[team][slot - 1] = name
    setPicks(newPicks)
    setSaved(false)
  }

  function undoLastPick() {
    // Find last filled pick in order
    let lastFilledIndex = -1
    for (let i = effectiveOrder.length - 1; i >= 0; i--) {
      const { team, slot } = effectiveOrder[i]
      if (picks[team][slot - 1] !== null) {
        lastFilledIndex = i
        break
      }
    }
    if (lastFilledIndex === -1) return
    const { team, slot } = effectiveOrder[lastFilledIndex]
    const newPicks = picks.map(row => [...row])
    newPicks[team][slot - 1] = null
    setPicks(newPicks)
    setSaved(false)
  }

  async function saveDraft() {
    if (teams.length < 2) return
    setSaving(true)

    // Delete existing non-captain players
    await supabase.from('players').delete().eq('is_captain', false)

    const insertions = []
    for (let teamIdx = 0; teamIdx < 2; teamIdx++) {
      for (let slot = 0; slot < 5; slot++) {
        const name = picks[teamIdx][slot]
        if (name) {
          insertions.push({
            name,
            team_id: teams[teamIdx].id,
            pick_number: slot + 1,
            is_captain: false,
          })
        }
      }
    }

    if (insertions.length > 0) {
      await supabase.from('players').insert(insertions)
    }

    await fetchData()
    setSaving(false)
    setSaved(true)
  }

  if (loading) {
    return <div className="p-8 text-center text-[#2d5a3d]">Loading draft board...</div>
  }

  if (teams.length < 2) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 text-sm">Initialize teams first in the Teams tab before using the draft board.</p>
      </div>
    )
  }

  const team0 = teams[0] // Jack
  const team1 = teams[1] // Pat

  const currentPick = currentPickIndex !== -1 ? effectiveOrder[currentPickIndex] : null
  const currentTeamName = currentPick
    ? (currentPick.team === 0 ? team0.name : team1.name)
    : null

  return (
    <div className="max-w-lg mx-auto px-4 pb-12">
      {/* Coin flip toggle */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <p className="text-xs font-semibold text-gray-500 mb-2 text-center">WHO HAS THE 1ST OVERALL PICK?</p>
        <div className="flex gap-2">
          <button
            onClick={() => { setJackFirst(true); setPicks([[null,null,null,null,null],[null,null,null,null,null]]); setSaved(false) }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${
              jackFirst ? 'bg-[#2d5a3d] text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {team0.captain_name} picks 1st
          </button>
          <button
            onClick={() => { setJackFirst(false); setPicks([[null,null,null,null,null],[null,null,null,null,null]]); setSaved(false) }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${
              !jackFirst ? 'bg-[#c9a84c] text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {team1.captain_name} picks 1st
          </button>
        </div>
      </div>

      {/* Current pick indicator */}
      {!isDraftComplete && currentTeamName && (
        <div className="text-center mb-4">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
            currentPick?.team === 0 ? 'bg-[#2d5a3d] text-white' : 'bg-[#c9a84c] text-white'
          }`}>
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Pick {currentPickIndex + 1} of 10 — {currentTeamName}&apos;s turn
          </div>
        </div>
      )}

      {isDraftComplete && (
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-green-600 text-white">
            ✅ Draft Complete!
          </div>
        </div>
      )}

      {/* Draft board grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[team0, team1].map((team, teamIdx) => (
          <div key={team.id}>
            {/* Captain header */}
            <div
              className="text-center py-3 rounded-xl font-bold text-white text-sm mb-2 shadow-sm"
              style={{ backgroundColor: team.color }}
            >
              <div className="text-lg">👑</div>
              <div>{team.captain_name}</div>
              <div className="text-white/70 text-xs font-normal">{team.name}</div>
            </div>

            {/* Pick slots */}
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(slot => {
                const player = picks[teamIdx][slot - 1]
                const isCurrentSlot = currentPick?.team === teamIdx && currentPick?.slot === slot

                return (
                  <div
                    key={slot}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${
                      isCurrentSlot
                        ? 'border-dashed border-gray-400 bg-gray-50 animate-pulse'
                        : player
                        ? 'border-transparent bg-white shadow-sm'
                        : 'border-transparent bg-gray-100'
                    }`}
                  >
                    <span className={`text-xs font-bold w-5 shrink-0 ${
                      player ? 'text-gray-400' : 'text-gray-300'
                    }`}>{slot}</span>
                    {player ? (
                      <span className="font-semibold text-[#1a3a2a] text-sm">{player}</span>
                    ) : (
                      <span className="text-gray-300 text-sm">{isCurrentSlot ? 'picking...' : '—'}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Player buttons */}
      {remaining.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 mb-2 text-center">TAP TO DRAFT</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {remaining.map(name => (
              <button
                key={name}
                onClick={() => selectPlayer(name)}
                disabled={isDraftComplete}
                className="px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl font-semibold text-sm text-[#1a3a2a] hover:border-[#2d5a3d] hover:bg-[#2d5a3d]/5 active:scale-95 transition-all disabled:opacity-40"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={undoLastPick}
          disabled={picks.flat().every(p => p === null)}
          className="flex-1 border border-gray-200 text-gray-500 py-3 rounded-xl font-semibold text-sm disabled:opacity-30 hover:bg-gray-50"
        >
          ↩ Undo
        </button>
        <button
          onClick={saveDraft}
          disabled={saving || picks.flat().filter(Boolean).length === 0}
          className="flex-2 bg-[#2d5a3d] text-white px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-[#1a3a2a] transition-colors"
        >
          {saving ? 'Saving...' : saved ? '✅ Saved!' : '💾 Save Draft'}
        </button>
      </div>

      <p className="text-center text-xs text-gray-400 mt-3">
        Save locks picks into Supabase and enables Sunday auto-fill
      </p>
    </div>
  )
}
