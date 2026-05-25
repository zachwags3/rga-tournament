import Link from 'next/link'
import AdminSetup from '@/components/AdminSetup'
import AdminAuth from '@/components/AdminAuth'

export default function AdminPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <header className="bg-[#1a3a2a] sticky top-0 z-10 shadow-md">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-white/60 hover:text-white transition-colors text-sm">
            ← Leaderboard
          </Link>
          <div>
            <h1 className="text-white font-bold text-base leading-none">Admin Setup</h1>
            <p className="text-[#c9a84c] text-xs mt-0.5">RGA 2026</p>
          </div>
        </div>
      </header>
      <main className="pt-5">
        <AdminAuth>
          <AdminSetup />
        </AdminAuth>
      </main>
    </div>
  )
}
