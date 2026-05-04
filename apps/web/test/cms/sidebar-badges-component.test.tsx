import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

let mockIsExpanded = true

vi.mock('@tn-figueiredo/cms-ui/client', () => ({
  useSidebar: () => ({ isExpanded: mockIsExpanded }),
}))

vi.mock('@/lib/cms/sidebar-badges', () => ({
  computeUrgencyColor: (d: number) => {
    if (d < 0) return null
    if (d <= 4) return 'red'
    if (d <= 9) return 'orange'
    if (d <= 15) return 'yellow'
    return null
  },
}))

import { formatCount, formatSlotDate } from '@/components/cms/sidebar-badges'
import type { SidebarBadgeData } from '@/lib/cms/sidebar-badges'

const EMPTY_DATA: SidebarBadgeData = {
  posts: { wip: 0 },
  newsletters: { wip: 0, wipDraft: 0, wipReady: 0, urgency: null },
}

async function importComponent() {
  const mod = await import('@/components/cms/sidebar-badges')
  return mod.SidebarBadges
}

describe('formatCount', () => {
  it('returns number as string for values <= 99', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(1)).toBe('1')
    expect(formatCount(99)).toBe('99')
  })

  it('returns 99+ for values > 99', () => {
    expect(formatCount(100)).toBe('99+')
    expect(formatCount(999)).toBe('99+')
  })
})

describe('formatSlotDate', () => {
  it('formats ISO date to short month/day', () => {
    expect(formatSlotDate('2026-01-05')).toBe('Jan 5')
    expect(formatSlotDate('2026-12-25')).toBe('Dec 25')
  })

  it('handles single-digit days', () => {
    expect(formatSlotDate('2026-03-01')).toBe('Mar 1')
  })

  it('handles month boundaries', () => {
    expect(formatSlotDate('2026-02-28')).toBe('Feb 28')
  })
})

describe('SidebarBadges', () => {
  beforeEach(() => {
    mockIsExpanded = true
    document.body.innerHTML = ''
  })

  it('returns null when all counts are zero', async () => {
    const SidebarBadges = await importComponent()
    const { container } = render(<SidebarBadges data={EMPTY_DATA} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders collapsed dot for posts when sidebar is collapsed', async () => {
    mockIsExpanded = false
    document.body.innerHTML = '<div data-area="cms"><a href="/cms/blog">Blog</a></div>'
    const SidebarBadges = await importComponent()
    const data: SidebarBadgeData = {
      ...EMPTY_DATA,
      posts: { wip: 3 },
    }
    render(<SidebarBadges data={data} />)
    await vi.waitFor(() => {
      const dot = document.querySelector('[aria-hidden="true"]')
      expect(dot).toBeTruthy()
    })
  })

  it('renders expanded pill with count for posts via portal', async () => {
    document.body.innerHTML = '<div data-area="cms"><a href="/cms/blog">Blog</a></div>'
    const SidebarBadges = await importComponent()
    const data: SidebarBadgeData = {
      ...EMPTY_DATA,
      posts: { wip: 5 },
    }
    render(<SidebarBadges data={data} />)
    await vi.waitFor(() => {
      const pill = document.querySelector('[role="status"]')
      expect(pill).toBeTruthy()
      expect(pill?.textContent).toBe('5')
    })
  })

  it('renders both wip and urgency pills for newsletters', async () => {
    document.body.innerHTML = '<div data-area="cms"><a href="/cms/newsletters">Newsletters</a></div>'
    const SidebarBadges = await importComponent()
    const data: SidebarBadgeData = {
      posts: { wip: 0 },
      newsletters: {
        wip: 11,
        wipDraft: 7,
        wipReady: 4,
        urgency: {
          count: 24,
          color: 'red',
          slots: [
            { typeName: 'Weekly', typeColor: '#ef4444', slotDate: '2026-05-06', daysUntil: 3 },
          ],
        },
      },
    }
    render(<SidebarBadges data={data} />)
    await vi.waitFor(() => {
      const pills = document.querySelectorAll('[role="status"]')
      expect(pills.length).toBe(2)
      expect(pills[0]?.textContent).toBe('11')
      expect(pills[1]?.textContent).toBe('24')
    })
  })

  it('renders only urgency pill when wip is 0 but urgency exists', async () => {
    document.body.innerHTML = '<div data-area="cms"><a href="/cms/newsletters">Newsletters</a></div>'
    const SidebarBadges = await importComponent()
    const data: SidebarBadgeData = {
      posts: { wip: 0 },
      newsletters: {
        wip: 0,
        wipDraft: 0,
        wipReady: 0,
        urgency: {
          count: 2,
          color: 'orange',
          slots: [
            { typeName: 'Bi-weekly', typeColor: '#f97316', slotDate: '2026-05-10', daysUntil: 7 },
          ],
        },
      },
    }
    render(<SidebarBadges data={data} />)
    await vi.waitFor(() => {
      const pills = document.querySelectorAll('[role="status"]')
      expect(pills.length).toBe(1)
      expect(pills[0]?.textContent).toBe('2')
    })
  })

  it('pill has correct aria-label', async () => {
    document.body.innerHTML = '<div data-area="cms"><a href="/cms/blog">Blog</a></div>'
    const SidebarBadges = await importComponent()
    const data: SidebarBadgeData = {
      ...EMPTY_DATA,
      posts: { wip: 42 },
    }
    render(<SidebarBadges data={data} />)
    await vi.waitFor(() => {
      const pill = document.querySelector('[role="status"]')
      expect(pill?.getAttribute('aria-label')).toBe('42 draft and ready posts')
    })
  })

  it('pill is keyboard-focusable', async () => {
    document.body.innerHTML = '<div data-area="cms"><a href="/cms/blog">Blog</a></div>'
    const SidebarBadges = await importComponent()
    const data: SidebarBadgeData = {
      ...EMPTY_DATA,
      posts: { wip: 1 },
    }
    render(<SidebarBadges data={data} />)
    await vi.waitFor(() => {
      const pill = document.querySelector('[role="status"]')
      expect(pill?.getAttribute('tabindex')).toBe('0')
    })
  })
})
