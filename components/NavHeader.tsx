'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import RefreshLogo from './RefreshLogo'

export default function NavHeader() {
  const pathname = usePathname()

  return (
    <header className="bg-[#091540] sticky top-0 z-10 shadow-md">
      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
        {/* Nav buttons */}
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors text-center leading-tight whitespace-nowrap ${
              pathname === '/' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            Scoreboard
          </Link>
          <Link
            href="/feed"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors text-center leading-tight whitespace-nowrap ${
              pathname === '/feed' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            Feed
          </Link>
          <Link
            href="/stats"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors text-center leading-tight whitespace-nowrap ${
              pathname === '/stats' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            Leaderboard
          </Link>
          <Link
            href="/history"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors text-center leading-tight whitespace-nowrap ${
              pathname === '/history' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            History
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
