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
      .select('link_id, site_id, clicked_at, is_unique, is_bot, country, referrer_domain')
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
        unique_clicks: number
        bot_clicks: number
        countries: Set<string>
        referrers: Set<string>
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
          unique_clicks: 0,
          bot_clicks: 0,
          countries: new Set(),
          referrers: new Set(),
        })
      }
      const b = buckets.get(key)!
      b.clicks++
      if (click.is_unique) b.unique_clicks++
      if (click.is_bot) b.bot_clicks++
      if (click.country) b.countries.add(click.country)
      if (click.referrer_domain) b.referrers.add(click.referrer_domain)
    }

    // Upsert daily metrics
    const rows = [...buckets.values()].map((b) => ({
      link_id: b.link_id,
      site_id: b.site_id,
      date: b.date,
      clicks: b.clicks,
      unique_clicks: b.unique_clicks,
      bot_clicks: b.bot_clicks,
      top_countries: [...b.countries].slice(0, 10),
      top_referrers: [...b.referrers].slice(0, 10),
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
