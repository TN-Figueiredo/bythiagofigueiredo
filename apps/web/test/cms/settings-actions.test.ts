import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

// Build a chainable mock that tracks the last table accessed so we can
// customise behaviour per-table (e.g. `select().eq().single()` for the
// deleteSite slug lookup vs. `update().eq()` for simple writes).
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockUpdate = vi.fn()
const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockUpsert = vi.fn()

function makeChain() {
  // Every chain method returns itself so `.eq().eq()` etc. works
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = mockSingle.mockResolvedValue({ data: { slug: 'test-site' }, error: null })
  chain.select = vi.fn().mockReturnValue(chain)
  chain.update = mockUpdate.mockReturnValue(chain)
  chain.insert = mockInsert.mockReturnValue(chain)
  chain.delete = mockDelete.mockReturnValue(chain)
  chain.upsert = mockUpsert.mockResolvedValue({ error: null })
  // Fallback: if the chain is awaited directly (e.g. `.eq('id', x)` is the
  // terminal), resolve with no error.
  chain.then = (resolve: (v: unknown) => void) => resolve({ error: null })
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

describe('updateBranding', () => {
  beforeEach(() => vi.clearAllMocks())

  it('validates logo_url starts with https://', async () => {
    const { updateBranding } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateBranding({
      logo_url: 'http://bad.com/logo.png',
      primary_color: '#000000',
    })
    expect(result.ok).toBe(false)
  })

  it('validates primary_color is hex', async () => {
    const { updateBranding } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateBranding({
      logo_url: 'https://ok.com/logo.png',
      primary_color: 'red',
    })
    expect(result.ok).toBe(false)
  })

  it('returns ok on valid input', async () => {
    const { updateBranding } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateBranding({
      logo_url: 'https://ok.com/logo.png',
      primary_color: '#ff6600',
    })
    expect(result.ok).toBe(true)
  })

  it('accepts empty logo_url', async () => {
    const { updateBranding } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateBranding({
      logo_url: '',
      primary_color: '#ff6600',
    })
    expect(result.ok).toBe(true)
  })
})

describe('updateIdentity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('validates twitter_handle format', async () => {
    const { updateIdentity } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateIdentity({
      identity_type: 'person',
      twitter_handle: '@too-long-handle!!!',
    })
    expect(result.ok).toBe(false)
  })

  it('accepts valid identity data', async () => {
    const { updateIdentity } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateIdentity({
      identity_type: 'person',
      twitter_handle: 'tnFigueiredo',
    })
    expect(result.ok).toBe(true)
  })

  it('rejects invalid identity_type', async () => {
    const { updateIdentity } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateIdentity({
      identity_type: 'bot' as unknown as 'person',
      twitter_handle: 'test',
    })
    expect(result.ok).toBe(false)
  })
})

describe('updateSeoDefaults', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepts null og image', async () => {
    const { updateSeoDefaults } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateSeoDefaults({ seo_default_og_image: null })
    expect(result.ok).toBe(true)
  })

  it('validates og image url starts with https', async () => {
    const { updateSeoDefaults } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateSeoDefaults({
      seo_default_og_image: 'http://bad.com/og.png',
    })
    expect(result.ok).toBe(false)
  })
})

describe('deleteSite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects mismatched slug confirmation', async () => {
    const { deleteSite } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await deleteSite('wrong-slug')
    expect(result.ok).toBe(false)
  })
})
