import { CmsTopbar, CmsButton } from '@tn-figueiredo/cms-ui/client'
import { AnalyticsTabs } from '@tn-figueiredo/cms-admin/analytics/client'

export default async function AnalyticsPage() {
  return (
    <div>
      <CmsTopbar title="Analytics" actions={<CmsButton variant="ghost" size="sm">Export Report</CmsButton>} />
      <div className="p-6 lg:p-8">
        <AnalyticsTabs />
      </div>
    </div>
  )
}
