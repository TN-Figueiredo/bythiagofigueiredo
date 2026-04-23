'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { CampaignListItem } from '@tn-figueiredo/cms'
import { StatusBadge, Pagination, Sparkline, type StatusVariant } from '@tn-figueiredo/cms-ui/client'

export interface CampaignRow extends CampaignListItem {
  has_pdf: boolean
  submission_count: number
  sparkline_data: number[]
  submissions_delta: number
}

interface CampaignTableProps {
  campaigns: CampaignRow[]
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>
}

function TypeBadge({ hasPdf }: { hasPdf: boolean }) {
  return hasPdf ? (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{
        color: 'var(--cms-accent, #6366f1)',
        background: 'color-mix(in srgb, var(--cms-accent, #6366f1) 12%, transparent)',
        borderColor: 'color-mix(in srgb, var(--cms-accent, #6366f1) 30%, transparent)',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      PDF
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{
        color: 'var(--cms-cyan, #06b6d4)',
        background: 'color-mix(in srgb, var(--cms-cyan, #06b6d4) 12%, transparent)',
        borderColor: 'color-mix(in srgb, var(--cms-cyan, #06b6d4) 30%, transparent)',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      Link
    </span>
  )
}

function LocaleBadge({ locale }: { locale: string }) {
  return (
    <span className="rounded border border-cms-border bg-cms-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-cms-text-muted">
      {locale}
    </span>
  )
}

function SparklineWithDelta({ data, delta }: { data: number[]; delta: number }) {
  if (!data || data.length < 2) return <span className="text-cms-text-dim text-xs">—</span>

  const deltaColor =
    delta > 0
      ? 'var(--cms-green, #22c55e)'
      : delta < 0
        ? 'var(--cms-red, #ef4444)'
        : 'var(--cms-text-dim, #71717a)'
  const deltaLabel = delta > 0 ? `+${delta}` : String(delta)

  return (
    <div className="flex items-center gap-1.5">
      <Sparkline points={data} color="var(--cms-amber, #f59e0b)" width={48} height={18} />
      {delta !== 0 && (
        <span className="text-[11px] font-medium" style={{ color: deltaColor }}>
          {deltaLabel}
        </span>
      )}
    </div>
  )
}

function NoPdfWarning() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]"
      style={{
        color: 'var(--cms-amber, #f59e0b)',
        background: 'color-mix(in srgb, var(--cms-amber, #f59e0b) 8%, transparent)',
        borderColor: 'color-mix(in srgb, var(--cms-amber, #f59e0b) 30%, transparent)',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      No PDF
    </span>
  )
}

const PAGE_SIZE = 20

function DeleteButton({
  campaignId,
  onDelete,
}: {
  campaignId: string
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (!confirm('Delete this campaign? This action is permanent.')) return
    setError(null)
    startTransition(async () => {
      const result = await onDelete(campaignId)
      if (!result.ok) setError(result.error ?? 'Failed to delete')
    })
  }

  return (
    <>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="rounded px-2 py-1 text-xs disabled:opacity-40"
        style={{ color: 'var(--cms-red, #ef4444)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--cms-red, #ef4444) 10%, transparent)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        aria-label="Delete campaign"
      >
        {isPending ? '…' : 'Delete'}
      </button>
      {error && (
        <span role="alert" className="text-[10px]" style={{ color: 'var(--cms-red, #ef4444)' }}>
          {error}
        </span>
      )}
    </>
  )
}

function DesktopRow({
  campaign,
  onDelete,
}: {
  campaign: CampaignRow
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const isArchived = campaign.status === 'archived'
  const isDraft = campaign.status === 'draft'

  return (
    <tr
      className={`border-b border-cms-border transition-colors hover:bg-cms-surface-hover ${isArchived ? 'opacity-50' : ''}`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--cms-radius)]"
            style={{
              background: 'color-mix(in srgb, var(--cms-amber, #f59e0b) 10%, transparent)',
              color: 'var(--cms-amber, #f59e0b)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="min-w-0">
            <Link
              href={`/cms/campaigns/${campaign.id}/edit`}
              className="block truncate text-sm font-medium text-cms-text hover:text-cms-accent"
            >
              {campaign.translation.meta_title ?? campaign.translation.context_tag ?? campaign.translation.slug}
            </Link>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-cms-text-dim">
                {campaign.translation.slug}
              </span>
              {campaign.has_pdf && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--cms-text-dim, #71717a)" strokeWidth="2" aria-label="Has PDF" className="shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              )}
              {isDraft && !campaign.has_pdf && <NoPdfWarning />}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <TypeBadge hasPdf={campaign.has_pdf} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {campaign.available_locales.map((l) => (
            <LocaleBadge key={l} locale={l} />
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge variant={campaign.status as StatusVariant} pill />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-cms-text">
            {campaign.submission_count.toLocaleString()}
          </span>
          <SparklineWithDelta data={campaign.sparkline_data} delta={campaign.submissions_delta} />
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-cms-text-muted">
        {campaign.published_at
          ? new Date(campaign.published_at).toLocaleDateString('en', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/cms/campaigns/${campaign.id}/edit`}
            className="rounded px-2 py-1 text-xs text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text"
          >
            Edit
          </Link>
          {(campaign.status === 'draft' || campaign.status === 'archived') && (
            <DeleteButton campaignId={campaign.id} onDelete={onDelete} />
          )}
        </div>
      </td>
    </tr>
  )
}

function MobileCard({
  campaign,
  onDelete,
}: {
  campaign: CampaignRow
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const isArchived = campaign.status === 'archived'
  const isDraft = campaign.status === 'draft'

  return (
    <div
      className={`rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4 ${isArchived ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={`/cms/campaigns/${campaign.id}/edit`}
            className="block truncate text-sm font-medium text-cms-text hover:text-cms-accent"
          >
            {campaign.translation.meta_title ?? campaign.translation.context_tag ?? campaign.translation.slug}
          </Link>
          <p className="mt-0.5 font-mono text-[10px] text-cms-text-dim">
            {campaign.translation.slug}
          </p>
        </div>
        <StatusBadge variant={campaign.status as StatusVariant} pill />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TypeBadge hasPdf={campaign.has_pdf} />
        {isDraft && !campaign.has_pdf && <NoPdfWarning />}
        {campaign.available_locales.map((l) => (
          <LocaleBadge key={l} locale={l} />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-cms-text">
            {campaign.submission_count.toLocaleString()}
          </span>
          <span className="text-[11px] text-cms-text-muted">subs</span>
          <SparklineWithDelta data={campaign.sparkline_data} delta={campaign.submissions_delta} />
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/cms/campaigns/${campaign.id}/edit`}
            className="rounded px-2 py-1 text-xs text-cms-text-muted hover:bg-cms-surface-hover"
          >
            Edit
          </Link>
          {(campaign.status === 'draft' || campaign.status === 'archived') && (
            <DeleteButton campaignId={campaign.id} onDelete={onDelete} />
          )}
        </div>
      </div>
    </div>
  )
}

export function CampaignTable({ campaigns, onDelete }: CampaignTableProps) {
  const [page, setPage] = useState(1)

  const paginated = campaigns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div
      className="overflow-hidden rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface"
      data-testid="campaign-table"
    >
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cms-border text-left">
              {['Campaign', 'Type', 'Locales', 'Status', 'Submissions', 'Date', 'Actions'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[11px] font-medium uppercase tracking-[1.5px] text-cms-text-muted"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {paginated.map((c) => (
              <DesktopRow key={c.id} campaign={c} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {paginated.map((c) => (
          <MobileCard key={c.id} campaign={c} onDelete={onDelete} />
        ))}
      </div>
      <Pagination
        currentPage={page}
        totalPages={Math.ceil(campaigns.length / PAGE_SIZE)}
        onPageChange={setPage}
        totalItems={campaigns.length}
        pageSize={PAGE_SIZE}
      />
    </div>
  )
}
