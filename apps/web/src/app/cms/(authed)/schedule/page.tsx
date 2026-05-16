import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { fetchScheduleData } from '@/lib/schedule/schedule-queries'
import { ScheduleCalendar } from './_components/schedule-calendar'

/* ------------------------------------------------------------------ */
/*  Data loader                                                       */
/* ------------------------------------------------------------------ */

async function ScheduleData({
  month,
}: {
  month: string
}) {
  const { siteId, timezone } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()
  const data = await fetchScheduleData(supabase, siteId, month, timezone)

  return <ScheduleCalendar data={data} />
}

/* ------------------------------------------------------------------ */
/*  Skeleton fallback                                                 */
/* ------------------------------------------------------------------ */

function ScheduleSkeleton() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0f172a] p-4 md:p-6">
      {/* Nav skeleton */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex gap-1">
          <div className="h-8 w-8 animate-pulse rounded bg-slate-700" />
          <div className="h-8 w-16 animate-pulse rounded bg-slate-700" />
          <div className="h-8 w-8 animate-pulse rounded bg-slate-700" />
        </div>
        <div className="h-5 w-32 animate-pulse rounded bg-slate-700" />
      </div>
      {/* Metrics skeleton */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg bg-slate-800"
          />
        ))}
      </div>
      {/* Calendar grid skeleton */}
      <div className="mt-4">
        <div className="mb-1 grid grid-cols-7 gap-px">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-5 animate-pulse rounded bg-slate-800"
            />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px rounded-lg border border-slate-700/50 bg-slate-700/50">
          {Array.from({ length: 42 }).map((_, i) => (
            <div
              key={i}
              className="h-[90px] animate-pulse bg-slate-800/50"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const month = params.month ?? defaultMonth

  return (
    <div>
      <CmsTopbar title="Schedule" />
      <Suspense fallback={<ScheduleSkeleton />}>
        <ScheduleData month={month} />
      </Suspense>
    </div>
  )
}
