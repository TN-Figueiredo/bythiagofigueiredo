import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { rodarRetrato } from '@/lib/youtube/ab-gravacao/retrato-step'

export const runtime = 'nodejs'
export const maxDuration = 60

const JOB = 'ab-retrato'

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const sb = getSupabaseServiceClient()
  return withCronLock(sb, JOB, newRunId(), JOB, () => rodarRetrato(sb, new Date()))
}
