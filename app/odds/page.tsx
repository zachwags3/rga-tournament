import NavHeader from '@/components/NavHeader'

export default function OddsPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <NavHeader />
      <main className="pt-5 px-4 max-w-2xl mx-auto pb-12">
        <h1 className="text-2xl font-bold text-[#091540] mb-6">Odds</h1>
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <p className="text-[#091540]/50 text-sm">
            Live odds coming soon — for entertainment only.
          </p>
        </div>
      </main>
    </div>
  )
}
