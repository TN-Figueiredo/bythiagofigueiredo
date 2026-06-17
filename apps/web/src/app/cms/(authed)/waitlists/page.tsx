import { getSiteContext } from '@/lib/cms/site-context'
import { EmptyState } from '../blog/_shared/empty-state'
import { listWaitlistsForSite } from './queries'
import { WaitlistsTable } from './_components/waitlists-table'
import './waitlists.css'

export const dynamic = 'force-dynamic'

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-cms-text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-cms-text">
        {value}
        {sub && <span className="ml-1 text-sm font-normal text-cms-text-muted">{sub}</span>}
      </div>
    </div>
  )
}

export default async function CmsWaitlistsListPage() {
  const { siteId } = await getSiteContext()
  const { rows, kpis } = await listWaitlistsForSite(siteId)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-cms-text">Waitlists</h1>
          <p className="mt-0.5 text-sm text-cms-text-muted">Launch-notification signup lists</p>
        </div>
        {/* TODO Task 15: the create/edit drawer (connected island, M2) wires this CTA. */}
        <button
          type="button"
          data-testid="new-waitlist-btn"
          className="inline-flex items-center gap-2 rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          New waitlist
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Waitlists" value={kpis.total} sub={kpis.open ? `${kpis.open} open` : undefined} />
        <Kpi label="Total signups" value={kpis.totalSignups} sub={kpis.suppressed ? `−${kpis.suppressed}` : undefined} />
        <Kpi label="Linked campaigns" value={kpis.linkedCampaigns} />
        <Kpi label="Needs attention" value={kpis.needsAttention} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">🎁</span>}
          heading="No waitlists yet"
          description="Create a launch-notification list to start collecting signups."
        />
      ) : (
        <WaitlistsTable rows={rows} />
      )}
    </div>
  )
}
