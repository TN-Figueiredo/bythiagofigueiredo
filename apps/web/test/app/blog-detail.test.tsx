import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
  tryGetSiteContext: () =>
    Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

// Sprint 5b PR-C C.4: page now resolves SEO config via the SEO factory,
// which talks to Supabase. Stub it with a fixed config so unit tests don't
// need a live DB. The shape mirrors SiteSeoConfig.
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
  headers: () => Promise.resolve(new Map([['host', 'example.com']])),
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

vi.mock('../../lib/blog/related-posts', () => ({
  getRelatedPosts: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../lib/blog/adjacent-posts', () => ({
  getAdjacentPosts: vi.fn().mockResolvedValue({ prev: null, next: null }),
}))

import BlogDetailPage, { generateMetadata } from '../../src/app/(public)/blog/[locale]/[slug]/page'

describe('BlogDetailPage', () => {
  it('renders title + TOC + reading time', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Hello')
    expect(container.textContent).toContain('1 min leitura')
  })

  it('hides LocaleSwitcher when only one translation exists', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }) })
    const { container } = render(jsx as never)
    expect(container.querySelector('[data-testid="locale-switcher"]')).toBeNull()
  })

  it('renders new 3-column layout with author row and TOC label', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Thiago Figueiredo')
    expect(container.textContent).toContain('NESTE TEXTO')
    expect(container.textContent).toContain('voltar ao arquivo')
  })

  it('renders author card in footer', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('SOBRE QUEM ESCREVEU')
    expect(container.textContent).toContain('Construo software')
  })

  it('renders comments section with mock data', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Conversa')
    expect(container.textContent).toContain('Paula Reis')
    expect(container.textContent).toContain('RESPOSTA DO AUTOR')
  })

  it('renders newsletter CTA', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('NEWSLETTER')
    expect(container.querySelector('input[type="email"]')).toBeTruthy()
  })

  it('calls notFound when post missing', async () => {
    vi.doMock('../../lib/cms/repositories', () => ({
      postRepo: () => ({
        getBySlug: vi.fn().mockResolvedValue(null),
        getById: vi.fn().mockResolvedValue(null),
      }),
    }))
    vi.resetModules()
    const { default: Page } = await import('../../src/app/(public)/blog/[locale]/[slug]/page')
    await expect(
      Page({ params: Promise.resolve({ locale: 'pt-BR', slug: 'missing' }) })
    ).rejects.toThrow() // notFound() throws NEXT_NOT_FOUND
  })
})

describe('BlogDetailPage generateMetadata', () => {
  it('emits hreflang alternates for all translations + x-default', async () => {
    vi.doMock('../../lib/cms/repositories', () => ({
      postRepo: () => ({
        getBySlug: vi.fn().mockResolvedValue(multiLocalePost),
        getById: vi.fn().mockResolvedValue(multiLocalePost),
      }),
    }))
    vi.resetModules()
    const { generateMetadata: gen } = await import('../../src/app/(public)/blog/[locale]/[slug]/page')
    const meta = await gen({ params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }) })
    expect(meta.alternates?.canonical).toBe('/blog/pt-BR/hello')
    expect(meta.alternates?.languages).toEqual({
      'pt-BR': '/blog/pt-BR/hello',
      en: '/blog/en/hello-en',
      'x-default': '/blog/pt-BR/hello',
    })
  })

  it('returns empty object when site context missing', async () => {
    vi.doMock('../../lib/cms/site-context', () => ({
      getSiteContext: () => Promise.reject(new Error('no site')),
      tryGetSiteContext: () => Promise.resolve(null),
    }))
    vi.resetModules()
    const { generateMetadata: gen } = await import('../../src/app/(public)/blog/[locale]/[slug]/page')
    const meta = await gen({ params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }) })
    expect(meta).toEqual({})
  })
})

// Keep a reference so the `generateMetadata` import is not tree-shaken in
// environments that are strict about unused imports.
void generateMetadata
