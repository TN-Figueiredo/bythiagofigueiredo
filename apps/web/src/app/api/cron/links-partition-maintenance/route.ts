import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'

export const runtime = 'nodejs'

const JOB = 'links-partition-maintenance'
const LOCK_KEY = 'cron:links-partition-maintenance'

export interface MonthRange {
  year: number
  month: number
  startDate: string
  endDate: string
}

export function getNextMonthRange(now: Date = new Date()): MonthRange {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1 // 0-indexed -> 1-indexed

  let nextYear = year
  let nextMonth = month + 1
  if (nextMonth > 12) {
    nextMonth = 1
    nextYear = year + 1
  }

  // End date is the 1st of the month AFTER next
  let endYear = nextYear
  let endMonth = nextMonth + 1
  if (endMonth > 12) {
    endMonth = 1
    endYear = nextYear + 1
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  return {
    year: nextYear,
    month: nextMonth,
    startDate: `${nextYear}-${pad(nextMonth)}-01`,
    endDate: `${endYear}-${pad(endMonth)}-01`,
  }
}

export async function POST(req: Request): Promise<Response> {
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
      // Partition already exists is not a real error (idempotent)
      if (error.message?.includes('already exists')) {
        return {
          status: 'ok' as const,
          partition: partitionName,
          already_exists: true,
        }
      }
      return { status: 'error' as const, error: error.message }
    }

    return {
      status: 'ok' as const,
      partition: data ?? partitionName,
      range,
    }
  })
}
