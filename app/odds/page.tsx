import NavHeader from '@/components/NavHeader'
import Odds from '@/components/Odds'

export default function OddsPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <NavHeader />
      <main className="pt-5 px-4 max-w-2xl mx-auto pb-12">
        <Odds />
      </main>
    </div>
  )
}
