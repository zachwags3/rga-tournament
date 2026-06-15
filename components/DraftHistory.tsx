'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Team } from '@/types/database'

// Same snake order as DraftBoard
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

function pickLabel(teamIdx: number, slot: number): string {
  const overall = SNAKE_ORDER.findIndex(p => p.team === teamIdx && p.slot === slot) + 1
  if (overall === 0) return `${slot}`
  const round = Math.ceil(overall / 2)
  const pos = ((overall - 1) % 2) + 1
  return `${round}.0${pos}`
}

type Player = { id: string; name: string; team_id: string; pick_number: number; is_captain: boolean }

export default function DraftHistory() {
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [t, p] = await Promise.all([
        supabase.from('teams').select('*').order('created_at'),
        supabase.from('players').select('*').order('pick_number'),
      ])
      setTeams(t.data ?? [])
      setPlayers(p.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-8 text-center text-[#2d5a3d]">Loading draft...</div>
  if (teams.length < 2) return null

  const team0 = teams[0]
  const team1 = teams[1]

  return (
    <div className="mb-6">
      <h2 className="text-[#1a3a2a] font-bold text-base mb-3 px-1">2026 Draft Board</h2>
      <div className="grid grid-cols-2 gap-3">
        {[team0, team1].map((team, teamIdx) => {
          const teamPlayers = players.filter(p => p.team_id === team.id && !p.is_captain)
            .sort((a, b) => a.pick_number - b.pick_number)
          const cardBg = teamIdx === 0 ? '#6b7280' : '#091540'

          return (
            <div key={team.id}>
              {/* Captain header */}
              <div
                className="text-center py-3 rounded-xl font-bold text-white text-sm mb-2 shadow-sm"
                style={{ backgroundColor: cardBg }}
              >
                <div className="text-lg">👑</div>
                <div>{team.captain_name}</div>
                <div className="text-white/70 text-xs font-normal">{team.name}</div>
              </div>

              {/* Picks */}
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(slot => {
                  const player = teamPlayers.find(p => p.pick_number === slot)
                  return (
                    <div key={slot} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white shadow-sm border border-gray-100">
                      <span className="text-xs font-bold w-8 shrink-0 text-gray-400">
                        {pickLabel(teamIdx, slot)}
                      </span>
                      <span className="font-semibold text-[#1a3a2a] text-sm">
                        {player?.name ?? '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
