import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'

export async function POST(req: Request) {
  const { password } = await req.json()

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const token = createHmac('sha256', process.env.ADMIN_PASSWORD)
    .update('rga-admin-2026')
    .digest('hex')

  return NextResponse.json({ ok: true, token })
}
