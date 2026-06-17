'use client'

import type { WaitlistStatus } from './wl-badge'

/**
 * Status-transition controls for a waitlist (handoff §3). Renders only the legal
 * Fase-1 transitions for the current status with a one-line hint each; clicking
 * calls `onTransition(to)`, which the connected island bridges to the
 * `transitionWaitlistStatus` server action. Keep this button map in sync with
 * `LEGAL_TRANSITIONS` in actions.ts. `launching`/`launched` expose no transitions
 * (the launch broadcast owns `launching`, `launched` is terminal).
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
  const note = TERMINAL_NOTE[status]

  if (actions.length === 0) {
    return note ? <p className="text-sm text-cms-text-muted">{note}</p> : null
  }

  return (
    <div className="flex flex-col gap-3">
      {actions.map((a) => (
        <div key={a.to} className="flex items-center justify-between gap-3">
          <span className="text-sm text-cms-text-muted">{a.hint}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => onTransition(a.to)}
            className={`shrink-0 rounded-[var(--cms-radius)] px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${TONE[a.tone]}`}
          >
            {a.label}
          </button>
        </div>
      ))}
    </div>
  )
}
