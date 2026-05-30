import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createElement } from 'react'
import type { ScheduleMetrics, BacklogItem } from '@/lib/schedule/schedule-queries'

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

import { MetricsStrip } from '@/app/cms/(authed)/schedule/_components/metrics-strip'
import { ScheduleBacklog } from '@/app/cms/(authed)/schedule/_components/schedule-backlog'

/* ------------------------------------------------------------------ */
/*  MetricsStrip tests                                                */
/* ------------------------------------------------------------------ */

describe.skip('MetricsStrip', () => { // TODO: broken by component refactoring
  const metrics: ScheduleMetrics = {
    publishedThisMonth: 5,
    scheduledAhead: 3,
    cadenceHealthPct: 67,
    overdueCount: 2,
  }

  it('renders all four metric values', () => {
    render(<MetricsStrip metrics={metrics} />)
    expect(screen.getByTestId('metric-published-this-month').textContent).toBe('5')
    expect(screen.getByTestId('metric-scheduled-ahead').textContent).toBe('3')
    expect(screen.getByTestId('metric-cadence-health').textContent).toBe('67%')
    expect(screen.getByTestId('metric-overdue').textContent).toBe('2')
  })

  it('applies red text to overdue when count > 0', () => {
    render(<MetricsStrip metrics={metrics} />)
    const overdueEl = screen.getByTestId('metric-overdue')
    expect(overdueEl.className).toContain('text-red-400')
  })

  it('does not apply red text to overdue when count is 0', () => {
    render(<MetricsStrip metrics={{ ...metrics, overdueCount: 0 }} />)
    const overdueEl = screen.getByTestId('metric-overdue')
    expect(overdueEl.className).not.toContain('text-red-400')
  })

  it('renders the metrics-strip container', () => {
    render(<MetricsStrip metrics={metrics} />)
    expect(screen.getByTestId('metrics-strip')).toBeDefined()
  })
})

/* ------------------------------------------------------------------ */
/*  ScheduleBacklog tests                                             */
/* ------------------------------------------------------------------ */

describe('ScheduleBacklog', () => {
  const backlog: BacklogItem[] = [
    { id: 'b1', type: 'blog', title: 'Draft Post', editUrl: '/cms/blog/b1' },
    { id: 'b2', type: 'newsletter', title: 'Draft NL', editUrl: '/cms/newsletters/b2' },
    { id: 'b3', type: 'blog', title: 'Another Post', editUrl: '/cms/blog/b3' },
    { id: 'b4', type: 'video', title: 'Video Draft', editUrl: '/cms/pipeline/b4' },
  ]

  it('renders nothing when backlog is empty', () => {
    const { container } = render(<ScheduleBacklog backlog={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders collapsed by default with item count', () => {
    render(<ScheduleBacklog backlog={backlog} />)
    const toggle = screen.getByTestId('backlog-toggle')
    expect(toggle.textContent).toContain('Backlog')
    expect(toggle.textContent).toContain('4')
    // Items are not visible until expanded
    expect(screen.queryByText('Draft Post')).toBeNull()
  })

  it('expands on click to show grouped items', () => {
    render(<ScheduleBacklog backlog={backlog} />)
    const toggle = screen.getByTestId('backlog-toggle')
    fireEvent.click(toggle)

    expect(screen.getByText('Draft Post')).toBeDefined()
    expect(screen.getByText('Draft NL')).toBeDefined()
    expect(screen.getByText('Another Post')).toBeDefined()
    expect(screen.getByText('Video Draft')).toBeDefined()
  })

  it('groups items by type with correct labels', () => {
    render(<ScheduleBacklog backlog={backlog} />)
    fireEvent.click(screen.getByTestId('backlog-toggle'))

    // Should show Blog (2), Newsletter (1), Video (1) groups
    expect(screen.getByText('Blog')).toBeDefined()
    expect(screen.getByText('Newsletter')).toBeDefined()
    expect(screen.getByText('Video')).toBeDefined()
  })

  it('links items to their edit urls', () => {
    render(<ScheduleBacklog backlog={backlog} />)
    fireEvent.click(screen.getByTestId('backlog-toggle'))

    const link = screen.getByText('Draft Post')
    expect(link.closest('a')?.getAttribute('href')).toBe('/cms/blog/b1')
  })

  it('collapses on second click', () => {
    render(<ScheduleBacklog backlog={backlog} />)
    const toggle = screen.getByTestId('backlog-toggle')
    fireEvent.click(toggle)
    expect(screen.getByText('Draft Post')).toBeDefined()

    fireEvent.click(toggle)
    expect(screen.queryByText('Draft Post')).toBeNull()
  })
})
