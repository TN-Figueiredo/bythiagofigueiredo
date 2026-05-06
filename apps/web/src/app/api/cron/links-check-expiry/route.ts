import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'
import { invalidateLink, invalidateList } from '@/lib/links/cache'

export const runtime = 'nodejs'

const JOB = 'links-check-expiry'
const LOCK_KEY = 'cron:links-check-expiry'

export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const now = new Date().toISOString()

    // Find active links that have expired
    const { data: expiredLinks, error: selErr } = await supabase
      .from('tracked_links')
      .select('id, site_id, short_code')
      .eq('status', 'active')
      .lt('expires_at', now)
      .not('expires_at', 'is', null)

    if (selErr) {
      Sentry.captureException(selErr, { tags: { links: 'true', component: 'cron-expiry' } })
      return { status: 'error' as const, error: selErr.message }
    }

    if (!expiredLinks || expiredLinks.length === 0) {
      return { status: 'ok' as const, expired: 0 }
    }

    // Batch update status
    const ids = expiredLinks.map((l: { id: string }) => l.id)
    const { error: updErr } = await supabase
      .from('tracked_links')
      .update({ status: 'expired' })
      .in('id', ids)

    if (updErr) {
      Sentry.captureException(updErr, { tags: { links: 'true', component: 'cron-expiry' } })
      return { status: 'error' as const, error: updErr.message }
    }

    // Invalidate cache for each expired link
    const siteIds = new Set<string>()
    for (const link of expiredLinks as { id: string; site_id: string; short_code: string }[]) {
      invalidateLink(link.site_id, link.short_code)
      siteIds.add(link.site_id)
    }
    for (const siteId of siteIds) {
      invalidateList(siteId)
    }

    return { status: 'ok' as const, expired: expiredLinks.length }
  })
}
