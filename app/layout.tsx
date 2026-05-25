import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RGA Tournament 2026',
  description: 'Retarded Golf Association — Live Leaderboard & Score Entry',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  )
}
