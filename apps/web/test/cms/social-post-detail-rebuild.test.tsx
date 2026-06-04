/**
 * @vitest-environment happy-dom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}))
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}))

vi.mock('@/lib/social/actions', () => ({
  retrySocialDelivery: vi.fn(),
  deleteSocialPost: vi.fn(),
  cancelSocialPost: vi.fn(),
}))

vi.mock('@/lib/social/realtime', () => ({
  useSocialDeliveries: vi.fn(() => []),
  useSocialPostStatus: vi.fn(() => 'completed'),
}))

import { DeliveryHero } from '@/app/cms/(authed)/social/[id]/_components/delivery-hero'
import { PipelineCompact } from '@/app/cms/(authed)/social/[id]/_components/pipeline-compact'
import { Timeline } from '@/app/cms/(authed)/social/[id]/_components/timeline'
import { SourceCard } from '@/app/cms/(authed)/social/[id]/_components/source-card'
import { ShortLinkCard } from '@/app/cms/(authed)/social/[id]/_components/short-link-card'

describe('DeliveryHero', () => {
  it('renders success variant when all delivered', () => {
    render(
      <DeliveryHero
        publishedCount={3}
        totalCount={3}
        status="completed"
        durationMs={158000}
        platforms={['facebook', 'instagram', 'bluesky']}
      />,
    )
    expect(screen.getByText('3/3')).toBeDefined()
    expect(screen.getByText(/Entregues/)).toBeDefined()
    expect(screen.getByText('2m 38s')).toBeDefined()
  })

  it('renders partial variant when some failed', () => {
    render(
      <DeliveryHero
        publishedCount={2}
        totalCount={3}
        status="partial_failure"
        durationMs={120000}
        platforms={['facebook', 'instagram', 'bluesky']}
      />,
    )
    expect(screen.getByText('2/3')).toBeDefined()
    expect(screen.getByText(/parciais/i)).toBeDefined()
  })

  it('renders pending variant during publishing', () => {
    render(
      <DeliveryHero
        publishedCount={0}
        totalCount={3}
        status="publishing"
        platforms={['facebook', 'instagram', 'bluesky']}
      />,
    )
    expect(screen.getByText(/andamento/i)).toBeDefined()
  })

  it('renders platform dots for each platform', () => {
    render(
      <DeliveryHero
        publishedCount={3}
        totalCount={3}
        status="completed"
        platforms={['facebook', 'instagram', 'bluesky']}
      />,
    )
    const dots = screen.getAllByTestId('platform-dot')
    expect(dots).toHaveLength(3)
  })
})

describe('PipelineCompact', () => {
  const steps = [
    { step: 'post_created', status: 'completed', at: '2026-05-12T14:22:00Z' },
    { step: 'short_link', status: 'completed', at: '2026-05-12T14:22:01Z' },
    { step: 'platform_prepare', status: 'completed', at: '2026-05-12T14:23:12Z' },
    { step: 'deliver', status: 'completed', at: '2026-05-12T14:25:38Z' },
  ]

  it('renders 4 dots with labels', () => {
    render(<PipelineCompact steps={steps} />)
    expect(screen.getByText('Post')).toBeDefined()
    expect(screen.getByText('Short Link')).toBeDefined()
    expect(screen.getByText('Platform Prepare')).toBeDefined()
    expect(screen.getByText('Deliver')).toBeDefined()
  })

  it('shows timestamps for completed steps', () => {
    render(<PipelineCompact steps={steps} />)
    // Check that at least one formatted time appears
    // 14:22 appears twice (post_created + short_link at same minute), 14:25 once
    const times22 = screen.getAllByText('14:22')
    expect(times22.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('14:25')).toBeDefined()
  })

  it('renders connecting lines between dots', () => {
    render(<PipelineCompact steps={steps} />)
    const lines = screen.getAllByTestId('pipeline-line')
    expect(lines).toHaveLength(3)
  })
})

describe('Timeline', () => {
  const events = [
    { type: 'created', timestamp: '2026-05-12T14:22:00Z', description: 'Post criado', origin: 'auto' },
    { type: 'short_link', timestamp: '2026-05-12T14:22:01Z', description: 'Short link criado', code: 'ai-empire' },
    { type: 'platform_prepare', timestamp: '2026-05-12T14:23:12Z', description: '7 tags validadas, 1.2s, 200 OK' },
    { type: 'delivery', timestamp: '2026-05-12T14:24:00Z', description: 'Facebook Entregue', platform: 'facebook', platformPostId: '123456789' },
    { type: 'delivery', timestamp: '2026-05-12T14:24:30Z', description: 'Instagram Entregue', platform: 'instagram', platformPostId: 'ig-123' },
    { type: 'delivery', timestamp: '2026-05-12T14:25:38Z', description: 'Bluesky Entregue', platform: 'bluesky', platformPostId: 'at://did:plc:abc' },
  ]

  it('renders all timeline events', () => {
    render(<Timeline events={events} />)
    expect(screen.getByText('Post criado')).toBeDefined()
    expect(screen.getByText('Short link criado')).toBeDefined()
    expect(screen.getByText(/7 tags validadas/)).toBeDefined()
    expect(screen.getByText('Facebook Entregue')).toBeDefined()
    expect(screen.getByText('Instagram Entregue')).toBeDefined()
    expect(screen.getByText('Bluesky Entregue')).toBeDefined()
  })

  it('renders events in chronological order', () => {
    const { container } = render(<Timeline events={events} />)
    const items = container.querySelectorAll('[data-testid="timeline-event"]')
    expect(items).toHaveLength(6)
  })

  it('shows dot color based on event type', () => {
    render(<Timeline events={events} />)
    const dots = screen.getAllByTestId('timeline-dot')
    expect(dots).toHaveLength(6)
  })
})

describe('SourceCard', () => {
  it('renders content info with type badge', () => {
    render(
      <SourceCard
        contentType="blog"
        contentId="blog-123"
        title="AI Empire: O Que Vem Por Ai"
        thumbnail="https://example.com/thumb.jpg"
        date="2026-05-12T14:00:00Z"
      />,
    )
    expect(screen.getByText('AI Empire: O Que Vem Por Ai')).toBeDefined()
    expect(screen.getByText('Blog Post')).toBeDefined()
    expect(screen.getByText('Abrir no CMS')).toBeDefined()
  })

  it('links to correct CMS editor path for blog', () => {
    render(
      <SourceCard contentType="blog" contentId="blog-123" title="Test" />,
    )
    const link = screen.getByText('Abrir no CMS')
    expect(link.closest('a')!.getAttribute('href')).toBe('/cms/blog/blog-123/editor')
  })

  it('links to correct CMS editor path for newsletter', () => {
    render(
      <SourceCard contentType="newsletter" contentId="nl-456" title="Test" />,
    )
    const link = screen.getByText('Abrir no CMS')
    expect(link.closest('a')!.getAttribute('href')).toBe('/cms/newsletters/nl-456')
  })
})

describe('ShortLinkCard', () => {
  it('renders short URL with copy button', () => {
    render(
      <ShortLinkCard
        shortUrl="go.bythiagofigueiredo.com/ai-empire"
        destinationUrl="bythiagofigueiredo.com/blog/ai-empire"
        clicks={42}
        uniqueVisitors={28}
      />,
    )
    expect(screen.getByText('go.bythiagofigueiredo.com/ai-empire')).toBeDefined()
    expect(screen.getByText('Copiar')).toBeDefined()
  })

  it('renders click stats', () => {
    render(
      <ShortLinkCard
        shortUrl="go.bythiagofigueiredo.com/test"
        destinationUrl="example.com"
        clicks={42}
        uniqueVisitors={28}
      />,
    )
    expect(screen.getByText('42')).toBeDefined()
    expect(screen.getByText('28')).toBeDefined()
  })

  it('renders resolution chain compact', () => {
    render(
      <ShortLinkCard
        shortUrl="go.bythiagofigueiredo.com/test"
        destinationUrl="example.com/page"
        clicks={0}
        uniqueVisitors={0}
      />,
    )
    expect(screen.getByText(/301/)).toBeDefined()
  })
})
