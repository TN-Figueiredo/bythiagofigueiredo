/**
 * @vitest-environment happy-dom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}))
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}))

const mockScrapeOgTags = vi.fn().mockResolvedValue({ ok: true, data: {} })
vi.mock('@/lib/social/actions', () => ({
  scrapeOgTags: (...args: unknown[]) => mockScrapeOgTags(...args),
}))

import { OgValidation } from '@/app/cms/(authed)/social/[id]/_components/og-validation'
import { UrlChain } from '@/app/cms/(authed)/social/[id]/_components/url-chain'
import { ScrapeDetails } from '@/app/cms/(authed)/social/[id]/_components/scrape-details'
import { RawResponse } from '@/app/cms/(authed)/social/[id]/_components/raw-response'

const mockOgResult = {
  success: true,
  tags: {
    title: 'AI Empire: O Que Vem Por Ai',
    description: 'O futuro da inteligencia artificial...',
    image: 'https://example.com/og-image.jpg',
    url: 'https://bythiagofigueiredo.com/blog/ai-empire',
    type: 'article',
    site_name: 'By Thiago Figueiredo',
    locale: 'pt_BR',
  },
  scrape: {
    status: 200,
    latency_ms: 1200,
    timestamp: '2026-05-12T14:23:12Z',
    raw_response: { og_object: { title: 'AI Empire' } },
  },
  validation: {
    passed: 6,
    failed: 0,
    items: [
      { key: 'og:title', status: 'ok' as const, message: 'Present, 28 chars' },
      { key: 'og:description', status: 'ok' as const, message: 'Present, 40 chars' },
      { key: 'og:image', status: 'ok' as const, message: 'Accessible, 1200x630' },
      { key: 'og:url', status: 'ok' as const, message: 'Resolves to 200 OK' },
      { key: 'og:type', status: 'ok' as const, message: 'article' },
      { key: 'og:site_name', status: 'ok' as const, message: 'Present' },
      { key: 'ig:story', status: 'na' as const, message: 'Story nao usa OG tags' },
    ],
  },
}

describe('OgValidation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders success hero when all checks pass', () => {
    render(<OgValidation result={mockOgResult} postId="p1" />)
    expect(screen.getByText(/validadas com sucesso/i)).toBeDefined()
  })

  it('renders all 7 checklist items', () => {
    render(<OgValidation result={mockOgResult} postId="p1" />)
    expect(screen.getByText('og:title')).toBeDefined()
    expect(screen.getByText('og:description')).toBeDefined()
    expect(screen.getByText('og:image')).toBeDefined()
    expect(screen.getByText('og:url')).toBeDefined()
    expect(screen.getByText('og:type')).toBeDefined()
    expect(screen.getByText('og:site_name')).toBeDefined()
    expect(screen.getByText('ig:story')).toBeDefined()
  })

  it('shows N/A badge for IG Story item', () => {
    render(<OgValidation result={mockOgResult} postId="p1" />)
    expect(screen.getByText('N/A')).toBeDefined()
  })

  it('renders re-scrape button', () => {
    render(<OgValidation result={mockOgResult} postId="p1" />)
    expect(screen.getByText('Re-scrape')).toBeDefined()
  })

  it('calls scrapeOgTags on re-scrape click', () => {
    render(<OgValidation result={mockOgResult} postId="p1" />)
    fireEvent.click(screen.getByText('Re-scrape'))
    expect(mockScrapeOgTags).toHaveBeenCalledWith('p1')
  })

  it('renders error hero when validation fails', () => {
    const failedResult = {
      ...mockOgResult,
      success: false,
      validation: { ...mockOgResult.validation, failed: 2, passed: 4 },
    }
    render(<OgValidation result={failedResult} postId="p1" />)
    expect(screen.getByText(/Falha na validacao/i)).toBeDefined()
  })

  it('renders Facebook Debugger external link', () => {
    render(<OgValidation result={mockOgResult} postId="p1" />)
    const link = screen.getByText(/Facebook Debugger/)
    expect(link.closest('a')!.getAttribute('href')).toContain('developers.facebook.com/tools/debug')
  })
})

describe('UrlChain', () => {
  it('renders short URL, status 301, destination URL, and status 200', () => {
    render(
      <UrlChain
        shortUrl="go.bythiagofigueiredo.com/ai-empire"
        destinationUrl="bythiagofigueiredo.com/blog/ai-empire"
      />,
    )
    expect(screen.getByText('go.bythiagofigueiredo.com/ai-empire')).toBeDefined()
    expect(screen.getByText('301')).toBeDefined()
    expect(screen.getByText('bythiagofigueiredo.com/blog/ai-empire')).toBeDefined()
    expect(screen.getByText('200')).toBeDefined()
  })
})

describe('ScrapeDetails', () => {
  it('renders endpoint, status, latency, and timestamp', () => {
    render(
      <ScrapeDetails
        endpoint="POST graph.facebook.com/?id=..."
        status={200}
        latencyMs={1200}
        timestamp="2026-05-12T14:23:12Z"
      />,
    )
    expect(screen.getByText(/graph.facebook.com/)).toBeDefined()
    expect(screen.getByText('200 OK')).toBeDefined()
    expect(screen.getByText('1.2s')).toBeDefined()
  })

  it('renders 4 pipeline dots', () => {
    render(
      <ScrapeDetails
        endpoint=""
        status={200}
        latencyMs={0}
        timestamp=""
        pipelineSteps={[
          { step: 'post_created', status: 'completed' },
          { step: 'short_link', status: 'completed' },
          { step: 'platform_prepare', status: 'completed' },
          { step: 'deliver', status: 'pending' },
        ]}
      />,
    )
    const dots = screen.getAllByTestId('pipeline-dot')
    expect(dots).toHaveLength(4)
  })
})

describe('RawResponse', () => {
  it('is collapsed by default', () => {
    render(<RawResponse data={{ og_object: { title: 'Test' } }} />)
    expect(screen.queryByTestId('raw-json')).toBeNull()
  })

  it('expands to show JSON on toggle click', () => {
    render(<RawResponse data={{ og_object: { title: 'Test' } }} />)
    fireEvent.click(screen.getByText(/Mostrar resposta raw/))
    expect(screen.getByTestId('raw-json')).toBeDefined()
  })

  it('collapses when toggle clicked again', () => {
    render(<RawResponse data={{ og_object: { title: 'Test' } }} />)
    fireEvent.click(screen.getByText(/Mostrar resposta raw/))
    expect(screen.getByTestId('raw-json')).toBeDefined()
    fireEvent.click(screen.getByText(/Ocultar/))
    expect(screen.queryByTestId('raw-json')).toBeNull()
  })

  it('renders copy button when expanded', () => {
    render(<RawResponse data={{ test: true }} />)
    fireEvent.click(screen.getByText(/Mostrar resposta raw/))
    expect(screen.getByText('Copiar JSON')).toBeDefined()
  })
})
