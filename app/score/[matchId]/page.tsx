import Link from 'next/link'
import ScoreEntry from '@/components/ScoreEntry'

export default async function ScorePage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <header className="bg-[#1a3a2a] sticky top-0 z-10 shadow-md">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-white/60 hover:text-white transition-colors text-sm">
            ← Back
          </Link>
          <h1 className="text-white font-bold text-base">Score Entry</h1>
        </div>
      </header>
      <main className="pt-5">
        <ScoreEntry matchId={matchId} />
      </main>
    </div>
  )
}
