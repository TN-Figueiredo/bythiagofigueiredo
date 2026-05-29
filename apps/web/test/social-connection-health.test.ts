import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [
                {
                  id: 'conn-1',
                  provider: 'instagram',
                  account_name: '@test',
                  token_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
                  metadata: { followers_count: 5000 },
                  status: 'active',
                },
                {
                  id: 'conn-2',
                  provider: 'facebook',
                  account_name: 'Test Page',
                  token_expires_at: new Date(Date.now() + 3 * 86400000).toISOString(),
                  metadata: {},
                  status: 'active',
                },
                {
                  id: 'conn-3',
                  provider: 'youtube',
                  account_name: 'TestChannel',
                  token_expires_at: null,
                  metadata: { subscriber_count: 12000 },
                  status: 'active',
                },
              ],
              error: null,
            }),
        }),
      }),
    }),
  }),
}))

vi.mock('@tn-figueiredo/social', () => ({}))

vi.mock('@tn-figueiredo/social/vault', () => ({
  encrypt: vi.fn((v: string) => v),
  decrypt: vi.fn((v: string) => v),
  getMasterKey: vi.fn(() => 'test-key'),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: () => ({ ok: true, user: { id: 'u1' } }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => ({ siteId: 'site-1' }),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { checkConnectionHealth } from '@/lib/social/actions/connections'

describe('checkConnectionHealth', () => {
  it('returns ok for valid token', async () => {
    const result = await checkConnectionHealth('site-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const ig = result.data.find((c) => c.provider === 'instagram')
    expect(ig?.status).toBe('ok')
    expect(ig?.followersCount).toBe(5000)
  })

  it('returns warn for token expiring within 7 days', async () => {
    const result = await checkConnectionHealth('site-1')
    if (!result.ok) return
    const fb = result.data.find((c) => c.provider === 'facebook')
    expect(fb?.status).toBe('warn')
    expect(fb?.tokenExpiresIn).toBeLessThanOrEqual(7)
  })

  it('returns null tokenExpiresIn for non-expiring tokens', async () => {
    const result = await checkConnectionHealth('site-1')
    if (!result.ok) return
    const yt = result.data.find((c) => c.provider === 'youtube')
    expect(yt?.status).toBe('ok')
    expect(yt?.tokenExpiresIn).toBeNull()
    expect(yt?.followersCount).toBe(12000)
  })
})
