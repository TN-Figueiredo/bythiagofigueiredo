/**
 * NON-DB-gated tests for the transitionWaitlistStatus GATE logic. The
 * illegal-transition and Fase-1 LGPD open-gate both return BEFORE any DB
 * round-trip, so these run in CI (the service client is mocked to THROW if
 * touched, proving the early-return). The CAS success/status_changed paths are
 * exercised in the DB-gated waitlist-cms-actions suite.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(async () => ({ siteId: 'site-1', orgId: 'org-1', defaultLocale: 'en' })),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'user-1' } })),
}))
const serviceCalled = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => {
    serviceCalled()
    // Chainable stub: the CAS update resolves to the new row. Gated rejections
    // return before this is ever called (asserted via serviceCalled below).
    const chain = {
      from: () => chain,
      update: () => chain,
      eq: () => chain,
      select: () => chain,
      maybeSingle: async () => ({ data: { status: 'closed' }, error: null }),
    }
    return chain
  },
}))
vi.mock('@/lib/cms/repositories', () => ({ ringContext: () => ({ getSite: async () => ({ domains: [] }) }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))

import { transitionWaitlistStatus } from '../../src/app/cms/(authed)/waitlists/actions'

describe('transitionWaitlistStatus — gate logic (no DB)', () => {
  afterEach(() => {
    serviceCalled.mockClear()
    vi.unstubAllEnvs()
  })

  it('rejects an illegal transition (draft→launched) before any DB call', async () => {
    const res = await transitionWaitlistStatus('wl-1', 'draft', 'launched')
    expect(res).toEqual({ ok: false, error: 'illegal_transition' })
    expect(serviceCalled).not.toHaveBeenCalled()
  })

  it('treats launched as terminal (launched→closed is illegal)', async () => {
    const res = await transitionWaitlistStatus('wl-1', 'launched', 'closed')
    expect(res).toEqual({ ok: false, error: 'illegal_transition' })
    expect(serviceCalled).not.toHaveBeenCalled()
  })

  it('blocks draft→open as fase1_only_draft when WAITLIST_ACCEPT_PUBLIC_SIGNUPS is unset (LGPD M6)', async () => {
    vi.stubEnv('WAITLIST_ACCEPT_PUBLIC_SIGNUPS', '')
    const res = await transitionWaitlistStatus('wl-1', 'draft', 'open')
    expect(res).toEqual({ ok: false, error: 'fase1_only_draft' })
    expect(serviceCalled).not.toHaveBeenCalled()
  })

  it('lets a legal non-open transition (open→closed) reach the DB and succeed via CAS', async () => {
    const res = await transitionWaitlistStatus('wl-1', 'open', 'closed')
    expect(res).toEqual({ ok: true, status: 'closed' })
    expect(serviceCalled).toHaveBeenCalledTimes(1)
  })
})
