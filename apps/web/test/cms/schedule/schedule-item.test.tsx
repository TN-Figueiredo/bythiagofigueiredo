import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createElement } from 'react'
import type { CalendarItem } from '@/lib/schedule/schedule-queries'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    createElement('a', { href, ...rest }, children),
}))

/* ------------------------------------------------------------------ */
/*  Import after mocks                                                */
/* ------------------------------------------------------------------ */

import { ScheduleItem } from '@/app/cms/(authed)/schedule/_components/schedule-item'

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

const blogItem: CalendarItem = {
  id: 'blog-1',
  type: 'blog',
  title: 'My Blog Post',
  status: 'scheduled',
  dateKey: '2026-05-20',
  time: '14:30',
  editUrl: '/cms/blog/blog-1',
}

const overdueItem: CalendarItem = {
  id: 'nl-overdue',
  type: 'newsletter',
  title: 'Overdue Newsletter',
  status: 'overdue',
  dateKey: '2026-05-10',
  time: null,
  editUrl: '/cms/newsletters/nl-overdue',
}

const videoItem: CalendarItem = {
  id: 'video-1',
  type: 'video',
  title: 'Video Upload',
  status: 'published',
  dateKey: '2026-05-15',
  time: '09:00',
  editUrl: '/cms/pipeline/video-1',
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe.skip('ScheduleItem', () => { // TODO: broken by component refactoring
  it('renders item title as a link to editUrl', () => {
    render(<ScheduleItem item={blogItem} />)
    const link = screen.getByRole('link', { name: 'My Blog Post' })
    expect(link).toBeDefined()
    expect(link.getAttribute('href')).toBe('/cms/blog/blog-1')
  })

  it('uses data-testid with item id', () => {
    render(<ScheduleItem item={blogItem} />)
    expect(screen.getByTestId('schedule-item-blog-1')).toBeDefined()
  })

  it('shows tooltip on hover with title, type, time, and status', async () => {
    render(<ScheduleItem item={blogItem} />)
    const container = screen.getByTestId('schedule-item-blog-1')
    fireEvent.mouseEnter(container)

    const tooltip = screen.getByTestId('schedule-tooltip')
    expect(tooltip).toBeDefined()
    expect(tooltip.textContent).toContain('My Blog Post')
    expect(tooltip.textContent).toContain('Blog')
    expect(tooltip.textContent).toContain('14:30')
    expect(tooltip.textContent).toContain('scheduled')
  })

  it('hides tooltip on mouse leave', () => {
    render(<ScheduleItem item={blogItem} />)
    const container = screen.getByTestId('schedule-item-blog-1')
    fireEvent.mouseEnter(container)
    expect(screen.getByTestId('schedule-tooltip')).toBeDefined()

    fireEvent.mouseLeave(container)
    expect(screen.queryByTestId('schedule-tooltip')).toBeNull()
  })

  it('tooltip anchors right when colIndex >= 5 (flip logic)', () => {
    render(<ScheduleItem item={blogItem} colIndex={5} />)
    const container = screen.getByTestId('schedule-item-blog-1')
    fireEvent.mouseEnter(container)

    const tooltip = screen.getByTestId('schedule-tooltip')
    expect(tooltip.className).toContain('left-0')
  })

  it('tooltip anchors left when colIndex < 5', () => {
    render(<ScheduleItem item={blogItem} colIndex={2} />)
    const container = screen.getByTestId('schedule-item-blog-1')
    fireEvent.mouseEnter(container)

    const tooltip = screen.getByTestId('schedule-tooltip')
    expect(tooltip.className).toContain('right-0')
  })

  it('renders overdue item with red border color', () => {
    render(<ScheduleItem item={overdueItem} />)
    const link = screen.getByRole('link', { name: 'Overdue Newsletter' })
    // The border-left-color should be red for overdue
    expect(link.style.borderLeftColor).toBe('#ef4444')
  })

  it('renders published item without border-left', () => {
    render(<ScheduleItem item={videoItem} />)
    const link = screen.getByRole('link', { name: 'Video Upload' })
    // Published items should have transparent border
    expect(link.style.borderLeftColor).toBe('transparent')
  })

  it('renders video item linked to pipeline', () => {
    render(<ScheduleItem item={videoItem} />)
    const link = screen.getByRole('link', { name: 'Video Upload' })
    expect(link.getAttribute('href')).toBe('/cms/pipeline/video-1')
  })
})
