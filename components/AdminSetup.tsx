'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Team, Player, Round, Match } from '@/types/database'

// Pre-populated player list from the bylaws
const PLAYER_NAMES = ['Charlie', 'Danny', 'Henry', 'Joe', 'Mike', 'Mitch', 'Nate', 'Sam', 'Sean', 'Zach']
const CAPTAIN_NAMES = ['Jack', 'Pat']

export default function AdminSetup() {
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'teams' | 'pairings' | 'rounds'>('teams')

  const fetchAll = useCallback(async () => {
    const timeout = new Promise<null>(res => setTimeout(() => res(null), 5000))
    const fetches = Promise.all([
      supabase.from('teams').select('*').order('created_at'),
      supabase.from('players').select('*').order('pick_number'),
      supabase.from('rounds').select('*').order('sort_order'),
      supabase.from('matches').select('*').order('round_id,match_number'),
    ])
    const result = await Promise.race([fetches, timeout])
    if (!result) { setLoading(false); return }
    const [t, p, r, m] = result
    setTeams(t.data ?? [])
    setPlayers(p.data ?? [])
    setRounds(r.data ?? [])
    setMatches(m.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function setupTeams() {
    setSaving(true)
    // Delete existing teams + players (cascade)
    await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    const { data: teamsData } = await supabase.from('teams').insert([
      { name: "Team Jack", captain_name: "Jack", color: "#2d5a3d" },
      { name: "Team Pat", captain_name: "Pat", color: "#c9a84c" },
    ]).select()

    if (teamsData) {
      const jackTeam = teamsData[0]
      const patTeam = teamsData[1]
      await supabase.from('players').insert([
        { name: 'Jack', team_id: jackTeam.id, pick_number: 0, is_captain: true },
        { name: 'Pat', team_id: patTeam.id, pick_number: 0, is_captain: true },
      ])
    }

    await fetchAll()
    setSaving(false)
    setActiveTab('pairings')
  }

  async function assignPlayer(playerName: string, teamId: string, pickNumber: number) {
    setSaving(true)
    // Check if player already exists
    const existing = players.find(p => p.name === playerName)
    if (existing) {
      await supabase.from('players').update({ team_id: teamId, pick_number: pickNumber }).eq('id', existing.id)
    } else {
      await supabase.from('players').insert({ name: playerName, team_id: teamId, pick_number: pickNumber, is_captain: false })
    }
    await fetchAll()
    setSaving(false)
  }

  async function removePlayer(playerName: string) {
    setSaving(true)
    await supabase.from('players').delete().eq('name', playerName).eq('is_captain', false)
    await fetchAll()
    setSaving(false)
  }

  async function resetScores() {
    if (!confirm('This will delete ALL hole scores and reset all matches to pending. Are you sure?')) return
    setSaving(true)
    await supabase.from('hole_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('matches').update({
      status: 'pending', result: null, rga_points_team1: 0, rga_points_team2: 0
    }).neq('id', '00000000-0000-0000-0000-000000000000')
    await fetchAll()
    setSaving(false)
  }

  if (loading) return <div className="p-8 text-center text-[#2d5a3d]">Loading...</div>

  const team1 = teams[0]
  const team2 = teams[1]
  const draftedPlayers = players.filter(p => !p.is_captain)
  const assignedNames = new Set(players.map(p => p.name))
  const unassigned = PLAYER_NAMES.filter(n => !assignedNames.has(n))

  return (
    <div className="max-w-lg mx-auto px-4 pb-12">
      {/* Tabs */}
      <div className="flex bg-white rounded-xl border border-gray-200 p-1 mb-6">
        {(['teams', 'pairings', 'rounds'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
              activeTab === tab ? 'bg-[#2d5a3d] text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'pairings' ? 'Pairings' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* TEAMS TAB */}
      {activeTab === 'teams' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-bold text-[#1a3a2a] mb-1">Step 1: Initialize Teams</h2>
            <p className="text-gray-400 text-xs mb-4">
              This creates Team Jack and Team Pat with both captains. Run this once after the draft.
            </p>
            {teams.length === 0 ? (
              <button
                onClick={setupTeams}
                disabled={saving}
                className="w-full bg-[#2d5a3d] text-white py-3 rounded-xl font-bold disabled:opacity-50"
              >
                {saving ? 'Setting up...' : '⛳ Initialize Teams & Captains'}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="flex-1 bg-[#2d5a3d]/10 text-[#2d5a3d] text-center py-2 rounded-lg text-sm font-semibold">
                    ✅ {team1?.name}
                  </span>
                  <span className="flex-1 bg-[#c9a84c]/10 text-[#c9a84c] text-center py-2 rounded-lg text-sm font-semibold">
                    ✅ {team2?.name}
                  </span>
                </div>
                <button
                  onClick={setupTeams}
                  disabled={saving}
                  className="w-full border border-red-200 text-red-500 py-2 rounded-xl text-sm disabled:opacity-50 hover:bg-red-50"
                >
                  Reset Teams (clears all players)
                </button>
              </div>
            )}
          </div>

          {teams.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-bold text-[#1a3a2a] mb-1">Step 2: Assign Draft Picks</h2>
              <p className="text-gray-400 text-xs mb-4">
                Assign each of the 10 drafted players to a team with their pick number (1–5).
              </p>

              {/* Team rosters */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[team1, team2].map(team => {
                  if (!team) return null
                  const teamPlayers = draftedPlayers.filter(p => p.team_id === team.id).sort((a, b) => (a.pick_number ?? 0) - (b.pick_number ?? 0))
                  return (
                    <div key={team.id}>
                      <div className="text-xs font-bold mb-1" style={{ color: team.color }}>{team.name}</div>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
                          C: {team.captain_name}
                        </div>
                        {teamPlayers.map(p => (
                          <div key={p.id} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded text-xs">
                            <span className="font-medium">{p.pick_number}. {p.name}</span>
                            <button
                              onClick={() => removePlayer(p.name)}
                              className="text-red-400 hover:text-red-600 ml-1"
                            >×</button>
                          </div>
                        ))}
                        {teamPlayers.length < 5 && (
                          <div className="text-xs text-gray-300 text-center py-1">
                            {5 - teamPlayers.length} more needed
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Unassigned players */}
              {unassigned.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-2">Unassigned ({unassigned.length})</div>
                  <div className="space-y-2">
                    {unassigned.map(name => (
                      <PlayerAssignRow
                        key={name}
                        name={name}
                        team1={team1}
                        team2={team2}
                        draftedPlayers={draftedPlayers}
                        onAssign={assignPlayer}
                        disabled={saving}
                      />
                    ))}
                  </div>
                </div>
              )}

              {unassigned.length === 0 && draftedPlayers.length === 10 && (
                <div className="text-center text-[#2d5a3d] text-sm font-semibold bg-[#2d5a3d]/10 rounded-xl py-3">
                  ✅ All 10 players assigned! Go to Pairings →
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PAIRINGS TAB */}
      {activeTab === 'pairings' && (
        <PairingsTab teams={teams} players={players} rounds={rounds} matches={matches} onRefresh={fetchAll} />
      )}

      {/* ROUNDS TAB */}
      {activeTab === 'rounds' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-bold text-[#1a3a2a] mb-3">Round Status</h2>
            {rounds.map(round => (
              <RoundStatusRow key={round.id} round={round} onRefresh={fetchAll} />
            ))}
          </div>

          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <h2 className="font-bold text-red-700 mb-1">Danger Zone</h2>
            <p className="text-red-500 text-xs mb-3">
              Reset all hole scores and match results. Teams and pairings are preserved.
            </p>
            <button
              onClick={resetScores}
              disabled={saving}
              className="w-full border border-red-300 text-red-600 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 hover:bg-red-100"
            >
              🗑️ Reset All Scores
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PlayerAssignRow({
  name, team1, team2, draftedPlayers, onAssign, disabled
}: {
  name: string
  team1?: Team
  team2?: Team
  draftedPlayers: Player[]
  onAssign: (name: string, teamId: string, pick: number) => void
  disabled: boolean
}) {
  const [selectedTeam, setSelectedTeam] = useState('')
  const [pick, setPick] = useState('')

  const t1Picks = draftedPlayers.filter(p => p.team_id === team1?.id).map(p => p.pick_number)
  const t2Picks = draftedPlayers.filter(p => p.team_id === team2?.id).map(p => p.pick_number)
  const takenPicks = selectedTeam === team1?.id ? t1Picks : selectedTeam === team2?.id ? t2Picks : []

  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm font-semibold text-[#1a3a2a] w-14 shrink-0">{name}</span>
      <select
        value={selectedTeam}
        onChange={e => { setSelectedTeam(e.target.value); setPick('') }}
        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#2d5a3d]"
      >
        <option value="">Team</option>
        {team1 && <option value={team1.id}>Team Jack</option>}
        {team2 && <option value={team2.id}>Team Pat</option>}
      </select>
      <select
        value={pick}
        onChange={e => setPick(e.target.value)}
        disabled={!selectedTeam}
        className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#2d5a3d] disabled:opacity-40"
      >
        <option value="">Pick</option>
        {[1, 2, 3, 4, 5].filter(n => !takenPicks.includes(n)).map(n => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <button
        onClick={() => {
          if (selectedTeam && pick) onAssign(name, selectedTeam, parseInt(pick))
        }}
        disabled={!selectedTeam || !pick || disabled}
        className="bg-[#2d5a3d] text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
      >
        Add
      </button>
    </div>
  )
}

function PairingsTab({
  teams, players, rounds, matches, onRefresh
}: {
  teams: Team[]
  players: Player[]
  rounds: Round[]
  matches: Match[]
  onRefresh: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{
    roundId: string
    team1p1: string
    team1p2: string
    team2p1: string
    team2p2: string
  }>({ roundId: '', team1p1: '', team1p2: '', team2p1: '', team2p2: '' })

  const team1 = teams[0]
  const team2 = teams[1]

  const selectedRound = rounds.find(r => r.id === form.roundId)
  const isSingles = selectedRound?.format === 'singles'

  const team1Players = players.filter(p => p.team_id === team1?.id).sort((a, b) => (a.pick_number ?? -1) - (b.pick_number ?? -1))
  const team2Players = players.filter(p => p.team_id === team2?.id).sort((a, b) => (a.pick_number ?? -1) - (b.pick_number ?? -1))

  async function addMatch() {
    if (!form.roundId || !form.team1p1 || !form.team2p1) return
    if (!isSingles && (!form.team1p2 || !form.team2p2)) return

    const roundMatches = matches.filter(m => m.round_id === form.roundId)
    const nextNum = roundMatches.length + 1
    const maxMatches = isSingles ? 6 : 3
    if (nextNum > maxMatches) {
      alert(`Maximum ${maxMatches} matches for this round.`)
      return
    }

    const t1Players = isSingles ? [form.team1p1] : [form.team1p1, form.team1p2]
    const t2Players = isSingles ? [form.team2p1] : [form.team2p1, form.team2p2]

    setSaving(true)
    await supabase.from('matches').insert({
      round_id: form.roundId,
      match_number: nextNum,
      team1_player_names: t1Players,
      team2_player_names: t2Players,
      team1_id: team1?.id,
      team2_id: team2?.id,
      status: 'pending',
      rga_points_team1: 0,
      rga_points_team2: 0,
    })
    setForm({ roundId: form.roundId, team1p1: '', team1p2: '', team2p1: '', team2p2: '' })
    await onRefresh()
    setSaving(false)
  }

  async function deleteMatch(matchId: string) {
    if (!confirm('Delete this match?')) return
    setSaving(true)
    await supabase.from('hole_scores').delete().eq('match_id', matchId)
    await supabase.from('matches').delete().eq('id', matchId)
    await onRefresh()
    setSaving(false)
  }

  async function autoFillSunday() {
    const sundayRound = rounds.find(r => r.format === 'singles')
    if (!sundayRound) return
    if (!confirm('Auto-fill Sunday pairings based on draft pick numbers? This will add matches for all 6 pairs.')) return

    setSaving(true)
    // Captain match (pick 0 vs 0)
    const captains1 = team1Players.filter(p => p.is_captain || p.pick_number === 0)
    const captains2 = team2Players.filter(p => p.is_captain || p.pick_number === 0)

    // Pick 1-5 matches
    const insertions = []
    for (let pick = 1; pick <= 5; pick++) {
      const p1 = team1Players.find(p => p.pick_number === pick)
      const p2 = team2Players.find(p => p.pick_number === pick)
      if (p1 && p2) {
        insertions.push({
          round_id: sundayRound.id,
          match_number: pick,
          team1_player_names: [p1.name],
          team2_player_names: [p2.name],
          team1_id: team1?.id,
          team2_id: team2?.id,
          status: 'pending' as const,
          rga_points_team1: 0,
          rga_points_team2: 0,
        })
      }
    }
    // Captain match is always last (match 6)
    if (captains1[0] && captains2[0]) {
      insertions.push({
        round_id: sundayRound.id,
        match_number: 6,
        team1_player_names: [captains1[0].name],
        team2_player_names: [captains2[0].name],
        team1_id: team1?.id,
        team2_id: team2?.id,
        status: 'pending' as const,
        rga_points_team1: 0,
        rga_points_team2: 0,
      })
    }

    if (insertions.length > 0) {
      await supabase.from('matches').insert(insertions)
    }
    await onRefresh()
    setSaving(false)
  }

  if (teams.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <p className="text-gray-400 text-sm">Set up teams first in the Teams tab.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Add pairing form */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-bold text-[#1a3a2a] mb-3">Add Pairing</h2>

        <select
          value={form.roundId}
          onChange={e => setForm(prev => ({ ...prev, roundId: e.target.value, team1p1: '', team1p2: '', team2p1: '', team2p2: '' }))}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 outline-none focus:border-[#2d5a3d]"
        >
          <option value="">Select Round</option>
          {rounds.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        {form.roundId && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <div className="text-xs font-semibold text-[#2d5a3d] mb-1">{team1?.name}</div>
                <select value={form.team1p1} onChange={e => setForm(p => ({ ...p, team1p1: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-[#2d5a3d] mb-1">
                  <option value="">Player 1</option>
                  {team1Players.map(p => <option key={p.id} value={p.name}>{p.name}{p.is_captain ? ' (C)' : ` #${p.pick_number}`}</option>)}
                </select>
                {!isSingles && (
                  <select value={form.team1p2} onChange={e => setForm(p => ({ ...p, team1p2: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-[#2d5a3d]">
                    <option value="">Player 2</option>
                    {team1Players.filter(p => p.name !== form.team1p1).map(p => <option key={p.id} value={p.name}>{p.name}{p.is_captain ? ' (C)' : ` #${p.pick_number}`}</option>)}
                  </select>
                )}
              </div>
              <div>
                <div className="text-xs font-semibold text-[#c9a84c] mb-1">{team2?.name}</div>
                <select value={form.team2p1} onChange={e => setForm(p => ({ ...p, team2p1: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-[#2d5a3d] mb-1">
                  <option value="">Player 1</option>
                  {team2Players.map(p => <option key={p.id} value={p.name}>{p.name}{p.is_captain ? ' (C)' : ` #${p.pick_number}`}</option>)}
                </select>
                {!isSingles && (
                  <select value={form.team2p2} onChange={e => setForm(p => ({ ...p, team2p2: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-[#2d5a3d]">
                    <option value="">Player 2</option>
                    {team2Players.filter(p => p.name !== form.team2p1).map(p => <option key={p.id} value={p.name}>{p.name}{p.is_captain ? ' (C)' : ` #${p.pick_number}`}</option>)}
                  </select>
                )}
              </div>
            </div>

            <button
              onClick={addMatch}
              disabled={saving || !form.team1p1 || !form.team2p1 || (!isSingles && (!form.team1p2 || !form.team2p2))}
              className="w-full bg-[#2d5a3d] text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-40"
            >
              {saving ? 'Adding...' : '+ Add Match'}
            </button>

            {selectedRound?.format === 'singles' && (
              <button
                onClick={autoFillSunday}
                disabled={saving || team1Players.filter(p => !p.is_captain).length < 5}
                className="w-full mt-2 border border-[#2d5a3d] text-[#2d5a3d] py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 hover:bg-[#2d5a3d]/5"
              >
                ⚡ Auto-fill Sunday (by pick #)
              </button>
            )}
          </>
        )}
      </div>

      {/* Existing matches by round */}
      {rounds.map(round => {
        const roundMatches = matches.filter(m => m.round_id === round.id).sort((a, b) => a.match_number - b.match_number)
        if (roundMatches.length === 0) return null
        return (
          <div key={round.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-bold text-[#1a3a2a] text-sm mb-3">{round.name}</h3>
            <div className="space-y-2">
              {roundMatches.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-600">
                    <span className="font-semibold">{m.team1_player_names.join(' & ')}</span>
                    <span className="text-gray-400 mx-2">vs</span>
                    <span className="font-semibold">{m.team2_player_names.join(' & ')}</span>
                  </div>
                  {m.status === 'pending' && (
                    <button onClick={() => deleteMatch(m.id)} className="text-red-400 hover:text-red-600 text-xs ml-2 shrink-0">
                      Remove
                    </button>
                  )}
                  {m.status !== 'pending' && (
                    <span className="text-xs text-gray-400 ml-2 shrink-0">
                      {m.status === 'complete' ? '✅' : '🔴'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RoundStatusRow({ round, onRefresh }: { round: Round; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false)

  async function setStatus(status: Round['status']) {
    setSaving(true)
    await supabase.from('rounds').update({ status }).eq('id', round.id)
    await onRefresh()
    setSaving(false)
  }

  const statusColors: Record<string, string> = {
    pending: 'text-gray-400',
    active: 'text-blue-600',
    complete: 'text-green-600',
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <div className="text-sm font-semibold text-[#1a3a2a]">{round.name}</div>
        <div className={`text-xs font-medium ${statusColors[round.status]}`}>{round.status}</div>
      </div>
      <div className="flex gap-1.5">
        {(['pending', 'active', 'complete'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            disabled={saving || round.status === s}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
              round.status === s
                ? 'bg-[#2d5a3d] text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
