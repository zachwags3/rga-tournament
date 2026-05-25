'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Team, Player, Round, Match } from '@/types/database'
import DraftBoard from '@/components/DraftBoard'
import CourseAdmin from '@/components/CourseAdmin'

export default function AdminSetup() {
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'draft' | 'pairings' | 'courses' | 'rounds'>('draft')

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

  return (
    <div className="max-w-lg mx-auto px-4 pb-12">
      {/* Tabs */}
      <div className="flex bg-white rounded-xl border border-gray-200 p-1 mb-6">
        {(['draft', 'pairings', 'courses', 'rounds'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
              activeTab === tab ? 'bg-[#2d5a3d] text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* DRAFT TAB */}
      {activeTab === 'draft' && <DraftBoard onDraftSaved={fetchAll} />}

      {/* COURSES TAB */}
      {activeTab === 'courses' && <CourseAdmin />}

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

  // All players including captains, sorted by team
  const team1Players = players.filter(p => p.team_id === team1?.id).sort((a, b) => (a.pick_number ?? -1) - (b.pick_number ?? -1))
  const team2Players = players.filter(p => p.team_id === team2?.id).sort((a, b) => (a.pick_number ?? -1) - (b.pick_number ?? -1))

  async function addMatch() {
    if (!form.roundId || !form.team1p1 || !form.team2p1) return
    if (!isSingles && (!form.team1p2 || !form.team2p2)) return

    const roundMatches = matches.filter(m => m.round_id === form.roundId)
    const maxMatches = isSingles ? 6 : 3
    if (roundMatches.length >= maxMatches) {
      alert(`Maximum ${maxMatches} matches for this round.`)
      return
    }

    const t1Players = isSingles ? [form.team1p1] : [form.team1p1, form.team1p2]
    const t2Players = isSingles ? [form.team2p1] : [form.team2p1, form.team2p2]

    setSaving(true)
    await supabase.from('matches').insert({
      round_id: form.roundId,
      match_number: roundMatches.length + 1,
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

  if (teams.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <p className="text-gray-400 text-sm">Complete the draft first before setting pairings.</p>
      </div>
    )
  }

  // Only show Saturday rounds in the pairing form (Sunday is auto-set by draft)
  const saturdayRounds = rounds.filter(r => r.format !== 'singles')

  return (
    <div className="space-y-4">
      <div className="bg-[#1a3a2a]/5 rounded-xl p-3 text-center text-xs text-gray-500">
        Sunday singles are auto-set from the draft. Set pairings below for Saturday only.
      </div>

      {/* Add pairing form */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-bold text-[#1a3a2a] mb-3">Add Saturday Pairing</h2>

        <select
          value={form.roundId}
          onChange={e => setForm(prev => ({ ...prev, roundId: e.target.value, team1p1: '', team1p2: '', team2p1: '', team2p2: '' }))}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 outline-none focus:border-[#2d5a3d]"
        >
          <option value="">Select Round</option>
          {saturdayRounds.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        {form.roundId && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: team1?.color }}>{team1?.name}</div>
                <select value={form.team1p1} onChange={e => setForm(p => ({ ...p, team1p1: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-[#2d5a3d] mb-1">
                  <option value="">Player 1</option>
                  {team1Players.map(p => (
                    <option key={p.id} value={p.name}>
                      {p.name}{p.is_captain ? ' (C)' : ` #${p.pick_number}`}
                    </option>
                  ))}
                </select>
                <select value={form.team1p2} onChange={e => setForm(p => ({ ...p, team1p2: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-[#2d5a3d]">
                  <option value="">Player 2</option>
                  {team1Players.filter(p => p.name !== form.team1p1).map(p => (
                    <option key={p.id} value={p.name}>
                      {p.name}{p.is_captain ? ' (C)' : ` #${p.pick_number}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: team2?.color }}>{team2?.name}</div>
                <select value={form.team2p1} onChange={e => setForm(p => ({ ...p, team2p1: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-[#2d5a3d] mb-1">
                  <option value="">Player 1</option>
                  {team2Players.map(p => (
                    <option key={p.id} value={p.name}>
                      {p.name}{p.is_captain ? ' (C)' : ` #${p.pick_number}`}
                    </option>
                  ))}
                </select>
                <select value={form.team2p2} onChange={e => setForm(p => ({ ...p, team2p2: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-[#2d5a3d]">
                  <option value="">Player 2</option>
                  {team2Players.filter(p => p.name !== form.team2p1).map(p => (
                    <option key={p.id} value={p.name}>
                      {p.name}{p.is_captain ? ' (C)' : ` #${p.pick_number}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={addMatch}
              disabled={saving || !form.team1p1 || !form.team2p1 || !form.team1p2 || !form.team2p2}
              className="w-full bg-[#2d5a3d] text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-40"
            >
              {saving ? 'Adding...' : '+ Add Match'}
            </button>
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
                  {m.status === 'pending' && round.format !== 'singles' && (
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
              round.status === s ? 'bg-[#2d5a3d] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
