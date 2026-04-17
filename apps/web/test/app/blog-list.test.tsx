import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
  tryGetSiteContext: () =>
    Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

// Sprint 5b PR-C C.4: blog list now resolves SEO config via the SEO factory
// to emit BreadcrumbList JSON-LD + factory-driven generateMetadata. Stub the
// config getter so unit tests don't need a live DB.
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
    twitterHandle: null,
    defaultOgImageUrl: null,
    contentPaths: { blog: '/blog', campaigns: '/campaigns' },
    personIdentity: null,
    orgIdentity: null,
  }),
}))

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Map([['host', 'example.com']])),
  cookies: () => Promise.resolve({ get: () => undefined }),
}))

vi.mock('../../lib/cms/repositories', () => ({
  postRepo: () => ({
    list: vi.fn().mockResolvedValue([
      {
        id: 'p1',
        status: 'published',
        published_at: '2026-01-01',
        cover_image_url: null,
        translation: { locale: 'pt-BR', title: 'Hello', slug: 'hello', excerpt: 'Oi', reading_time_min: 2 },
        available_locales: ['pt-BR'],
      },
    ]),
  }),
}))

import BlogListPage from '../../src/app/blog/[locale]/page'

describe('BlogListPage', () => {
  it('renders post titles + reading time', async () => {
    const jsx = await BlogListPage({
      params: Promise.resolve({ locale: 'pt-BR' }),
      searchParams: Promise.resolve({}),
    })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Hello')
    expect(container.textContent).toContain('2 min')
  })

  it('shows empty state when no posts', async () => {
    vi.doMock('../../lib/cms/repositories', () => ({
      postRepo: () => ({ list: vi.fn().mockResolvedValue([]) }),
    }))
    // Force re-import with new mock
    vi.resetModules()
    const { default: Page } = await import('../../src/app/blog/[locale]/page')
    const jsx = await Page({ params: Promise.resolve({ locale: 'pt-BR' }), searchParams: Promise.resolve({}) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Nenhum post')
  })
})
