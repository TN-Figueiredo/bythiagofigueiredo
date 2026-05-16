import type { FunnelData, ClickedLink } from '@/app/cms/(authed)/analytics/types'

export interface InsightCard {
  id: string
  type: 'warning' | 'success' | 'opportunity'
  color: 'red' | 'green' | 'indigo'
  title: string
  body: string
}

interface LinkStats {
  topLinks: ClickedLink[]
  totalClicks: number
  prevTotalClicks?: number
}

/**
 * Generate up to 3 insight cards based on funnel and link data.
 *
 * Rules:
 * - Biggest funnel leak → red (warning)
 * - Winning pattern / click growth → green (success)
 * - Low conversion opportunity → indigo (opportunity)
 */
export function generateInsights(funnel: FunnelData, links: LinkStats): InsightCard[] {
  const cards: InsightCard[] = []

  // 1. Biggest funnel leak (red)
  const stages = [
    { label: 'Views → Read 50%+', from: funnel.views, to: funnel.read50 },
    { label: 'Read 50%+ → Clicked Link', from: funnel.read50, to: funnel.clickedLink },
    { label: 'Clicked Link → NL Opened', from: funnel.clickedLink, to: funnel.nlOpened },
    { label: 'NL Opened → Subscribed', from: funnel.nlOpened, to: funnel.subscribed },
  ]

  let biggestLeak: { label: string; dropPct: number } | null = null
  for (const stage of stages) {
    if (stage.from === 0) continue
    const dropPct = Math.round(((stage.from - stage.to) / stage.from) * 100)
    if (!biggestLeak || dropPct > biggestLeak.dropPct) {
      biggestLeak = { label: stage.label, dropPct }
    }
  }

  if (biggestLeak && biggestLeak.dropPct > 0) {
    cards.push({
      id: 'funnel-leak',
      type: 'warning',
      color: 'red',
      title: 'Biggest funnel leak',
      body: `${biggestLeak.dropPct}% drop at "${biggestLeak.label}". Consider optimizing this stage.`,
    })
  }

  // 2. Click growth or winning pattern (green)
  if (links.prevTotalClicks !== undefined && links.prevTotalClicks > 0) {
    const growth = Math.round(
      ((links.totalClicks - links.prevTotalClicks) / links.prevTotalClicks) * 100,
    )
    if (growth > 0) {
      cards.push({
        id: 'click-growth',
        type: 'success',
        color: 'green',
        title: 'Click growth detected',
        body: `Link clicks grew ${growth}% vs previous period. Keep it up!`,
      })
    }
  } else if (links.topLinks.length > 0) {
    const topLink = links.topLinks[0]
    if (topLink) {
      cards.push({
        id: 'winning-link',
        type: 'success',
        color: 'green',
        title: 'Top performing link',
        body: `"${truncateUrl(topLink.url)}" drives ${topLink.clicks} clicks — the most in this period.`,
      })
    }
  }

  // 3. Opportunity: low conversion (indigo)
  if (funnel.views > 0 && funnel.subscribed === 0) {
    cards.push({
      id: 'no-conversions',
      type: 'opportunity',
      color: 'indigo',
      title: 'No new subscribers',
      body: 'Zero conversions this period. Consider adding a stronger CTA or lead magnet.',
    })
  } else if (funnel.views > 0 && funnel.read50 > 0) {
    const conversionRate = Math.round((funnel.subscribed / funnel.views) * 100)
    if (conversionRate < 2) {
      cards.push({
        id: 'low-conversion',
        type: 'opportunity',
        color: 'indigo',
        title: 'Low conversion rate',
        body: `Only ${conversionRate}% of views convert to subscribers. Test different CTAs or content formats.`,
      })
    }
  }

  return cards.slice(0, 3)
}

function truncateUrl(url: string): string {
  if (url.length <= 40) return url
  return url.slice(0, 37) + '...'
}
