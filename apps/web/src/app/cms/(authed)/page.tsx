import { Suspense } from 'react'
import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar, SkeletonBlock } from '@tn-figueiredo/cms-ui/client'
import { DashboardKpis } from './_components/dashboard-kpis'
import { ComingUp } from './_components/coming-up'
import { ContinueEditing } from './_components/continue-editing'

export default async function CmsDashboardPage() {
  const { siteId } = await getSiteContext()

  return (
    <div>
      <CmsTopbar title="Dashboard" />
      <div className="p-6 lg:p-8 space-y-6">
        <ContinueEditing siteId={siteId} />

        <Suspense
          fallback={
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <SkeletonBlock key={i} className="h-[88px]" />
              ))}
            </div>
          }
        >
          <DashboardKpis />
        </Suspense>

        <div className="grid lg:grid-cols-[3fr_2fr] gap-6">
          <div className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] p-5">
            <h3 className="text-sm font-semibold text-cms-text mb-4">Content Performance</h3>
            <div className="h-44 flex items-center justify-center text-cms-text-dim text-sm">
              Chart — implemented in Phase 3 (Analytics)
            </div>
          </div>

          <div className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] p-5">
            <h3 className="text-sm font-semibold text-cms-text mb-4">Coming Up</h3>
            <Suspense
              fallback={
                <div className="space-y-2">
                  {Array.from({ length: 3 }, (_, i) => (
                    <SkeletonBlock key={i} className="h-14" />
                  ))}
                </div>
              }
            >
              <ComingUp />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
