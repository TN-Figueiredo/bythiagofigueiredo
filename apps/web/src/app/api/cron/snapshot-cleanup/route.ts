import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

// Vercel Cron: { "path": "/api/cron/snapshot-cleanup", "schedule": "0 4 * * *" }

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

  // 1. Delete expired snapshots (auto: 30 days, pre_destructive: 90 days)
  const { data: expired } = await supabase
    .from('playlist_snapshots')
    .delete()
    .lt('expires_at', now)
    .not('expires_at', 'is', null)
    .select('id')

  deletedCount += expired?.length ?? 0

  // 2. Enforce per-playlist cap via single RPC (avoids N+1)
  const { data: overcap } = await supabase.rpc('cleanup_excess_auto_snapshots', {
    p_max_per_playlist: 100,
  })

  deletedCount += overcap ?? 0

  return NextResponse.json({
    ok: true,
    deleted: deletedCount,
    timestamp: now,
  })
}
