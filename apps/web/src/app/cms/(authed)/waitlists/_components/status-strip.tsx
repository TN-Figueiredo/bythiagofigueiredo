'use client'

import type { WaitlistStatus } from './wl-badge'

/**
 * Status-transition controls for a waitlist (handoff §3 `.wl-strip`): a framed
 * horizontal row — uppercase label + hint (spacer) + inline action button(s).
 * Renders only the legal Fase-1 transitions for the current status; clicking calls
 * `onTransition(to)`, which the connected island bridges to `transitionWaitlistStatus`.
 * Terminal states (`launching`/`launched`) render the same framed container with a
 * note instead of buttons (never a bare/absent element). Keep this button map in
 * sync with `LEGAL_TRANSITIONS` in actions.ts.
 */
export interface StatusAction {
  to: WaitlistStatus
  label: string
  hint: string
  tone: 'primary' | 'default' | 'recover'
}

const STRIP: Record<WaitlistStatus, StatusAction[]> = {
  draft: [{ to: 'open', label: 'Open signups', hint: 'Start collecting signups on the public page.', tone: 'primary' }],
  open: [{ to: 'closed', label: 'Close signups', hint: 'Stop accepting new signups.', tone: 'default' }],
  closed: [{ to: 'open', label: 'Reopen signups', hint: 'Accept signups again.', tone: 'primary' }],
  failed: [{ to: 'closed', label: 'Reset to closed', hint: 'Recover after a failed launch, then retry.', tone: 'recover' }],
  launching: [],
  launched: [],
}

const TERMINAL_NOTE: Partial<Record<WaitlistStatus, string>> = {
  launching: 'Launch in progress — signups are paused while the broadcast runs.',
  launched: 'Launched — this list is closed and archived.',
}

const TONE: Record<StatusAction['tone'], string> = {
  primary: 'bg-cms-accent text-white hover:bg-cms-accent-hover',
  default: 'border border-cms-border text-cms-text hover:bg-cms-surface',
  recover: 'border border-[var(--cms-amber,#f59e0b)] text-[var(--cms-amber,#f59e0b)] hover:bg-[rgba(245,158,11,0.1)]',
}

export interface WaitlistStatusStripProps {
  status: WaitlistStatus
  onTransition: (to: WaitlistStatus) => void
  pending?: boolean
}

export function WaitlistStatusStrip({ status, onTransition, pending = false }: WaitlistStatusStripProps) {
  const actions = STRIP[status] ?? []
  const hint = actions[0]?.hint ?? TERMINAL_NOTE[status] ?? 'No actions available for this status.'

  return (
    <div className="flex items-center gap-3 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-4 py-3">
      <span className="text-xs font-medium uppercase tracking-wide text-cms-text-muted">Status</span>
      <span className="flex-1 text-sm text-cms-text-muted">{hint}</span>
      {actions.length > 0 && (
        <div className="flex shrink-0 gap-2">
          {actions.map((a) => (
            <button
              key={a.to}
              type="button"
              disabled={pending}
              onClick={() => onTransition(a.to)}
              className={`rounded-[var(--cms-radius)] px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${TONE[a.tone]}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
