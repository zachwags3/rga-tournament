'use client'

import { useEffect, useState } from 'react'
import { TEE_OFF } from '@/lib/scramble/config'

// Counts down to the first tee, then disappears completely.
// `remaining` stays null through SSR and the first client render so the markup
// matches on hydration; the timer only starts once mounted.
export default function ScrambleCountdown() {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const target = Date.parse(TEE_OFF)
    const left = () => target - Date.now()
    const first = left()
    setRemaining(first)
    if (first <= 0) return // already teed off — never start a timer
    const id = setInterval(() => {
      const diff = left()
      setRemaining(diff)
      if (diff <= 0) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  if (remaining === null || remaining <= 0) return null

  const total = Math.floor(remaining / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60

  const seg = (value: number, label: string) => (
    <div className="flex flex-col items-center">
      <span className="text-2xl font-bold text-white tabular-nums leading-none">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] uppercase tracking-widest text-white/40 mt-1">{label}</span>
    </div>
  )

  return (
    <div className="bg-[#091540] rounded-2xl px-4 py-3 mb-3 text-center shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#e8c96a] mb-2">Tees off in</p>
      <div className="flex items-start justify-center gap-6">
        {seg(days, 'days')}
        {seg(hours, 'hrs')}
        {seg(mins, 'min')}
        {seg(secs, 'sec')}
      </div>
    </div>
  )
}
