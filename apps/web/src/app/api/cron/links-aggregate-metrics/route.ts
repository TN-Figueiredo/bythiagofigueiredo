import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 60

const JOB = 'links-aggregate-metrics'
const LOCK_KEY = 'cron:links-aggregate-metrics'

export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    // Read watermark
    const { data: watermark } = await supabase
      .from('link_aggregation_watermark')
      .select('last_processed_at')
      .single()

    const since = watermark?.last_processed_at ?? new Date(0).toISOString()
    const until = new Date().toISOString()

    // Fetch clicks since watermark
    const { data: clicks, error: clicksErr } = await supabase
      .from('link_clicks')
      .select('link_id, site_id, clicked_at, is_unique, is_bot, country, referrer_domain, device_type, referrer_source')
      .gt('clicked_at', since)
      .lte('clicked_at', until)
      .order('clicked_at', { ascending: true })

    if (clicksErr) {
      return {
        status: 'error' as const,
        error: clicksErr.message,
      }
    }

    if (!clicks || clicks.length === 0) {
      return { status: 'ok' as const, aggregated: 0 }
    }

    // Aggregate by (link_id, date)
    const buckets = new Map<
      string,
      {
        link_id: string
        site_id: string
        date: string
        clicks: number
        unique_visitors: number
        bot_clicks: number
        countries: Record<string, number>
        mobile_clicks: number
        desktop_clicks: number
        tablet_clicks: number
        ref_direct: number
        ref_search: number
        ref_social: number
        ref_email: number
        ref_referral: number
        ref_other: number
        hourly_clicks: Record<string, number>
      }
    >()

    for (const click of clicks) {
      const date = click.clicked_at.slice(0, 10)
      const key = `${click.link_id}:${date}`
      if (!buckets.has(key)) {
        buckets.set(key, {
          link_id: click.link_id,
          site_id: click.site_id,
          date,
          clicks: 0,
          unique_visitors: 0,
          bot_clicks: 0,
          countries: {},
          mobile_clicks: 0,
          desktop_clicks: 0,
          tablet_clicks: 0,
          ref_direct: 0,
          ref_search: 0,
          ref_social: 0,
          ref_email: 0,
          ref_referral: 0,
          ref_other: 0,
          hourly_clicks: {},
        })
      }
      const b = buckets.get(key)!
      b.clicks++
      if (click.is_unique) b.unique_visitors++
      if (click.is_bot) b.bot_clicks++
      if (click.country) {
        b.countries[click.country] = (b.countries[click.country] ?? 0) + 1
      }
      // Device breakdown
      if (click.device_type === 'mobile') b.mobile_clicks++
      else if (click.device_type === 'desktop') b.desktop_clicks++
      else if (click.device_type === 'tablet') b.tablet_clicks++
      // Referrer source breakdown
      const src = click.referrer_source ?? 'direct'
      if (src === 'direct') b.ref_direct++
      else if (src === 'search') b.ref_search++
      else if (src === 'social') b.ref_social++
      else if (src === 'email') b.ref_email++
      else if (src === 'referral') b.ref_referral++
      else b.ref_other++
      // Hourly distribution
      const hour = String(new Date(click.clicked_at).getUTCHours())
      b.hourly_clicks[hour] = (b.hourly_clicks[hour] ?? 0) + 1
    }

    // Upsert daily metrics
    const rows = [...buckets.values()].map((b) => ({
      link_id: b.link_id,
      site_id: b.site_id,
      date: b.date,
      weekday: new Date(b.date).getUTCDay() as number,
      clicks: b.clicks,
      unique_visitors: b.unique_visitors,
      bot_clicks: b.bot_clicks,
      countries: b.countries,
      mobile_clicks: b.mobile_clicks,
      desktop_clicks: b.desktop_clicks,
      tablet_clicks: b.tablet_clicks,
      ref_direct: b.ref_direct,
      ref_search: b.ref_search,
      ref_social: b.ref_social,
      ref_email: b.ref_email,
      ref_referral: b.ref_referral,
      ref_other: b.ref_other,
      hourly_clicks: b.hourly_clicks,
    }))

    const { error: upsertErr } = await supabase
      .from('link_daily_metrics')
      .upsert(rows, { onConflict: 'link_id,date' })

    if (upsertErr) {
      return { status: 'error' as const, error: upsertErr.message }
    }

    // Update watermark
    await supabase
      .from('link_aggregation_watermark')
      .upsert({ id: 'singleton', last_processed_at: until })

    return { status: 'ok' as const, aggregated: rows.length }
  })
}
