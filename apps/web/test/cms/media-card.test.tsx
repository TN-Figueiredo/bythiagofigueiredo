import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MediaCard } from '../../src/app/cms/(authed)/media/_components/media-card'
import type { MediaAsset } from '@/lib/media/types'

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img data-testid="next-image" src={props.src as string} alt={props.alt as string} />
  ),
}))

const mockAsset: MediaAsset = {
  id: 'asset-1',
  siteId: 'site-1',
  blobUrl: 'https://blob.vercel-storage.com/test.jpg',
  blobPathname: 'media/test.jpg',
  filename: 'hero-banner.jpg',
  altText: 'A hero banner',
  width: 1200,
  height: 675,
  mimeType: 'image/jpeg',
  fileSize: 245000,
  contentHash: 'abc123',
  folder: 'blog',
  tags: ['banner', 'homepage'],
  uploadedBy: 'user-1',
  createdAt: new Date().toISOString(),
}

describe('MediaCard', () => {
  const onSelect = vi.fn()
  const onCheck = vi.fn()
  const onQuickAction = vi.fn()

  it('renders filename and dimensions', () => {
    render(
      <MediaCard
        item={mockAsset}
        type="cover"
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    expect(screen.getByText('hero-banner.jpg')).toBeDefined()
    expect(screen.getByText('1200 × 675')).toBeDefined()
  })

  it('applies correct type border color for cover', () => {
    const { container } = render(
      <MediaCard
        item={mockAsset}
        type="cover"
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    const card = container.firstElementChild as HTMLElement
    expect(card.className).toContain('border-l-blue-500')
  })

  it('applies orphan styling', () => {
    const { container } = render(
      <MediaCard
        item={mockAsset}
        type="cover"
        isOrphan
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    const orphanOverlay = container.querySelector('[class*="animate-pulse"]')
    expect(orphanOverlay).toBeTruthy()
  })

  it('shows type badge', () => {
    render(
      <MediaCard
        item={mockAsset}
        type="avatar"
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    expect(screen.getByText('Avatar')).toBeDefined()
  })

  it('calls onSelect when clicked', () => {
    render(
      <MediaCard
        item={mockAsset}
        type="cover"
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    fireEvent.click(screen.getByTestId('media-card-asset-1'))
    expect(onSelect).toHaveBeenCalledWith('asset-1')
  })

  it('shows checked overlay when checked', () => {
    const { container } = render(
      <MediaCard
        item={mockAsset}
        type="cover"
        checked={true}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    expect(container.querySelector('[data-checked="true"]')).toBeDefined()
  })

  it('highlights search text in filename', () => {
    render(
      <MediaCard
        item={mockAsset}
        type="cover"
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
        searchQuery="hero"
      />,
    )
    expect(screen.getByTestId('search-highlight')).toBeDefined()
  })

  it('renders SVG with img tag instead of next/image', () => {
    const svgAsset = { ...mockAsset, mimeType: 'image/svg+xml', width: null, height: null }
    render(
      <MediaCard
        item={svgAsset}
        type="inline"
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    const img = screen.queryByTestId('next-image')
    expect(img).toBeNull()
  })

  it('formats file size correctly', () => {
    render(
      <MediaCard
        item={mockAsset}
        type="cover"
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    expect(screen.getByText('239.3 KB')).toBeDefined()
  })
})
