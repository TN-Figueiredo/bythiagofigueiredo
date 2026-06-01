import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import { phaseProcessQueue, phaseRotateActiveTests } from '@/lib/youtube/ab-rotate-phases'

export const maxDuration = 300 // 5min for 20+ concurrent tests

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  const queueStarted = await phaseProcessQueue(supabase)
  const { processed, errors } = await phaseRotateActiveTests(supabase)

  if (errors === 0) {
    await recordCronSuccess('ab-rotate', 'critical')
  } else {
    await recordCronFailure('ab-rotate', `${errors} test(s) failed`, 'critical')
  }

  return Response.json({ status: 'ok', queueStarted, processed, errors })
}
