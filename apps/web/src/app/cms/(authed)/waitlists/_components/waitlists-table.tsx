import { WlBadge } from './wl-badge'
import { relTimeShort } from '@/lib/cms/relative-time'
import type { WaitlistListRow } from '../queries'

export function WaitlistsTable({
  rows,
  onRowClick,
}: {
  rows: WaitlistListRow[]
  /** When provided, the Name cell becomes a focusable button (Enter/Space) that opens the row. */
  onRowClick?: (row: WaitlistListRow) => void
}) {
  return (
    <div className="overflow-hidden rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cms-border text-left text-xs uppercase tracking-wide text-cms-text-muted">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Signups</th>
            <th className="px-4 py-3 font-medium">Linked campaign</th>
            <th className="px-4 py-3 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-cms-border last:border-0">
              <td className="px-4 py-3">
                {onRowClick ? (
                  <button type="button" onClick={() => onRowClick(r)} className="block text-left">
                    <div className="font-medium text-cms-text hover:underline">{r.name}</div>
                    <div className="font-mono text-xs text-cms-text-muted">/waitlists/{r.slug}</div>
                  </button>
                ) : (
                  <>
                    <div className="font-medium text-cms-text">{r.name}</div>
                    <div className="font-mono text-xs text-cms-text-muted">/waitlists/{r.slug}</div>
                  </>
                )}
              </td>
              <td className="px-4 py-3">
                <WlBadge status={r.status} />
              </td>
              <td className="px-4 py-3 text-cms-text">
                {r.signups}
                {r.suppressed > 0 && (
                  <span className="ml-1 text-xs text-cms-text-muted">−{r.suppressed}</span>
                )}
              </td>
              <td className="px-4 py-3 text-cms-text-muted">
                {r.campaignTitle ?? <span className="text-cms-text-muted/60">—</span>}
              </td>
              <td className="px-4 py-3 text-cms-text-muted">{relTimeShort(r.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
