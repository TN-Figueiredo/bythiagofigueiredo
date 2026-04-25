import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/cms',
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
  }) =>
    React.createElement('a', { href, ...rest }, children),
}))

// Mock @tn-figueiredo/cms-ui/client
vi.mock('@tn-figueiredo/cms-ui/client', () => ({
  CmsTopbar: ({ title }: { title: string }) =>
    React.createElement('div', { 'data-testid': 'topbar' }, title),
  KpiCard: ({
    label,
    value,
    color,
  }: {
    label: string
    value: string | number
    color?: string
  }) =>
    React.createElement(
      'div',
      { 'data-testid': `kpi-${label.toLowerCase().replace(/\s+/g, '-')}`, 'data-color': color },
      `${label}: ${value}`,
    ),
  formatRelativeTime: (iso: string) => {
    // Simple relative time for tests
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return 'recently'
  },
}))

/* ------------------------------------------------------------------ */
/*  Import component under test                                       */
/* ------------------------------------------------------------------ */

import {
  DashboardConnected,
  type DashboardData,
} from '../../src/app/cms/(authed)/_components/dashboard-connected'

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

function makeEmptyData(): DashboardData {
  return {
    kpis: {
      publishedPosts: 0,
      publishedPostsDelta: null,
      subscribers: 0,
      subscribersDelta: null,
      avgOpenRate: null,
      avgOpenRateDelta: null,
      unreadMessages: 0,
    },
    lastNewsletter: null,
    comingUp: [],
    drafts: [],
    recentActivity: [],
    topPosts: [],
    topNewsletters: [],
    topCampaigns: [],
  }
}

function makePopulatedData(): DashboardData {
  const today = new Date()
  const todayStr = today.toISOString()
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString()

  return {
    kpis: {
      publishedPosts: 12,
      publishedPostsDelta: 20.0,
      subscribers: 340,
      subscribersDelta: 5.3,
      avgOpenRate: 42.5,
      avgOpenRateDelta: -2.1,
      unreadMessages: 3,
    },
    lastNewsletter: {
      id: 'nl-1',
      subject: 'Weekly Digest #42',
      sentAt: todayStr,
      delivered: 300,
      opens: 120,
      clicks: 45,
      bounces: 2,
    },
    comingUp: [
      {
        id: 'cu-1',
        title: 'Intro to React 19',
        date: todayStr,
        type: 'post',
        href: '/cms/blog/cu-1/edit',
      },
      {
        id: 'cu-2',
        title: 'Monthly Update',
        date: tomorrowStr,
        type: 'newsletter',
        href: '/cms/newsletters/cu-2/edit',
      },
    ],
    drafts: [
      {
        id: 'd-1',
        title: 'Draft Post Alpha',
        updatedAt: todayStr,
        type: 'post',
        href: '/cms/blog/d-1/edit',
      },
      {
        id: 'd-2',
        title: 'Draft Newsletter Beta',
        updatedAt: todayStr,
        type: 'newsletter',
        href: '/cms/newsletters/d-2/edit',
      },
    ],
    recentActivity: [
      {
        id: 'a-1',
        action: 'published',
        resourceType: 'blog_post',
        resourceId: 'bp-1',
        createdAt: todayStr,
        actorEmail: 'admin@example.com',
      },
      {
        id: 'a-2',
        action: 'created',
        resourceType: 'campaign',
        resourceId: 'c-1',
        createdAt: todayStr,
        actorEmail: null,
      },
    ],
    topPosts: [
      { id: 'tp-1', title: 'Best Post Ever', views: 1200, locale: 'pt-BR' },
      { id: 'tp-2', title: 'Second Best', views: 800, locale: 'en' },
    ],
    topNewsletters: [
      { id: 'tn-1', title: 'Newsletter Issue 10', views: 500, locale: 'pt-BR' },
    ],
    topCampaigns: [
      { id: 'tc-1', title: 'Launch Campaign', views: 300, locale: 'pt-BR' },
    ],
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('DashboardConnected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('KPI cards', () => {
    it('renders 4 KPI cards with correct values', () => {
      const data = makePopulatedData()
      render(<DashboardConnected data={data} />)

      const strip = screen.getByTestId('kpi-strip')
      expect(strip).toBeTruthy()

      // Published Posts card
      expect(screen.getByTestId('kpi-published-posts')).toBeTruthy()
      expect(screen.getByTestId('kpi-published-posts').textContent).toContain(
        'Published Posts: 12',
      )

      // Subscribers card
      expect(screen.getByTestId('kpi-subscribers')).toBeTruthy()
      expect(screen.getByTestId('kpi-subscribers').textContent).toContain(
        'Subscribers: 340',
      )

      // Avg Open Rate card
      expect(screen.getByTestId('kpi-avg-open-rate')).toBeTruthy()
      expect(screen.getByTestId('kpi-avg-open-rate').textContent).toContain(
        'Avg Open Rate: 42.5%',
      )

      // Unread Messages card
      expect(screen.getByTestId('kpi-unread-messages')).toBeTruthy()
      expect(screen.getByTestId('kpi-unread-messages').textContent).toContain(
        'Unread Messages: 3',
      )
    })

    it('renders 0 for all KPIs in empty state', () => {
      const data = makeEmptyData()
      render(<DashboardConnected data={data} />)

      expect(screen.getByTestId('kpi-published-posts').textContent).toContain(
        'Published Posts: 0',
      )
      expect(screen.getByTestId('kpi-subscribers').textContent).toContain(
        'Subscribers: 0',
      )
      expect(screen.getByTestId('kpi-avg-open-rate').textContent).toContain(
        'Avg Open Rate: 0%',
      )
      expect(screen.getByTestId('kpi-unread-messages').textContent).toContain(
        'Unread Messages: 0',
      )
    })

    it('applies amber color to unread messages when count > 0', () => {
      const data = makePopulatedData()
      render(<DashboardConnected data={data} />)

      const card = screen.getByTestId('kpi-unread-messages')
      expect(card.getAttribute('data-color')).toBe('amber')
    })

    it('uses default color for unread messages when count is 0', () => {
      const data = makePopulatedData()
      data.kpis.unreadMessages = 0
      render(<DashboardConnected data={data} />)

      const card = screen.getByTestId('kpi-unread-messages')
      expect(card.getAttribute('data-color')).toBe('default')
    })
  })

  describe('empty state / onboarding', () => {
    it('shows onboarding cards when no content exists', () => {
      const data = makeEmptyData()
      render(<DashboardConnected data={data} />)

      const onboarding = screen.getByTestId('onboarding-cards')
      expect(onboarding).toBeTruthy()
      expect(onboarding.textContent).toContain('Write your first post')
      expect(onboarding.textContent).toContain('Set up a newsletter')
      expect(onboarding.textContent).toContain('Create a campaign')
    })

    it('does NOT show onboarding when content exists', () => {
      const data = makePopulatedData()
      render(<DashboardConnected data={data} />)

      expect(screen.queryByTestId('onboarding-cards')).toBeNull()
    })
  })

  describe('last newsletter banner', () => {
    it('renders the newsletter banner when lastNewsletter is provided', () => {
      const data = makePopulatedData()
      render(<DashboardConnected data={data} />)

      const banner = screen.getByTestId('newsletter-banner')
      expect(banner).toBeTruthy()
      expect(banner.textContent).toContain('Weekly Digest #42')
      expect(banner.textContent).toContain('300')  // delivered
      expect(banner.textContent).toContain('40.0') // open rate: 120/300 = 40%
      expect(banner.textContent).toContain('45')   // clicks
      expect(banner.textContent).toContain('2')    // bounces
    })

    it('hides the banner when lastNewsletter is null', () => {
      const data = makePopulatedData()
      data.lastNewsletter = null
      render(<DashboardConnected data={data} />)

      expect(screen.queryByTestId('newsletter-banner')).toBeNull()
    })
  })

  describe('top content tabs', () => {
    it('shows posts tab by default', () => {
      const data = makePopulatedData()
      render(<DashboardConnected data={data} />)

      const table = screen.getByTestId('top-content-table')
      expect(table).toBeTruthy()
      expect(table.textContent).toContain('Best Post Ever')
      expect(table.textContent).toContain('Second Best')
    })

    it('switches to newsletters tab on click', () => {
      const data = makePopulatedData()
      render(<DashboardConnected data={data} />)

      const nlTab = screen.getByTestId('tab-newsletters')
      fireEvent.click(nlTab)

      const table = screen.getByTestId('top-content-table')
      expect(table.textContent).toContain('Newsletter Issue 10')
      expect(table.textContent).not.toContain('Best Post Ever')
    })

    it('switches to campaigns tab on click', () => {
      const data = makePopulatedData()
      render(<DashboardConnected data={data} />)

      const campTab = screen.getByTestId('tab-campaigns')
      fireEvent.click(campTab)

      const table = screen.getByTestId('top-content-table')
      expect(table.textContent).toContain('Launch Campaign')
      expect(table.textContent).not.toContain('Best Post Ever')
    })

    it('shows empty state when a tab has no data', () => {
      const data = makePopulatedData()
      data.topCampaigns = []
      render(<DashboardConnected data={data} />)

      const campTab = screen.getByTestId('tab-campaigns')
      fireEvent.click(campTab)

      expect(screen.getByTestId('top-content-empty')).toBeTruthy()
    })
  })

  describe('coming up timeline', () => {
    it('groups items by day (Today / Tomorrow)', () => {
      const data = makePopulatedData()
      render(<DashboardConnected data={data} />)

      const list = screen.getByTestId('coming-up-list')
      expect(list).toBeTruthy()
      expect(list.textContent).toContain('Today')
      expect(list.textContent).toContain('Tomorrow')
      expect(list.textContent).toContain('Intro to React 19')
      expect(list.textContent).toContain('Monthly Update')
    })

    it('shows empty state when no coming up items', () => {
      const data = makePopulatedData()
      data.comingUp = []
      // Need to still have some content so onboarding does not show
      render(<DashboardConnected data={data} />)

      expect(screen.getByTestId('coming-up-empty')).toBeTruthy()
      expect(screen.getByTestId('coming-up-empty').textContent).toContain(
        'Nothing scheduled',
      )
    })
  })

  describe('continue editing', () => {
    it('renders draft items with links', () => {
      const data = makePopulatedData()
      render(<DashboardConnected data={data} />)

      const list = screen.getByTestId('drafts-list')
      expect(list).toBeTruthy()
      expect(list.textContent).toContain('Draft Post Alpha')
      expect(list.textContent).toContain('Draft Newsletter Beta')
    })

    it('shows empty state when no drafts', () => {
      const data = makePopulatedData()
      data.drafts = []
      render(<DashboardConnected data={data} />)

      expect(screen.getByTestId('drafts-empty')).toBeTruthy()
    })
  })

  describe('recent activity', () => {
    it('renders activity items', () => {
      const data = makePopulatedData()
      render(<DashboardConnected data={data} />)

      const list = screen.getByTestId('activity-list')
      expect(list).toBeTruthy()
      expect(list.textContent).toContain('published')
      expect(list.textContent).toContain('blog_post')
      expect(list.textContent).toContain('admin@example.com')
    })

    it('shows empty state when no activity', () => {
      const data = makePopulatedData()
      data.recentActivity = []
      render(<DashboardConnected data={data} />)

      expect(screen.getByTestId('activity-empty')).toBeTruthy()
    })
  })

  describe('main data-testid', () => {
    it('renders the dashboard wrapper', () => {
      const data = makePopulatedData()
      render(<DashboardConnected data={data} />)

      expect(screen.getByTestId('dashboard')).toBeTruthy()
    })
  })
})
