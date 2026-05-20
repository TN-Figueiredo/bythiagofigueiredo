// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render } from '@testing-library/react'

beforeAll(() => {
  // sendBeacon is not available in happy-dom; stub it to prevent network errors
  Object.defineProperty(navigator, 'sendBeacon', {
    value: vi.fn(),
    writable: true,
  })
})

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'system' }), getAll: () => [] }),
  headers: async () => ({ get: (k: string) => (k === 'x-site-id' ? 'site-1' : k === 'x-locale' ? 'pt-BR' : null) }),
}))

vi.mock('@/lib/supabase/service', () => {
  const chainable: Record<string, unknown> = {}
  chainable.eq = vi.fn(() => chainable)
  chainable.is = vi.fn(() => chainable)
  chainable.in = vi.fn(() => chainable)
  chainable.order = vi.fn(() => chainable)
  chainable.limit = vi.fn(() => chainable)
  chainable.single = vi.fn(() => Promise.resolve({ data: null, error: null }))
  chainable.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  chainable.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null })
  return {
    getSupabaseServiceClient: vi.fn(() => ({
      from: vi.fn(() => ({ select: vi.fn(() => chainable) })),
    })),
  }
})

// Import components after mocks
import { LinktreeClient } from '../../src/app/go/linktree/_components/linktree-client'
import type { LinktreePageData } from '../../src/app/go/linktree/_lib/types'

const mockData: LinktreePageData = {
  config: {
    highlight: { active: false, badge_pt: '', badge_en: '', title_pt: '', title_en: '', desc_pt: '', desc_en: '', cta_pt: '', cta_en: '', url: '' },
    tagline_pt: 'dev indie · blog · YouTube',
    tagline_en: 'indie dev · blog · YouTube',
    blog_desc_pt: 'Artigos sobre código',
    blog_desc_en: 'Posts on code',
    shared_links: [{ label_pt: 'Sobre', label_en: 'About', url: '/about', icon: 'user' }],
  },
  site: {
    id: 'site-1',
    name: 'byThiagoFigueiredo',
    primaryDomain: 'bythiagofigueiredo.com',
    logoUrl: null,
    primaryColor: '#FF8240',
    supportedLocales: ['pt-BR', 'en'],
    defaultLocale: 'pt-BR',
  },
  author: { displayName: 'Thiago Figueiredo', avatarUrl: null, bio: null },
  latestPost: {
    title: 'Todos os blocos do CMS',
    slug: 'blocos-cms',
    readingTimeMin: 7,
    publishedAt: '2026-05-06T12:00:00Z',
    tagName: 'Código',
    tagColor: '#D65B1F',
    locale: 'pt-BR',
  },
  latestVideo: {
    title: 'Como eu publico com um clique',
    duration: '12:34',
    publishedAt: '2026-05-08T12:00:00Z',
    viewCount: 1200,
    channelHandle: 'bythiagofigueiredo',
    youtubeVideoId: 'abc123',
  },
  socials: [
    { platform: 'youtube', url: 'https://youtube.com/@bythiagofigueiredo', handle: 'bythiagofigueiredo' },
    { platform: 'instagram', url: 'https://instagram.com/bythiagofigueiredo', handle: 'bythiagofigueiredo' },
  ],
  sections: [
    {
      locale: 'pt-BR',
      flag: '🇧🇷',
      label: 'Português',
      hand: 'em português',
      items: [
        { id: 'blog-pt', type: 'blog', label: 'Blog', desc: 'Artigos sobre código', url: 'https://bythiagofigueiredo.com/blog', icon: 'blog' },
      ],
    },
  ],
  sharedLinks: [{ label_pt: 'Sobre', label_en: 'About', url: '/about', icon: 'user' }],
}

describe('LinktreeClient', () => {
  it('renders author name', () => {
    const { getByText } = render(
      <LinktreeClient initialLocale="pt-BR" initialTheme="dark" {...mockData} />,
    )
    expect(getByText('Thiago Figueiredo')).toBeTruthy()
  })

  it('renders tagline in Portuguese', () => {
    const { getAllByText } = render(
      <LinktreeClient initialLocale="pt-BR" initialTheme="dark" {...mockData} />,
    )
    expect(getAllByText('dev indie · blog · YouTube').length).toBeGreaterThan(0)
  })

  it('renders latest post title', () => {
    const { getAllByText } = render(
      <LinktreeClient initialLocale="pt-BR" initialTheme="dark" {...mockData} />,
    )
    expect(getAllByText('Todos os blocos do CMS').length).toBeGreaterThan(0)
  })

  it('hides highlight when inactive', () => {
    const { queryByText } = render(
      <LinktreeClient initialLocale="pt-BR" initialTheme="dark" {...mockData} />,
    )
    expect(queryByText('Em breve')).toBeNull()
  })

  it('renders social bar links with aria-labels', () => {
    const { getByLabelText } = render(
      <LinktreeClient initialLocale="pt-BR" initialTheme="dark" {...mockData} />,
    )
    expect(getByLabelText('youtube: bythiagofigueiredo')).toBeTruthy()
    expect(getByLabelText('instagram: bythiagofigueiredo')).toBeTruthy()
  })

  it('renders shared links section with correct label', () => {
    const { getByText } = render(
      <LinktreeClient initialLocale="pt-BR" initialTheme="dark" {...mockData} />,
    )
    expect(getByText('Sobre')).toBeTruthy()
  })

  it('renders footer with domain', () => {
    const { getByText } = render(
      <LinktreeClient initialLocale="pt-BR" initialTheme="dark" {...mockData} />,
    )
    expect(getByText('go.bythiagofigueiredo.com')).toBeTruthy()
  })

  it('locale EN renders English tagline', () => {
    const { getAllByText } = render(
      <LinktreeClient initialLocale="en" initialTheme="dark" {...mockData} />,
    )
    expect(getAllByText('indie dev · blog · YouTube').length).toBeGreaterThan(0)
  })
})
