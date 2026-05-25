import NavHeader from '@/components/NavHeader'

export default function HistoryPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <NavHeader />
      <main className="pt-10 px-4 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center shadow-sm">
          <div className="text-5xl mb-4">🏆</div>
          <h2 className="text-xl font-bold text-[#1a3a2a] mb-2">League History</h2>
          <p className="text-gray-400 text-sm">Coming soon — past tournament results will live here.</p>
        </div>
      </main>
    </div>
  )
}
