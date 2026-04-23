'use client'

import { KpiCard } from '@tn-figueiredo/cms-ui/client'
import { AreaChart } from './area-chart'
import { DonutChart } from './donut-chart'
import { DeliveryFunnel } from './delivery-funnel'

interface OverviewTabProps {
  period: string
}

function buildEngagementSeries(period: string) {
  const counts =
    period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 12
  const labels: string[] = []
  const pageViews: number[] = []
  const opens: number[] = []
  const clicks: number[] = []

  for (let i = 0; i < counts; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (counts - 1 - i))
    labels.push(
      period === '12m'
        ? d.toLocaleDateString('en', { month: 'short' })
        : `${d.getMonth() + 1}/${d.getDate()}`,
    )
    pageViews.push(Math.floor(400 + Math.random() * 600 + Math.sin(i / 4) * 200))
    opens.push(Math.floor(100 + Math.random() * 150 + Math.cos(i / 3) * 60))
    clicks.push(Math.floor(20 + Math.random() * 50 + Math.sin(i / 5) * 20))
  }

  return {
    data: labels.map((label, i) => ({
      label,
      values: [pageViews[i] ?? 0, opens[i] ?? 0, clicks[i] ?? 0],
    })),
    todayIndex: counts - 1,
  }
}

const AUDIENCE_SEGMENTS = [
  { label: 'Direct', value: 342, color: '#6366f1' },
  { label: 'Organic Search', value: 218, color: '#22c55e' },
  { label: 'Newsletter', value: 156, color: '#f59e0b' },
  { label: 'Social', value: 89, color: '#06b6d4' },
  { label: 'Referral', value: 47, color: '#a855f7' },
]

const FUNNEL_STEPS = [
  { label: 'Sent', value: 4820, percentage: 100, color: '#6366f1' },
  { label: 'Delivered', value: 4731, percentage: 98, color: '#22c55e' },
  { label: 'Opened', value: 2104, percentage: 44, color: '#f59e0b' },
  { label: 'Clicked', value: 618, percentage: 13, color: '#06b6d4' },
  { label: 'Bounced', value: 89, percentage: 2, color: '#ef4444' },
]

const TOP_POSTS = [
  { title: 'Building a multi-tenant CMS with Next.js 15', views: 2341, locale: 'en' },
  { title: 'LGPD compliance deep-dive: the 3-phase model', views: 1876, locale: 'pt-BR' },
  { title: 'SEO hardening with schema.org JSON-LD', views: 1203, locale: 'en' },
  { title: 'React 19 actions & progressive enhancement', views: 987, locale: 'en' },
  { title: 'Newsletter engine: Resend + RFC 8058', views: 754, locale: 'pt-BR' },
]

const TOP_CAMPAIGNS = [
  { title: 'Sprint 5 Launch Pack', submissions: 312, convRate: 8.4 },
  { title: 'Developer Newsletter Q1', submissions: 198, convRate: 6.2 },
  { title: 'LGPD Compliance Kit', submissions: 143, convRate: 5.1 },
]

const RANK_STYLES: Record<number, string> = {
  1: '\u{1F947}',
  2: '\u{1F948}',
  3: '\u{1F949}',
}

export function OverviewTab({ period }: OverviewTabProps) {
  const { data, todayIndex } = buildEngagementSeries(period)

  const kpis = [
    {
      label: 'Emails Delivered',
      value: '8,201',
      trend: { direction: 'up' as const, label: '+5.2% vs prior' },
      sparklinePoints: [320, 410, 390, 480, 520, 610, 580],
      color: 'default' as const,
    },
    {
      label: 'Open Rate',
      value: '30.9%',
      trend: { direction: 'up' as const, label: '+1.4pp vs prior' },
      sparklinePoints: [180, 210, 190, 240, 230, 260, 250],
      color: 'green' as const,
    },
    {
      label: 'Click Rate',
      value: '7.3%',
      trend: { direction: 'up' as const, label: '+0.6pp vs prior' },
      sparklinePoints: [38, 40, 41, 43, 42, 44, 44],
      color: 'cyan' as const,
    },
    {
      label: 'Campaign Leads',
      value: '1,896',
      trend: { direction: 'up' as const, label: '+18% vs prior' },
      sparklinePoints: [90, 80, 95, 110, 125, 140, 175],
      color: 'amber' as const,
    },
    {
      label: 'Bounce Rate',
      value: '2.6%',
      trend: { direction: 'down' as const, label: '-0.3pp vs prior' },
      sparklinePoints: [4, 3.5, 3, 2.8, 2.7, 2.6, 2.6],
      color: 'default' as const,
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            trend={kpi.trend}
            sparklinePoints={kpi.sparklinePoints}
            color={kpi.color}
          />
        ))}
      </div>

      {/* Engagement area chart */}
      <div
        className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-5"
      >
        <h3 className="text-sm font-medium text-cms-text mb-4">Engagement Over Time</h3>
        <AreaChart
          data={data}
          series={[
            { name: 'Page Views', color: '#6366f1' },
            { name: 'Opens', color: '#22c55e' },
            { name: 'Clicks', color: '#f59e0b' },
          ]}
          height={200}
          todayIndex={todayIndex}
        />
      </div>

      {/* Audience + Funnel row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-5">
          <h3 className="text-sm font-medium text-cms-text mb-4">Audience Sources</h3>
          <DonutChart
            segments={AUDIENCE_SEGMENTS}
            centerLabel="Sessions"
            centerValue="852"
            size={130}
          />
        </div>

        <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-5">
          <h3 className="text-sm font-medium text-cms-text mb-4">Delivery Funnel</h3>
          <DeliveryFunnel steps={FUNNEL_STEPS} />
        </div>
      </div>

      {/* Top posts + campaigns row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-5">
          <h3 className="text-sm font-medium text-cms-text mb-3">Top Posts</h3>
          <div className="space-y-2">
            {TOP_POSTS.map((post, idx) => (
              <div
                key={post.title}
                className="flex items-center gap-2 text-xs py-1.5 border-b border-cms-border last:border-0"
              >
                <span className="text-base leading-none w-5 shrink-0">
                  {RANK_STYLES[idx + 1] ?? `${idx + 1}`}
                </span>
                <span className="text-cms-text flex-1 truncate">{post.title}</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: 'var(--cms-bg, #0f1117)', color: 'var(--cms-text-dim, #52525b)' }}
                >
                  {post.locale}
                </span>
                <span className="text-cms-text-muted tabular-nums shrink-0">
                  {post.views.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-5">
          <h3 className="text-sm font-medium text-cms-text mb-3">Top Campaigns</h3>
          <div className="space-y-2">
            {TOP_CAMPAIGNS.map((campaign, idx) => (
              <div
                key={campaign.title}
                className="flex items-center gap-2 text-xs py-1.5 border-b border-cms-border last:border-0"
              >
                <span className="text-base leading-none w-5 shrink-0">
                  {RANK_STYLES[idx + 1] ?? `${idx + 1}`}
                </span>
                <span className="text-cms-text flex-1 truncate">{campaign.title}</span>
                <span className="text-cms-text-muted tabular-nums shrink-0">
                  {campaign.submissions} leads
                </span>
                <span className="text-cms-green tabular-nums shrink-0">
                  {campaign.convRate}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
