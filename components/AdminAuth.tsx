'use client'

import { useEffect, useState } from 'react'

const TOKEN_KEY = 'rga_admin_token'

export default function AdminAuth({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'authed' | 'unauthed'>('loading')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) { setStatus('unauthed'); return }

    fetch('/api/admin-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(data => setStatus(data.ok ? 'authed' : 'unauthed'))
      .catch(() => setStatus('unauthed'))
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (data.ok) {
        localStorage.setItem(TOKEN_KEY, data.token)
        setStatus('authed')
      } else {
        setError('Incorrect password.')
      }
    } catch {
      setError('Something went wrong. Try again.')
    }

    setSubmitting(false)
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)
    setStatus('unauthed')
    setPassword('')
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[#2d5a3d]">Checking access...</p>
      </div>
    )
  }

  if (status === 'unauthed') {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🔒</div>
            <h2 className="text-xl font-bold text-[#1a3a2a]">Admin Access</h2>
            <p className="text-gray-400 text-sm mt-1">RGA Tournament 2026</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter admin password"
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#2d5a3d] text-center tracking-widest"
            />
            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting || !password}
              className="w-full bg-[#2d5a3d] text-white py-3 rounded-xl font-bold disabled:opacity-40 hover:bg-[#1a3a2a] transition-colors"
            >
              {submitting ? 'Checking...' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <>
      {children}
      <div className="max-w-lg mx-auto px-4 pb-6">
        <button
          onClick={handleLogout}
          className="w-full text-xs text-gray-300 hover:text-gray-500 py-2 transition-colors"
        >
          Log out of admin
        </button>
      </div>
    </>
  )
}
