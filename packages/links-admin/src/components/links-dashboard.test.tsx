import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LinksDashboard } from './links-dashboard'
import type { LinkSummary, DashboardKpis } from '../types'

function makeLinks(count: number): LinkSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `link-${i}`,
    code: `code${i}`,
    slug: null,
    title: `Link ${i}`,
    destination_url: `https://example.com/${i}`,
    source_type: 'manual',
    tags: [],
    active: true,
    redirect_type: 302,
    expires_at: null,
    total_clicks: i * 100,
    unique_visitors: i * 80,
    last_clicked_at: null,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
  }))
}

const kpis: DashboardKpis = {
  totalLinks: 10,
  totalClicks: 5000,
  activeLinks: 8,
  topPerformer: { code: 'best1', clicks: 2000 },
}

describe('LinksDashboard', () => {
  const defaultProps = {
    links: makeLinks(5),
    metrics: kpis,
    onCreateLink: vi.fn(),
    onDeleteLink: vi.fn(),
    onToggleActive: vi.fn(),
  }

  it('renders stats cards with KPI data', () => {
    render(<LinksDashboard {...defaultProps} />)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('5,000')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('renders top performer card', () => {
    render(<LinksDashboard {...defaultProps} />)
    expect(screen.getByText(/best1/)).toBeInTheDocument()
    expect(screen.getByText('2,000')).toBeInTheDocument()
  })

  it('renders link list with all links', () => {
    render(<LinksDashboard {...defaultProps} />)
    expect(screen.getByText('Link 0')).toBeInTheDocument()
    expect(screen.getByText('Link 4')).toBeInTheDocument()
  })

  it('renders create link button', () => {
    render(<LinksDashboard {...defaultProps} />)
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
  })

  it('calls onCreateLink when create button clicked', async () => {
    const user = userEvent.setup()
    render(<LinksDashboard {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /create/i }))
    expect(defaultProps.onCreateLink).toHaveBeenCalled()
  })

  it('renders empty state when no links', () => {
    render(
      <LinksDashboard {...defaultProps} links={[]} metrics={{ ...kpis, totalLinks: 0 }} />,
    )
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('shows total links label', () => {
    render(<LinksDashboard {...defaultProps} />)
    expect(screen.getByText(/total links/i)).toBeInTheDocument()
  })

  it('shows total clicks label', () => {
    render(<LinksDashboard {...defaultProps} />)
    expect(screen.getByText(/total clicks/i)).toBeInTheDocument()
  })

  it('shows active links label', () => {
    render(<LinksDashboard {...defaultProps} />)
    expect(screen.getByText(/active links/i)).toBeInTheDocument()
  })
})
