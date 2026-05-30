import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ------------------------------------------------------------------ */
/*  Configurable mock data via vi.hoisted                              */
/* ------------------------------------------------------------------ */

const { mockData } = vi.hoisted(() => ({
  mockData: { data: [] as any[], error: null as any },
}))

const { mockSiteId } = vi.hoisted(() => ({
  mockSiteId: { value: 'site-1' },
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => mockData,
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
  getSiteContext: () => ({ siteId: mockSiteId.value }),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { checkConnectionHealth } from '@/lib/social/actions/connections'

describe('checkConnectionHealth', () => {
  beforeEach(() => {
    mockData.data = []
    mockData.error = null
    mockSiteId.value = 'site-1'
  })

  it('returns ok for valid token (30 days out)', async () => {
    mockData.data = [
      {
        id: 'conn-1',
        provider: 'instagram',
        account_name: '@test',
        token_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        metadata: { followers_count: 5000 },
        status: 'active',
      },
    ]
    const result = await checkConnectionHealth('site-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data[0].status).toBe('ok')
    expect(result.data[0].followersCount).toBe(5000)
  })

  it('returns warn for token expiring within 7 days', async () => {
    mockData.data = [
      {
        id: 'conn-2',
        provider: 'facebook',
        account_name: 'Test Page',
        token_expires_at: new Date(Date.now() + 3 * 86400000).toISOString(),
        metadata: {},
        status: 'active',
      },
    ]
    const result = await checkConnectionHealth('site-1')
    if (!result.ok) return
    expect(result.data[0].status).toBe('warn')
    expect(result.data[0].tokenExpiresIn).toBeLessThanOrEqual(7)
  })

  it('returns error for expired token', async () => {
    mockData.data = [
      {
        id: 'conn-3',
        provider: 'instagram',
        account_name: '@expired',
        token_expires_at: new Date(Date.now() - 86400000).toISOString(),
        metadata: {},
        status: 'active',
      },
    ]
    const result = await checkConnectionHealth('site-1')
    if (!result.ok) return
    expect(result.data[0].status).toBe('error')
    expect(result.data[0].tokenExpiresIn).toBeLessThanOrEqual(0)
  })

  it('returns error for revoked connection', async () => {
    mockData.data = [
      {
        id: 'conn-4',
        provider: 'instagram',
        account_name: '@revoked',
        token_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        metadata: {},
        status: 'revoked',
      },
    ]
    const result = await checkConnectionHealth('site-1')
    if (!result.ok) return
    expect(result.data[0].status).toBe('error')
  })

  it('returns forbidden when siteId does not match', async () => {
    mockSiteId.value = 'other-site'
    const result = await checkConnectionHealth('site-1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('forbidden')
  })

  it('returns empty array when no connections exist', async () => {
    mockData.data = []
    const result = await checkConnectionHealth('site-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(0)
  })

  it('returns error when DB query fails', async () => {
    mockData.data = null as any
    mockData.error = { message: 'connection timeout' }
    const result = await checkConnectionHealth('site-1')
    expect(result.ok).toBe(false)
  })

  it('returns null tokenExpiresIn for non-expiring tokens', async () => {
    mockData.data = [
      {
        id: 'conn-5',
        provider: 'youtube',
        account_name: 'TestChannel',
        token_expires_at: null,
        metadata: { subscriber_count: 12000 },
        status: 'active',
      },
    ]
    const result = await checkConnectionHealth('site-1')
    if (!result.ok) return
    expect(result.data[0].tokenExpiresIn).toBeNull()
    expect(result.data[0].followersCount).toBe(12000)
  })
})
