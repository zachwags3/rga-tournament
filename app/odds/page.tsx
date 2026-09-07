import NavHeader from '@/components/NavHeader'
import Odds from '@/components/Odds'
import ScrambleOdds from '@/components/ScrambleOdds'
import { SCRAMBLE_ENABLED } from '@/lib/scramble/config'

export default function OddsPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <NavHeader />
      <main className="pt-5 pb-12">
        {SCRAMBLE_ENABLED ? (
          <ScrambleOdds />
        ) : (
          <div className="px-4 max-w-2xl mx-auto"><Odds /></div>
        )}
      </main>
    </div>
  )
}
