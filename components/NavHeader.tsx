'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import RefreshLogo from './RefreshLogo'

export default function NavHeader() {
  const pathname = usePathname()

  return (
    <header className="bg-[#1a3a2a] sticky top-0 z-10 shadow-md">
      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
        {/* Nav buttons */}
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              pathname === '/' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            2026 Scoreboard
          </Link>
          <Link
            href="/history"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              pathname === '/history' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            League History
          </Link>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/admin"
            className="text-white/50 text-xs hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/10 whitespace-nowrap"
          >
            Wags Log In
          </Link>
          <RefreshLogo />
        </div>
      </div>
    </header>
  )
}
