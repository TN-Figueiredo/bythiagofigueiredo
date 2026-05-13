import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { NotificationCenter } from '@/app/cms/(authed)/_shared/notification-center'

const mockNotifications = [
  { id: 'n1', type: 'delivery_failed' as const, message: 'Delivery failed on Instagram', read: false, createdAt: '2026-05-13T10:00:00Z', href: '/cms/social/p1' },
  { id: 'n2', type: 'ab_test_complete' as const, message: 'A/B test complete: Variant B won', read: false, createdAt: '2026-05-13T09:00:00Z', href: '/cms/youtube/ab-lab' },
  { id: 'n3', type: 'published' as const, message: 'Published to Facebook, Bluesky', read: true, createdAt: '2026-05-13T08:00:00Z', href: '/cms/social/p2' },
]

describe('NotificationCenter', () => {
  it('shows unread badge count', () => {
    render(<NotificationCenter notifications={mockNotifications} onMarkAllRead={() => {}} />)
    expect(screen.getByText('2')).toBeDefined()
  })

  it('opens dropdown on bell click', () => {
    render(<NotificationCenter notifications={mockNotifications} onMarkAllRead={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('Delivery failed on Instagram')).toBeDefined()
  })

  it('shows mark all read button', () => {
    render(<NotificationCenter notifications={mockNotifications} onMarkAllRead={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('Mark all read')).toBeDefined()
  })

  it('shows empty state when no notifications', () => {
    render(<NotificationCenter notifications={[]} onMarkAllRead={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('No notifications')).toBeDefined()
  })
})
