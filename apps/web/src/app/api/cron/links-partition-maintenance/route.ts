import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'
import { getNextMonthRange } from '../../../../lib/links/partition-utils'

export const runtime = 'nodejs'

const JOB = 'links-partition-maintenance'
const LOCK_KEY = 'cron:links-partition-maintenance'

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const range = getNextMonthRange()
    const partitionName = `link_clicks_${range.year}_${String(range.month).padStart(2, '0')}`

    const { data, error } = await supabase.rpc('create_link_clicks_partition', {
      p_partition_name: partitionName,
      p_start_date: range.startDate,
      p_end_date: range.endDate,
    })

    if (error) {
      if (error.message?.includes('already exists')) {
        return {
          status: 'ok' as const,
          partition: partitionName,
          already_exists: true,
        }
      }
      Sentry.captureException(error, { tags: { links: 'true', component: 'cron-partition' } })
      return { status: 'error' as const, error: error.message }
    }

    return {
      status: 'ok' as const,
      partition: data ?? partitionName,
      range,
    }
  })
}
