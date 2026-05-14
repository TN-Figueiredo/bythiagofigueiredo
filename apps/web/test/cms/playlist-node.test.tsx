import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlaylistNode } from '@/app/cms/(authed)/playlists/[id]/_components/playlist-node'
import type { PlaylistItemEnriched, ContentType } from '@/lib/playlists/types'

function makeItem(overrides?: Partial<PlaylistItemEnriched>): PlaylistItemEnriched {
  return {
    id: 'item-1', playlist_id: 'p1', blog_post_id: 'bp1',
    newsletter_edition_id: null, pipeline_id: null,
    sort_order: 1000, position_x: 100, position_y: 200, created_at: '2026-01-01',
    content_type: 'blog_post', title: 'Test Blog Post', status: 'published',
    category: 'tech', metadata: null, is_ghost: false,
    other_playlist_count: 2, language: 'pt-br',
    ...overrides,
  }
}

const defaultProps = {
  isSelected: false,
  isDropTarget: false,
  isDimmed: false,
  isIdea: false,
  viewNumber: 1 as number | null,
  onPointerDown: vi.fn(),
  onHandlePointerDown: vi.fn(),
  onContextMenu: vi.fn(),
  onClick: vi.fn(),
  onOpenContent: vi.fn(),
}

describe('PlaylistNode V7', () => {
  it('renders type badge', () => {
    render(<PlaylistNode item={makeItem()} {...defaultProps} />)
    expect(screen.getByText('BLOG')).toBeTruthy()
  })

  it('renders language badge', () => {
    render(<PlaylistNode item={makeItem({ language: 'pt-br' })} {...defaultProps} />)
    expect(screen.getByText('PT')).toBeTruthy()
  })

  it('renders EN language badge', () => {
    render(<PlaylistNode item={makeItem({ language: 'en' })} {...defaultProps} />)
    expect(screen.getByText('EN')).toBeTruthy()
  })

  it('renders order number in stripe', () => {
    render(<PlaylistNode item={makeItem()} {...defaultProps} viewNumber={3} />)
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('renders --- when viewNumber is null', () => {
    render(<PlaylistNode item={makeItem()} {...defaultProps} viewNumber={null} />)
    expect(screen.getByText('---')).toBeTruthy()
  })

  it('renders cross-playlist count', () => {
    render(<PlaylistNode item={makeItem({ other_playlist_count: 2 })} {...defaultProps} />)
    expect(screen.getByText('+2 playlists')).toBeTruthy()
  })

  it('renders status with dot', () => {
    render(<PlaylistNode item={makeItem({ status: 'published' })} {...defaultProps} />)
    expect(screen.getByText(/published/)).toBeTruthy()
  })

  it('renders VIDEO badge for video type', () => {
    render(<PlaylistNode item={makeItem({ content_type: 'video' })} {...defaultProps} />)
    expect(screen.getByText('VIDEO')).toBeTruthy()
  })

  it('clamps title to 2 lines via CSS class', () => {
    const { container } = render(<PlaylistNode item={makeItem({ title: 'A very long title that should be clamped' })} {...defaultProps} />)
    const titleEl = container.querySelector('[data-testid="node-title"]') ?? container.querySelector('h4')
    expect(titleEl).toBeTruthy()
    expect(titleEl!.className).toContain('line-clamp-2')
  })

  it('sets max-width 250px', () => {
    const { container } = render(<PlaylistNode item={makeItem()} {...defaultProps} />)
    const nodeEl = container.querySelector('[data-node-id]')!
    expect(nodeEl.className).toContain('max-w-[250px]')
  })

  it('applies dimmed state styles', () => {
    const { container } = render(<PlaylistNode item={makeItem()} {...defaultProps} isDimmed={true} />)
    const nodeEl = container.querySelector('[data-node-id]')!
    expect(nodeEl.className).toContain('opacity-[0.12]')
    expect(nodeEl.className).toContain('pointer-events-none')
  })

  it('applies idea state styles', () => {
    const { container } = render(<PlaylistNode item={makeItem()} {...defaultProps} isIdea={true} />)
    const nodeEl = container.querySelector('[data-node-id]')!
    expect(nodeEl.className).toContain('opacity-55')
  })

  it('renders ghost item with dashed border', () => {
    const { container } = render(<PlaylistNode item={makeItem({ is_ghost: true, content_type: null })} {...defaultProps} />)
    const nodeEl = container.querySelector('[data-node-id]')!
    expect(nodeEl.className).toContain('border-dashed')
  })

  it('renders 4 connection handles', () => {
    const { container } = render(<PlaylistNode item={makeItem()} {...defaultProps} />)
    const handles = container.querySelectorAll('[data-handle-id]')
    expect(handles).toHaveLength(4)
  })

  it('fires onOpenContent when open button is clicked', () => {
    const onOpenContent = vi.fn()
    render(<PlaylistNode item={makeItem()} {...defaultProps} onOpenContent={onOpenContent} />)
    const openBtn = screen.getByLabelText('Open in editor')
    fireEvent.click(openBtn)
    expect(onOpenContent).toHaveBeenCalledWith('item-1')
  })
})
