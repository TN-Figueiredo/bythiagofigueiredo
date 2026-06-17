import type { WaitlistDetailData } from '../queries'

/**
 * Signups tab. Task 17 ships the status summary; the full searchable, server-side
 * keyset-paginated list is added in Task 18 (which modifies this component).
 */
export function SignupsTab({ detail }: { detail: WaitlistDetailData }) {
  const total = detail.pending + detail.suppressed
  return (
    <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-cms-text">
        <span>
          <span className="font-semibold">{total}</span> total
        </span>
        <span>
          <span className="font-semibold">{detail.pending}</span> pending
        </span>
        <span>
          <span className="font-semibold">{detail.suppressed}</span> suppressed
        </span>
      </div>
      <p className="mt-3 text-xs text-cms-text-muted">
        The full searchable, paginated signups list ships in the next step.
      </p>
    </div>
  )
}
