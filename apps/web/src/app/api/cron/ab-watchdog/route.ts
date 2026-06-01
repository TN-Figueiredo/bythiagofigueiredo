import { NextRequest } from 'next/server'
import { getCronHealth, recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import { createNotification } from '@/lib/notifications/create'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { checkDrift } from '@/lib/youtube/ab-drift'
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
        .select('id, site_id, test_type, youtube_video_id')
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

    // Drift detection: compare current YouTube thumbnail vs expected variant
    const apiKey = process.env.YOUTUBE_API_KEY
    if (apiKey) {
      const driftClient = getSupabaseServiceClient()
      const { data: driftTests } = await driftClient
        .from('ab_tests')
        .select('id, site_id, test_type, youtube_video_id')
        .eq('status', 'active')

      if (driftTests?.length) {
        for (const test of driftTests) {
          if (test.test_type !== 'thumbnail' && test.test_type !== 'combo') continue

          // Get current variant's thumbnail
          const { data: openCycle } = await driftClient
            .from('ab_test_cycles')
            .select('variant_id, ab_test_variants!inner(blob_url)')
            .eq('test_id', test.id)
            .is('ended_at', null)
            .limit(1)
            .maybeSingle()

          if (!openCycle) continue
          const expectedUrl = (openCycle as any).ab_test_variants?.blob_url

          // Get YouTube video ID
          const { data: video } = await driftClient
            .from('youtube_videos')
            .select('youtube_video_id')
            .eq('id', test.youtube_video_id)
            .single()

          if (!video?.youtube_video_id) continue

          const { drifted } = await checkDrift(test.id, video.youtube_video_id, expectedUrl, apiKey)

          if (drifted) {
            const now = new Date().toISOString()

            // 1. Close the open cycle
            await driftClient
              .from('ab_test_cycles')
              .update({ ended_at: now })
              .eq('test_id', test.id)
              .is('ended_at', null)

            // 2. Attempt thumbnail revert to original
            try {
              const { data: testFull } = await driftClient
                .from('ab_tests')
                .select('original_thumbnail_url, site_id')
                .eq('id', test.id)
                .single()

              if (testFull?.original_thumbnail_url?.includes('blob.vercel-storage.com')) {
                const { ensureFreshToken } = await import('@/lib/social/token-refresh')
                const { fetchVariantImageBuffer, setThumbnail } = await import('@/lib/youtube/ab-youtube')
                const { accessToken } = await ensureFreshToken(testFull.site_id, 'youtube')
                const { buffer, contentType } = await fetchVariantImageBuffer(testFull.original_thumbnail_url)
                await setThumbnail(video.youtube_video_id, buffer, contentType, accessToken)
              }
            } catch (revertErr) {
              Sentry.captureException(revertErr, { extra: { context: 'ab-watchdog-revert', testId: test.id } })
            }

            // 3. Pause the test
            await driftClient
              .from('ab_tests')
              .update({ status: 'paused', paused_at: now, status_note: 'Thumbnail alterado externamente' })
              .eq('id', test.id)

            // 4. Notify owner
            const { data: owner } = await driftClient
              .from('site_users')
              .select('user_id')
              .eq('site_id', test.site_id)
              .eq('role', 'super_admin')
              .limit(1)
              .single()

            if (owner) {
              await createNotification({
                site_id: test.site_id,
                user_id: owner.user_id,
                type: 'youtube.drift_detected',
                domain: 'youtube',
                priority: 1,
                title: 'Thumbnail alterado externamente',
                message: 'O teste foi pausado porque a thumbnail do YouTube foi modificada fora do sistema.',
                action_href: `/cms/youtube/ab-lab/${test.id}`,
                dedup_key: `drift-${test.id}-${new Date().toISOString().slice(0, 10)}`,
              })
            }
          }
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

    // Prune old competitor changes (90-day retention)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString()
    const { error: competitorPruneError } = await pruneClient
      .from('competitor_changes')
      .delete()
      .lt('detected_at', ninetyDaysAgo)
      .eq('bookmarked', false)
    if (competitorPruneError) console.error('[ab-watchdog] competitor change prune failed:', competitorPruneError.message)

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
