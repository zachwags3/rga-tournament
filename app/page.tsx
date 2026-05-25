import Leaderboard from '@/components/Leaderboard'
import NavHeader from '@/components/NavHeader'

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <NavHeader />
      <main className="pt-5">
        <Leaderboard />
      </main>
    </div>
  )
}
