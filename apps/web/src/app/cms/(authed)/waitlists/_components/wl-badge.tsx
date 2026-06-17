// Six-status badge for the waitlists CMS. Statuses mirror the DB `waitlists.status`
// enum and the design handoff (views-waitlists.jsx WL_STATUS). Styling lives in
// ../waitlists.css (token-backed, literal-rgba backgrounds — see the color-mix note
// there). The status union is exported here as the single source of truth for the
// CMS module (drawer/transitions/detail import it).
export type WaitlistStatus = 'draft' | 'open' | 'closed' | 'launching' | 'launched' | 'failed'

const WL_STATUS: Record<WaitlistStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'wl-draft' },
  open: { label: 'Open', cls: 'wl-open' },
  closed: { label: 'Closed', cls: 'wl-closed' },
  launching: { label: 'Launching', cls: 'wl-launching' },
  launched: { label: 'Launched', cls: 'wl-launched' },
  failed: { label: 'Failed', cls: 'wl-failed' },
}

interface Props {
  status: WaitlistStatus
  /** Larger variant for headers/detail. */
  lg?: boolean
}

export function WlBadge({ status, lg }: Props) {
  const m = WL_STATUS[status] ?? WL_STATUS.draft
  return (
    <span className={`wl-badge ${m.cls}${lg ? ' lg' : ''}`}>
      <span className={`wl-dot${status === 'launching' ? ' wl-pulse' : ''}`} aria-hidden="true" />
      {m.label}
    </span>
  )
}
