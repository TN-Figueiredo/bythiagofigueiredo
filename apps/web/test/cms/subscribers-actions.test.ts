import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const mockEq = vi.fn()
const mockNeq = vi.fn()
const mockIn = vi.fn()
const mockIlike = vi.fn()
const mockUpdate = vi.fn()

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.eq = mockEq.mockReturnValue(chain)
  chain.neq = mockNeq.mockReturnValue(chain)
  chain.in = mockIn.mockReturnValue(chain)
  chain.ilike = mockIlike.mockReturnValue(chain)
  chain.select = vi.fn().mockReturnValue(chain)
  chain.update = mockUpdate.mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({
      data: [
        {
          id: 'sub-1',
          email: 'alice@example.com',
          status: 'confirmed',
          newsletter_type_id: 'nt-1',
          tracking_consent: true,
          created_at: '2026-04-01T00:00:00Z',
          unsubscribed_at: null,
          locale: 'en',
        },
        {
          id: 'sub-2',
          email: 'a1b2c3d4e5f60708...@anon',
          status: 'unsubscribed',
          newsletter_type_id: 'nt-1',
          tracking_consent: false,
          created_at: '2026-03-15T00:00:00Z',
          unsubscribed_at: '2026-04-10T00:00:00Z',
          locale: 'pt-BR',
        },
      ],
      error: null,
    })
  return chain
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => makeChain()),
  })),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({
    siteId: 'site-1',
    orgId: 'org-1',
    defaultLocale: 'pt-BR',
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'u1' } }),
}))

/* ------------------------------------------------------------------ */
/*  Tests — exportSubscribers                                         */
/* ------------------------------------------------------------------ */

describe('exportSubscribers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid format', async () => {
    const { exportSubscribers } = await import(
      '@/app/cms/(authed)/subscribers/actions'
    )
    const result = await exportSubscribers('xml' as 'csv')
    expect(result.ok).toBe(false)
  })

  it('returns CSV data on valid csv format', async () => {
    const { exportSubscribers } = await import(
      '@/app/cms/(authed)/subscribers/actions'
    )
    const result = await exportSubscribers('csv')
    expect(result.ok).toBe(true)
    if (result.ok && 'data' in result) {
      expect(result.data).toContain('id,email,status')
      // Anonymized rows should be excluded
      expect(result.data).toContain('alice@example.com')
      expect(result.data).not.toContain('a1b2c3d4e5f60708')
    }
  })

  it('returns JSON data on valid json format', async () => {
    const { exportSubscribers } = await import(
      '@/app/cms/(authed)/subscribers/actions'
    )
    const result = await exportSubscribers('json')
    expect(result.ok).toBe(true)
    if (result.ok && 'data' in result) {
      const parsed = JSON.parse(result.data)
      expect(Array.isArray(parsed)).toBe(true)
      // Anonymized rows excluded
      expect(parsed.length).toBe(1)
      expect(parsed[0].email).toBe('alice@example.com')
    }
  })

  it('passes filters to query', async () => {
    const { exportSubscribers } = await import(
      '@/app/cms/(authed)/subscribers/actions'
    )
    await exportSubscribers('csv', { status: 'confirmed', search: 'alice' })
    // mockEq called for site_id and status
    expect(mockEq).toHaveBeenCalled()
    expect(mockIlike).toHaveBeenCalled()
  })
})

/* ------------------------------------------------------------------ */
/*  Tests — batchUnsubscribe                                          */
/* ------------------------------------------------------------------ */

describe('batchUnsubscribe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects empty array', async () => {
    const { batchUnsubscribe } = await import(
      '@/app/cms/(authed)/subscribers/actions'
    )
    const result = await batchUnsubscribe([])
    expect(result.ok).toBe(false)
  })

  it('rejects invalid UUID', async () => {
    const { batchUnsubscribe } = await import(
      '@/app/cms/(authed)/subscribers/actions'
    )
    const result = await batchUnsubscribe(['not-a-uuid'])
    expect(result.ok).toBe(false)
  })

  it('accepts valid UUIDs', async () => {
    const { batchUnsubscribe } = await import(
      '@/app/cms/(authed)/subscribers/actions'
    )
    const result = await batchUnsubscribe([
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
    ])
    expect(result.ok).toBe(true)
  })

  it('calls update with unsubscribed status', async () => {
    const { batchUnsubscribe } = await import(
      '@/app/cms/(authed)/subscribers/actions'
    )
    await batchUnsubscribe(['00000000-0000-0000-0000-000000000001'])
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'unsubscribed',
        unsubscribed_at: expect.any(String),
      }),
    )
  })
})

/* ------------------------------------------------------------------ */
/*  Tests — toggleTrackingConsent                                     */
/* ------------------------------------------------------------------ */

describe('toggleTrackingConsent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid UUID', async () => {
    const { toggleTrackingConsent } = await import(
      '@/app/cms/(authed)/subscribers/actions'
    )
    const result = await toggleTrackingConsent('bad-id', true)
    expect(result.ok).toBe(false)
  })

  it('rejects non-boolean enabled', async () => {
    const { toggleTrackingConsent } = await import(
      '@/app/cms/(authed)/subscribers/actions'
    )
    const result = await toggleTrackingConsent(
      '00000000-0000-0000-0000-000000000001',
      'yes' as unknown as boolean,
    )
    expect(result.ok).toBe(false)
  })

  it('accepts valid input and updates', async () => {
    const { toggleTrackingConsent } = await import(
      '@/app/cms/(authed)/subscribers/actions'
    )
    const result = await toggleTrackingConsent(
      '00000000-0000-0000-0000-000000000001',
      true,
    )
    expect(result.ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({ tracking_consent: true })
  })

  it('can disable tracking consent', async () => {
    const { toggleTrackingConsent } = await import(
      '@/app/cms/(authed)/subscribers/actions'
    )
    const result = await toggleTrackingConsent(
      '00000000-0000-0000-0000-000000000001',
      false,
    )
    expect(result.ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({ tracking_consent: false })
  })
})

/* ------------------------------------------------------------------ */
/*  Tests — RBAC enforcement                                          */
/* ------------------------------------------------------------------ */

describe('RBAC enforcement', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws forbidden when requireSiteScope denies access', async () => {
    const { requireSiteScope } = await import(
      '@tn-figueiredo/auth-nextjs/server'
    )
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { batchUnsubscribe } = await import(
      '@/app/cms/(authed)/subscribers/actions'
    )
    await expect(
      batchUnsubscribe(['00000000-0000-0000-0000-000000000001']),
    ).rejects.toThrow('forbidden')
  })

  it('throws unauthenticated when no session', async () => {
    const { requireSiteScope } = await import(
      '@tn-figueiredo/auth-nextjs/server'
    )
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'unauthenticated',
    })
    const { toggleTrackingConsent } = await import(
      '@/app/cms/(authed)/subscribers/actions'
    )
    await expect(
      toggleTrackingConsent('00000000-0000-0000-0000-000000000001', true),
    ).rejects.toThrow('unauthenticated')
  })

  it('throws forbidden for exportSubscribers when denied', async () => {
    const { requireSiteScope } = await import(
      '@tn-figueiredo/auth-nextjs/server'
    )
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { exportSubscribers } = await import(
      '@/app/cms/(authed)/subscribers/actions'
    )
    await expect(exportSubscribers('csv')).rejects.toThrow('forbidden')
  })
})
