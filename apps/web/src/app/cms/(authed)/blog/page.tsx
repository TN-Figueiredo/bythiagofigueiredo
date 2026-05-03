import { Suspense } from 'react'
import { getSiteContext } from '@/lib/cms/site-context'
import type { BlogTabId } from './_hub/hub-types'
import { fetchBlogSharedData, fetchOverviewData, fetchEditorialData, fetchScheduleData } from './_hub/hub-queries'
import { HubClient } from './_hub/hub-client'
import { TabSkeleton } from './_hub/tab-skeleton'
import { en } from './_i18n/en'
import { ptBR } from './_i18n/pt-BR'
import type { BlogHubStrings } from './_i18n/types'

import { OverviewTab } from './_tabs/overview/overview-tab'
import { EditorialTab } from './_tabs/editorial/editorial-tab'
import { ScheduleTab } from './_tabs/schedule/schedule-tab'
import { AnalyticsTab } from './_tabs/analytics/analytics-tab'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

async function TabContent({
  tab, siteId, tagId, locale, strings, uiLocale,
}: {
  tab: BlogTabId
  siteId: string
  tagId: string | null
  locale: string | null
  strings: BlogHubStrings
  uiLocale: 'en' | 'pt-BR'
}) {
  switch (tab) {
    case 'overview': {
      const data = await fetchOverviewData(siteId, tagId, locale)
      return <OverviewTab data={data} strings={strings} />
    }
    case 'editorial': {
      const data = await fetchEditorialData(siteId, tagId, locale)
      return <EditorialTab data={data} strings={strings} siteId={siteId} tagId={tagId} locale={locale} />
    }
    case 'schedule': {
      const data = await fetchScheduleData(siteId, tagId, locale)
      return <ScheduleTab data={data} strings={strings} locale={uiLocale} />
    }
    case 'analytics':
      return <AnalyticsTab strings={strings} />
    default:
      return null
  }
}

export default async function BlogHubPage({ searchParams }: Props) {
  const params = await searchParams
  const ctx = await getSiteContext()
  const { siteId } = ctx

  const uiLocale: 'en' | 'pt-BR' = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const tab = (params.tab as BlogTabId) || 'overview'
  const tagId = params.tag ?? null
  const filterLocale = params.locale ?? null

  const [sharedData, strings] = await Promise.all([
    fetchBlogSharedData(siteId),
    Promise.resolve<BlogHubStrings>(uiLocale === 'pt-BR' ? ptBR : en),
  ])

  return (
    <HubClient
      sharedData={sharedData}
      defaultTab={tab}
      tabLabels={strings.tabs}
      allTagsLabel={strings.common.allTags}
      allLocalesLabel={strings.common.allLocales}
      editLabel={strings.common.edit}
      locale={uiLocale}
      drawerStrings={strings.tagDrawer}
      commonStrings={strings.common}
      actionStrings={strings.actions}
    >
      <Suspense fallback={<TabSkeleton tab={tab} />}>
        <TabContent
          tab={tab}
          siteId={siteId}
          tagId={tagId}
          locale={filterLocale}
          strings={strings}
          uiLocale={uiLocale}
        />
      </Suspense>
    </HubClient>
  )
}
