import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getSiteContext } from '@/lib/cms/site-context'
import { loadWaitlistDetail, listSignups, parseSignupsCursor, WAITLIST_SOURCE_LABELS } from '../queries'
import { exportWaitlistSignups } from '../actions'
import { WlBadge } from '../_components/wl-badge'
import { LaunchCta } from '../_components/launch-cta'
import { SignupsTab } from '../_components/signups-tab'
import { WaitlistExportButton } from '../_components/export-button'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; status?: string; q?: string; c?: string }>
}

export default async function WaitlistDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { tab, status: statusParam, q, c } = await searchParams
  const { siteId } = await getSiteContext()

  const detail = await loadWaitlistDetail(siteId, id)
  if (!detail) notFound()

  const activeTab = tab === 'signups' ? 'signups' : 'overview'

  // Signups tab data (only fetched when that tab is active).
  const statusFilter = statusParam === 'pending' || statusParam === 'suppressed' ? statusParam : undefined
  const cursor = parseSignupsCursor(c) // validates ISO|UUID — a tampered ?c degrades to page 1
  const signupsPage =
    activeTab === 'signups'
      ? await listSignups(siteId, detail.id, { status: statusFilter, q: q || undefined, cursor })
      : null
  const totalBySource = detail.sourceCounts.landing + detail.sourceCounts.embed + detail.sourceCounts.tiptap

  const TabLink = ({ id: tabId, label }: { id: 'overview' | 'signups'; label: string }) => (
    <Link
      href={`/cms/waitlists/${detail.id}${tabId === 'signups' ? '?tab=signups' : ''}`}
      aria-current={activeTab === tabId ? 'page' : undefined}
      className={`border-b-2 px-1 pb-2 text-sm ${
        activeTab === tabId
          ? 'border-cms-accent font-medium text-cms-text'
          : 'border-transparent text-cms-text-muted hover:text-cms-text'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <Link href="/cms/waitlists" className="inline-flex items-center gap-1 text-sm text-cms-text-muted hover:text-cms-text">
        <ChevronLeft size={15} aria-hidden="true" /> Waitlists
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-cms-text">{detail.name}</h1>
            <WlBadge status={detail.status} lg />
          </div>
          <a
            href={`/waitlists/${detail.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`/waitlists/${detail.slug} (opens in a new tab)`}
            className="mt-1 inline-block font-mono text-xs text-cms-text-muted hover:text-cms-text hover:underline"
          >
            /waitlists/{detail.slug} ↗
          </a>
        </div>
        <div className="flex items-center gap-2">
          <WaitlistExportButton slug={detail.slug} waitlistId={detail.id} exportAction={exportWaitlistSignups} />
          {/* Edit happens via the list drawer (M2). The dedicated detail-hosted edit + the
              row→detail navigation are a small follow-up; link there for now. */}
          <Link
            href="/cms/waitlists"
            className="rounded-[var(--cms-radius)] border border-cms-border px-4 py-2 text-sm text-cms-text hover:bg-cms-surface"
          >
            Edit
          </Link>
        </div>
      </div>

      <nav className="flex gap-4 border-b border-cms-border">
        <TabLink id="overview" label="Overview" />
        <TabLink id="signups" label="Signups" />
      </nav>

      {activeTab === 'overview' ? (
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-4">
            <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
              <h3 className="text-sm font-semibold text-cms-text">Signups by source</h3>
              <div className="mt-3 flex flex-col gap-2">
                {(['landing', 'embed', 'tiptap'] as const).map((src) => {
                  const n = detail.sourceCounts[src]
                  const pct = totalBySource > 0 ? Math.round((n / totalBySource) * 100) : 0
                  return (
                    <div key={src} className="flex items-center gap-3 text-sm">
                      <span className="w-24 shrink-0 text-cms-text-muted">{WAITLIST_SOURCE_LABELS[src]}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-cms-border">
                        <div className="h-full bg-cms-accent" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-10 shrink-0 text-right tabular-nums text-cms-text">{n}</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 flex gap-4 border-t border-cms-border pt-3 text-xs">
                <span className="text-[#22c55e]">{detail.pending} pending</span>
                <span className="text-cms-text-muted">{detail.suppressed} suppressed</span>
              </div>
            </div>

            <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
              <h3 className="text-sm font-semibold text-cms-text">Details</h3>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-cms-text-muted">Sender</dt>
                <dd className="text-cms-text">{detail.senderName || '—'}{detail.senderEmail ? ` · ${detail.senderEmail}` : ''}</dd>
                <dt className="text-cms-text-muted">Reply-to</dt>
                <dd className="text-cms-text">{detail.replyTo || '—'}</dd>
                <dt className="text-cms-text-muted">Linked campaign</dt>
                <dd className="text-cms-text">{detail.campaignId ? 'Linked' : '—'}</dd>
              </dl>
            </div>
          </div>

          <LaunchCta status={detail.status} pending={detail.pending} />
        </div>
      ) : (
        signupsPage && <SignupsTab detail={detail} page={signupsPage} filters={{ status: statusFilter, q: q || undefined }} />
      )}
    </div>
  )
}
