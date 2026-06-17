import { AlertTriangle } from 'lucide-react'
import { getSiteContext } from '@/lib/cms/site-context'
import { listWaitlistsForSite } from './queries'
import { createWaitlist, updateWaitlist, transitionWaitlistStatus } from './actions'
import { WaitlistsConnected } from './_components/waitlists-connected'

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
  const { siteId, defaultLocale } = await getSiteContext()

  // WL-R4 / WL-03: `listWaitlistsForSite` rethrows on a DB/RPC failure (it already
  // logs + reports to Sentry). Without this guard the raw error escapes to the
  // Next.js error boundary, which renders the generic dark crash screen. The
  // canonical fix is a sibling `error.tsx` segment boundary (cross-file follow-up,
  // not my file to create); until it lands, catch here and render a graceful,
  // cms-token error state so the chrome stays intact and the operator can retry.
  let result: Awaited<ReturnType<typeof listWaitlistsForSite>> | null = null
  try {
    result = await listWaitlistsForSite(siteId)
  } catch {
    // Detail is intentionally not surfaced (already logged/Sentry-captured in the
    // query); avoid leaking DB internals into the chrome.
    result = null
  }

  if (result === null) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-lg font-semibold text-cms-text">Waitlists</h1>
          <p className="mt-0.5 text-sm text-cms-text-muted">Launch-notification signup lists</p>
        </div>
        <div
          role="alert"
          className="flex flex-col items-center justify-center rounded-[var(--cms-radius)] border border-dashed border-cms-border bg-cms-surface px-6 py-10 text-center"
        >
          <AlertTriangle size={28} className="mb-3 text-cms-text-muted" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-cms-text">Couldn&apos;t load waitlists</h3>
          <p className="mt-1 text-xs text-cms-text-muted">
            Something went wrong fetching this list. Refresh the page to try again.
          </p>
        </div>
      </div>
    )
  }

  const { rows, kpis } = result

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-cms-text">Waitlists</h1>
        <p className="mt-0.5 text-sm text-cms-text-muted">Launch-notification signup lists</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Waitlists" value={kpis.total} sub={kpis.open ? `${kpis.open} open` : undefined} />
        <Kpi label="Total signups" value={kpis.totalSignups} sub={kpis.suppressed ? `−${kpis.suppressed}` : undefined} />
        <Kpi label="Linked campaigns" value={kpis.linkedCampaigns} />
        <Kpi label="Needs attention" value={kpis.needsAttention} />
      </div>

      <WaitlistsConnected
        rows={rows}
        defaultLocale={defaultLocale}
        createAction={createWaitlist}
        updateAction={updateWaitlist}
        transitionAction={transitionWaitlistStatus}
      />
    </div>
  )
}
