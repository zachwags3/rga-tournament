import NavHeader from '@/components/NavHeader'
import StatsBoard from '@/components/StatsBoard'

export default function StatsPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <NavHeader />
      <main className="pt-5 px-4 max-w-2xl mx-auto pb-12">
        <StatsBoard />
      </main>
    </div>
  )
}
