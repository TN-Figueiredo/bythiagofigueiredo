import { NextRequest } from 'next/server'
import { getCronHealth, recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import { createNotification } from '@/lib/notifications/create'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as Sentry from '@sentry/nextjs'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().slice(0, 10)
    const rotateHealth = await getCronHealth('ab-rotate')

    const rotateRanToday =
      rotateHealth?.last_success_at &&
      rotateHealth.last_success_at.slice(0, 10) === today

    if (!rotateRanToday) {
      const supabase = getSupabaseServiceClient()
      const { data: activeTests } = await supabase
        .from('ab_tests')
        .select('site_id')
        .eq('status', 'active')

      if (activeTests && activeTests.length > 0) {
        // Get unique site_ids
        const siteIds = [...new Set(activeTests.map(t => t.site_id))]

        for (const siteId of siteIds) {
          const { data: owner } = await supabase
            .from('site_users')
            .select('user_id')
            .eq('site_id', siteId)
            .eq('role', 'super_admin')
            .limit(1)
            .single()

          if (owner) {
            await createNotification({
              site_id: siteId,
              user_id: owner.user_id,
              type: 'youtube.rotation_missed',
              domain: 'youtube',
              priority: 1,
              title: 'Rotação A/B não executou hoje',
              message: `O cron ab-rotate não rodou hoje (${today}). Último sucesso: ${rotateHealth?.last_success_at ?? 'nunca'}.`,
              action_href: '/cms/youtube/ab-lab',
              dedup_key: `rotation-missed-${siteId}-${today}`,
            })
          }
        }

        // Trigger catch-up rotation — ab-rotate has built-in idempotency
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        try {
          await fetch(`${baseUrl}/api/cron/ab-rotate`, {
            headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
            signal: AbortSignal.timeout(10_000),
          })
        } catch {
          // Non-fatal: catch-up fetch timed out or failed — watchdog still succeeds
        }
      }
    }

    // Prune old polls (7-day retention)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const pruneClient = getSupabaseServiceClient()
    const { error: pruneError } = await pruneClient
      .from('ab_test_polls')
      .delete()
      .lt('polled_at', sevenDaysAgo)
    if (pruneError) console.error('[ab-watchdog] poll prune failed:', pruneError.message)

    await recordCronSuccess('ab-watchdog', 'info')

    return Response.json({
      status: 'ok',
      rotate_healthy: !!rotateRanToday,
      last_rotate: rotateHealth?.last_success_at ?? null,
    })
  } catch (err) {
    Sentry.captureException(err, { extra: { context: 'ab-watchdog' } })
    await recordCronFailure('ab-watchdog', (err as Error).message)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
