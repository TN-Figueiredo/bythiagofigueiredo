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

vi.mock('@tn-figueiredo/cms-ui/client', () => ({
  formatRelativeTime: () => 'agora há pouco',
}))

/* ------------------------------------------------------------------ */
/*  Import                                                            */
/* ------------------------------------------------------------------ */

import { DashboardActivityFeed } from '../../src/app/cms/(authed)/_components/dashboard-activity-feed'
import type { ActivityFeedItem } from '../../src/app/cms/(authed)/_components/dashboard-queries'

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

function makeItems(count: number): ActivityFeedItem[] {
  const actions = ['created', 'updated', 'published', 'deleted', 'sent']
  const types = ['blog_post', 'newsletter_edition', 'campaign', 'content_pipeline', 'link']

  return Array.from({ length: count }, (_, i) => ({
    id: `act-${i}`,
    action: actions[i % 5],
    resourceType: types[i % 5],
    resourceId: `res-${i}`,
    createdAt: new Date(Date.now() - i * 3600000).toISOString(),
    actorUserId: `user-${i}`,
  }))
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('DashboardActivityFeed', () => {
  it('shows empty state when no items', () => {
    render(<DashboardActivityFeed items={[]} />)

    expect(screen.getByTestId('activity-feed')).toBeTruthy()
    expect(screen.getByTestId('activity-feed-empty')).toBeTruthy()
    expect(screen.getByTestId('activity-feed-empty').textContent).toContain(
      'Nenhuma atividade recente',
    )
  })

  it('renders the activity list when items exist', () => {
    render(<DashboardActivityFeed items={makeItems(3)} />)

    expect(screen.getByTestId('activity-feed-list')).toBeTruthy()
    expect(screen.queryByTestId('activity-feed-empty')).toBeNull()
  })

  it('translates action to Portuguese labels', () => {
    const items: ActivityFeedItem[] = [
      {
        id: '1',
        action: 'created',
        resourceType: 'blog_post',
        resourceId: 'bp-1',
        createdAt: new Date().toISOString(),
        actorUserId: null,
      },
      {
        id: '2',
        action: 'published',
        resourceType: 'newsletter_edition',
        resourceId: 'ne-1',
        createdAt: new Date().toISOString(),
        actorUserId: null,
      },
    ]
    render(<DashboardActivityFeed items={items} />)

    expect(screen.getByText('criou')).toBeTruthy()
    expect(screen.getByText('publicou')).toBeTruthy()
  })

  it('shows Portuguese resource type labels', () => {
    const items: ActivityFeedItem[] = [
      {
        id: '1',
        action: 'updated',
        resourceType: 'blog_post',
        resourceId: 'bp-1',
        createdAt: new Date().toISOString(),
        actorUserId: null,
      },
    ]
    render(<DashboardActivityFeed items={items} />)

    expect(screen.getByText('post')).toBeTruthy()
  })

  it('shows relative time for each item', () => {
    render(<DashboardActivityFeed items={makeItems(2)} />)

    // Our mock returns 'agora há pouco' for all times
    const timeLabels = screen.getAllByText('agora há pouco')
    expect(timeLabels.length).toBe(2)
  })

  it('renders multiple items in order', () => {
    const items = makeItems(5)
    render(<DashboardActivityFeed items={items} />)

    const list = screen.getByTestId('activity-feed-list')
    const listItems = list.querySelectorAll('li')
    expect(listItems.length).toBe(5)
  })

  it('shows emoji icons for different resource types', () => {
    const items: ActivityFeedItem[] = [
      {
        id: '1',
        action: 'created',
        resourceType: 'blog_post',
        resourceId: 'bp-1',
        createdAt: new Date().toISOString(),
        actorUserId: null,
      },
      {
        id: '2',
        action: 'sent',
        resourceType: 'newsletter_edition',
        resourceId: 'ne-1',
        createdAt: new Date().toISOString(),
        actorUserId: null,
      },
    ]
    render(<DashboardActivityFeed items={items} />)

    const list = screen.getByTestId('activity-feed-list')
    // Check that emoji icons are present in the content
    expect(list.textContent).toContain('📝')
    expect(list.textContent).toContain('📨')
  })

  it('falls back to action string when unknown', () => {
    const items: ActivityFeedItem[] = [
      {
        id: '1',
        action: 'custom_action',
        resourceType: 'unknown_type',
        resourceId: null,
        createdAt: new Date().toISOString(),
        actorUserId: null,
      },
    ]
    render(<DashboardActivityFeed items={items} />)

    // Should display the raw action string
    expect(screen.getByText('custom_action')).toBeTruthy()
  })
})
