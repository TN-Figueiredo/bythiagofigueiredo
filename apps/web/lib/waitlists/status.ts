// Server-safe waitlist status domain: the status union, its runtime guard, and the
// Fase-1 legal transition graph. Lives in lib/ (NOT a 'use client' component) so the
// 'use server' actions module can import it without coupling to client code, and so the
// CMS status-strip and the transition action share ONE source of truth for the graph.

export type WaitlistStatus = 'draft' | 'open' | 'closed' | 'launching' | 'launched' | 'failed'

export const WAITLIST_STATUSES: readonly WaitlistStatus[] = [
  'draft',
  'open',
  'closed',
  'launching',
  'launched',
  'failed',
]

/** Runtime guard — lets DB/PostgREST reads narrow without an `as` cast. */
export function isWaitlistStatus(s: unknown): s is WaitlistStatus {
  return typeof s === 'string' && (WAITLIST_STATUSES as readonly string[]).includes(s)
}

/** Statuses whose waitlist renders on the PUBLIC surface (status route + landing page). */
export const PUBLIC_WAITLIST_STATUSES = ['open', 'closed', 'launched'] as const satisfies readonly WaitlistStatus[]
export type PublicWaitlistStatus = (typeof PUBLIC_WAITLIST_STATUSES)[number]
export function isPublicWaitlistStatus(s: unknown): s is PublicWaitlistStatus {
  return typeof s === 'string' && (PUBLIC_WAITLIST_STATUSES as readonly string[]).includes(s)
}

/**
 * Fase-1 legal status graph (single source of truth for both transitionWaitlistStatus and
 * the status-strip buttons). `launching`/`launched` are intentionally absent as targets —
 * the launch broadcast owns `launching` (Fase 2) and `launched` is terminal.
 */
export const LEGAL_TRANSITIONS: Record<WaitlistStatus, readonly WaitlistStatus[]> = {
  draft: ['open'],
  open: ['closed'],
  closed: ['open'],
  failed: ['closed'],
  launching: [],
  launched: [],
}
