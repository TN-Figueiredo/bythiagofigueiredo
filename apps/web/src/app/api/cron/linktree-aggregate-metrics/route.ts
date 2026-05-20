import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 60

const JOB = 'linktree-aggregate-metrics'
const LOCK_KEY = 'cron:linktree-aggregate-metrics'
const PAGE_SIZE = 1000

interface Bucket {
  siteId: string
  date: string
  weekday: number
  pageviews: number
  linkClicks: number
  botViews: number
  mobile: number
  desktop: number
  tablet: number
  refDirect: number
  refSearch: number
  refSocial: number
  refEmail: number
  refReferral: number
  refOther: number
  countries: Record<string, number>
  hourlyViews: number[]
  linkClicksByKey: Record<string, number>
}

function emptyBucket(siteId: string, date: string, weekday: number): Bucket {
  return {
    siteId,
    date,
    weekday,
    pageviews: 0,
    linkClicks: 0,
    botViews: 0,
    mobile: 0,
    desktop: 0,
    tablet: 0,
    refDirect: 0,
    refSearch: 0,
    refSocial: 0,
    refEmail: 0,
    refReferral: 0,
    refOther: 0,
    countries: {},
    hourlyViews: Array.from({ length: 24 }, () => 0),
    linkClicksByKey: {},
  }
}

export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    // Read watermark for linktree (distinct id from the links singleton)
    const { data: wm } = await supabase
      .from('link_aggregation_watermark')
      .select('last_processed_at')
      .eq('id', 'linktree')
      .single()

    let since = wm?.last_processed_at ?? new Date(0).toISOString()
    const until = new Date().toISOString()

    const buckets = new Map<string, Bucket>()
    let totalProcessed = 0

    // --- Phase 1: Bucket delta events (since last watermark) ---
    while (true) {
      const { data: events, error } = await supabase
        .from('linktree_events')
        .select(
          'site_id, event_type, link_key, visitor_id, is_bot, device_type, referrer_source, country, created_at',
        )
        .gt('created_at', since)
        .lte('created_at', until)
        .order('created_at', { ascending: true })
        .limit(PAGE_SIZE)

      if (error) {
        Sentry.captureException(new Error(error.message), { tags: { component: JOB } })
        return { status: 'error' as const, error: error.message }
      }

      if (!events || events.length === 0) break

      for (const e of events) {
        const d = new Date(e.created_at)
        const dateStr = d.toISOString().slice(0, 10)
        const key = `${e.site_id}:${dateStr}`

        let bucket = buckets.get(key)
        if (!bucket) {
          bucket = emptyBucket(e.site_id, dateStr, d.getUTCDay())
          buckets.set(key, bucket)
        }

        if (e.event_type === 'pageview') {
          bucket.pageviews++
          if (e.is_bot) bucket.botViews++

          const hour = d.getUTCHours()
          bucket.hourlyViews[hour]!++

          switch (e.device_type) {
            case 'mobile':
              bucket.mobile++
              break
            case 'desktop':
              bucket.desktop++
              break
            case 'tablet':
              bucket.tablet++
              break
          }

          switch (e.referrer_source) {
            case 'direct':
              bucket.refDirect++
              break
            case 'search':
              bucket.refSearch++
              break
            case 'social':
              bucket.refSocial++
              break
            case 'email':
              bucket.refEmail++
              break
            case 'referral':
              bucket.refReferral++
              break
            default:
              bucket.refOther++
              break
          }

          if (e.country) {
            bucket.countries[e.country] = (bucket.countries[e.country] ?? 0) + 1
          }
        } else if (e.event_type === 'link_click') {
          bucket.linkClicks++
          if (e.link_key) {
            bucket.linkClicksByKey[e.link_key] = (bucket.linkClicksByKey[e.link_key] ?? 0) + 1
          }
        }
      }

      totalProcessed += events.length
      since = events[events.length - 1]!.created_at

      if (events.length < PAGE_SIZE) break
    }

    if (buckets.size === 0) {
      return { status: 'ok' as const, aggregated: 0, eventsProcessed: 0 }
    }

    // --- Phase 2: Query accurate unique_visitors per site+date from full day ---
    const uniqueVisitorsByKey = new Map<string, number>()

    for (const [key, bucket] of buckets) {
      const { data: visitorRows } = await supabase
        .from('linktree_events')
        .select('visitor_id')
        .eq('site_id', bucket.siteId)
        .eq('event_type', 'pageview')
        .gte('created_at', `${bucket.date}T00:00:00.000Z`)
        .lt('created_at', `${bucket.date}T23:59:59.999Z`)
        .not('visitor_id', 'is', null)
        .limit(10_000)

      const distinctSet = new Set(visitorRows?.map((r) => r.visitor_id))
      uniqueVisitorsByKey.set(key, distinctSet.size)
    }

    // --- Phase 3: Build rows and call the additive upsert RPC ---
    const rows = Array.from(buckets.entries()).map(([key, b]) => ({
      site_id: b.siteId,
      date: b.date,
      weekday: b.weekday,
      pageviews: b.pageviews,
      unique_visitors: uniqueVisitorsByKey.get(key) ?? 0,
      link_clicks: b.linkClicks,
      bot_views: b.botViews,
      mobile_views: b.mobile,
      desktop_views: b.desktop,
      tablet_views: b.tablet,
      ref_direct: b.refDirect,
      ref_search: b.refSearch,
      ref_social: b.refSocial,
      ref_email: b.refEmail,
      ref_referral: b.refReferral,
      ref_other: b.refOther,
      countries: b.countries,
      hourly_views: b.hourlyViews,
      link_clicks_by_key: b.linkClicksByKey,
    }))

    const { error: rpcErr } = await supabase.rpc('upsert_linktree_daily_metrics', {
      p_rows: rows,
    })

    if (rpcErr) {
      Sentry.captureException(new Error(rpcErr.message), { tags: { component: JOB } })
      return { status: 'error' as const, error: rpcErr.message }
    }

    const { error: wmErr } = await supabase
      .from('link_aggregation_watermark')
      .upsert({ id: 'linktree', last_processed_at: until })

    if (wmErr) {
      Sentry.captureException(new Error(wmErr.message), { tags: { component: JOB } })
      return { status: 'error' as const, error: `watermark update failed: ${wmErr.message}` }
    }

    return { status: 'ok' as const, aggregated: rows.length, eventsProcessed: totalProcessed }
  })
}
