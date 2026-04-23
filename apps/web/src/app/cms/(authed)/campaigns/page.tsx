import { Suspense } from 'react'
import Link from 'next/link'
import type { ContentStatus } from '@tn-figueiredo/cms'
import { campaignRepo } from '@/lib/cms/repositories'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { deleteCampaign } from './[id]/edit/actions'
import { CampaignKpis } from './_components/campaign-kpis'
import { CampaignTable, type CampaignRow } from './_components/campaign-table'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ status?: string; locale?: string; search?: string }>
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-6 py-16 text-center">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="mb-4 text-cms-text-dim"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="text-base font-semibold text-cms-text">No campaigns yet</p>
      <p className="mt-1 text-sm text-cms-text-muted">
        Create your first lead-capture campaign.
      </p>
      <Link
        href="/cms/campaigns/new"
        className="mt-6 inline-flex items-center gap-2 rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Create first campaign
      </Link>
    </div>
  )
}

function FilterBar({
  status,
  locale,
  search,
}: {
  status: string
  locale: string
  search: string
}) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-center gap-3"
      data-testid="campaign-filters"
    >
      <input
        type="search"
        name="search"
        placeholder="Search campaigns…"
        defaultValue={search}
        aria-label="title search"
        className="h-9 w-64 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 text-sm text-cms-text placeholder-cms-text-dim outline-none focus:border-cms-accent"
      />
      <select
        name="status"
        defaultValue={status}
        aria-label="status filter"
        className="h-9 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 text-sm text-cms-text outline-none focus:border-cms-accent"
      >
        <option value="">All statuses</option>
        <option value="draft">Draft</option>
        <option value="scheduled">Scheduled</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
      </select>
      <select
        name="locale"
        defaultValue={locale}
        aria-label="locale filter"
        className="h-9 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 text-sm text-cms-text outline-none focus:border-cms-accent"
      >
        <option value="">All locales</option>
        <option value="pt-BR">pt-BR</option>
        <option value="en">en</option>
      </select>
      <button
        type="submit"
        className="h-9 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 text-sm text-cms-text-muted hover:bg-cms-surface-hover"
      >
        Filter
      </button>
    </form>
  )
}

async function CampaignsContent({
  status,
  locale,
  search,
  siteId,
  defaultLocale,
}: {
  status: string
  locale: string
  search: string
  siteId: string
  defaultLocale: string
}) {
  const supabase = getSupabaseServiceClient()

  const campaigns = await campaignRepo().list({
    siteId,
    locale: locale || defaultLocale,
    status: (status as ContentStatus) || undefined,
    search: search || undefined,
    perPage: 200,
  })

  if (campaigns.length === 0) {
    return <EmptyState />
  }

  const campaignIds = campaigns.map((c) => c.id)

  const { data: submissionCounts } = await supabase
    .from('campaign_submissions')
    .select('campaign_id')
    .in('campaign_id', campaignIds)

  const countMap: Record<string, number> = {}
  for (const row of submissionCounts ?? []) {
    const cid = row.campaign_id as string
    countMap[cid] = (countMap[cid] ?? 0) + 1
  }

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const { data: recentSubs } = await supabase
    .from('campaign_submissions')
    .select('campaign_id, submitted_at')
    .in('campaign_id', campaignIds)
    .gte('submitted_at', fourteenDaysAgo)

  const today = new Date()
  const sparklineMap: Record<string, number[]> = {}
  const deltaMap: Record<string, number> = {}

  for (const id of campaignIds) {
    const days14 = Array(14).fill(0) as number[]
    for (const row of recentSubs ?? []) {
      if (row.campaign_id !== id) continue
      const submittedDate = new Date(row.submitted_at as string)
      const daysAgo = Math.floor(
        (today.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysAgo >= 0 && daysAgo < 14) {
        days14[13 - daysAgo] = (days14[13 - daysAgo] ?? 0) + 1
      }
    }
    const recent7 = days14.slice(7)
    const prior7 = days14.slice(0, 7)
    const recent7Total = recent7.reduce((a, b) => a + b, 0)
    const prior7Total = prior7.reduce((a, b) => a + b, 0)
    sparklineMap[id] = recent7
    deltaMap[id] = recent7Total - prior7Total
  }

  const { data: pdfData } = await supabase
    .from('campaigns')
    .select('id, pdf_storage_path')
    .in('id', campaignIds)

  const pdfMap: Record<string, boolean> = {}
  for (const row of pdfData ?? []) {
    pdfMap[row.id as string] = !!(row.pdf_storage_path as string | null)
  }

  const rows: CampaignRow[] = campaigns.map((c) => ({
    ...c,
    has_pdf: pdfMap[c.id] ?? false,
    submission_count: countMap[c.id] ?? 0,
    sparkline_data: sparklineMap[c.id] ?? [],
    submissions_delta: deltaMap[c.id] ?? 0,
  }))

  async function handleDelete(id: string): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const result = await deleteCampaign(id)
    if (result.ok) return { ok: true }
    return {
      ok: false,
      error: (result as { message?: string }).message ?? (result as { error?: string }).error,
    }
  }

  return <CampaignTable campaigns={rows} onDelete={handleDelete} />
}

export default async function CmsCampaignsListPage({ searchParams }: Props) {
  const sp = await searchParams
  const ctx = await getSiteContext()

  const status = sp.status ?? ''
  const locale = sp.locale ?? ''
  const search = sp.search ?? ''

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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Campaign
        </Link>
      </div>

      <Suspense fallback={<KpisSkeleton />}>
        <CampaignKpis />
      </Suspense>

      <FilterBar status={status} locale={locale} search={search} />

      <Suspense fallback={<TableSkeleton />}>
        <CampaignsContent
          status={status}
          locale={locale}
          search={search}
          siteId={ctx.siteId}
          defaultLocale={ctx.defaultLocale}
        />
      </Suspense>
    </div>
  )
}
