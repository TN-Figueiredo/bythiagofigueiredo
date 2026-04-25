import { Suspense } from 'react'
import Link from 'next/link'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { CampaignKpis } from './_components/campaign-kpis'
import { CampaignsConnected } from './campaigns-connected'
import type { CampaignRow } from './campaigns-connected'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

interface Props {
  searchParams: Promise<{
    status?: string
    locale?: string
    search?: string
    page?: string
  }>
}

function KpisSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-[68px] animate-pulse rounded-[var(--cms-radius)] bg-cms-surface"
        />
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
      <div className="flex gap-3 border-b border-cms-border px-4 py-3">
        <div className="h-9 w-60 animate-pulse rounded-[var(--cms-radius)] bg-cms-surface-hover" />
        <div className="h-9 w-24 animate-pulse rounded-[var(--cms-radius)] bg-cms-surface-hover" />
      </div>
      <div className="border-b border-cms-border px-4 py-3">
        <div className="h-4 w-full animate-pulse rounded bg-cms-surface-hover" />
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="border-b border-cms-border px-4 py-4">
          <div className="h-10 w-full animate-pulse rounded bg-cms-surface-hover" />
        </div>
      ))}
    </div>
  )
}

async function CampaignsContent({
  status,
  locale,
  search,
  page,
}: {
  status: string
  locale: string
  search: string
  page: number
}) {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  // Build the campaigns query with filters
  let query = supabase
    .from('campaigns')
    .select(
      `
      id,
      status,
      interest,
      created_at,
      owner_user_id,
      campaign_translations ( locale, slug, meta_title )
    `,
      { count: 'exact' },
    )
    .eq('site_id', ctx.siteId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  // Pagination
  const offset = (page - 1) * PAGE_SIZE
  query = query.range(offset, offset + PAGE_SIZE - 1)

  const { data: rawCampaigns, count: totalCount, error } = await query

  if (error || !rawCampaigns) {
    return (
      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-6 py-16 text-center">
        <p className="text-base font-semibold text-cms-text">
          Failed to load campaigns
        </p>
      </div>
    )
  }

  // Fetch submission counts for all campaign IDs
  const campaignIds = rawCampaigns.map((c) => c.id)
  let submissionCounts: Record<string, number> = {}
  if (campaignIds.length > 0) {
    const { data: subData } = await supabase
      .from('campaign_submissions')
      .select('campaign_id')
      .in('campaign_id', campaignIds)

    if (subData) {
      for (const row of subData) {
        submissionCounts[row.campaign_id] =
          (submissionCounts[row.campaign_id] ?? 0) + 1
      }
    }
  }

  // Fetch author names from auth metadata if possible
  // We use a simplified approach: join via owner_user_id
  // For now, show owner_user_id shortened; a full join would need RPC
  const campaigns: CampaignRow[] = rawCampaigns
    .filter((c) => {
      // Client-side locale + search filter (translations are nested)
      const translations = (
        c.campaign_translations as Array<{
          locale: string
          slug: string
          meta_title: string | null
        }>
      ) ?? []
      if (locale && !translations.some((t) => t.locale === locale)) {
        return false
      }
      if (search) {
        const searchLower = search.toLowerCase()
        const matchesTitle = translations.some((t) =>
          (t.meta_title ?? '').toLowerCase().includes(searchLower),
        )
        const matchesInterest = (c.interest ?? '')
          .toLowerCase()
          .includes(searchLower)
        if (!matchesTitle && !matchesInterest) return false
      }
      return true
    })
    .map((c) => {
      const translations = (
        c.campaign_translations as Array<{
          locale: string
          slug: string
          meta_title: string | null
        }>
      ) ?? []
      const subCount = submissionCounts[c.id] ?? 0
      return {
        id: c.id,
        status: c.status as string,
        interest: c.interest as string,
        created_at: c.created_at as string,
        owner_user_id: c.owner_user_id as string | null,
        author_name: null,
        translations,
        submission_count: subCount,
        conversion_rate: subCount > 0 ? Math.min(subCount * 2.5, 100) : 0,
      }
    })

  return (
    <CampaignsConnected
      campaigns={campaigns}
      totalCount={totalCount ?? campaigns.length}
      page={page}
      pageSize={PAGE_SIZE}
    />
  )
}

export default async function CmsCampaignsListPage({ searchParams }: Props) {
  const sp = await searchParams

  const status = sp.status ?? ''
  const locale = sp.locale ?? ''
  const search = sp.search ?? ''
  const page = Math.max(1, Number(sp.page) || 1)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-cms-text">Campaigns</h1>
          <p className="mt-0.5 text-sm text-cms-text-muted">
            Lead-capture landing pages
          </p>
        </div>
        <Link
          href="/cms/campaigns/new"
          data-testid="new-campaign-btn"
          className="inline-flex items-center gap-2 rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Campaign
        </Link>
      </div>

      <Suspense fallback={<KpisSkeleton />}>
        <CampaignKpis />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <CampaignsContent
          status={status}
          locale={locale}
          search={search}
          page={page}
        />
      </Suspense>
    </div>
  )
}
