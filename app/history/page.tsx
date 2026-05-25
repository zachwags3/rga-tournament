import NavHeader from '@/components/NavHeader'
import DraftHistory from '@/components/DraftHistory'

export default function HistoryPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <NavHeader />
      <main className="pt-5 px-4 max-w-2xl mx-auto pb-12">
        <DraftHistory />
      </main>
    </div>
  )
}
