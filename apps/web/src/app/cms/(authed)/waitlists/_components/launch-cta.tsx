'use client'

import type { WaitlistStatus } from './wl-badge'

/**
 * Launch is allowed only when there is at least one pending signup to notify AND the
 * list is in a launchable status (open or closed). Exported as a pure predicate so the
 * gating contract is unit-testable independent of the card chrome.
 */
export function canLaunch(status: WaitlistStatus, pending: number): boolean {
  return pending > 0 && (status === 'open' || status === 'closed')
}

export interface LaunchCtaProps {
  status: WaitlistStatus
  pending: number
  /** Opens the broadcast dialog (Task 19). The launch action itself returns
   *  `not_implemented` until Fase 2 — see the card hint. */
  onLaunch?: () => void
}

export function LaunchCta({ status, pending, onLaunch }: LaunchCtaProps) {
  const enabled = canLaunch(status, pending)
  const reason = !enabled
    ? pending === 0
      ? 'No pending signups to notify yet.'
      : 'Open or close the list before launching.'
    : `Notify ${pending} pending signup${pending === 1 ? '' : 's'}.`

  return (
    <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
      <h3 className="text-sm font-semibold text-cms-text">Launch</h3>
      <p className="mt-1 text-xs text-cms-text-muted">{reason}</p>
      <button
        type="button"
        disabled={!enabled}
        onClick={() => onLaunch?.()}
        className="mt-3 inline-flex items-center gap-2 rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        Launch broadcast
      </button>
      <p className="mt-2 text-xs text-cms-text-muted">
        Broadcast delivery ships in the next phase — this returns “not implemented” until Fase 2.
      </p>
    </div>
  )
}
