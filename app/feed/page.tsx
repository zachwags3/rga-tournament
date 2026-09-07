import NavHeader from '@/components/NavHeader'
import Feed from '@/components/Feed'
import ScrambleFeed from '@/components/ScrambleFeed'
import { SCRAMBLE_ENABLED } from '@/lib/scramble/config'

export default function FeedPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <NavHeader />
      <main className="pt-5 pb-12">
        {SCRAMBLE_ENABLED ? (
          <ScrambleFeed />
        ) : (
          <div className="px-4 max-w-2xl mx-auto"><Feed /></div>
        )}
      </main>
    </div>
  )
}
