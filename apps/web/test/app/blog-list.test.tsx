import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR', primaryDomain: 'example.com' }),
  tryGetSiteContext: () =>
    Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR', primaryDomain: 'example.com' }),
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

// BlogArchiveClient is a 'use client' component using useRouter/useSearchParams.
// Stub it to avoid Next.js app router invariant errors in unit tests.
vi.mock('../../src/app/(public)/blog/blog-archive-client', () => ({
  BlogArchiveClient: ({ posts, categories, tags, locale }: {
    posts: Array<{ id: string; title: string; readingTime: number }>
    categories: Array<{ key: string; label: string; count: number }>
    tags: Array<{ tag: string; count: number }>
    locale: string
  }) => (
    <div data-testid="blog-archive-client">
      <span data-testid="locale">{locale}</span>
      <span data-testid="post-count">{posts.length}</span>
      {posts.map((p) => (
        <div key={p.id} data-testid={`post-${p.id}`}>
          {p.title} — {p.readingTime} min
        </div>
      ))}
      {categories.map((c) => (
        <span key={c.key} data-testid={`cat-${c.key}`}>{c.label} ({c.count})</span>
      ))}
      {tags.map((t) => (
        <span key={t.tag} data-testid={`tag-${t.tag}`}>{t.tag} ({t.count})</span>
      ))}
    </div>
  ),
}))

// Mock getSupabaseServiceClient — the blog page queries blog_translations with
// a join on blog_posts + blog_tags.
const mockRows = vi.fn<() => Record<string, unknown>[]>().mockReturnValue([
  {
    slug: 'hello',
    title: 'Hello',
    excerpt: 'Oi',
    reading_time_min: 2,
    cover_image_url: null,
    blog_posts: {
      id: 'p1',
      published_at: '2026-01-01T00:00:00Z',
      category: 'code',
      tag_id: 't1',
      blog_tags: { name: 'nextjs', color: '#000000', color_dark: '#333333' },
    },
  },
])

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        lte: () => chain,
        not: () => chain,
        order: () => chain,
      }
      chain['then'] = (resolve: (v: unknown) => void) =>
        resolve({ data: mockRows(), error: null })
      return chain
    },
  }),
}))

import BlogPage from '../../src/app/(public)/blog/page'

describe('BlogPage', () => {
  it('renders post titles + reading time via BlogArchiveClient', async () => {
    const jsx = await BlogPage()
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Hello')
    expect(container.textContent).toContain('2 min')
  })

  it('falls back to mock data when DB returns empty', async () => {
    mockRows.mockReturnValue([])
    const jsx = await BlogPage()
    const { container } = render(jsx as never)
    // Should render mock posts (18 items from MOCK_POSTS)
    expect(container.textContent).toContain('Manifesto')
  })
})
