// Six-status badge for the waitlists CMS. Statuses mirror the DB `waitlists.status`
// enum and the design handoff (views-waitlists.jsx WL_STATUS). Styled with inline
// Tailwind keyed off the cms color tokens (M1 — no per-feature stylesheet). Backgrounds
// are LITERAL rgba (matching each token's base hex at .14 alpha), NOT token-alpha via
// color-mix/relative-color: Opera renders those transparent and these surfaces are
// load-bearing chrome (project color-mix note). The dot inherits the status color via
// `bg-current`. The status union is exported here as the single source of truth for the
// CMS module (drawer/transitions/detail import it).
export type WaitlistStatus = 'draft' | 'open' | 'closed' | 'launching' | 'launched' | 'failed'

// draft → muted, open → green, closed → amber, launching → cyan (pulsing),
// launched → purple, failed → rose.
const WL_STATUS: Record<WaitlistStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'text-[var(--cms-text-muted,#8a8f98)] bg-[rgba(138,143,152,0.14)]' },
  open: { label: 'Open', cls: 'text-[var(--cms-green,#22c55e)] bg-[rgba(34,197,94,0.14)]' },
  closed: { label: 'Closed', cls: 'text-[var(--cms-amber,#f59e0b)] bg-[rgba(245,158,11,0.14)]' },
  launching: { label: 'Launching', cls: 'text-[var(--cms-cyan,#06b6d4)] bg-[rgba(6,182,212,0.14)]' },
  launched: { label: 'Launched', cls: 'text-[var(--cms-purple,#a855f7)] bg-[rgba(168,85,247,0.14)]' },
  failed: { label: 'Failed', cls: 'text-[var(--cms-rose,#f43f5e)] bg-[rgba(244,63,94,0.14)]' },
}

/** Runtime guard for the status union — lets DB/PostgREST reads narrow without an `as` cast. */
export function isWaitlistStatus(s: unknown): s is WaitlistStatus {
  return typeof s === 'string' && Object.prototype.hasOwnProperty.call(WL_STATUS, s)
}

const BASE = 'inline-flex items-center gap-1.5 rounded-full font-semibold leading-none whitespace-nowrap'

interface Props {
  status: WaitlistStatus
  /** Larger variant for headers/detail. */
  lg?: boolean
}

export function WlBadge({ status, lg }: Props) {
  const m = WL_STATUS[status] ?? WL_STATUS.draft
  const size = lg ? 'px-[13px] py-[5px] text-[13px]' : 'px-2.5 py-[3px] text-xs'
  const pulse = status === 'launching' ? 'animate-pulse motion-reduce:animate-none' : ''
  return (
    <span data-status={status} className={`${BASE} ${size} ${m.cls}`}>
      <span className={`h-[7px] w-[7px] shrink-0 rounded-full bg-current ${pulse}`} aria-hidden="true" />
      {m.label}
    </span>
  )
}
