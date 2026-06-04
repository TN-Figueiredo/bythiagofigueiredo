import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import {
  shouldPollPost,
  pollMetricsForDelivery,
  type PollCandidate,
} from '@/lib/social/metrics-poller'
import {
  ensureFreshToken,
  TokenRevokedError,
} from '@/lib/social/token-refresh'
import type { Provider } from '@tn-figueiredo/social'

// Vercel Cron: { "path": "/api/cron/social-metrics", "schedule": "0 */4 * * *" }

export const runtime = 'nodejs'
export const maxDuration = 60

const LOCK_KEY = 'cron:social-metrics'
const JOB = 'social-metrics'
const BATCH_LIMIT = 20
const CONNECTION_SELECT =
  'id, site_id, account_id, page_token_enc, access_token_enc, bluesky_access_jwt_enc, circuit_open_until, metadata' as const

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    // Find published deliveries with platform_post_id
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString()

    const { data: deliveries, error: fetchError } = await supabase
      .from('social_deliveries')
      .select(
        'id, post_id, provider, platform_post_id, connection_id, format, published_at',
      )
      .eq('status', 'published')
      .not('platform_post_id', 'is', null)
      .gte('published_at', sevenDaysAgo)
      .order('published_at', { ascending: true })
      .limit(BATCH_LIMIT)

    if (fetchError) {
      throw new Error(`Failed to fetch deliveries: ${fetchError.message}`)
    }

    if (!deliveries || deliveries.length === 0) {
      return { status: 'ok' as const, processed: 0 }
    }

    // Get last poll times from post_metrics
    const deliveryIds = deliveries.map((d) => d.id as string)
    const { data: lastPolls } = await supabase
      .from('post_metrics')
      .select('delivery_id, polled_at')
      .in('delivery_id', deliveryIds)
      .order('polled_at', { ascending: false })

    const lastPollMap = new Map<string, string>()
    for (const poll of lastPolls ?? []) {
      const did = poll.delivery_id as string
      if (!lastPollMap.has(did)) {
        lastPollMap.set(did, poll.polled_at as string)
      }
    }

    // Filter by polling schedule
    const toPoll = deliveries.filter((d) => {
      const candidate: PollCandidate = {
        postId: d.post_id as string,
        publishedAt: d.published_at as string,
        lastPolledAt: lastPollMap.get(d.id as string) ?? null,
        isStory: (d.format as string) === 'story',
      }
      return shouldPollPost(candidate)
    })

    let processed = 0
    const errors: string[] = []

    for (const delivery of toPoll) {
      try {
        const { data: connection } = await supabase
          .from('social_connections')
          .select(CONNECTION_SELECT)
          .eq('id', delivery.connection_id)
          .single()

        if (!connection) continue

        // Gap 7: circuit breaker — skip connections in cooldown
        const circuitUntil = (connection as Record<string, unknown>)
          .circuit_open_until as string | null
        if (circuitUntil && new Date(circuitUntil) > new Date()) {
          errors.push(
            `delivery ${delivery.id}: circuit open until ${circuitUntil}`,
          )
          continue
        }

        // Gap 5: token refresh before poll
        const siteId = (connection as Record<string, unknown>).site_id as
          | string
          | null
        const accountId = (connection as Record<string, unknown>)
          .account_id as string | null

        if (!siteId || !accountId) {
          errors.push(
            `delivery ${delivery.id}: connection missing site_id or account_id`,
          )
          continue
        }

        try {
          await ensureFreshToken(
            siteId,
            delivery.provider as Provider,
            accountId,
          )
        } catch (refreshErr) {
          if (refreshErr instanceof TokenRevokedError) {
            Sentry.captureException(refreshErr, {
              tags: {
                provider: delivery.provider as string,
                connectionId: connection.id as string,
              },
            })
            errors.push(
              `delivery ${delivery.id}: token revoked for ${delivery.provider}`,
            )
            continue
          }
          throw refreshErr
        }

        // Re-fetch connection after token refresh to get updated tokens
        const { data: freshConn } = await supabase
          .from('social_connections')
          .select(CONNECTION_SELECT)
          .eq('id', delivery.connection_id)
          .single()

        if (!freshConn) continue

        const metricRow = await pollMetricsForDelivery(
          delivery.id as string,
          delivery.provider as Provider,
          delivery.platform_post_id as string,
          freshConn as Record<string, unknown>,
        )

        if (metricRow) {
          metricRow.post_id = delivery.post_id as string

          const { error: insertError } = await supabase
            .from('post_metrics')
            .insert(metricRow)

          if (insertError) {
            errors.push(
              `delivery ${delivery.id}: insert failed: ${insertError.message}`,
            )
          } else {
            processed++
          }
        }
      } catch (err) {
        errors.push(
          `delivery ${delivery.id}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    // Log cron run
    try {
      await supabase.from('cron_runs').insert({
        job: JOB,
        status: errors.length > 0 ? 'error' : 'ok',
        items_processed: processed,
        error: errors.length > 0 ? errors.join('; ') : null,
      })
    } catch {
      /* best-effort */
    }

    return {
      status: 'ok' as const,
      processed,
      errors: errors.length > 0 ? errors : undefined,
    }
  })
}
