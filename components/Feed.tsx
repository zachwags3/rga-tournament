'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buildFeed, formatFeedTime, type FeedPost } from '@/lib/feed'
import type { Round, Match, HoleScore, Team } from '@/types/database'

// Lighten only dark, low-saturation (gray) borders so they read distinctly from
// navy in the feed — navy and the light A/S neutral are left untouched.
function feedBorderColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const isGray = Math.max(r, g, b) - Math.min(r, g, b) <= 40
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  if (!isGray || luminance >= 170) return hex
  const blend = (c: number) => Math.round(c + (255 - c) * 0.3)
  return `#${[blend(r), blend(g), blend(b)].map(c => c.toString(16).padStart(2, '0')).join('')}`
}

export default function Feed() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [anyInProgress, setAnyInProgress] = useState(false)

  async function fetchAll() {
    const timeout = new Promise<null>(res => setTimeout(() => res(null), 5000))
    const fetches = Promise.all([
      supabase.from('teams').select('*').order('created_at'),
      supabase.from('rounds').select('*').order('sort_order'),
      supabase.from('matches').select('*').order('match_number'),
      supabase.from('hole_scores').select('*'),
      supabase.from('courses').select('id,round_id'),
      supabase.from('course_holes').select('course_id,hole_number,par'),
    ])
    const result = await Promise.race([fetches, timeout])
    if (!result) { setLoading(false); return }
    const [teamsRes, roundsRes, matchesRes, scoresRes, coursesRes, holesRes] = result

    const teams: Team[] = teamsRes.data ?? []
    const rounds: Round[] = roundsRes.data ?? []
    const matches: Match[] = matchesRes.data ?? []
    const holeScores: HoleScore[] = scoresRes.data ?? []
    const courses: { id: string; round_id: string }[] = coursesRes.data ?? []
    const courseHoles: { course_id: string; hole_number: number; par: number }[] = holesRes.data ?? []

    // course_id -> round_id
    const roundByCourse = new Map(courses.map(c => [c.id, c.round_id]))
    const parsByRound: Record<string, Record<number, number>> = {}
    for (const ch of courseHoles) {
      const roundId = roundByCourse.get(ch.course_id)
      if (!roundId) continue
      ;(parsByRound[roundId] ??= {})[ch.hole_number] = ch.par
    }

    setPosts(buildFeed({ rounds, matches, holeScores, teams, parsByRound }))
    setAnyInProgress(matches.some(m => m.status === 'in_progress'))
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_scores' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <>
      {/* Heading with live indicator: pulsing red when a match is underway, gray otherwise */}
      <div className="flex items-center gap-2.5 mb-6">
        <span className="relative flex h-3 w-3">
          {anyInProgress && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
          )}
          <span
            className={`relative inline-flex h-3 w-3 rounded-full ${anyInProgress ? 'bg-red-500' : 'bg-gray-400'}`}
          />
        </span>
        <h1 className="text-2xl font-bold text-[#091540]">Live Feed</h1>
      </div>

      {loading ? (
        <p className="text-[#091540]/50 text-sm text-center py-8">Loading feed…</p>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <p className="text-[#091540]/50 text-sm">
            No scores yet — entries will appear here live once play begins.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map(post => {
            const border = feedBorderColor(post.borderColor)
            return (
              <div
                key={post.id}
                className="rounded-xl shadow-sm border-4 px-4 py-3"
                style={{
                  borderColor: border,
                  backgroundColor: post.isResult ? `${post.borderColor}14` : '#ffffff',
                }}
              >
                {post.isResult && (
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: '#091540' }}
                  >
                    Final
                  </p>
                )}
                <p
                  className={`text-black leading-snug ${
                    post.isResult ? 'text-[15px] font-bold' : 'text-sm font-medium'
                  }`}
                >
                  {post.text}
                </p>
                <p className="text-[#091540]/40 text-xs mt-1">{formatFeedTime(post.ts)}</p>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
