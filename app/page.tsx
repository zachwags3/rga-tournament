import Link from 'next/link'
import Leaderboard from '@/components/Leaderboard'
import RefreshLogo from '@/components/RefreshLogo'

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      {/* Header */}
      <header className="bg-[#1a3a2a] sticky top-0 z-10 shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg leading-none">⛳ RGA 2026</h1>
            <p className="text-[#c9a84c] text-xs mt-0.5">Live Leaderboard</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-white/50 text-xs hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
            >
              Wags Log In
            </Link>
            <RefreshLogo />
          </div>
        </div>
      </header>

      <main className="pt-5">
        <Leaderboard />
      </main>
    </div>
  )
}
