# Links Insights — Implementation Plan

> **Goal:** Populate the Analytics tab Insights panel with real, auto-generated insights based on link metrics.

**Status:** Infrastructure exists (formatInsight, pipeline builder, InsightsPanel UI). Missing: the wiring that generates insights from actual data in `page.tsx`.

**Estimated effort:** ~2-3h

---

## What exists today

| Component | Location | Status |
|-----------|----------|--------|
| `formatInsight()` | `apps/web/src/lib/links/insights-formatter.ts` | Done — formats 6 insight types to tone/icon/text |
| `buildInsightsPayload()` | `apps/web/src/lib/links/pipeline-insights.ts` | Done — builds Cowork pipeline payload |
| Insights UI | `apps/web/src/app/cms/(authed)/links/_components/analytics-view.tsx` | Done — renders colored icon rows |
| Data prop | `apps/web/src/app/cms/(authed)/links/page.tsx:249` | **`insights: []`** — hardcoded empty |

---

## Tasks

### Task 1: Create `computeInsights()` pure function (~1h)

Create: `apps/web/src/lib/links/compute-insights.ts`

A pure function that takes link metrics and returns `RawInsight[]`:

```typescript
import type { RawInsight } from './insights-formatter'
import type { LinkDisplay } from '@tn-figueiredo/links-admin'

interface InsightInput {
  totalClicks: number
  prevClicks: number
  totalUnique: number
  prevUnique: number
  links: LinkDisplay[]
  qrShare: number
  heatmap: number[][]
}

export function computeInsights(input: InsightInput): RawInsight[] {
  const insights: RawInsight[] = []

  // 1. Growth/decline in clicks
  if (input.prevClicks > 0) {
    const pct = Math.round(((input.totalClicks - input.prevClicks) / input.prevClicks) * 100)
    if (pct > 5) {
      insights.push({ type: 'growth', metric: 'clicks', value: pct, period: '30d' })
    } else if (pct < -5) {
      insights.push({ type: 'decline', metric: 'clicks', value: pct, period: '30d' })
    }
  }

  // 2. Top performer
  const top = [...input.links].sort((a, b) => b.clicks - a.clicks)[0]
  if (top && top.clicks > 0) {
    insights.push({ type: 'top_performer', metric: 'clicks', value: top.clicks, linkTitle: top.title })
  }

  // 3. QR surge
  if (input.qrShare > 30) {
    insights.push({ type: 'qr_surge', metric: 'scans', value: Math.round(input.qrShare), period: '30d' })
  }

  // 4. Health warning
  const unhealthy = input.links.filter(l => l.health !== 'ok')
  if (unhealthy.length > 0) {
    insights.push({ type: 'health_warning', metric: 'health', value: unhealthy.length })
  }

  // 5. Milestone
  if (input.totalClicks >= 10000) {
    insights.push({ type: 'milestone', metric: 'clicks', value: input.totalClicks })
  } else if (input.totalClicks >= 1000) {
    insights.push({ type: 'milestone', metric: 'clicks', value: input.totalClicks })
  }

  // 6. Peak hours from heatmap
  let peakDay = 0, peakHour = 0, peakVal = 0
  input.heatmap.forEach((row, d) => {
    row.forEach((v, h) => {
      if (v > peakVal) { peakVal = v; peakDay = d; peakHour = h }
    })
  })
  if (peakVal > 0) {
    // Could add a timing insight here
  }

  return insights.slice(0, 4) // max 4 insights
}
```

**TDD:** Write tests first in `apps/web/test/lib/links/compute-insights.test.ts`

### Task 2: Wire into page.tsx (~30min)

In `apps/web/src/app/cms/(authed)/links/page.tsx`:

1. Import `computeInsights` and `formatInsight`
2. After building `analytics` object, compute insights:

```typescript
import { computeInsights } from '@/lib/links/compute-insights'
import { formatInsight } from '@/lib/links/insights-formatter'

// ... after building analytics object ...

const rawInsights = computeInsights({
  totalClicks, prevClicks: 0, // TODO: compute prev period
  totalUnique, prevUnique: 0,
  links, qrShare: 0,
  heatmap,
})

const analytics: AnalyticsDisplay = {
  // ... existing fields ...
  insights: rawInsights.map(formatInsight),
}
```

### Task 3: Previous period data for comparison (~1h)

Currently `prevClicks` and `prevUnique` are hardcoded to 0. To show growth/decline insights:

1. Add a second date range query for the previous period (30-60 days ago)
2. Compute `prevClicks` and `prevUnique` from that data
3. Pass to `computeInsights`

This also fixes the Delta badges in the KPI tiles showing proper comparison values.

### Task 4: (Optional) Cowork AI insights (~2h)

For richer narratives, use the existing `buildInsightsPayload()` to call the Cowork pipeline:

1. Check if pipeline key exists
2. Call pipeline endpoint with metrics payload
3. Parse response into `RawInsight[]`
4. Cache result for 1 hour (avoid repeated API calls)

This is optional — `computeInsights()` provides deterministic rule-based insights without AI.

---

## Dependencies

- `formatInsight()` already handles all 6 insight types
- `InsightsPanel` UI already renders formatted insights with tone colors
- No new packages needed

## Validation

- Insights should appear when there's meaningful data (clicks > 0, health issues, etc.)
- Empty state "Nenhum insight disponível" shows when no rules match
- Max 4 insights shown to avoid overwhelming the panel
