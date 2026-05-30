import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { createServerClient } from '@tn-figueiredo/auth-nextjs'
import { getSiteContext } from '@/lib/cms/site-context'

export const dynamic = 'force-dynamic'
import { fetchDashboardBlogHealth } from './_components/dashboard-blog-health-queries'
import {
  fetchDashboardKpis,
  fetchNeedsAttention,
  fetchThisWeekStrip,
  fetchActivityFeed,
  fetchYtDashboardSummary,
  type DashboardPeriod,
} from './_components/dashboard-queries'
import { fetchFunnelData, fetchTopLinks } from '@/lib/analytics/analytics-queries'
import { generateInsights } from '@/lib/analytics/insights-engine'
import { getGreeting, formatTodayLabel } from './_components/dashboard-greeting'
import { DashboardHeader } from './_components/dashboard-header'
import { DashboardKpiGrid } from './_components/dashboard-kpi-grid'
import { DashboardNeedsAttention } from './_components/dashboard-needs-attention'
import { DashboardWeekStrip } from './_components/dashboard-week-strip'
import { DashboardQuickActions } from './_components/dashboard-quick-actions'
import { DashboardActivityFeed } from './_components/dashboard-activity-feed'
import { BlogHealthSection } from './_components/dashboard-blog-health'
import { DashboardYoutubeCard } from './_components/dashboard-youtube-card'
import { DashboardAiInsights } from './_components/dashboard-ai-insights'
import { SectionErrorBoundary } from './_shared/section-error-boundary'

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CmsDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const periodParam = typeof params.period === 'string' ? params.period : '7d'
  const period: DashboardPeriod =
    periodParam === '30d' || periodParam === '90d' ? periodParam : '7d'

  const { timezone } = await getSiteContext()
  const { text: greeting } = getGreeting(timezone)
  const todayLabel = formatTodayLabel(timezone)

  // Extract first name for personalized greeting
  let userName: string | undefined
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient({
      env: {
        apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          for (const { name, value, options } of list) {
            cookieStore.set(name, value, options)
          }
        },
      },
    })
    const { data: { user } } = await supabase.auth.getUser()
    const meta = user?.user_metadata as Record<string, string> | undefined
    const fullName = meta?.full_name ?? meta?.name
    userName = fullName?.split(' ')[0]
  } catch {
    // Silently fall back to no name
  }

  return (
    <div className="flex min-h-screen flex-col" data-testid="dashboard">
      <DashboardHeader greeting={greeting} userName={userName} todayLabel={todayLabel} period={period} />
      <SectionErrorBoundary>
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent period={period} />
        </Suspense>
      </SectionErrorBoundary>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Data section (streamed)                                           */
/* ------------------------------------------------------------------ */

async function DashboardContent({ period }: { period: DashboardPeriod }) {
  const { siteId, timezone, primaryDomain } = await getSiteContext()
  const periodInput = { type: 'preset' as const, value: period }
  const siteOrigin = primaryDomain
    ? `https://${primaryDomain}`
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')

  const [kpis, attentionItems, weekStrip, activityFeed, blogHealth, ytSummary, funnel, topLinks] =
    await Promise.all([
      fetchDashboardKpis(siteId, period),
      fetchNeedsAttention(siteId),
      fetchThisWeekStrip(siteId, timezone),
      fetchActivityFeed(siteId),
      fetchDashboardBlogHealth(siteId),
      fetchYtDashboardSummary(siteId),
      fetchFunnelData(siteId, periodInput, timezone),
      fetchTopLinks(siteId, periodInput, siteOrigin),
    ])

  const aiInsights = generateInsights(funnel, {
    topLinks,
    totalClicks: kpis.linkClicks,
    prevTotalClicks: undefined,
  })

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Quick Actions — top row */}
      <DashboardQuickActions />

      {/* Main 2-column grid */}
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        {/* Left column — primary content */}
        <main className="flex min-w-0 flex-col gap-6">
          <DashboardNeedsAttention items={attentionItems} />
          <DashboardWeekStrip days={weekStrip} />
          {ytSummary && <DashboardYoutubeCard data={ytSummary} />}
          <DashboardAiInsights insights={aiInsights} />
        </main>

        {/* Right column — status panels */}
        <aside className="flex flex-col gap-6">
          <div className="rounded-xl border border-[var(--bdr-1)] bg-[var(--bg-2)]/40 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="max-h-[calc(100vh-16rem)] overflow-y-auto [mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)]">
              <DashboardActivityFeed items={activityFeed} />
            </div>
          </div>
          {blogHealth && <BlogHealthSection data={blogHealth} />}
        </aside>
      </div>

      {/* KPI row — bottom anchored */}
      <DashboardKpiGrid data={kpis} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Skeleton fallback                                                  */
/* ------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-6 lg:p-8">
      {/* Quick actions skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-[var(--bg-2)]" />
        ))}
      </div>
      {/* 2-column grid skeleton */}
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          <div className="h-48 rounded-xl bg-[var(--bg-2)]" />
          <div className="h-36 rounded-xl bg-[var(--bg-2)]" />
        </div>
        <div className="space-y-6">
          <div className="h-64 rounded-xl bg-[var(--bg-2)]" />
          <div className="h-48 rounded-xl bg-[var(--bg-2)]" />
        </div>
      </div>
      {/* KPI skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-[var(--bg-2)]" />
        ))}
      </div>
    </div>
  )
}
