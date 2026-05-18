import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  const { data: channels } = await supabase
    .from('youtube_channels')
    .select('id, site_id')
    .eq('enabled', true)

  if (!channels?.length) return NextResponse.json({ status: 'no_channels' })

  let created = 0
  for (const channel of channels) {
    try {
      const { data: existing } = await supabase
        .from('youtube_intelligence_tasks')
        .select('id')
        .eq('channel_id', channel.id)
        .in('status', ['pending', 'running'])
        .limit(1)
        .single()

      if (existing) continue

      await supabase.from('youtube_intelligence_tasks').insert({
        site_id: channel.site_id,
        channel_id: channel.id,
        trigger_type: 'cron',
      })
      created++
    } catch (err) {
      console.error('[youtube-intelligence-dispatch] Error processing channel:', err)
      Sentry.captureException(err)
    }
  }

  return NextResponse.json({ created })
}
