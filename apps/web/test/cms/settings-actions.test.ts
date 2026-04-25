import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockUpdate = vi.fn()
const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockUpsert = vi.fn()

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = mockSingle.mockResolvedValue({
    data: { slug: 'test-site' },
    error: null,
  })
  chain.select = vi.fn().mockReturnValue(chain)
  chain.update = mockUpdate.mockReturnValue(chain)
  chain.insert = mockInsert.mockReturnValue(chain)
  chain.delete = mockDelete.mockReturnValue(chain)
  chain.upsert = mockUpsert.mockResolvedValue({ error: null })
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

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'u1' } }),
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

describe('updateNewsletterType', () => {
  beforeEach(() => vi.clearAllMocks())

  it('validates cadence_days range', async () => {
    const { updateNewsletterType } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateNewsletterType('nt-1', {
      cadence_days: 0,
    })
    expect(result.ok).toBe(false)
  })

  it('validates preferred_send_time format', async () => {
    const { updateNewsletterType } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateNewsletterType('nt-1', {
      preferred_send_time: 'noon',
    })
    expect(result.ok).toBe(false)
  })

  it('accepts valid newsletter type update', async () => {
    const { updateNewsletterType } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateNewsletterType('nt-1', {
      cadence_days: 7,
      preferred_send_time: '08:00',
      cadence_paused: false,
    })
    expect(result.ok).toBe(true)
  })

  it('accepts null cadence_days', async () => {
    const { updateNewsletterType } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateNewsletterType('nt-1', {
      cadence_days: null,
    })
    expect(result.ok).toBe(true)
  })
})

describe('createNewsletterType', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects empty name', async () => {
    const { createNewsletterType } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await createNewsletterType({ name: '' })
    expect(result.ok).toBe(false)
  })

  it('accepts valid create input', async () => {
    const { createNewsletterType } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await createNewsletterType({
      name: 'Weekly Digest',
      sort_order: 0,
    })
    expect(result.ok).toBe(true)
  })
})

describe('updateBlogCadence', () => {
  beforeEach(() => vi.clearAllMocks())

  it('validates preferred_send_time format', async () => {
    const { updateBlogCadence } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateBlogCadence('pt-BR', {
      preferred_send_time: 'invalid',
    })
    expect(result.ok).toBe(false)
  })

  it('accepts valid cadence data', async () => {
    const { updateBlogCadence } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateBlogCadence('pt-BR', {
      cadence_days: 7,
      preferred_send_time: '09:00',
    })
    expect(result.ok).toBe(true)
  })
})

describe('updateSiteLocales', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects default locale not in supported list', async () => {
    const { updateSiteLocales } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateSiteLocales({
      default_locale: 'ja',
      supported_locales: ['pt-BR', 'en'],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects empty supported_locales', async () => {
    const { updateSiteLocales } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateSiteLocales({
      default_locale: 'pt-BR',
      supported_locales: [],
    })
    expect(result.ok).toBe(false)
  })

  it('accepts valid locale config', async () => {
    const { updateSiteLocales } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    const result = await updateSiteLocales({
      default_locale: 'pt-BR',
      supported_locales: ['pt-BR', 'en'],
    })
    expect(result.ok).toBe(true)
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
    const { updateBranding } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    await expect(
      updateBranding({
        logo_url: 'https://ok.com/logo.png',
        primary_color: '#ff6600',
      }),
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
    const { disableCms } = await import(
      '@/app/cms/(authed)/settings/actions'
    )
    await expect(disableCms()).rejects.toThrow('unauthenticated')
  })
})
