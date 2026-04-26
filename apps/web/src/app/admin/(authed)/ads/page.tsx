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
  fetchAdMedia,
  fetchAdPerformance,
  fetchAdInquiries,
} from '@tn-figueiredo/ad-engine-admin'
import {
  AdDashboardServer,
  CampaignWizardServer,
  MediaLibraryServer,
} from '@tn-figueiredo/ad-engine-admin/server'
import { InquiriesList, PlaceholderManager } from '@tn-figueiredo/ad-engine-admin/client'
import { SITE_AD_SLOTS } from '@app/shared'
import type { AdSlotDefinition } from '@tn-figueiredo/ad-engine'
import Link from 'next/link'
import {
  createCampaign,
  updateCampaign,
  deleteCampaign,
  updateCampaignStatus,
  fetchCampaignById,
  updatePlaceholder,
  uploadMedia,
  deleteMedia,
} from './_actions/campaigns'
import { updateInquiryStatus, updateInquiryNotes } from './_actions/inquiries'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'campaigns', label: 'Campanhas' },
  { key: 'inquiries', label: 'Interessados' },
  { key: 'placeholders', label: 'Placeholders' },
  { key: 'media', label: 'Biblioteca' },
] as const

interface PageProps {
  searchParams: Promise<{ tab?: string; page?: string }>
}

export default async function AdsAdminPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tab = params.tab ?? 'dashboard'
  const page = Math.max(1, Number(params.page) || 1)
  const supabase = getSupabaseAdmin()
  const APP_ID = 'bythiagofigueiredo'

  const [kpisResult, chartResult, eventsResult, conversionResult, perfResult, configsResult, placeholdersResult, mediaResult, inquiriesResult] =
    await Promise.allSettled([
      tab === 'dashboard'    ? fetchAdKpis(supabase, APP_ID) : Promise.resolve(null),
      tab === 'dashboard'    ? fetchAdChartData(supabase, APP_ID) : Promise.resolve(null),
      tab === 'dashboard'    ? fetchRecentAdEvents(supabase, APP_ID) : Promise.resolve(null),
      tab === 'dashboard'    ? fetchSlotConversion(supabase, APP_ID) : Promise.resolve(null),
      tab === 'dashboard'    ? fetchAdPerformance(supabase, APP_ID) : Promise.resolve(null),
      tab === 'campaigns'    ? fetchAdConfigs(supabase, APP_ID, { page, pageSize: 20 }) : Promise.resolve(null),
      tab === 'placeholders' ? fetchAdPlaceholders(supabase, APP_ID) : Promise.resolve(null),
      tab === 'media'        ? fetchAdMedia(supabase, APP_ID) : Promise.resolve(null),
      tab === 'inquiries'    ? fetchAdInquiries(supabase, APP_ID) : Promise.resolve(null),
    ])

  const kpis           = kpisResult.status === 'fulfilled' ? (kpisResult.value ?? EMPTY_AD_KPIS) : EMPTY_AD_KPIS
  const chartData      = chartResult.status === 'fulfilled' ? (chartResult.value ?? []) : []
  const recentEvents   = eventsResult.status === 'fulfilled' ? (eventsResult.value ?? []) : []
  const slotConversion = conversionResult.status === 'fulfilled' ? (conversionResult.value ?? []) : []
  const adPerformance  = perfResult.status === 'fulfilled' ? (perfResult.value ?? []) : []
  const configs        = configsResult.status === 'fulfilled' ? configsResult.value : null
  const placeholders   = placeholdersResult.status === 'fulfilled' ? (placeholdersResult.value ?? []) : []
  const media          = mediaResult.status === 'fulfilled' ? (mediaResult.value ?? []) : []
  const inquiriesData  = inquiriesResult.status === 'fulfilled' ? inquiriesResult.value : null
  const inquiries = inquiriesData?.inquiries ?? []

  const adminConfig: AdAdminConfig = {
    appId: APP_ID,
    slots: SITE_AD_SLOTS as unknown as AdSlotDefinition[],
    basePath: '/admin/ads',
    locale: 'pt-BR',
    currency: 'BRL',
    supportedLocales: ['pt-BR', 'en'],
  }

  const actions: AdAdminActions = {
    createCampaign,
    updateCampaign,
    deleteCampaign,
    updateCampaignStatus,
    fetchCampaignById,
    updatePlaceholder,
    uploadMedia,
    deleteMedia,
  }

  return (
    <AdEngineAdminProvider config={adminConfig} actions={actions}>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Anuncios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerenciamento de campanhas e metricas do ad engine
          </p>
        </div>

        <nav className="flex gap-1 border-b border-border">
          {TABS.map(({ key, label }) => (
            <Link
              key={key}
              href={key === 'dashboard' ? '/admin/ads' : `/admin/ads?tab=${key}`}
              className={`px-4 py-2 text-sm font-medium no-underline transition-colors ${
                tab === key
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {tab === 'dashboard' && (
          <AdDashboardServer
            kpis={kpis}
            recentEvents={recentEvents}
            chartData={chartData}
            slotConversion={slotConversion}
            adPerformance={adPerformance}
          />
        )}

        {tab === 'campaigns' && (
          <CampaignWizardServer
            campaigns={configs?.configs ?? []}
            updateCampaignStatusAction={updateCampaignStatus}
            fetchCampaignByIdAction={fetchCampaignById}
          />
        )}

        {tab === 'placeholders' && (
          <PlaceholderManager placeholders={placeholders} />
        )}

        {tab === 'inquiries' && (
          <InquiriesList
            inquiries={inquiries}
            updateStatusAction={updateInquiryStatus}
            updateNotesAction={updateInquiryNotes}
          />
        )}

        {tab === 'media' && (
          <MediaLibraryServer media={media} />
        )}
      </div>
    </AdEngineAdminProvider>
  )
}
