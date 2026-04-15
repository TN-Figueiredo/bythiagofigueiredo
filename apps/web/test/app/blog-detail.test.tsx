import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

const samplePost = {
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

import BlogDetailPage, { generateMetadata } from '../../src/app/blog/[locale]/[slug]/page'

describe('BlogDetailPage', () => {
  it('renders title + TOC + reading time', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Hello')
    expect(container.querySelector('aside[aria-label="Sumário"]')).toBeTruthy()
    expect(container.textContent).toContain('1 min de leitura')
  })

  it('hides LocaleSwitcher when only one translation exists', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }) })
    const { container } = render(jsx as never)
    expect(container.querySelector('[data-testid="locale-switcher"]')).toBeNull()
  })

  it('renders LocaleSwitcher when multiple translations exist', async () => {
    vi.doMock('../../lib/cms/repositories', () => ({
      postRepo: () => ({
        getBySlug: vi.fn().mockResolvedValue(multiLocalePost),
        getById: vi.fn().mockResolvedValue(multiLocalePost),
      }),
    }))
    vi.resetModules()
    const { default: Page } = await import('../../src/app/blog/[locale]/[slug]/page')
    const jsx = await Page({ params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }) })
    const { container } = render(jsx as never)
    const switcher = container.querySelector('[data-testid="locale-switcher"]')
    expect(switcher).toBeTruthy()
    const link = switcher?.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/blog/en/hello-en')
  })

  it('calls notFound when post missing', async () => {
    vi.doMock('../../lib/cms/repositories', () => ({
      postRepo: () => ({
        getBySlug: vi.fn().mockResolvedValue(null),
        getById: vi.fn().mockResolvedValue(null),
      }),
    }))
    vi.resetModules()
    const { default: Page } = await import('../../src/app/blog/[locale]/[slug]/page')
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
    const { generateMetadata: gen } = await import('../../src/app/blog/[locale]/[slug]/page')
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
    }))
    vi.resetModules()
    const { generateMetadata: gen } = await import('../../src/app/blog/[locale]/[slug]/page')
    const meta = await gen({ params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }) })
    expect(meta).toEqual({})
  })
})

// Keep a reference so the `generateMetadata` import is not tree-shaken in
// environments that are strict about unused imports.
void generateMetadata
