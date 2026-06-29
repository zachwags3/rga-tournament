'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import RefreshLogo from './RefreshLogo'

export default function NavHeader() {
  const pathname = usePathname()
  const [anyInProgress, setAnyInProgress] = useState(false)

  useEffect(() => {
    async function check() {
      const { data } = await supabase.from('matches').select('status')
      setAnyInProgress((data ?? []).some(m => m.status === 'in_progress'))
    }
    check()
    const channel = supabase
      .channel('nav-match-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, check)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <header className="bg-[#091540] sticky top-0 z-10 shadow-md">
      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
        {/* Nav buttons — scrollable row so it never clips on small phones */}
        <div
          className="flex items-center gap-0.5 overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          <Link
            href="/"
            className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors text-center leading-tight whitespace-nowrap ${
              pathname === '/' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            Scoreboard
          </Link>
          <Link
            href="/history"
            className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors text-center leading-tight whitespace-nowrap ${
              pathname === '/history' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            History
          </Link>
          <Link
            href="/feed"
            className={`relative px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors text-center leading-tight whitespace-nowrap ${
              pathname === '/feed' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            Feed
            {anyInProgress && (
              <span className="absolute top-[-1px] right-[-1px] flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
            )}
          </Link>
          <Link
            href="/odds"
            className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors text-center leading-tight whitespace-nowrap ${
              pathname === '/odds' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            Odds
          </Link>
          <Link
            href="/stats"
            className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors text-center leading-tight whitespace-nowrap ${
              pathname === '/stats' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            Stats
          </Link>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          <RefreshLogo />
        </div>
      </div>
    </header>
  )
}
