import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/cms',
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
  }) => React.createElement('a', { href, ...rest }, children),
}))

/* ------------------------------------------------------------------ */
/*  Import                                                            */
/* ------------------------------------------------------------------ */

import { DashboardWeekStrip } from '../../src/app/cms/(authed)/_components/dashboard-week-strip'
import type { WeekDayItem } from '../../src/app/cms/(authed)/_components/dashboard-queries'

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

function makeWeekDays(todayIndex = 4): WeekDayItem[] {
  const labels = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
  return labels.map((label, i) => ({
    date: `2026-05-${String(11 + i).padStart(2, '0')}`,
    label,
    dayOfMonth: 11 + i,
    isToday: i === todayIndex,
    dots:
      i === todayIndex
        ? [
            { type: 'post' as const, title: 'New Post', href: '/cms/blog/1/edit' },
            { type: 'newsletter' as const, title: 'Weekly Digest', href: '/cms/newsletters/2/edit' },
          ]
        : i === 2
          ? [{ type: 'pipeline' as const, title: 'Idea X', href: '/cms/up-next?item=3' }]
          : [],
  }))
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('DashboardWeekStrip', () => {
  it('renders 7 day columns', () => {
    const days = makeWeekDays()
    render(<DashboardWeekStrip days={days} />)

    expect(screen.getByTestId('week-strip')).toBeTruthy()
    const dayButtons = screen.getByTestId('week-strip-days').children
    expect(dayButtons.length).toBe(7)
  })

  it('renders day labels (seg through dom)', () => {
    const days = makeWeekDays()
    render(<DashboardWeekStrip days={days} />)

    expect(screen.getByText('seg')).toBeTruthy()
    expect(screen.getByText('ter')).toBeTruthy()
    expect(screen.getByText('qua')).toBeTruthy()
    expect(screen.getByText('qui')).toBeTruthy()
    expect(screen.getByText('sex')).toBeTruthy()
    expect(screen.getByText('sab')).toBeTruthy()
    expect(screen.getByText('dom')).toBeTruthy()
  })

  it('highlights today with special styling', () => {
    const days = makeWeekDays(4) // Friday is today
    render(<DashboardWeekStrip days={days} />)

    const todayBtn = screen.getByTestId('week-day-2026-05-15')
    expect(todayBtn.className).toContain('bg-[var(--acc)]')
    expect(todayBtn.className).toContain('shadow')
  })

  it('non-today days do not have today styling', () => {
    const days = makeWeekDays(4)
    render(<DashboardWeekStrip days={days} />)

    const otherDay = screen.getByTestId('week-day-2026-05-11')
    expect(otherDay.className).not.toContain('bg-[var(--acc)]')
  })

  it('shows dots for days with content', () => {
    const days = makeWeekDays(4)
    render(<DashboardWeekStrip days={days} />)

    // Today (index 4, day 15) has 2 dots
    const todayBtn = screen.getByTestId('week-day-2026-05-15')
    const dots = todayBtn.querySelectorAll('[class*="rounded-full"]')
    // 2 event dots (plus possible other rounded-full elements)
    expect(dots.length).toBeGreaterThanOrEqual(2)
  })

  it('opens tooltip on click of day with dots', () => {
    const days = makeWeekDays(4)
    render(<DashboardWeekStrip days={days} />)

    const todayBtn = screen.getByTestId('week-day-2026-05-15')
    fireEvent.click(todayBtn)

    expect(screen.getByTestId('week-strip-tooltip')).toBeTruthy()
    expect(screen.getByText('New Post')).toBeTruthy()
    expect(screen.getByText('Weekly Digest')).toBeTruthy()
  })

  it('closes tooltip on second click', () => {
    const days = makeWeekDays(4)
    render(<DashboardWeekStrip days={days} />)

    const todayBtn = screen.getByTestId('week-day-2026-05-15')
    fireEvent.click(todayBtn)
    expect(screen.getByTestId('week-strip-tooltip')).toBeTruthy()

    fireEvent.click(todayBtn)
    expect(screen.queryByTestId('week-strip-tooltip')).toBeNull()
  })

  it('does not open tooltip for empty days', () => {
    const days = makeWeekDays(4)
    render(<DashboardWeekStrip days={days} />)

    // Day 11 (Monday) has no dots
    const emptyDay = screen.getByTestId('week-day-2026-05-11')
    fireEvent.click(emptyDay)

    expect(screen.queryByTestId('week-strip-tooltip')).toBeNull()
  })

  it('renders day of month numbers', () => {
    const days = makeWeekDays()
    render(<DashboardWeekStrip days={days} />)

    expect(screen.getByText('11')).toBeTruthy()
    expect(screen.getByText('17')).toBeTruthy()
  })
})
