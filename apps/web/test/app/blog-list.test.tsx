import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
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
