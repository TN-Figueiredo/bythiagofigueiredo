import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 })

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase.rpc('unsubscribe_via_token', {
    p_token_hash: hashToken(token),
  })

  if (error) return NextResponse.json({ error: 'rpc_failed' }, { status: 500 })
  return NextResponse.json({ ok: data?.ok ?? false })
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 })
  return NextResponse.redirect(new URL(`/unsubscribe/${token}`, url.origin), 302)
}
