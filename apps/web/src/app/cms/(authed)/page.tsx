import { cms } from '@/lib/cms/admin'
import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { DashboardKpis, ComingUp, ContinueEditing } from '@tn-figueiredo/cms-admin/dashboard/client'
import { ContentPerformanceCard } from './_components/content-performance-card'

export default async function CmsDashboardPage() {
  const { siteId } = await getSiteContext()
  const [kpis, comingUp] = await Promise.all([
    cms.dashboard.getKpis(),
    cms.dashboard.getComingUp(),
  ])

  return (
    <div>
      <CmsTopbar title="Dashboard" />
      <div className="p-6 lg:p-8 space-y-6">
        <ContinueEditing siteId={siteId} />
        <DashboardKpis data={kpis} />

        <div className="grid lg:grid-cols-[3fr_2fr] gap-6">
          <div className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] p-5">
            <h3 className="text-sm font-semibold text-cms-text mb-4">Content Performance</h3>
            <ContentPerformanceCard kpis={kpis} />
          </div>

          <div className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] p-5">
            <h3 className="text-sm font-semibold text-cms-text mb-4">Coming Up</h3>
            <ComingUp items={comingUp} />
          </div>
        </div>
      </div>
    </div>
  )
}
