import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { rodarSonda } from '@/lib/youtube/ab-gravacao/sonda-step'

export const runtime = 'nodejs'
export const maxDuration = 60

const JOB = 'ab-sonda-miniatura'

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const sb = getSupabaseServiceClient()
  return withCronLock(sb, JOB, newRunId(), JOB, () => rodarSonda(sb, new Date()))
}
