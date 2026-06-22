import NavHeader from '@/components/NavHeader'

export default function FeedPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <NavHeader />
      <main className="pt-5 px-4 max-w-2xl mx-auto pb-12">
        <h1 className="text-2xl font-bold text-[#091540] mb-1">Live Feed</h1>
        <p className="text-[#091540]/60 text-sm mb-6">Scores as they come in.</p>

        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <p className="text-[#091540]/50 text-sm">
            No scores yet — entries will appear here live once play begins.
          </p>
        </div>
      </main>
    </div>
  )
}
