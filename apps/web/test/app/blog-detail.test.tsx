import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
  tryGetSiteContext: () =>
    Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

vi.mock('../../lib/seo/config', () => ({
  getSiteSeoConfig: vi.fn().mockResolvedValue({
    siteId: 's1',
    siteName: 'Example',
    siteUrl: 'https://example.com',
    defaultLocale: 'pt-BR',
    supportedLocales: ['pt-BR', 'en'],
    identityType: 'person',
    primaryColor: '#0F172A',
    logoUrl: null,
    twitterHandle: 'tnFigueiredo',
    defaultOgImageUrl: null,
    contentPaths: { blog: '/blog', campaigns: '/campaigns' },
    personIdentity: {
      type: 'person',
      name: 'Thiago',
      jobTitle: 'Creator',
      imageUrl: 'https://example.com/p.jpg',
      sameAs: [],
    },
    orgIdentity: null,
  }),
}))

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Map([['host', 'example.com'], ['x-locale', 'pt-BR']])),
  cookies: () => Promise.resolve({ get: () => undefined }),
}))

const samplePost = {
  id: 'p1',
  site_id: 's1',
  author_id: 'a1',
  status: 'published',
  published_at: '2026-01-01T00:00:00Z',
  scheduled_for: null,
  cover_image_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  translations: [
    {
      id: 't1',
      post_id: 'p1',
      locale: 'pt-BR',
      title: 'Hello',
      slug: 'hello',
      excerpt: 'Oi',
      content_mdx: '# Hello',
      content_compiled: null,
      content_toc: [{ depth: 1, text: 'Hello', slug: 'hello' }],
      reading_time_min: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ],
}

const multiLocalePost = {
  ...samplePost,
  translations: [
    samplePost.translations[0],
    {
      id: 't2',
      post_id: 'p1',
      locale: 'en',
      title: 'Hello (en)',
      slug: 'hello-en',
      excerpt: 'Hi',
      content_mdx: '# Hi',
      content_compiled: null,
      content_toc: [],
      reading_time_min: 1,
      created_at: '',
      updated_at: '',
    },
  ],
}

vi.mock('../../lib/cms/repositories', () => ({
  postRepo: () => ({
    getBySlug: vi.fn().mockResolvedValue(samplePost),
    getById: vi.fn().mockResolvedValue(samplePost),
  }),
}))

vi.mock('@tn-figueiredo/cms', async () => {
  const actual = await vi.importActual<object>('@tn-figueiredo/cms')
  return {
    ...actual,
    compileMdx: vi.fn().mockResolvedValue({ compiledSource: '() => null', toc: [], readingTimeMin: 1 }),
    MdxRunner: () => null,
  }
})

vi.mock('../../lib/cms/registry', () => ({ blogRegistry: {} }))

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { category: 'vida' }, error: null }),
        }),
      }),
    }),
  }),
}))

vi.mock('../../lib/blog/related-posts', () => ({
  getRelatedPosts: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../lib/blog/adjacent-posts', () => ({
  getAdjacentPosts: vi.fn().mockResolvedValue({ prev: null, next: null }),
}))

vi.mock('../../src/lib/ads/resolve', () => ({
  loadAdCreatives: vi.fn().mockResolvedValue({
    inline_end: {
      campaignId: 'mock-nl',
      slotKey: 'inline_end',
      type: 'house',
      source: 'campaign',
      interaction: 'form',
      title: 'Newsletter: Receba o próximo ensaio',
      body: 'Uma carta a cada 15 dias.',
      ctaText: 'Assinar →',
      ctaUrl: '/newsletter',
      imageUrl: null,
      logoUrl: null,
      brandColor: '#7B5BF7',
      dismissSeconds: 0,
    },
  }),
}))

import BlogDetailPage, { generateMetadata } from '../../src/app/(public)/blog/[slug]/page'

describe('BlogDetailPage', () => {
  it('renders title + TOC + reading time', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ slug: 'hello' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Hello')
    expect(container.textContent).toContain('1 min leitura')
  })

  it('hides LocaleSwitcher when only one translation exists', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ slug: 'hello' }) })
    const { container } = render(jsx as never)
    expect(container.querySelector('[data-testid="locale-switcher"]')).toBeNull()
  })

  it('renders new 3-column layout with author row and TOC label', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ slug: 'hello' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Thiago Figueiredo')
    expect(container.textContent).toContain('NESTE TEXTO')
    expect(container.textContent).toContain('voltar ao arquivo')
  })

  it('renders author card in footer', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ slug: 'hello' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Sobre quem escreveu')
    expect(container.textContent).toContain('Construo software')
  })

  it('renders comments section with mock data', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ slug: 'hello' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Conversa')
    expect(container.textContent).toContain('Paula Reis')
    expect(container.textContent).toContain('resposta do autor')
  })

  it('calls notFound when post missing', async () => {
    vi.doMock('../../lib/cms/repositories', () => ({
      postRepo: () => ({
        getBySlug: vi.fn().mockResolvedValue(null),
        getById: vi.fn().mockResolvedValue(null),
      }),
    }))
    vi.resetModules()
    const { default: Page } = await import('../../src/app/(public)/blog/[slug]/page')
    await expect(
      Page({ params: Promise.resolve({ slug: 'missing' }) })
    ).rejects.toThrow()
  })
})

describe('BlogDetailPage generateMetadata', () => {
  it('emits hreflang alternates for all translations + x-default', async () => {
    vi.doMock('../../lib/blog/load-post', () => ({
      loadPostWithLocales: vi.fn().mockResolvedValue({
        post: multiLocalePost,
        translations: multiLocalePost.translations,
        full: multiLocalePost,
        extrasByLocale: new Map(),
      }),
      toTranslationInputs: vi.fn((_cover: unknown, txs: Array<{ locale: string; slug: string; title: string; excerpt: string | null }>, _extras: unknown) =>
        txs.map((t) => ({ locale: t.locale, slug: t.slug, title: t.title, excerpt: t.excerpt, cover_image_url: null, seo_extras: null })),
      ),
    }))
    vi.resetModules()
    const { generateMetadata: gen } = await import('../../src/app/(public)/blog/[slug]/page')
    const meta = await gen({ params: Promise.resolve({ slug: 'hello' }) })
    expect(meta.alternates?.canonical).toBe('/pt/blog/hello')
    expect(meta.alternates?.languages).toEqual({
      pt: '/pt/blog/hello',
      en: '/blog/hello-en',
      'x-default': '/pt/blog/hello',
    })
  })

  it('returns empty object when site context missing', async () => {
    vi.doMock('../../lib/cms/site-context', () => ({
      getSiteContext: () => Promise.reject(new Error('no site')),
      tryGetSiteContext: () => Promise.resolve(null),
    }))
    vi.resetModules()
    const { generateMetadata: gen } = await import('../../src/app/(public)/blog/[slug]/page')
    const meta = await gen({ params: Promise.resolve({ slug: 'hello' }) })
    expect(meta).toEqual({})
  })
})

void generateMetadata
