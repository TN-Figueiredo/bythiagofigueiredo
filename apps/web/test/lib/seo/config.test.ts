import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('getSiteSeoConfig', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('assembles SiteSeoConfig from sites row + identity profile', async () => {
    // unstable_cache requires Next request context — pass-through wrap so
    // the underlying assembleConfig runs unwrapped in tests.
    vi.doMock('next/cache', () => ({
      unstable_cache: <T extends (...a: unknown[]) => unknown>(fn: T) => fn,
    }))
    vi.doMock('@/lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'site-1',
                  name: 'Thiago Figueiredo',
                  slug: 'bythiagofigueiredo',
                  primary_domain: 'bythiagofigueiredo.com',
                  default_locale: 'pt-BR',
                  supported_locales: ['pt-BR', 'en'],
                  identity_type: 'person',
                  primary_color: '#FF0066',
                  logo_url: null,
                  twitter_handle: 'tnFigueiredo',
                  seo_default_og_image: null,
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    }))
    const { getSiteSeoConfig } = await import('@/lib/seo/config')
    const c = await getSiteSeoConfig('site-1', 'bythiagofigueiredo.com')
    expect(c.siteUrl).toBe('https://bythiagofigueiredo.com')
    expect(c.identityType).toBe('person')
    expect(c.personIdentity).not.toBeNull()
    expect(c.orgIdentity).toBeNull()
  })
})
