import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/newsletter/cache-invalidation', () => ({
  revalidateAuthor: vi.fn(),
  revalidateAbout: vi.fn(),
}))

const mockUpsert = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'sites') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { supported_locales: ['pt-BR', 'en'] },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'author_about_translations') {
        return {
          upsert: mockUpsert.mockResolvedValue({ error: null }),
        }
      }
      const chain: Record<string, any> = {}
      chain.eq = vi.fn().mockReturnValue(chain)
      chain.select = vi.fn().mockReturnValue(chain)
      chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
      chain.update = vi.fn().mockReturnValue(chain)
      chain.then = (resolve: (v: unknown) => void) => resolve({ error: null })
      return chain
    }),
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

vi.mock('@tn-figueiredo/cms', () => ({
  compileMdx: vi.fn().mockResolvedValue({
    compiledSource: '<p>compiled</p>',
    toc: [],
    readingTimeMin: 1,
  }),
  defaultComponents: {},
}))

import { updateAuthorAbout } from '../../src/app/cms/(authed)/authors/actions'

describe('updateAuthorAbout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves about fields with locale via upsert and returns ok', async () => {
    const result = await updateAuthorAbout('author-1', 'pt-BR', {
      headline: 'eu sou |Thiago.',
      subtitle: '37 anos',
      aboutMd: '# Hello',
      photoCaption: 'CN Tower',
      photoLocation: 'TORONTO · 2018',
    })

    expect(result.ok).toBe(true)
    expect(mockUpsert).toHaveBeenCalled()
  })

  it('rejects headline exceeding max length', async () => {
    const result = await updateAuthorAbout('author-1', 'pt-BR', {
      headline: 'x'.repeat(201),
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('validation_failed')
  })

  it('compiles MDX when aboutMd is provided', async () => {
    const { compileMdx } = await import('@tn-figueiredo/cms')

    await updateAuthorAbout('author-1', 'pt-BR', {
      aboutMd: '# New content',
    })

    expect(compileMdx).toHaveBeenCalledWith('# New content', {})
  })
})
