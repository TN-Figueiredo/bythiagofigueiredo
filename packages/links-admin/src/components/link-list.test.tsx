import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LinkList } from './link-list'
import type { LinkSummary } from '../types'

function makeLinks(count: number): LinkSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `link-${i}`,
    code: `code${i}`,
    slug: i % 2 === 0 ? `slug-${i}` : null,
    title: `Link ${i}`,
    destination_url: `https://example.com/${i}`,
    source_type: 'manual',
    tags: i % 3 === 0 ? ['promo'] : [],
    active: i % 2 === 0,
    redirect_type: 302,
    expires_at: null,
    total_clicks: i * 50,
    unique_visitors: i * 40,
    last_clicked_at: i > 0 ? '2026-05-01T10:00:00Z' : null,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
  }))
}

describe('LinkList', () => {
  const defaultProps = {
    links: makeLinks(5),
    onSelect: vi.fn(),
    onToggleActive: vi.fn(),
    onDelete: vi.fn(),
    onEdit: vi.fn(),
    selectedId: null as string | null,
  }

  it('renders all links as table rows', () => {
    render(<LinkList {...defaultProps} />)
    for (let i = 0; i < 5; i++) {
      expect(screen.getByText(`Link ${i}`)).toBeInTheDocument()
    }
  })

  it('displays link code for each row', () => {
    render(<LinkList {...defaultProps} />)
    expect(screen.getByText(/code0/)).toBeInTheDocument()
    expect(screen.getByText(/code4/)).toBeInTheDocument()
  })

  it('truncates long destination URLs', () => {
    const links = [
      {
        ...makeLinks(1)[0],
        destination_url:
          'https://example.com/very/long/path/that/should/be/truncated/somewhere',
      },
    ]
    render(<LinkList {...defaultProps} links={links} />)
    const truncated = screen.getByText(/example\.com/)
    expect(truncated.textContent!.length).toBeLessThan(
      'https://example.com/very/long/path/that/should/be/truncated/somewhere'.length,
    )
  })

  it('shows source type badge', () => {
    render(<LinkList {...defaultProps} />)
    const badges = screen.getAllByText('manual')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('shows active status badge for active links', () => {
    render(<LinkList {...defaultProps} />)
    const activeBadges = screen.getAllByText(/active/i)
    expect(activeBadges.length).toBeGreaterThan(0)
  })

  it('shows inactive status badge for paused links', () => {
    render(<LinkList {...defaultProps} />)
    const inactiveBadges = screen.getAllByText(/paused/i)
    expect(inactiveBadges.length).toBeGreaterThan(0)
  })

  it('calls onSelect when row is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<LinkList {...defaultProps} onSelect={onSelect} />)
    await user.click(screen.getByText('Link 2'))
    expect(onSelect).toHaveBeenCalledWith('link-2')
  })

  it('highlights selected row', () => {
    render(<LinkList {...defaultProps} selectedId="link-1" />)
    const row = screen.getByText('Link 1').closest('tr')
    expect(row?.className).toContain('bg-indigo')
  })

  it('calls onToggleActive with link id', async () => {
    const user = userEvent.setup()
    const onToggleActive = vi.fn()
    render(<LinkList {...defaultProps} onToggleActive={onToggleActive} />)
    const toggleButtons = screen.getAllByTitle(/pause|activate/i)
    await user.click(toggleButtons[0])
    expect(onToggleActive).toHaveBeenCalledWith('link-0')
  })

  it('calls onDelete with link id', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<LinkList {...defaultProps} onDelete={onDelete} />)
    const deleteButtons = screen.getAllByTitle(/delete/i)
    await user.click(deleteButtons[0])
    expect(onDelete).toHaveBeenCalledWith('link-0')
  })

  it('calls onEdit with link id', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<LinkList {...defaultProps} onEdit={onEdit} />)
    const editButtons = screen.getAllByTitle(/edit/i)
    await user.click(editButtons[0])
    expect(onEdit).toHaveBeenCalledWith('link-0')
  })

  it('renders empty state when no links', () => {
    render(<LinkList {...defaultProps} links={[]} />)
    expect(screen.getByText(/no links found/i)).toBeInTheDocument()
  })

  it('renders copy URL button for each row', () => {
    render(<LinkList {...defaultProps} />)
    const copyButtons = screen.getAllByTitle(/copy/i)
    expect(copyButtons.length).toBe(5)
  })

  it('shows click count in each row', () => {
    render(<LinkList {...defaultProps} />)
    expect(screen.getByText('200')).toBeInTheDocument()
  })
})
