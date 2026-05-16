import { getSiteContext } from '@/lib/cms/site-context'
import { fetchDashboardBlogHealth } from './_components/dashboard-blog-health-queries'
import {
  fetchDashboardKpis,
  fetchNeedsAttention,
  fetchThisWeekStrip,
  fetchActivityFeed,
  type DashboardPeriod,
} from './_components/dashboard-queries'
import { getGreeting, formatTodayLabel } from './_components/dashboard-greeting'
import { DashboardHeader } from './_components/dashboard-header'
import { DashboardKpiGrid } from './_components/dashboard-kpi-grid'
import { DashboardNeedsAttention } from './_components/dashboard-needs-attention'
import { DashboardWeekStrip } from './_components/dashboard-week-strip'
import { DashboardQuickActions } from './_components/dashboard-quick-actions'
import { DashboardActivityFeed } from './_components/dashboard-activity-feed'
import { BlogHealthSection } from './_components/dashboard-blog-health'

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

  const { siteId, timezone } = await getSiteContext()

  const [kpis, attentionItems, weekStrip, activityFeed, blogHealth] =
    await Promise.all([
      fetchDashboardKpis(siteId, period),
      fetchNeedsAttention(siteId),
      fetchThisWeekStrip(siteId, timezone),
      fetchActivityFeed(siteId),
      fetchDashboardBlogHealth(siteId),
    ])

  const { text: greeting } = getGreeting(timezone)
  const todayLabel = formatTodayLabel(timezone)

  return (
    <div className="flex min-h-screen flex-col" data-testid="dashboard">
      <DashboardHeader greeting={greeting} todayLabel={todayLabel} period={period} />

      <div className="flex flex-1 gap-6 p-6 lg:p-8">
        {/* Main column */}
        <main className="flex min-w-0 flex-1 flex-col gap-6">
          <DashboardKpiGrid data={kpis} />
          <DashboardNeedsAttention items={attentionItems} />
          <DashboardWeekStrip days={weekStrip} />
          <DashboardQuickActions />
          {blogHealth && <BlogHealthSection data={blogHealth} />}
        </main>

        {/* Aside — Activity Feed */}
        <aside className="hidden w-[340px] shrink-0 lg:block">
          <div className="sticky top-20 rounded-xl border border-[var(--bdr-1)] bg-[var(--bg-2)]/40 p-5">
            <div className="max-h-[calc(100vh-10rem)] overflow-y-auto [mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)]">
              <DashboardActivityFeed items={activityFeed} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
