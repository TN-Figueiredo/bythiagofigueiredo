import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

vi.mock('../../lib/cms/repositories', () => ({
  postRepo: () => ({
    getBySlug: vi.fn().mockResolvedValue({
      id: 'p1',
      site_id: 's1',
      author_id: 'a1',
      status: 'published',
      published_at: '2026-01-01',
      scheduled_for: null,
      cover_image_url: null,
      created_at: '',
      updated_at: '',
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
          created_at: '',
          updated_at: '',
        },
      ],
    }),
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

import BlogDetailPage from '../../src/app/blog/[locale]/[slug]/page'

describe('BlogDetailPage', () => {
  it('renders title + TOC + reading time', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Hello')
    expect(container.querySelector('aside[aria-label="Sumário"]')).toBeTruthy()
    expect(container.textContent).toContain('1 min de leitura')
  })

  it('calls notFound when post missing', async () => {
    // Re-mock getBySlug to return null
    vi.doMock('../../lib/cms/repositories', () => ({
      postRepo: () => ({ getBySlug: vi.fn().mockResolvedValue(null) }),
    }))
    vi.resetModules()
    const { default: Page } = await import('../../src/app/blog/[locale]/[slug]/page')
    await expect(
      Page({ params: Promise.resolve({ locale: 'pt-BR', slug: 'missing' }) })
    ).rejects.toThrow() // notFound() throws NEXT_NOT_FOUND
  })
})
