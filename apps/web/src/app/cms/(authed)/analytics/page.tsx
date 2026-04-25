import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { AnalyticsTabsConnected } from './analytics-tabs-connected'
import { fetchOverview } from './actions'
import type { PeriodInput } from './types'

interface Props {
  searchParams: Promise<{
    tab?: string
    period?: string
    compare?: string
    start?: string
    end?: string
  }>
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const params = await searchParams
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const editRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const canExport = editRes.ok

  const periodValue = params.period ?? '30d'
  const compare = params.compare === 'true'

  let periodInput: PeriodInput
  if (
    periodValue === 'custom' &&
    params.start &&
    params.end
  ) {
    periodInput = { type: 'custom', start: params.start, end: params.end }
  } else {
    const preset = periodValue === '7d' || periodValue === '90d' ? periodValue : '30d'
    periodInput = { type: 'preset', value: preset }
  }

  const overviewResult = await fetchOverview(periodInput, compare)
  const initialOverview = overviewResult.ok ? overviewResult.data : null

  return (
    <AnalyticsTabsConnected
      initialTab={(params.tab as 'overview' | 'newsletters' | 'campaigns' | 'content') ?? 'overview'}
      initialPeriod={periodValue}
      initialCompare={compare}
      initialCustomStart={params.start}
      initialCustomEnd={params.end}
      initialOverview={initialOverview}
      canExport={canExport}
    />
  )
}
