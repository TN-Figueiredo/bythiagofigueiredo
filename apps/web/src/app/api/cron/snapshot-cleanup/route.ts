import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'

// Vercel Cron: { "path": "/api/cron/snapshot-cleanup", "schedule": "0 4 * * *" }

const CRON_NAME = 'snapshot-cleanup'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const now = new Date().toISOString()
  let deletedCount = 0

  try {
    // 1. Delete expired snapshots (auto: 30 days, pre_destructive: 90 days)
    const { data: expired, error: expiredErr } = await supabase
      .from('playlist_snapshots')
      .delete()
      .lt('expires_at', now)
      .not('expires_at', 'is', null)
      .select('id')

    if (expiredErr) throw new Error(expiredErr.message)
    deletedCount += expired?.length ?? 0

    // 2. Enforce per-playlist cap via single RPC (avoids N+1)
    const { data: overcap, error: overcapErr } = await supabase.rpc('cleanup_excess_auto_snapshots', {
      p_max_per_playlist: 100,
    })

    if (overcapErr) throw new Error(overcapErr.message)
    deletedCount += overcap ?? 0

    await recordCronSuccess(CRON_NAME).catch((e) => console.error('[cron-health] write failed:', e))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await recordCronFailure(CRON_NAME, message).catch((e) => console.error('[cron-health] write failed:', e))
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    deleted: deletedCount,
    timestamp: now,
  })
}

// Cron da Vercel dispara GET; auth le o header Authorization independente do verbo, entao o alias e seguro.
export const GET = POST
