import { describe, it, expect, vi } from 'vitest'

// The action module imports heavy server deps at module load; stub them so the unit test
// can import + call the pure stub without wiring the full stack.
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/cms/repositories', () => ({ ringContext: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { launchWaitlist } from '../../src/app/cms/(authed)/waitlists/actions'

describe('launchWaitlist (Fase-1 stub)', () => {
  it('always returns { ok: false, error: "not_implemented" }', async () => {
    expect(await launchWaitlist('any-id')).toEqual({ ok: false, error: 'not_implemented' })
  })
})
