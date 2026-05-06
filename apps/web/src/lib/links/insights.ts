import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyMetricRow {
  date: string
  clicks: number
  unique_visitors: number
  mobile_clicks: number
  desktop_clicks: number
  countries: Record<string, number> | null
  hourly_clicks: Record<string, number> | null
}

interface AggregatedMetrics {
  clicksByDay: Map<string, number>
  clicksByHour: number[]
  countryMap: Map<string, number>
  mobileClicks: number
  desktopClicks: number
  total: number
  recentTotal: number
  prevTotal: number
}

// ─── Data loader ─────────────────────────────────────────────────────────────

async function loadMetrics(linkId: string): Promise<AggregatedMetrics> {
  const supabase = getSupabaseServiceClient()
  const cutoff = new Date(Date.now() - 30 * 86400 * 1000).toISOString().slice(0, 10)

  const { data: rows } = await supabase
    .from('link_daily_metrics')
    .select('date, clicks, unique_visitors, mobile_clicks, desktop_clicks, countries, hourly_clicks')
    .eq('link_id', linkId)
    .gte('date', cutoff)
    .order('date', { ascending: true })

  const metrics = (rows ?? []) as DailyMetricRow[]

  const clicksByDay = new Map<string, number>()
  const clicksByHour = new Array<number>(24).fill(0)
  const countryMap = new Map<string, number>()
  let mobileClicks = 0
  let desktopClicks = 0
  let total = 0

  const now = Date.now()
  const recentCutoff = new Date(now - 7 * 86400 * 1000).toISOString().slice(0, 10)
  const prevCutoff = new Date(now - 14 * 86400 * 1000).toISOString().slice(0, 10)
  let recentTotal = 0
  let prevTotal = 0

  for (const row of metrics) {
    const dayClicks = row.clicks ?? 0
    clicksByDay.set(row.date, dayClicks)
    total += dayClicks
    mobileClicks += row.mobile_clicks ?? 0
    desktopClicks += row.desktop_clicks ?? 0

    if (row.date >= recentCutoff) {
      recentTotal += dayClicks
    } else if (row.date >= prevCutoff) {
      prevTotal += dayClicks
    }

    if (row.countries) {
      for (const [c, n] of Object.entries(row.countries)) {
        countryMap.set(c, (countryMap.get(c) ?? 0) + n)
      }
    }

    if (row.hourly_clicks) {
      for (const [h, c] of Object.entries(row.hourly_clicks)) {
        const hour = parseInt(h, 10)
        if (hour >= 0 && hour < 24) {
          clicksByHour[hour] = (clicksByHour[hour] ?? 0) + (c as number)
        }
      }
    }
  }

  return {
    clicksByDay,
    clicksByHour,
    countryMap,
    mobileClicks,
    desktopClicks,
    total,
    recentTotal,
    prevTotal,
  }
}

// ─── Insight rules ────────────────────────────────────────────────────────────

/**
 * Rule 1 -- Traffic spike detection.
 * Fires when the most recent day has >=3x the 7-day daily average.
 */
function ruleSpikeDetection(metrics: AggregatedMetrics): string | null {
  if (metrics.clicksByDay.size < 3) return null

  const days = Array.from(metrics.clicksByDay.entries()).sort(([a], [b]) => a.localeCompare(b))
  const lastDay = days[days.length - 1]
  if (!lastDay) return null

  const [lastDate, lastCount] = lastDay
  const prior7 = days.slice(-8, -1)
  if (prior7.length === 0) return null

  const avg7d = prior7.reduce((sum, [, c]) => sum + c, 0) / prior7.length
  if (avg7d === 0) return null

  const ratio = lastCount / avg7d
  if (ratio >= 3) {
    return `Traffic spike detected: ${lastCount} clicks on ${lastDate} -- ${ratio.toFixed(1)}x above the 7-day average (${avg7d.toFixed(0)} clicks/day).`
  }

  return null
}

/**
 * Rule 2 -- Geo concentration.
 * Fires when a single country is responsible for >70% of clicks.
 */
function ruleGeoConcentration(metrics: AggregatedMetrics): string | null {
  if (metrics.total < 15) return null

  let topCountry: string | null = null
  let topCount = 0

  for (const [country, count] of metrics.countryMap) {
    if (count > topCount) {
      topCount = count
      topCountry = country
    }
  }

  if (!topCountry || topCount === 0) return null

  const share = topCount / metrics.total
  if (share >= 0.7) {
    return `Geographic concentration: ${(share * 100).toFixed(0)}% of clicks come from "${topCountry}". Consider creating localized content for that market.`
  }

  return null
}

/**
 * Rule 3 -- Best time insight.
 * Fires when a single 4-hour window concentrates >50% of clicks.
 */
function ruleBestTime(metrics: AggregatedMetrics): string | null {
  if (metrics.total < 20) return null

  const h = metrics.clicksByHour
  let bestWindow = 0
  let bestStart = 0

  for (let start = 0; start < 24; start++) {
    const windowClicks = (h[start % 24] ?? 0) + (h[(start + 1) % 24] ?? 0) + (h[(start + 2) % 24] ?? 0) + (h[(start + 3) % 24] ?? 0)
    if (windowClicks > bestWindow) {
      bestWindow = windowClicks
      bestStart = start
    }
  }

  const share = bestWindow / metrics.total
  if (share >= 0.5) {
    const endHour = (bestStart + 4) % 24
    return `Best time: ${bestStart}h-${endHour}h UTC concentrates ${(share * 100).toFixed(0)}% of clicks. Schedule publications in this interval for maximum reach.`
  }

  return null
}

/**
 * Rule 4 -- Device insight.
 * Fires when mobile share exceeds 80% or is below 20%.
 */
function ruleDeviceInsight(metrics: AggregatedMetrics): string | null {
  if (metrics.total < 15) return null

  const mobileShare = metrics.mobileClicks / metrics.total

  if (mobileShare >= 0.8) {
    return `Mostly mobile audience (${(mobileShare * 100).toFixed(0)}%). Verify that the destination page is optimized for mobile devices.`
  }

  if (mobileShare <= 0.2 && metrics.total >= 30) {
    const desktopShare = metrics.desktopClicks / metrics.total
    return `Predominantly desktop audience (${(desktopShare * 100).toFixed(0)}%). Long-form or technical content tends to perform well with this profile.`
  }

  return null
}

/**
 * Rule 5 -- Week-over-week growth/decline.
 * Fires when growth >= 50% or decline >= 40%.
 */
function ruleGrowthTrend(metrics: AggregatedMetrics): string | null {
  if (metrics.prevTotal === 0) return null

  const growth = ((metrics.recentTotal - metrics.prevTotal) / metrics.prevTotal) * 100

  if (growth >= 50) {
    return `Accelerated growth: +${growth.toFixed(0)}% clicks in the last 7 days compared to the prior week. Keep the distribution momentum.`
  }

  if (growth <= -40 && metrics.prevTotal >= 10) {
    return `Traffic decline: ${Math.abs(growth).toFixed(0)}% fewer clicks in the last 7 days. Check if the link is still being actively promoted.`
  }

  return null
}

/**
 * Rule 6 -- Low engagement warning.
 * Fires when a link has been active for 7+ days but total clicks < 5.
 */
function ruleLowEngagement(metrics: AggregatedMetrics): string | null {
  if (metrics.clicksByDay.size >= 7 && metrics.total < 5) {
    return 'Low engagement: this link has fewer than 5 clicks over the last 7+ days. Consider revising the distribution strategy or the destination URL.'
  }
  return null
}

// ─── Engine ───────────────────────────────────────────────────────────────────

const RULES = [
  ruleSpikeDetection,
  ruleGeoConcentration,
  ruleBestTime,
  ruleDeviceInsight,
  ruleGrowthTrend,
  ruleLowEngagement,
]

async function computeInsights(linkId: string): Promise<string[]> {
  const metrics = await loadMetrics(linkId)
  const insights: string[] = []

  for (const rule of RULES) {
    const result = rule(metrics)
    if (result) insights.push(result)
  }

  return insights
}

// ─── Public API (cached 1h) ───────────────────────────────────────────────────

export const getAiInsightsForLink = unstable_cache(
  async (linkId: string): Promise<string[]> => {
    return computeInsights(linkId)
  },
  ['links-ai-insights'],
  {
    revalidate: 3600,
    tags: ['links-ai-insights'],
  },
)

// Exported for testing
export {
  ruleSpikeDetection,
  ruleGeoConcentration,
  ruleBestTime,
  ruleDeviceInsight,
  ruleGrowthTrend,
  ruleLowEngagement,
  type AggregatedMetrics,
}
