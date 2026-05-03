import { Suspense } from 'react'
import { getSiteContext } from '@/lib/cms/site-context'
import { HubClient } from './_hub/hub-client'
import { TabSkeleton } from './_hub/tab-skeleton'
import {
  fetchSharedData,
  fetchOverviewData,
  fetchEditorialData,
  fetchScheduleData,
  fetchAutomationsData,
  fetchAudienceData,
} from './_hub/hub-queries'
import { NewsletterToastProvider } from './_components/toast-provider'
import { ptBR } from './_i18n/pt-BR'
import { en } from './_i18n/en'
import type { TabId, NewsletterType } from './_hub/hub-types'
import { OverviewTab } from './_tabs/overview/overview-tab'
import { EditorialTab } from './_tabs/editorial/editorial-tab'
import { ScheduleTab } from './_tabs/schedule/schedule-tab'
import { AutomationsTab } from './_tabs/automations/automations-tab'
import { AudienceTab } from './_tabs/audience/audience-tab'

export const dynamic = 'force-dynamic'

export default async function NewsletterHubPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string }>
}) {
  const params = await searchParams
  const tab = (params.tab as TabId) || 'overview'
  const typeFilter = params.type ?? null
  const ctx = await getSiteContext()
  const locale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const strings = locale === 'pt-BR' ? ptBR : en

  const sharedData = await fetchSharedData(ctx.siteId, locale)

  return (
    <>
      <NewsletterToastProvider />
      <HubClient
        sharedData={sharedData}
        defaultTab={tab}
        tabLabels={strings.tabs}
        allTypesLabel={strings.common.allTypes}
        editLabel={strings.common.edit}
        locale={locale as 'en' | 'pt-BR'}
        drawerStrings={strings.typeDrawer}
        commonStrings={strings.common}
        actionStrings={strings.actions}
      >
        <Suspense key={`${tab}-${typeFilter}`} fallback={<TabSkeleton tab={tab} />}>
          <TabContent tab={tab} siteId={ctx.siteId} typeFilter={typeFilter} locale={locale} types={sharedData.types} />
        </Suspense>
      </HubClient>
    </>
  )
}

async function TabContent({ tab, siteId, typeFilter, locale, types }: { tab: TabId; siteId: string; typeFilter: string | null; locale: 'pt-BR' | 'en'; types: NewsletterType[] }) {
  const strings = locale === 'pt-BR' ? ptBR : en
  switch (tab) {
    case 'overview': {
      const data = await fetchOverviewData(siteId)
      return <OverviewTab data={data} typeFilter={typeFilter} strings={strings} />
    }
    case 'editorial': {
      const data = await fetchEditorialData(siteId)
      return <EditorialTab data={data} typeFilter={typeFilter} strings={strings} types={types} />
    }
    case 'schedule': {
      const data = await fetchScheduleData(siteId)
      return <ScheduleTab data={data} typeFilter={typeFilter} strings={strings} locale={locale as 'en' | 'pt-BR'} />
    }
    case 'automations': {
      const data = await fetchAutomationsData(siteId)
      return <AutomationsTab data={data} strings={strings} />
    }
    case 'audience': {
      const data = await fetchAudienceData(siteId)
      return <AudienceTab data={data} typeFilter={typeFilter} strings={strings} />
    }
    default:
      return null
  }
}
