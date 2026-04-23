import { CmsTopbar } from '@/components/cms/cms-topbar'
import { CmsButton } from '@/components/cms/ui'
import { AnalyticsTabs } from './_components/analytics-tabs'

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
