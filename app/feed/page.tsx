import NavHeader from '@/components/NavHeader'
import Feed from '@/components/Feed'

export default function FeedPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <NavHeader />
      <main className="pt-5 px-4 max-w-2xl mx-auto pb-12">
        <Feed />
      </main>
    </div>
  )
}
