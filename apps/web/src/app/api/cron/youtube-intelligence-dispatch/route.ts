import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as Sentry from '@sentry/nextjs'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'

const CRON_NAME = 'youtube-intelligence-dispatch'

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
    .eq('sync_enabled', true)

  if (!channels?.length) {
    await recordCronSuccess(CRON_NAME).catch((e) => console.error('[cron-health] write failed:', e))
    return NextResponse.json({ status: 'no_channels' })
  }

  let created = 0
  let errors = 0
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
      errors++
      console.error('[youtube-intelligence-dispatch] Error processing channel:', err)
      Sentry.captureException(err)
    }
  }

  if (errors > 0) {
    await recordCronFailure(CRON_NAME, `${errors} channel(s) failed`).catch((e) => console.error('[cron-health] write failed:', e))
  } else {
    await recordCronSuccess(CRON_NAME).catch((e) => console.error('[cron-health] write failed:', e))
  }

  return NextResponse.json({ created })
}
