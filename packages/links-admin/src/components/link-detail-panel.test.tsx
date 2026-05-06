import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LinkDetailPanel } from './link-detail-panel'
import type { LinkSummary, AnalyticsMetrics } from '../types'

const link: LinkSummary = {
  id: 'link-1',
  code: 'abc123',
  slug: 'my-link',
  title: 'My Test Link',
  destination_url: 'https://example.com/destination',
  source_type: 'campaign',
  tags: ['promo', 'social'],
  active: true,
  redirect_type: 302,
  expires_at: '2026-12-31T00:00:00Z',
  total_clicks: 1500,
  unique_visitors: 1200,
  last_clicked_at: '2026-05-04T15:30:00Z',
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-05-04T15:30:00Z',
}

const metrics: AnalyticsMetrics = {
  totalClicks: 1500,
  uniqueVisitors: 1200,
  conversionRate: 0.045,
  topCountry: 'BR',
  dailyClicks: [
    { date: '2026-05-01', clicks: 200, unique: 180 },
    { date: '2026-05-02', clicks: 250, unique: 210 },
    { date: '2026-05-03', clicks: 300, unique: 260 },
    { date: '2026-05-04', clicks: 180, unique: 150 },
  ],
}

describe('LinkDetailPanel', () => {
  const defaultProps = {
    link,
    metrics,
    onEdit: vi.fn(),
    onCopyUrl: vi.fn(),
    onGenerateQr: vi.fn(),
    onClose: vi.fn(),
  }

  it('renders link title', () => {
    render(<LinkDetailPanel {...defaultProps} />)
    expect(screen.getByText('My Test Link')).toBeInTheDocument()
  })

  it('displays full destination URL', () => {
    render(<LinkDetailPanel {...defaultProps} />)
    expect(screen.getByText('https://example.com/destination')).toBeInTheDocument()
  })

  it('displays short URL with code', () => {
    render(<LinkDetailPanel {...defaultProps} />)
    expect(screen.getByText(/abc123/)).toBeInTheDocument()
  })

  it('shows total clicks metric', () => {
    render(<LinkDetailPanel {...defaultProps} />)
    expect(screen.getByText('1,500')).toBeInTheDocument()
  })

  it('shows unique visitors metric', () => {
    render(<LinkDetailPanel {...defaultProps} />)
    expect(screen.getByText('1,200')).toBeInTheDocument()
  })

  it('shows top country', () => {
    render(<LinkDetailPanel {...defaultProps} />)
    expect(screen.getByText('BR')).toBeInTheDocument()
  })

  it('displays tags', () => {
    render(<LinkDetailPanel {...defaultProps} />)
    expect(screen.getByText('promo')).toBeInTheDocument()
    expect(screen.getByText('social')).toBeInTheDocument()
  })

  it('shows sparkline container', () => {
    render(<LinkDetailPanel {...defaultProps} />)
    expect(screen.getByTestId('sparkline')).toBeInTheDocument()
  })

  it('calls onEdit when edit button clicked', async () => {
    const user = userEvent.setup()
    render(<LinkDetailPanel {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /edit/i }))
    expect(defaultProps.onEdit).toHaveBeenCalledWith('link-1')
  })

  it('calls onCopyUrl when copy button clicked', async () => {
    const user = userEvent.setup()
    render(<LinkDetailPanel {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /copy/i }))
    expect(defaultProps.onCopyUrl).toHaveBeenCalledWith('link-1')
  })

  it('calls onGenerateQr when QR button clicked', async () => {
    const user = userEvent.setup()
    render(<LinkDetailPanel {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /qr/i }))
    expect(defaultProps.onGenerateQr).toHaveBeenCalledWith('link-1')
  })

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup()
    render(<LinkDetailPanel {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('displays UTM breakdown when link has UTM params', () => {
    const linkWithUtm: LinkSummary = {
      ...link,
      source_type: 'newsletter',
    }
    render(<LinkDetailPanel {...defaultProps} link={linkWithUtm} />)
    expect(screen.getByText(/newsletter/i)).toBeInTheDocument()
  })
})
