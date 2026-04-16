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
        status: 'draft',
        published_at: null,
        cover_image_url: null,
        translation: { locale: 'pt-BR', title: 'Draft X', slug: 'x', excerpt: null, reading_time_min: 1 },
        available_locales: ['pt-BR'],
      },
      {
        id: 'p2',
        status: 'published',
        published_at: '2026-01-01',
        cover_image_url: null,
        translation: { locale: 'pt-BR', title: 'Published Y', slug: 'y', excerpt: null, reading_time_min: 3 },
        available_locales: ['pt-BR', 'en'],
      },
    ]),
  }),
}))

import CmsBlogListPage from '../../src/app/cms/(authed)/blog/page'

describe('CmsBlogListPage', () => {
  it('renders post rows with status labels', async () => {
    const jsx = await CmsBlogListPage({ searchParams: Promise.resolve({}) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Draft X')
    expect(container.textContent).toContain('Published Y')
    expect(container.querySelector('[data-status="draft"]')).toBeTruthy()
    expect(container.querySelector('[data-status="published"]')).toBeTruthy()
  })

  it('has [+ Novo] link to /cms/blog/new', async () => {
    const jsx = await CmsBlogListPage({ searchParams: Promise.resolve({}) })
    const { container } = render(jsx as never)
    const link = container.querySelector('a[href="/cms/blog/new"]')
    expect(link).toBeTruthy()
  })

  it('shows empty state when no posts', async () => {
    vi.doMock('../../lib/cms/repositories', () => ({
      postRepo: () => ({ list: vi.fn().mockResolvedValue([]) }),
    }))
    vi.resetModules()
    const { default: Page } = await import('../../src/app/cms/(authed)/blog/page')
    const jsx = await Page({ searchParams: Promise.resolve({}) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Nenhum post encontrado')
  })
})
