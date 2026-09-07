'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SCRAMBLE } from '@/lib/scramble/config'
import { buildFeed, postTime, type ScrambleScoreRow } from '@/lib/scramble/feed'

export default function ScrambleFeed() {
  const [rows, setRows] = useState<ScrambleScoreRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('scramble_scores')
      .select('team_slug,hole_number,strokes,created_at')
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('scramble-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scramble_scores' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const posts = buildFeed(rows)

  return (
    <div className="max-w-2xl mx-auto px-3 pb-12">
      <h1 className="text-2xl font-bold text-[#091540] mb-1">Live Feed</h1>
      <p className="text-[#091540]/50 text-xs mb-5">{SCRAMBLE.shortName}</p>

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-8">Loading…</p>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <p className="text-[#091540]/50 text-sm">Nothing yet — the feed fills in as scores are entered.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {posts.map(p => (
            <div
              key={p.id}
              className={`rounded-2xl px-4 py-3 shadow-sm ${
                p.tone === 'final' ? 'bg-[#f4f1e8] border border-[#e2dcc8]'
                : p.tone === 'good' ? 'bg-white border border-green-100'
                : 'bg-white border border-gray-100'
              }`}
            >
              {p.label && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#091540]/40 mb-1">{p.label}</p>
              )}
              <p className="text-sm text-black leading-snug">{p.text}</p>
              <p className="text-[11px] text-[#091540]/40 mt-1">{postTime(p.at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
