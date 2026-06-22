import NavHeader from '@/components/NavHeader'
import Feed from '@/components/Feed'

export default function FeedPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <NavHeader />
      <main className="pt-5 px-4 max-w-2xl mx-auto pb-12">
        <h1 className="text-2xl font-bold text-[#091540] mb-1">Live Feed</h1>
        <p className="text-[#091540]/60 text-sm mb-6">Scores as they come in.</p>
        <Feed />
      </main>
    </div>
  )
}
