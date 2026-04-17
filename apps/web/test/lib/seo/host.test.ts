import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isPreviewOrDevHost } from '@/lib/seo/host'

describe('isPreviewOrDevHost', () => {
  it.each([
    ['dev.bythiagofigueiredo.com', true],
    ['foo.vercel.app', true],
    ['localhost', true],
    ['localhost:3001', true],
    ['dev.localhost', true],
    ['bythiagofigueiredo.com', false],
    ['www.bythiagofigueiredo.com', false],
  ])('isPreviewOrDevHost(%s) === %s', (host, expected) => {
    expect(isPreviewOrDevHost(host)).toBe(expected)
  })
})

describe('resolveSiteByHost', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns null for unknown host', async () => {
    vi.doMock('@/lib/cms/repositories', () => ({
      ringContext: () => ({ getSiteByDomain: vi.fn().mockResolvedValue(null) }),
    }))
    const { resolveSiteByHost } = await import('@/lib/seo/host')
    expect(await resolveSiteByHost('unknown.test')).toBeNull()
  })

  it('returns site record for known host', async () => {
    vi.doMock('@/lib/cms/repositories', () => ({
      ringContext: () => ({
        getSiteByDomain: vi
          .fn()
          .mockResolvedValue({ id: 'site-1', slug: 'bythiagofigueiredo' }),
      }),
    }))
    const { resolveSiteByHost } = await import('@/lib/seo/host')
    const r = await resolveSiteByHost('bythiagofigueiredo.com')
    expect(r?.slug).toBe('bythiagofigueiredo')
  })
})
