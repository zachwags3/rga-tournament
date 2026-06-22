'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buildFeed, formatFeedTime, type FeedPost } from '@/lib/feed'
import type { Round, Match, HoleScore, Team } from '@/types/database'

export default function Feed() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return <p className="text-[#091540]/50 text-sm text-center py-8">Loading feed…</p>
  }

  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <p className="text-[#091540]/50 text-sm">
          No scores yet — entries will appear here live once play begins.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {posts.map(post => (
        <div
          key={post.id}
          className="bg-white rounded-xl shadow-sm border-[3px] px-4 py-3"
          style={{ borderColor: post.borderColor }}
        >
          <p className="text-[#091540] text-sm leading-snug font-medium">{post.text}</p>
          <p className="text-[#091540]/40 text-xs mt-1">{formatFeedTime(post.ts)}</p>
        </div>
      ))}
    </div>
  )
}
