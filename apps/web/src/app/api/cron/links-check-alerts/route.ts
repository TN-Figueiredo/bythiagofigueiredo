import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'

export const runtime = 'nodejs'

const JOB = 'links-check-alerts'
const LOCK_KEY = 'cron:links-check-alerts'

export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    // Fetch active alerts
    const { data: alerts, error } = await supabase
      .from('link_alerts')
      .select('id, link_id, site_id, alert_type, metric, condition, last_triggered_at')
      .eq('active', true)

    if (error) return { status: 'error' as const, error: error.message }
    if (!alerts?.length) return { status: 'ok' as const, checked: 0, triggered: 0 }

    const today = new Date().toISOString().slice(0, 10)
    let triggered = 0

    for (const alert of alerts) {
      const cond = alert.condition as {
        operator?: string
        threshold?: number
        window_days?: number
      }
      if (!cond.threshold || !cond.operator) continue

      const windowDays = cond.window_days ?? 1
      const since = new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10)

      // Aggregate metric over window
      const { data: metrics } = await supabase
        .from('link_daily_metrics')
        .select(alert.metric)
        .eq('link_id', alert.link_id)
        .gte('date', since)
        .lte('date', today)

      if (!metrics?.length) continue

      const total = metrics.reduce(
        (sum, m) => sum + (Number((m as unknown as Record<string, number>)[alert.metric]) || 0),
        0,
      )

      let shouldTrigger = false
      if (cond.operator === 'gt' && total > cond.threshold) shouldTrigger = true
      if (cond.operator === 'gte' && total >= cond.threshold) shouldTrigger = true
      if (cond.operator === 'lt' && total < cond.threshold) shouldTrigger = true

      // Cooldown: don't re-trigger within 24h
      if (shouldTrigger && alert.last_triggered_at) {
        const lastTriggered = new Date(alert.last_triggered_at as string)
        if (Date.now() - lastTriggered.getTime() < 86400000) shouldTrigger = false
      }

      if (shouldTrigger) {
        await supabase
          .from('link_alerts')
          .update({ last_triggered_at: new Date().toISOString() })
          .eq('id', alert.id)
        triggered++
      }
    }

    return { status: 'ok' as const, checked: alerts.length, triggered }
  })
}
