import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/cms/social/insights',
}))
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock @tn-figueiredo/social — PROVIDERS is consumed by InsightsHealth
vi.mock('@tn-figueiredo/social', () => ({
  PROVIDERS: ['youtube', 'facebook', 'instagram', 'bluesky'] as const,
}))

// Mock PlatformIcon / platformLabel used by InsightsHealth
vi.mock('@/app/cms/(authed)/_shared/social/platform-icon', () => ({
  PlatformIcon: ({ provider }: { provider: string }) => (
    <span data-testid={`icon-${provider}`}>{provider}</span>
  ),
  platformLabel: (p: string) => p.charAt(0).toUpperCase() + p.slice(1),
}))

// Mock OauthButton used by InsightsHealth for reconnect
vi.mock('@/app/cms/(authed)/social/accounts/_components/oauth-button', () => ({
  OauthButton: ({ label }: { label: string }) => (
    <button type="button">{label}</button>
  ),
}))

import { InsightsBestOf } from '@/app/cms/(authed)/social/insights/_components/insights-best-of'
import { InsightsHealth } from '@/app/cms/(authed)/social/insights/_components/insights-health'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

beforeEach(() => vi.clearAllMocks())

// ── Fixtures ──────────────────────────────────────────────────────────────────
const thumbnails = [
  { id: 't1', label: 'Thumb A', value: 12.5, thumbnailUrl: 'https://img/a.jpg', badge: en.insights.bestOf.winner },
  { id: 't2', label: 'Thumb B', value: 9.1 },
  { id: 't3', label: 'Thumb C', value: 6.0 },
]
const titles = [
  { id: 'ti1', label: 'Title Alpha', value: 14.2, badge: en.insights.bestOf.winner },
  { id: 'ti2', label: 'Title Beta', value: 10.0 },
]
const posts = [
  { id: 'p1', label: 'Post One', value: 320 },
  { id: 'p2', label: 'Post Two', value: 210 },
]

// ── InsightsBestOf ────────────────────────────────────────────────────────────
describe('InsightsBestOf', () => {
  it('renders all 3 podium section headings', () => {
    render(<InsightsBestOf topThumbnails={thumbnails} topTitles={titles} topPosts={posts} strings={en} />)
    expect(screen.getByText(en.insights.bestOf.topThumbnails)).toBeDefined()
    expect(screen.getByText(en.insights.bestOf.topTitles)).toBeDefined()
    expect(screen.getByText(en.insights.bestOf.topPosts)).toBeDefined()
  })

  it('renders winner badges', () => {
    render(<InsightsBestOf topThumbnails={thumbnails} topTitles={titles} topPosts={posts} strings={en} />)
    const winners = screen.getAllByText(en.insights.bestOf.winner)
    expect(winners.length).toBeGreaterThanOrEqual(1)
  })

  it('renders thumbnail images with alt text', () => {
    render(<InsightsBestOf topThumbnails={thumbnails} topTitles={titles} topPosts={posts} strings={en} />)
    const img = screen.getByRole('img', { name: 'Thumb A' }) as HTMLImageElement
    expect(img.src).toContain('a.jpg')
  })

  it('renders item labels inside podiums', () => {
    render(<InsightsBestOf topThumbnails={thumbnails} topTitles={titles} topPosts={posts} strings={en} />)
    expect(screen.getByText('Thumb A')).toBeDefined()
    expect(screen.getByText('Title Alpha')).toBeDefined()
    expect(screen.getByText('Post One')).toBeDefined()
  })

  it('renders item metric values with units', () => {
    render(<InsightsBestOf topThumbnails={thumbnails} topTitles={titles} topPosts={posts} strings={en} />)
    expect(screen.getByText('12.5% CTR')).toBeDefined()
    expect(screen.getByText('320 clicks')).toBeDefined()
  })

  it('shows empty state for all-empty data', () => {
    render(<InsightsBestOf topThumbnails={[]} topTitles={[]} topPosts={[]} strings={en} />)
    const noDataLabels = screen.getAllByText(en.insights.noData)
    expect(noDataLabels).toHaveLength(3)
  })

  it('shows empty state per-podium when only one has no data', () => {
    render(<InsightsBestOf topThumbnails={[]} topTitles={titles} topPosts={posts} strings={en} />)
    const noDataLabels = screen.getAllByText(en.insights.noData)
    expect(noDataLabels).toHaveLength(1)
  })

  it('renders rank numbers starting at 1', () => {
    render(<InsightsBestOf topThumbnails={thumbnails} topTitles={[]} topPosts={[]} strings={en} />)
    expect(screen.getByText('1')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
  })
})

// ── InsightsHealth ────────────────────────────────────────────────────────────

const healthyYT = {
  provider: 'youtube' as const,
  account_name: 'My Channel',
  token_expires_at: '2027-12-31T00:00:00Z',
  revoked_at: null,
}
const expiredFB = {
  provider: 'facebook' as const,
  account_name: 'My Page',
  token_expires_at: '2020-01-01T00:00:00Z',
  revoked_at: null,
}

describe('InsightsHealth', () => {
  it('renders a card for every provider', () => {
    render(<InsightsHealth connections={[]} strings={en} />)
    expect(screen.getByTestId('icon-youtube')).toBeDefined()
    expect(screen.getByTestId('icon-facebook')).toBeDefined()
    expect(screen.getByTestId('icon-instagram')).toBeDefined()
    expect(screen.getByTestId('icon-bluesky')).toBeDefined()
  })

  it('shows healthy status for connected non-expired provider', () => {
    render(<InsightsHealth connections={[healthyYT]} strings={en} />)
    expect(screen.getByText(en.insights.health.healthy)).toBeDefined()
  })

  it('shows expired status for expired token', () => {
    render(<InsightsHealth connections={[expiredFB]} strings={en} />)
    expect(screen.getByText(en.insights.health.expired)).toBeDefined()
  })

  it('shows reconnect button for expired token', () => {
    render(<InsightsHealth connections={[expiredFB]} strings={en} />)
    expect(screen.getByRole('button', { name: en.insights.health.reconnect })).toBeDefined()
  })

  it('shows YouTube quota section when youtube connection exists', () => {
    render(<InsightsHealth connections={[healthyYT]} quotaUsed={40} strings={en} />)
    expect(screen.getByText(en.insights.health.quotaLabel)).toBeDefined()
  })

  it('does NOT show quota section for non-youtube providers', () => {
    render(<InsightsHealth connections={[expiredFB]} strings={en} />)
    expect(screen.queryByText(en.insights.health.quotaLabel)).toBeNull()
  })

  it('shows token expiry days label for healthy soon-to-expire token', () => {
    // Set a token expiring in ~5 days
    const soonExpires = {
      provider: 'instagram' as const,
      account_name: 'My IG',
      token_expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
      revoked_at: null,
    }
    render(<InsightsHealth connections={[soonExpires]} strings={en} />)
    const expiryText = screen.getByText(/Expires in \d+ days/)
    expect(expiryText).toBeDefined()
  })

  it('shows dash status for providers with no connection', () => {
    render(<InsightsHealth connections={[]} strings={en} />)
    const dashes = screen.getAllByText('—')
    // All 4 providers have no connection → all show '—'
    expect(dashes.length).toBe(4)
  })
})
