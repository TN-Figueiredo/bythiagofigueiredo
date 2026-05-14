/**
 * @vitest-environment happy-dom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() })),
}))
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}))

import { SocialSummaryBar } from '../../src/app/cms/(authed)/links/_components/social-summary-bar'
import { SourceBreakdownChart } from '../../src/app/cms/(authed)/links/_components/source-breakdown'

describe('SocialSummaryBar', () => {
  it('renders auto-created links count', () => {
    render(
      <SocialSummaryBar
        autoLinksCount={12}
        ogValidated={true}
        platformCounts={{ facebook: 10, instagram: 8, bluesky: 6 }}
      />,
    )
    expect(screen.getByText(/12 links criados automaticamente/)).toBeDefined()
  })

  it('renders OG validated badge when all valid', () => {
    render(
      <SocialSummaryBar
        autoLinksCount={5}
        ogValidated={true}
        platformCounts={{ facebook: 5, instagram: 3, bluesky: 4 }}
      />,
    )
    expect(screen.getByText(/OG validado/)).toBeDefined()
  })

  it('renders platform breakdown counts', () => {
    render(
      <SocialSummaryBar
        autoLinksCount={10}
        ogValidated={true}
        platformCounts={{ facebook: 10, instagram: 8, bluesky: 6 }}
      />,
    )
    expect(screen.getByText('FB 10')).toBeDefined()
    expect(screen.getByText('IG 8')).toBeDefined()
    expect(screen.getByText('BS 6')).toBeDefined()
  })

  it('renders zero counts for missing platforms', () => {
    render(
      <SocialSummaryBar
        autoLinksCount={3}
        ogValidated={false}
        platformCounts={{ facebook: 3 }}
      />,
    )
    expect(screen.getByText('FB 3')).toBeDefined()
    expect(screen.getByText('IG 0')).toBeDefined()
    expect(screen.getByText('BS 0')).toBeDefined()
  })
})

describe('SourceBreakdownChart', () => {
  const data = [
    { source: 'blog', clicks: 120 },
    { source: 'social', clicks: 85 },
    { source: 'newsletter', clicks: 45 },
    { source: 'campaign', clicks: 30 },
    { source: 'manual', clicks: 15 },
    { source: 'video', clicks: 10 },
  ]

  it('renders bars for each source type', () => {
    render(<SourceBreakdownChart data={data} />)
    expect(screen.getByText('blog')).toBeDefined()
    expect(screen.getByText('social')).toBeDefined()
    expect(screen.getByText('newsletter')).toBeDefined()
    expect(screen.getByText('campaign')).toBeDefined()
    expect(screen.getByText('manual')).toBeDefined()
    expect(screen.getByText('video')).toBeDefined()
  })

  it('renders click counts', () => {
    render(<SourceBreakdownChart data={data} />)
    expect(screen.getByText('120')).toBeDefined()
    expect(screen.getByText('85')).toBeDefined()
  })

  it('renders percentage labels', () => {
    render(<SourceBreakdownChart data={data} />)
    const total = 120 + 85 + 45 + 30 + 15 + 10
    const blogPct = Math.round((120 / total) * 100)
    expect(screen.getByText(`${blogPct}%`)).toBeDefined()
  })
})
