// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('lucide-react', () => ({
  Pin: (props: Record<string, unknown>) => <svg data-testid="icon-pin" {...props} />,
  X: (props: Record<string, unknown>) => <svg data-testid="icon-x" {...props} />,
}))

vi.mock('@/lib/pipeline/gem-design', () => ({
  gemMix: vi.fn((color: string, pct: number) => `rgba(0,0,0,${pct / 100})`),
  getPriorityConfig: vi.fn(() => ({
    accent: '#6366f1', accentDim: 'rgba(99,102,241,0.1)',
    accentBorder: 'rgba(99,102,241,0.3)', label: 'P3', className: 'priority-3',
  })),
  getFormatIcon: vi.fn(() => ({ icon: '🎬', bgClass: 'bg-red-500/10', label: 'Video' })),
}))

vi.mock('@/lib/pipeline/colors', () => ({
  FORMAT_COLORS: {
    video: { accent: 'var(--gem-accent)', text: 'var(--gem-muted)', border: 'var(--gem-border)' },
    blog_post: { accent: '#f59e0b', text: '#92400e', border: '#f59e0b' },
    newsletter: { accent: '#818cf8', text: '#4338ca', border: '#818cf8' },
  },
}))

import type { WorkingTodayPin } from '../../src/app/cms/(authed)/pipeline/working-today-actions'

const { PinnedQueue } = await import(
  '../../src/app/cms/(authed)/pipeline/_components/pinned-queue'
)

const PIN: WorkingTodayPin = {
  itemId: 'item-1',
  title: 'Como gravar vlog',
  stage: 'roteiro',
  format: 'video',
  priority: 4,
  pinnedAt: '2026-05-26T10:00:00Z',
}

describe('PinnedQueue', () => {
  it('renders nothing when pins is empty and showGhosts is false', () => {
    const { container } = render(
      <PinnedQueue pins={[]} onUnpin={vi.fn()} showGhosts={false} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders pinned items with title and stage', () => {
    render(<PinnedQueue pins={[PIN]} onUnpin={vi.fn()} showGhosts={false} />)
    expect(screen.getByText('Como gravar vlog')).toBeTruthy()
    expect(screen.getByText(/roteiro/i)).toBeTruthy()
  })

  it('renders section heading', () => {
    render(<PinnedQueue pins={[PIN]} onUnpin={vi.fn()} showGhosts={false} />)
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy()
  })

  it('calls onUnpin when unpin button is clicked', () => {
    const onUnpin = vi.fn()
    render(<PinnedQueue pins={[PIN]} onUnpin={onUnpin} showGhosts={false} />)
    const unpinBtn = screen.getByRole('button', { name: /desafixar/i })
    fireEvent.click(unpinBtn)
    expect(onUnpin).toHaveBeenCalledWith('item-1')
  })

  it('renders ghost suggestion cards when showGhosts is true and pins < 3', () => {
    render(<PinnedQueue pins={[PIN]} onUnpin={vi.fn()} showGhosts={true} />)
    const ghosts = screen.getAllByTestId('ghost-suggestion')
    expect(ghosts.length).toBe(2)
  })

  it('does not render ghosts when pins equals cap', () => {
    const pins = [
      PIN,
      { ...PIN, itemId: 'item-2', title: 'Item 2' },
      { ...PIN, itemId: 'item-3', title: 'Item 3' },
    ]
    render(<PinnedQueue pins={pins} onUnpin={vi.fn()} showGhosts={true} />)
    expect(screen.queryByTestId('ghost-suggestion')).toBeNull()
  })

  it('renders item link pointing to detail page', () => {
    render(<PinnedQueue pins={[PIN]} onUnpin={vi.fn()} showGhosts={false} />)
    const link = screen.getByRole('link', { name: /Como gravar vlog/i })
    expect(link.getAttribute('href')).toBe('/cms/pipeline/items/item-1')
  })

  it('has accessible section label', () => {
    render(<PinnedQueue pins={[PIN]} onUnpin={vi.fn()} showGhosts={false} />)
    const section = screen.getByRole('region', { name: /foco/i })
    expect(section).toBeTruthy()
  })
})
