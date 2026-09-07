import Leaderboard from '@/components/Leaderboard'
import NavHeader from '@/components/NavHeader'
import ScrambleScoreboard from '@/components/ScrambleScoreboard'
import { SCRAMBLE_ENABLED } from '@/lib/scramble/config'

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <NavHeader />
      <main className="pt-5">
        {/* While the Kickoff Classic is on it takes over the Scoreboard page.
            Flip SCRAMBLE_ENABLED to false afterwards to restore the Cup leaderboard. */}
        {SCRAMBLE_ENABLED ? <ScrambleScoreboard /> : <Leaderboard />}
      </main>
    </div>
  )
}
