import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Insight } from '@tn-figueiredo/links-admin'

export async function getLinktreeInsights(
  siteId: string,
  dateFrom: string,
  dateTo: string,
): Promise<Insight[]> {
  const supabase = getSupabaseServiceClient()
  const insights: Insight[] = []

  const { data: metrics } = await supabase
    .from('linktree_daily_metrics')
    .select('date, pageviews, unique_visitors, link_clicks, link_clicks_by_key, countries')
    .eq('site_id', siteId)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: true })

  if (!metrics || metrics.length < 7) return insights

  const recent7 = metrics.slice(-7)
  const prior7 = metrics.slice(-14, -7)

  if (prior7.length > 0) {
    const recentViews = recent7.reduce((s, m) => s + (m.pageviews as number), 0)
    const priorViews = prior7.reduce((s, m) => s + (m.pageviews as number), 0)
    if (priorViews > 0) {
      const change = ((recentViews - priorViews) / priorViews) * 100
      if (Math.abs(change) > 20) {
        insights.push({
          id: 'traffic-trend',
          severity: change > 0 ? 'positive' : 'warning',
          title: change > 0 ? 'Tráfego crescendo' : 'Tráfego em queda',
          description: `Pageviews ${change > 0 ? 'aumentaram' : 'diminuíram'} ${Math.abs(Math.round(change))}% nos últimos 7 dias comparado à semana anterior.`,
          confidence: Math.min(Math.abs(change) / 100, 0.95),
        })
      }
    }

    const recentClicks = recent7.reduce((s, m) => s + (m.link_clicks as number), 0)
    const recentViews2 = recent7.reduce((s, m) => s + (m.pageviews as number), 0)
    const recentEngagement = recentViews2 > 0 ? recentClicks / recentViews2 : 0
    const priorClicks = prior7.reduce((s, m) => s + (m.link_clicks as number), 0)
    const priorViews2 = prior7.reduce((s, m) => s + (m.pageviews as number), 0)
    const priorEngagement = priorViews2 > 0 ? priorClicks / priorViews2 : 0
    if (priorEngagement > 0) {
      const engChange = ((recentEngagement - priorEngagement) / priorEngagement) * 100
      if (Math.abs(engChange) > 15) {
        insights.push({
          id: 'engagement-trend',
          severity: engChange > 0 ? 'positive' : 'warning',
          title: engChange > 0 ? 'Engagement melhorando' : 'Engagement caindo',
          description: `Taxa de engagement ${engChange > 0 ? 'subiu' : 'caiu'} ${Math.abs(Math.round(engChange))}%.`,
          confidence: 0.7,
        })
      }
    }
  }

  const allClicksByKey: Record<string, number> = {}
  for (const m of metrics) {
    const byKey = m.link_clicks_by_key as Record<string, number> | null
    if (!byKey) continue
    for (const [key, count] of Object.entries(byKey)) {
      allClicksByKey[key] = (allClicksByKey[key] ?? 0) + count
    }
  }
  const sorted = Object.entries(allClicksByKey).sort((a, b) => b[1] - a[1])
  if (sorted.length > 0) {
    const [topKey, topCount] = sorted[0]!
    const total = sorted.reduce((s, [, c]) => s + c, 0)
    if (total > 0) {
      insights.push({
        id: 'top-performer',
        severity: 'info',
        title: 'Link mais clicado',
        description: `"${topKey}" recebeu ${topCount} clicks (${Math.round((topCount / total) * 100)}% do total).`,
        confidence: 0.9,
      })
    }
  }

  const allCountries: Record<string, number> = {}
  for (const m of metrics) {
    const countries = m.countries as Record<string, number> | null
    if (!countries) continue
    for (const [c, count] of Object.entries(countries)) {
      allCountries[c] = (allCountries[c] ?? 0) + count
    }
  }
  const topCountry = Object.entries(allCountries).sort((a, b) => b[1] - a[1])[0]
  if (topCountry) {
    const totalGeo = Object.values(allCountries).reduce((s, c) => s + c, 0)
    const pct = Math.round((topCountry[1] / totalGeo) * 100)
    if (pct > 60) {
      insights.push({
        id: 'geo-concentration',
        severity: 'info',
        title: `${pct}% do tráfego de ${topCountry[0]}`,
        description: `A maioria dos visitantes vem de ${topCountry[0]}. Considere criar conteúdo localizado.`,
        confidence: 0.85,
      })
    }
  }

  return insights
}
