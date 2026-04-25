import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.in = vi.fn().mockReturnValue(chain)
  chain.select = mockSelect.mockResolvedValue({ data: [{ id: 'c1' }], error: null })
  chain.update = mockUpdate.mockReturnValue(chain)
  chain.delete = mockDelete.mockReturnValue(chain)
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
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('bulkPublishCampaigns', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects empty array', async () => {
    const { bulkPublishCampaigns } = await import(
      '@/app/cms/(authed)/campaigns/bulk-actions'
    )
    const result = await bulkPublishCampaigns([])
    expect(result.ok).toBe(false)
  })

  it('rejects non-UUID strings', async () => {
    const { bulkPublishCampaigns } = await import(
      '@/app/cms/(authed)/campaigns/bulk-actions'
    )
    const result = await bulkPublishCampaigns(['not-a-uuid'])
    expect(result.ok).toBe(false)
  })

  it('validates valid UUIDs and returns ok', async () => {
    const { bulkPublishCampaigns } = await import(
      '@/app/cms/(authed)/campaigns/bulk-actions'
    )
    const result = await bulkPublishCampaigns([
      '00000000-0000-0000-0000-000000000001',
    ])
    expect(result.ok).toBe(true)
  })

  it('returns affected count on success', async () => {
    const { bulkPublishCampaigns } = await import(
      '@/app/cms/(authed)/campaigns/bulk-actions'
    )
    const result = await bulkPublishCampaigns([
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
    ])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(typeof result.affected).toBe('number')
    }
  })
})

describe('bulkArchiveCampaigns', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects empty array', async () => {
    const { bulkArchiveCampaigns } = await import(
      '@/app/cms/(authed)/campaigns/bulk-actions'
    )
    const result = await bulkArchiveCampaigns([])
    expect(result.ok).toBe(false)
  })

  it('validates and returns ok for valid UUIDs', async () => {
    const { bulkArchiveCampaigns } = await import(
      '@/app/cms/(authed)/campaigns/bulk-actions'
    )
    const result = await bulkArchiveCampaigns([
      '00000000-0000-0000-0000-000000000001',
    ])
    expect(result.ok).toBe(true)
  })
})

describe('bulkDeleteCampaigns', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects empty array', async () => {
    const { bulkDeleteCampaigns } = await import(
      '@/app/cms/(authed)/campaigns/bulk-actions'
    )
    const result = await bulkDeleteCampaigns([])
    expect(result.ok).toBe(false)
  })

  it('validates and returns ok for valid UUIDs', async () => {
    const { bulkDeleteCampaigns } = await import(
      '@/app/cms/(authed)/campaigns/bulk-actions'
    )
    const result = await bulkDeleteCampaigns([
      '00000000-0000-0000-0000-000000000001',
    ])
    expect(result.ok).toBe(true)
  })
})

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
    const { bulkPublishCampaigns } = await import(
      '@/app/cms/(authed)/campaigns/bulk-actions'
    )
    await expect(
      bulkPublishCampaigns(['00000000-0000-0000-0000-000000000001']),
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
    const { bulkDeleteCampaigns } = await import(
      '@/app/cms/(authed)/campaigns/bulk-actions'
    )
    await expect(
      bulkDeleteCampaigns(['00000000-0000-0000-0000-000000000001']),
    ).rejects.toThrow('unauthenticated')
  })

  it('throws forbidden for bulkArchive when access denied', async () => {
    const { requireSiteScope } = await import(
      '@tn-figueiredo/auth-nextjs/server'
    )
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { bulkArchiveCampaigns } = await import(
      '@/app/cms/(authed)/campaigns/bulk-actions'
    )
    await expect(
      bulkArchiveCampaigns(['00000000-0000-0000-0000-000000000001']),
    ).rejects.toThrow('forbidden')
  })
})
