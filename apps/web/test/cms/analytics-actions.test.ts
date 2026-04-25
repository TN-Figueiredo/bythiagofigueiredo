import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const mockSelect = vi.fn()
const mockRpc = vi.fn()

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.gte = vi.fn().mockReturnValue(chain)
  chain.lte = vi.fn().mockReturnValue(chain)
  chain.in = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
  chain.select = mockSelect.mockReturnValue(chain)
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({ data: [], error: null, count: 0 })
  return chain
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => makeChain()),
    rpc: mockRpc.mockResolvedValue({ data: null, error: null }),
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
/*  Period validation                                                 */
/* ------------------------------------------------------------------ */

describe('fetchOverview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid period type', async () => {
    const { fetchOverview } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await fetchOverview({ type: 'preset', value: 'invalid' as '7d' })
    expect(result.ok).toBe(false)
  })

  it('accepts valid preset period 7d', async () => {
    const { fetchOverview } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await fetchOverview({ type: 'preset', value: '7d' })
    expect(result.ok).toBe(true)
  })

  it('accepts valid preset period 30d', async () => {
    const { fetchOverview } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await fetchOverview({ type: 'preset', value: '30d' })
    expect(result.ok).toBe(true)
  })

  it('accepts valid preset period 90d', async () => {
    const { fetchOverview } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await fetchOverview({ type: 'preset', value: '90d' })
    expect(result.ok).toBe(true)
  })

  it('accepts valid custom period with dates', async () => {
    const { fetchOverview } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await fetchOverview({
      type: 'custom',
      start: '2026-01-01',
      end: '2026-03-31',
    })
    expect(result.ok).toBe(true)
  })

  it('rejects custom period with invalid dates', async () => {
    const { fetchOverview } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await fetchOverview({
      type: 'custom',
      start: 'not-a-date',
      end: '2026-03-31',
    })
    expect(result.ok).toBe(false)
  })

  it('returns overview stats structure on success', async () => {
    const { fetchOverview } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await fetchOverview({ type: 'preset', value: '30d' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveProperty('postsPublished')
      expect(result.data).toHaveProperty('totalViews')
      expect(result.data).toHaveProperty('subscribers')
      expect(result.data).toHaveProperty('openRate')
      expect(result.data.prevPostsPublished).toBeNull()
    }
  })
})

describe('fetchNewsletterStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid period', async () => {
    const { fetchNewsletterStats } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await fetchNewsletterStats({ type: 'preset', value: 'bad' as '7d' })
    expect(result.ok).toBe(false)
  })

  it('accepts valid period', async () => {
    const { fetchNewsletterStats } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await fetchNewsletterStats({ type: 'preset', value: '30d' })
    expect(result.ok).toBe(true)
  })
})

describe('fetchCampaignStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid period', async () => {
    const { fetchCampaignStats } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await fetchCampaignStats({ type: 'preset', value: 'bad' as '7d' })
    expect(result.ok).toBe(false)
  })

  it('accepts valid period', async () => {
    const { fetchCampaignStats } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await fetchCampaignStats({ type: 'preset', value: '7d' })
    expect(result.ok).toBe(true)
  })
})

describe('fetchContentStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid period', async () => {
    const { fetchContentStats } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await fetchContentStats({ type: 'preset', value: 'bad' as '7d' })
    expect(result.ok).toBe(false)
  })

  it('accepts valid period', async () => {
    const { fetchContentStats } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await fetchContentStats({ type: 'preset', value: '90d' })
    expect(result.ok).toBe(true)
  })
})

describe('refreshStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls refresh_newsletter_stats RPC', async () => {
    const { refreshStats } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await refreshStats()
    expect(result.ok).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('refresh_newsletter_stats')
  })
})

/* ------------------------------------------------------------------ */
/*  Export validation                                                  */
/* ------------------------------------------------------------------ */

describe('exportReport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid export format', async () => {
    const { exportReport } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await exportReport(
      'xml' as 'json',
      ['overview'],
      { type: 'preset', value: '30d' },
    )
    expect(result.ok).toBe(false)
  })

  it('rejects empty sections array', async () => {
    const { exportReport } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await exportReport(
      'json',
      [],
      { type: 'preset', value: '30d' },
    )
    expect(result.ok).toBe(false)
  })

  it('rejects invalid section names', async () => {
    const { exportReport } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await exportReport(
      'json',
      ['invalid-section'],
      { type: 'preset', value: '30d' },
    )
    expect(result.ok).toBe(false)
  })

  it('rejects invalid period in export', async () => {
    const { exportReport } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await exportReport(
      'json',
      ['overview'],
      { type: 'preset', value: 'bad' as '7d' },
    )
    expect(result.ok).toBe(false)
  })

  it('accepts valid json export with multiple sections', async () => {
    const { exportReport } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await exportReport(
      'json',
      ['overview', 'newsletters'],
      { type: 'preset', value: '30d' },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      const parsed = JSON.parse(result.data)
      expect(parsed).toHaveProperty('overview')
    }
  })

  it('accepts valid csv export', async () => {
    const { exportReport } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    const result = await exportReport(
      'csv',
      ['overview'],
      { type: 'preset', value: '7d' },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toContain('Section,Metric,Value')
    }
  })
})

/* ------------------------------------------------------------------ */
/*  RBAC enforcement                                                  */
/* ------------------------------------------------------------------ */

describe('RBAC enforcement', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetchOverview throws forbidden when view access denied', async () => {
    const { requireSiteScope } = await import(
      '@tn-figueiredo/auth-nextjs/server'
    )
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { fetchOverview } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    await expect(
      fetchOverview({ type: 'preset', value: '30d' }),
    ).rejects.toThrow('forbidden')
  })

  it('fetchOverview throws unauthenticated when no session', async () => {
    const { requireSiteScope } = await import(
      '@tn-figueiredo/auth-nextjs/server'
    )
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'unauthenticated',
    })
    const { fetchOverview } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    await expect(
      fetchOverview({ type: 'preset', value: '30d' }),
    ).rejects.toThrow('unauthenticated')
  })

  it('exportReport uses edit mode (editors+ only)', async () => {
    const { requireSiteScope } = await import(
      '@tn-figueiredo/auth-nextjs/server'
    )
    // First call succeeds (view access from nested fetchOverview), but the
    // direct requireEditAccess call (mode: 'edit') should be checked
    vi.mocked(requireSiteScope).mockResolvedValue({
      ok: false,
      reason: 'insufficient_access',
    })
    const { exportReport } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    await expect(
      exportReport('json', ['overview'], { type: 'preset', value: '30d' }),
    ).rejects.toThrow('forbidden')
  })

  it('refreshStats throws forbidden when access denied', async () => {
    const { requireSiteScope } = await import(
      '@tn-figueiredo/auth-nextjs/server'
    )
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { refreshStats } = await import(
      '@/app/cms/(authed)/analytics/actions'
    )
    await expect(refreshStats()).rejects.toThrow('forbidden')
  })
})
