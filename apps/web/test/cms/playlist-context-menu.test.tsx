import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlaylistContextMenu } from '@/app/cms/(authed)/playlists/[id]/_components/context-menu'

const defaultProps = {
  x: 100,
  y: 200,
  itemId: 'item-1',
  itemTitle: 'My Blog Post',
  contentType: 'blog_post' as const,
  viewNumber: 3,
  createdAt: '2026-01-15T10:00:00Z',
  onClose: vi.fn(),
  onOpenEditor: vi.fn(),
  onCopyId: vi.fn(),
  onAddEdge: vi.fn(),
  onSelectConnected: vi.fn(),
  onMoveToPosition: vi.fn(),
  onShowOtherPlaylists: vi.fn(),
  onRemove: vi.fn(),
}

describe('PlaylistContextMenu', () => {
  it('renders header with type badge and title', () => {
    render(<PlaylistContextMenu {...defaultProps} />)
    expect(screen.getByText('BLOG')).toBeTruthy()
    expect(screen.getByText('#3')).toBeTruthy()
    expect(screen.getByText('My Blog Post')).toBeTruthy()
  })

  it('renders all 7 menu items', () => {
    render(<PlaylistContextMenu {...defaultProps} />)
    expect(screen.getByText('Open in editor')).toBeTruthy()
    expect(screen.getByText('Copy ID')).toBeTruthy()
    expect(screen.getByText('Add edge from here')).toBeTruthy()
    expect(screen.getByText('Select connected')).toBeTruthy()
    expect(screen.getByText('Move to position…')).toBeTruthy()
    expect(screen.getByText('Other playlists')).toBeTruthy()
    expect(screen.getByText('Remove from playlist')).toBeTruthy()
  })

  it('renders remove item in red', () => {
    render(<PlaylistContextMenu {...defaultProps} />)
    const removeBtn = screen.getByText('Remove from playlist').closest('button')!
    expect(removeBtn.className).toContain('text-red')
  })

  it('fires onOpenEditor when clicking Open in editor', () => {
    render(<PlaylistContextMenu {...defaultProps} />)
    fireEvent.click(screen.getByText('Open in editor'))
    expect(defaultProps.onOpenEditor).toHaveBeenCalled()
  })

  it('fires onRemove when clicking Remove from playlist', () => {
    render(<PlaylistContextMenu {...defaultProps} />)
    fireEvent.click(screen.getByText('Remove from playlist'))
    expect(defaultProps.onRemove).toHaveBeenCalled()
  })

  it('shows UUID in footer (truncated)', () => {
    render(<PlaylistContextMenu {...defaultProps} />)
    expect(screen.getByText(/item-1/)).toBeTruthy()
  })

  it('closes on Escape', () => {
    render(<PlaylistContextMenu {...defaultProps} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('applies backdrop blur', () => {
    const { container } = render(<PlaylistContextMenu {...defaultProps} />)
    const menu = container.querySelector('[data-testid="context-menu"]')!
    expect(menu.className).toContain('backdrop-blur')
  })
})
