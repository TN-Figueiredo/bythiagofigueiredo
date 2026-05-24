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

  // 2. Enforce per-playlist cap: max 100 auto-snapshots (backup for on-create)
  const { data: playlists } = await supabase
    .from('playlist_snapshots')
    .select('playlist_id')
    .eq('type', 'auto')

  const playlistIds = [...new Set((playlists ?? []).map(p => p.playlist_id))]

  for (const playlistId of playlistIds) {
    const { data: autoSnapshots } = await supabase
      .from('playlist_snapshots')
      .select('id')
      .eq('playlist_id', playlistId)
      .eq('type', 'auto')
      .order('created_at', { ascending: true })

    if (autoSnapshots && autoSnapshots.length > 100) {
      const toDelete = autoSnapshots.slice(0, autoSnapshots.length - 100)
      for (const s of toDelete) {
        await supabase.from('playlist_snapshots').delete().eq('id', s.id)
        deletedCount++
      }
    }
  }

  return NextResponse.json({
    ok: true,
    deleted: deletedCount,
    timestamp: now,
  })
}
