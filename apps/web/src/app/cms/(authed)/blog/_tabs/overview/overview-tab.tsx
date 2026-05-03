'use client'

import type { OverviewTabData } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { KpiStrip } from './kpi-strip'
import { TagBreakdown } from './tag-breakdown'
import { RecentPublications } from './recent-publications'
import { SparklineSvg } from '../../_shared/sparkline-svg'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'

interface OverviewTabProps {
  data: OverviewTabData
  strings?: BlogHubStrings
}

export function OverviewTab({ data, strings }: OverviewTabProps) {
  const s = strings

  return (
    <div className="flex flex-col gap-4">
      <SectionErrorBoundary sectionName="KPI strip">
        <KpiStrip kpis={data.kpis} sparklines={data.sparklines} strings={s} />
      </SectionErrorBoundary>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SectionErrorBoundary sectionName="Tag breakdown">
          <TagBreakdown data={data.tagBreakdown} strings={s} />
        </SectionErrorBoundary>
        <SectionErrorBoundary sectionName="Recent publications">
          <RecentPublications data={data.recentPublications} strings={s} />
        </SectionErrorBoundary>
      </div>

      {data.velocitySparkline.length >= 2 && (
        <SectionErrorBoundary sectionName="Velocity trend">
          <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {s?.overview.velocityTrend ?? 'Publishing Velocity'}
            </h3>
            <SparklineSvg
              data={data.velocitySparkline}
              width={200}
              height={40}
              color="#6366f1"
              variant="area"
            />
          </div>
        </SectionErrorBoundary>
      )}
    </div>
  )
}
