import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR', primaryDomain: 'example.com' }),
  tryGetSiteContext: () =>
    Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR', primaryDomain: 'example.com' }),
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
  headers: () => Promise.resolve(new Map([['host', 'example.com'], ['x-locale', 'pt-BR']])),
  cookies: () => Promise.resolve({ get: () => undefined }),
}))

// CategoryFilter is a 'use client' component using useRouter/usePathname/useSearchParams.
// Stub it to avoid Next.js app router invariant errors in unit tests.
vi.mock('../../src/app/(public)/blog/category-filter', () => ({
  CategoryFilter: ({ categories, allLabel }: { categories: string[]; allLabel: string }) => (
    <div data-testid="category-filter">{allLabel} | {categories.join(', ')}</div>
  ),
}))

// Mock getSupabaseServiceClient — the blog list page queries Supabase directly
// (not via postRepo) to include the `category` column for filtering.
function createSupabaseMock(rows: Record<string, unknown>[] = [], catRows: Record<string, unknown>[] = []) {
  let callIndex = 0
  return {
    getSupabaseServiceClient: () => {
      callIndex = 0 // reset per call to getSupabaseServiceClient
      return {
        from: () => {
          const currentCall = callIndex++
          // First call is for categories (unfiltered), second is for posts
          const isCategories = currentCall === 0
          const chain: Record<string, unknown> = {
            select: () => chain,
            eq: () => chain,
            lte: () => chain,
            not: () => chain,
            ilike: () => chain,
            order: () => chain,
            range: () => chain,
          }
          // Make the chain thenable so `await` resolves
          if (isCategories) {
            chain['then'] = (resolve: (v: unknown) => void) =>
              resolve({ data: catRows, error: null })
          } else {
            chain['then'] = (resolve: (v: unknown) => void) =>
              resolve({ data: rows, count: rows.length, error: null })
          }
          return chain
        },
      }
    },
  }
}

vi.mock('../../lib/supabase/service', () =>
  createSupabaseMock(
    [
      {
        slug: 'hello',
        locale: 'pt-BR',
        title: 'Hello',
        excerpt: 'Oi',
        reading_time_min: 2,
        blog_posts: {
          id: 'p1',
          published_at: '2026-01-01',
          cover_image_url: null,
          category: 'tech',
          status: 'published',
          site_id: 's1',
        },
      },
    ],
    [{ category: 'tech' }],
  ),
)

import BlogListPage from '../../src/app/(public)/blog/page'

describe('BlogListPage', () => {
  it('renders post titles + reading time', async () => {
    const jsx = await BlogListPage({
      searchParams: Promise.resolve({}),
    })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Hello')
    expect(container.textContent).toContain('2 min')
  })

  it('shows empty state when no posts', async () => {
    vi.doMock('../../lib/supabase/service', () => createSupabaseMock([], []))
    // Force re-import with new mock
    vi.resetModules()
    const { default: Page } = await import('../../src/app/(public)/blog/page')
    const jsx = await Page({ searchParams: Promise.resolve({}) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Nenhum post')
  })
})
