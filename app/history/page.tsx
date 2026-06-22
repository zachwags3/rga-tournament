import Link from 'next/link'
import NavHeader from '@/components/NavHeader'
import DraftHistory from '@/components/DraftHistory'

export default function HistoryPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <NavHeader />
      <main className="pt-5 px-4 max-w-2xl mx-auto pb-12">
        <DraftHistory />
        <div className="mt-8 flex justify-center">
          <Link
            href="/admin"
            className="text-[#091540]/50 hover:text-[#091540] transition-colors text-xs font-medium underline underline-offset-2"
          >
            Admin
          </Link>
        </div>
      </main>
    </div>
  )
}
