import type { RawInsight } from './insights-formatter'

export interface DashboardInsightInput {
  byDay: number[]
  links: Array<{ title: string; clicks: number; health: 'ok' | 'warn' | 'broken' }>
  devices: Array<{ k: string; v: number }>
  countries: Array<{ v: number; name: string }>
  totalClicks: number
  qrShare: number
}

const PRIORITY: Record<string, number> = {
  health_warning: 0,
  decline: 1,
  growth: 2,
  device_skew: 3,
  geo_concentration: 4,
  top_performer: 5,
  milestone: 6,
  qr_surge: 7,
}

export function computeDashboardInsights(input: DashboardInsightInput): RawInsight[] {
  const insights: RawInsight[] = []

  if (input.byDay.length >= 14) {
    const last7 = input.byDay.slice(-7).reduce((s, v) => s + v, 0)
    const prev7 = input.byDay.slice(-14, -7).reduce((s, v) => s + v, 0)
    if (prev7 >= 5) {
      const pct = Math.round(((last7 - prev7) / prev7) * 100)
      if (pct > 20) {
        insights.push({ type: 'growth', metric: 'clicks', value: pct, period: '7d' })
      } else if (pct < -20) {
        insights.push({ type: 'decline', metric: 'clicks', value: Math.abs(pct), period: '7d' })
      }
    }
  }

  const sorted = [...input.links].filter(l => l.clicks > 0).sort((a, b) => b.clicks - a.clicks)
  const topLink = sorted[0]
  if (sorted.length >= 2 && topLink) {
    insights.push({
      type: 'top_performer',
      metric: 'clicks',
      value: topLink.clicks,
      linkTitle: topLink.title,
    })
  }

  const unhealthy = input.links.filter(l => l.health !== 'ok')
  if (unhealthy.length > 0) {
    insights.push({ type: 'health_warning', metric: 'health', value: unhealthy.length })
  }

  const thresholds = [10_000, 5_000, 1_000, 500, 100]
  for (const t of thresholds) {
    if (input.totalClicks >= t) {
      insights.push({ type: 'milestone', metric: 'clicks', value: input.totalClicks })
      break
    }
  }

  if (input.qrShare > 30) {
    insights.push({ type: 'qr_surge', metric: 'scans', value: Math.round(input.qrShare), period: '30d' })
  }

  const topCountry = input.countries[0]
  if (topCountry && topCountry.v > 70) {
    insights.push({
      type: 'geo_concentration',
      metric: 'clicks',
      value: topCountry.v,
      linkTitle: topCountry.name,
    })
  }

  const mobileEntry = input.devices.find(d => d.k === 'Mobile')
  const desktopEntry = input.devices.find(d => d.k === 'Desktop')
  if (mobileEntry && mobileEntry.v >= 80) {
    insights.push({ type: 'device_skew', metric: 'clicks', value: mobileEntry.v, linkTitle: 'mobile' })
  } else if (desktopEntry && desktopEntry.v >= 80) {
    insights.push({ type: 'device_skew', metric: 'clicks', value: desktopEntry.v, linkTitle: 'desktop' })
  }

  insights.sort((a, b) => (PRIORITY[a.type] ?? 99) - (PRIORITY[b.type] ?? 99))

  return insights.slice(0, 4)
}
