import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'

export async function POST(req: Request) {
  const { token } = await req.json()

  if (!process.env.ADMIN_PASSWORD || !token) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const expected = createHmac('sha256', process.env.ADMIN_PASSWORD)
    .update('rga-admin-2026')
    .digest('hex')

  return NextResponse.json({ ok: token === expected })
}
