import { createClient } from '@supabase/supabase-js'
import {
  AdEngineAdminProvider,
  type AdAdminConfig,
  type AdAdminActions,
  EMPTY_AD_KPIS,
  fetchAdKpis,
  fetchAdConfigs,
  fetchAdPlaceholders,
  fetchAdChartData,
  fetchRecentAdEvents,
  fetchSlotConversion,
} from '@tn-figueiredo/ad-engine-admin'
import {
  AdDashboardServer,
  CampaignWizardServer,
  PlaceholderManagerServer,
} from '@tn-figueiredo/ad-engine-admin/server'
import { SITE_AD_SLOTS } from '@app/shared'
import type { AdSlotDefinition } from '@tn-figueiredo/ad-engine'
import {
  createCampaign,
  updateCampaign,
  deleteCampaign,
  updatePlaceholder,
} from './_actions/campaigns'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

interface PageProps {
  searchParams: Promise<{ tab?: string; page?: string }>
}

export default async function AdsAdminPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tab = params.tab ?? 'dashboard'
  const page = Math.max(1, Number(params.page) || 1)
  const supabase = getSupabaseAdmin()
  const APP_ID = 'bythiagofigueiredo'

  const [kpisResult, chartResult, eventsResult, conversionResult, configsResult, placeholdersResult] =
    await Promise.allSettled([
      tab === 'dashboard'    ? fetchAdKpis(supabase, APP_ID) : Promise.resolve(null),
      tab === 'dashboard'    ? fetchAdChartData(supabase, APP_ID) : Promise.resolve(null),
      tab === 'dashboard'    ? fetchRecentAdEvents(supabase, APP_ID) : Promise.resolve(null),
      tab === 'dashboard'    ? fetchSlotConversion(supabase, APP_ID) : Promise.resolve(null),
      tab === 'campaigns'    ? fetchAdConfigs(supabase, APP_ID, { page, pageSize: 20 }) : Promise.resolve(null),
      tab === 'placeholders' ? fetchAdPlaceholders(supabase, APP_ID) : Promise.resolve(null),
    ])

  const kpis         = kpisResult.status === 'fulfilled' ? (kpisResult.value ?? EMPTY_AD_KPIS) : EMPTY_AD_KPIS
  const chartData    = chartResult.status === 'fulfilled' ? (chartResult.value ?? []) : []
  const recentEvents = eventsResult.status === 'fulfilled' ? (eventsResult.value ?? []) : []
  const slotConversion = conversionResult.status === 'fulfilled' ? (conversionResult.value ?? []) : []
  const configs      = configsResult.status === 'fulfilled' ? configsResult.value : null
  const placeholders = placeholdersResult.status === 'fulfilled' ? (placeholdersResult.value ?? []) : []

  const adminConfig: AdAdminConfig = {
    appId: APP_ID,
    slots: SITE_AD_SLOTS as unknown as AdSlotDefinition[], // readonly → mutable cast: safe
    basePath: '/admin/ads',
    locale: 'pt-BR',
    currency: 'BRL',
  }

  const actions: AdAdminActions = {
    createCampaign,
    updateCampaign,
    deleteCampaign,
    updatePlaceholder,
    uploadMedia: async (_file: File) => { throw new Error('Not implemented') },
    deleteMedia: async (_id: string) => { throw new Error('Not implemented') },
  }

  return (
    <AdEngineAdminProvider config={adminConfig} actions={actions}>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Anúncios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerenciamento de campanhas e métricas do ad engine
          </p>
        </div>

        {(tab === 'dashboard' || !tab) && (
          <AdDashboardServer
            kpis={kpis}
            recentEvents={recentEvents}
            chartData={chartData}
            slotConversion={slotConversion}
          />
        )}

        {tab === 'campaigns' && (
          <CampaignWizardServer
            campaigns={configs?.configs ?? []}
            config={adminConfig}
          />
        )}

        {tab === 'placeholders' && (
          <PlaceholderManagerServer
            placeholders={placeholders}
            config={adminConfig}
          />
        )}
      </div>
    </AdEngineAdminProvider>
  )
}
