import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlaylistContextMenu } from '@/app/cms/(authed)/playlists/[id]/_components/context-menu'

function defaultProps(overrides: Partial<Parameters<typeof PlaylistContextMenu>[0]> = {}) {
  return {
    x: 100,
    y: 200,
    itemId: 'abc-123-long-uuid-value',
    itemTitle: 'My Blog Post',
    contentType: 'blog_post' as const,
    viewNumber: 3,
    createdAt: new Date().toISOString(),
    onClose: vi.fn(),
    onOpenEditor: vi.fn(),
    onCopyId: vi.fn(),
    onAddEdge: vi.fn(),
    onSelectConnected: vi.fn(),
    onMoveToPosition: vi.fn(),
    onShowOtherPlaylists: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  }
}

describe('PlaylistContextMenu', () => {
  it('renders header with badge, view number, and title', () => {
    render(<PlaylistContextMenu {...defaultProps()} />)
    expect(screen.getByText('BLOG')).toBeTruthy()
    expect(screen.getByText('#3')).toBeTruthy()
    expect(screen.getByText('My Blog Post')).toBeTruthy()
  })

  it('renders all 7 menu items', () => {
    render(<PlaylistContextMenu {...defaultProps()} />)
    expect(screen.getByText('Open in editor')).toBeTruthy()
    expect(screen.getByText('Copy ID')).toBeTruthy()
    expect(screen.getByText('Add edge from here')).toBeTruthy()
    expect(screen.getByText('Select connected')).toBeTruthy()
    expect(screen.getByText('Move to position…')).toBeTruthy()
    expect(screen.getByText('Other playlists')).toBeTruthy()
    expect(screen.getByText('Remove from playlist')).toBeTruthy()
  })

  it('fires onOpenEditor on click', () => {
    const props = defaultProps()
    render(<PlaylistContextMenu {...props} />)
    fireEvent.click(screen.getByText('Open in editor'))
    expect(props.onOpenEditor).toHaveBeenCalledOnce()
  })

  it('fires onCopyId on click', () => {
    const props = defaultProps()
    render(<PlaylistContextMenu {...props} />)
    fireEvent.click(screen.getByText('Copy ID'))
    expect(props.onCopyId).toHaveBeenCalledOnce()
  })

  it('fires onAddEdge on click', () => {
    const props = defaultProps()
    render(<PlaylistContextMenu {...props} />)
    fireEvent.click(screen.getByText('Add edge from here'))
    expect(props.onAddEdge).toHaveBeenCalledOnce()
  })

  it('fires onSelectConnected on click', () => {
    const props = defaultProps()
    render(<PlaylistContextMenu {...props} />)
    fireEvent.click(screen.getByText('Select connected'))
    expect(props.onSelectConnected).toHaveBeenCalledOnce()
  })

  it('fires onMoveToPosition on click', () => {
    const props = defaultProps()
    render(<PlaylistContextMenu {...props} />)
    fireEvent.click(screen.getByText('Move to position…'))
    expect(props.onMoveToPosition).toHaveBeenCalledOnce()
  })

  it('fires onShowOtherPlaylists on click', () => {
    const props = defaultProps()
    render(<PlaylistContextMenu {...props} />)
    fireEvent.click(screen.getByText('Other playlists'))
    expect(props.onShowOtherPlaylists).toHaveBeenCalledOnce()
  })

  it('fires onRemove on click', () => {
    const props = defaultProps()
    render(<PlaylistContextMenu {...props} />)
    fireEvent.click(screen.getByText('Remove from playlist'))
    expect(props.onRemove).toHaveBeenCalledOnce()
  })

  it('closes on Escape key', () => {
    const props = defaultProps()
    render(<PlaylistContextMenu {...props} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('closes on click outside', () => {
    const props = defaultProps()
    render(<PlaylistContextMenu {...props} />)
    fireEvent.mouseDown(document)
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('shows truncated ID in footer', () => {
    render(<PlaylistContextMenu {...defaultProps()} />)
    expect(screen.getByText('abc-123-long...')).toBeTruthy()
  })

  it('shows relative date in footer', () => {
    render(<PlaylistContextMenu {...defaultProps({ createdAt: new Date().toISOString() })} />)
    expect(screen.getByText('just now')).toBeTruthy()
  })

  it('remove button has danger styling', () => {
    render(<PlaylistContextMenu {...defaultProps()} />)
    const removeBtn = screen.getByText('Remove from playlist').closest('button')!
    expect(removeBtn.className).toContain('text-red-400')
  })

  it('renders without badge when contentType is null', () => {
    render(<PlaylistContextMenu {...defaultProps({ contentType: null })} />)
    expect(screen.queryByText('BLOG')).toBeNull()
    expect(screen.getByText('My Blog Post')).toBeTruthy()
  })

  it('renders without view number when null', () => {
    render(<PlaylistContextMenu {...defaultProps({ viewNumber: null })} />)
    expect(screen.queryByText(/#\d/)).toBeNull()
  })

  it('renders VIDEO badge for video type', () => {
    render(<PlaylistContextMenu {...defaultProps({ contentType: 'video' })} />)
    expect(screen.getByText('VIDEO')).toBeTruthy()
  })

  it('renders PIPE badge for pipeline type', () => {
    render(<PlaylistContextMenu {...defaultProps({ contentType: 'pipeline' })} />)
    expect(screen.getByText('PIPE')).toBeTruthy()
  })
})
