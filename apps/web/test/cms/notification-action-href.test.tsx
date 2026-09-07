// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { INotification } from '@/lib/notifications/types'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => <a href={href} {...p}>{children}</a>,
}))
const markRead = vi.fn(async () => undefined)
vi.mock('@/lib/notifications/actions', () => ({
  markRead: (...a: unknown[]) => markRead(...(a as [])),
  markUnread: vi.fn(async () => undefined),
  dismiss: vi.fn(async () => undefined),
  markAllRead: vi.fn(async () => undefined),
  bulkDismiss: vi.fn(async () => undefined),
}))

import { NotificationRow } from '@/app/cms/(authed)/_shared/notification-row'
import { InboxClient } from '@/app/cms/(authed)/notifications/_components/inbox-client'

function notification(over: Partial<INotification> = {}): INotification {
  return {
    id: 'n1', site_id: 's1', user_id: 'u1', type: 'system.token_expired', domain: 'system',
    priority: 5, title: 'Instagram token expired · @thiago.figueiredo',
    message: 'expired — reconnect at https://bythiagofigueiredo.com/cms/settings/instagram',
    payload: null, dedup_key: 'k', group_key: null, read_at: null, dismissed_at: null,
    expired_at: null, snoozed_until: null, suggested_action: null,
    action_href: '/cms/settings/instagram', created_at: new Date().toISOString(),
    ...over,
  }
}

describe('(a) bell popover — _shared/notification-row.tsx', () => {
  beforeEach(() => vi.clearAllMocks())

  it('labels the action button "Open" in English, never "Abrir"', () => {
    render(<NotificationRow notification={notification()} onAction={vi.fn()} />)
    const btn = screen.getByLabelText('Open')
    expect(btn.textContent).toContain('Open')
    expect(screen.queryByLabelText('Abrir')).toBeNull()
  })

  it('still honours suggested_action when the notification carries one', () => {
    render(<NotificationRow notification={notification({ suggested_action: 'Reconnect' })} onAction={vi.fn()} />)
    expect(screen.getByLabelText('Reconnect')).toBeTruthy()
  })
})

describe('(b) inbox — notifications/_components/inbox-client.tsx', () => {
  const domainCounts = { system: 1 } as never

  beforeEach(() => vi.clearAllMocks())

  it('renders an Open button that marks read and navigates', async () => {
    render(
      <InboxClient
        initialNotifications={[notification()]}
        totalCount={1}
        unreadCount={1}
        domainCounts={domainCounts}
        siteId="s1"
      />,
    )
    const btn = screen.getByLabelText('Open')
    expect(btn.textContent).toContain('Open')
    await act(async () => { fireEvent.click(btn) })
    expect(markRead).toHaveBeenCalledWith('n1')
    expect(push).toHaveBeenCalledWith('/cms/settings/instagram')
  })

  it('renders no Open button when action_href is null', () => {
    render(
      <InboxClient
        initialNotifications={[notification({ action_href: null })]}
        totalCount={1}
        unreadCount={1}
        domainCounts={domainCounts}
        siteId="s1"
      />,
    )
    expect(screen.queryByLabelText('Open')).toBeNull()
  })
})
