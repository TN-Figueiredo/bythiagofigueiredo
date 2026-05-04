import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/newsletter/cache-invalidation', () => ({
  revalidateAuthor: vi.fn(),
  revalidateAbout: vi.fn(),
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
  compileMdx: vi.fn().mockResolvedValue({ compiledSource: '', toc: [], readingTimeMin: 0 }),
  defaultComponents: {},
}))

let translationRows: unknown[] = []

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'author_about_translations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: translationRows,
              error: null,
            }),
          }),
        }
      }
      // Default chain for other tables
      const chain: Record<string, any> = {}
      chain.eq = vi.fn().mockReturnValue(chain)
      chain.select = vi.fn().mockReturnValue(chain)
      chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
      chain.update = vi.fn().mockReturnValue(chain)
      chain.upsert = vi.fn().mockResolvedValue({ error: null })
      chain.then = (resolve: (v: unknown) => void) => resolve({ error: null })
      return chain
    }),
  })),
}))

import { getAuthorAboutTranslations } from '../../src/app/cms/(authed)/authors/actions'

describe('getAuthorAboutTranslations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    translationRows = []
  })

  it('returns empty record when no translations exist', async () => {
    translationRows = []
    const result = await getAuthorAboutTranslations('author-1')
    expect(result).toEqual({})
  })

  it('returns translations keyed by locale', async () => {
    translationRows = [
      {
        locale: 'pt-BR',
        headline: 'Olá',
        subtitle: 'sub',
        about_md: '# md',
        photo_caption: 'cap',
        photo_location: 'loc',
        about_cta_links: null,
      },
      {
        locale: 'en',
        headline: 'Hello',
        subtitle: null,
        about_md: null,
        photo_caption: null,
        photo_location: null,
        about_cta_links: null,
      },
    ]
    const result = await getAuthorAboutTranslations('author-1')
    expect(result['pt-BR']).toBeTruthy()
    expect(result['pt-BR']!.headline).toBe('Olá')
    expect(result['pt-BR']!.aboutMd).toBe('# md')
    expect(result['en']).toBeTruthy()
    expect(result['en']!.headline).toBe('Hello')
    expect(result['en']!.aboutMd).toBeNull()
  })

  it('maps snake_case DB columns to camelCase', async () => {
    translationRows = [
      {
        locale: 'pt-BR',
        headline: 'Test',
        subtitle: null,
        about_md: '# content',
        photo_caption: 'my caption',
        photo_location: 'my location',
        about_cta_links: { kicker: 'k', signature: 's', links: [] },
      },
    ]
    const result = await getAuthorAboutTranslations('author-1')
    const tx = result['pt-BR']!
    expect(tx.aboutMd).toBe('# content')
    expect(tx.photoCaption).toBe('my caption')
    expect(tx.photoLocation).toBe('my location')
    expect(tx.aboutCtaLinks).toEqual({ kicker: 'k', signature: 's', links: [] })
  })
})
