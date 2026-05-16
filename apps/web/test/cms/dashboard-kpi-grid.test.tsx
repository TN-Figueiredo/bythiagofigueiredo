import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

import { DashboardKpiGrid } from '../../src/app/cms/(authed)/_components/dashboard-kpi-grid'
import type { KpiQueryResult } from '../../src/app/cms/(authed)/_components/dashboard-queries'

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

function makeKpiData(overrides?: Partial<KpiQueryResult>): KpiQueryResult {
  return {
    totalViews: 12500,
    totalViewsSparkline: [100, 200, 150, 300, 250, 400, 350],
    publishedCount: 8,
    subscribers: 1250,
    subscribersNet: 15,
    linkClicks: 3400,
    linkClicksSparkline: [50, 80, 60, 90, 70, 100, 85],
    revenue: null,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('DashboardKpiGrid', () => {
  it('renders 5 KPI cards', () => {
    render(<DashboardKpiGrid data={makeKpiData()} />)

    expect(screen.getByTestId('kpi-grid')).toBeTruthy()
    expect(screen.getByTestId('kpi-total-views')).toBeTruthy()
    expect(screen.getByTestId('kpi-publicados')).toBeTruthy()
    expect(screen.getByTestId('kpi-assinantes')).toBeTruthy()
    expect(screen.getByTestId('kpi-link-clicks')).toBeTruthy()
    expect(screen.getByTestId('kpi-receita')).toBeTruthy()
  })

  it('formats large numbers with K suffix', () => {
    render(<DashboardKpiGrid data={makeKpiData({ totalViews: 12500 })} />)

    const card = screen.getByTestId('kpi-total-views')
    expect(card.textContent).toContain('12.5K')
  })

  it('formats millions with M suffix', () => {
    render(<DashboardKpiGrid data={makeKpiData({ totalViews: 1500000 })} />)

    const card = screen.getByTestId('kpi-total-views')
    expect(card.textContent).toContain('1.5M')
  })

  it('shows small numbers without suffix', () => {
    render(<DashboardKpiGrid data={makeKpiData({ publishedCount: 8 })} />)

    const card = screen.getByTestId('kpi-publicados')
    expect(card.textContent).toContain('8')
  })

  it('shows positive trend arrow for subscribers', () => {
    render(<DashboardKpiGrid data={makeKpiData({ subscribersNet: 15 })} />)

    const card = screen.getByTestId('kpi-assinantes')
    // Should contain an up arrow indicator
    expect(card.textContent).toContain('↑')
    expect(card.textContent).toContain('+15')
  })

  it('shows negative trend arrow when subscribers decrease', () => {
    render(<DashboardKpiGrid data={makeKpiData({ subscribersNet: -5 })} />)

    const card = screen.getByTestId('kpi-assinantes')
    expect(card.textContent).toContain('↓')
    expect(card.textContent).toContain('-5')
  })

  it('shows no trend when subscribersNet is 0', () => {
    render(<DashboardKpiGrid data={makeKpiData({ subscribersNet: 0 })} />)

    const card = screen.getByTestId('kpi-assinantes')
    expect(card.textContent).not.toContain('↑')
    expect(card.textContent).not.toContain('↓')
  })

  it('shows -- for revenue when null', () => {
    render(<DashboardKpiGrid data={makeKpiData({ revenue: null })} />)

    const card = screen.getByTestId('kpi-receita')
    expect(card.textContent).toContain('--')
  })

  it('renders sparkline SVG elements', () => {
    const { container } = render(<DashboardKpiGrid data={makeKpiData()} />)

    // Should have SVG sparklines for views and link clicks
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(2)
  })
})
