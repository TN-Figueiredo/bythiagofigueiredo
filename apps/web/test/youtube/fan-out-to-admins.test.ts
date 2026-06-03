import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/notifications/get-site-admin-users', () => ({
  getSiteAdminUserIds: vi.fn(),
}))

vi.mock('@/lib/notifications/create', () => ({
  createNotification: vi.fn(),
}))

import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { getSiteAdminUserIds } from '@/lib/notifications/get-site-admin-users'
import { createNotification } from '@/lib/notifications/create'

const mockGetAdmins = vi.mocked(getSiteAdminUserIds)
const mockCreate = vi.mocked(createNotification)

function baseOpts() {
  return {
    siteId: 'site-1',
    domain: 'youtube' as const,
    type: 'youtube.ab_drift',
    priority: 3 as const,
    title: 'AB drift detected',
    message: 'Variant B is drifting',
    dedupKey: 'ab-drift-test-123',
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('fanOutToSiteAdmins', () => {
  it('calls getSiteAdminUserIds and fans out createNotification to each user', async () => {
    mockGetAdmins.mockResolvedValue(['user-a', 'user-b', 'user-c'])
    mockCreate.mockResolvedValue({ success: true, notificationId: 'n-1' })

    const count = await fanOutToSiteAdmins(baseOpts())

    expect(mockGetAdmins).toHaveBeenCalledWith('site-1')
    expect(mockCreate).toHaveBeenCalledTimes(3)
    expect(count).toBe(3)

    // Verify each user got the call with correct user_id
    const calls = mockCreate.mock.calls
    const userIds = calls.map(c => c[0].user_id)
    expect(userIds).toEqual(['user-a', 'user-b', 'user-c'])
  })

  it('returns count of notifications sent', async () => {
    mockGetAdmins.mockResolvedValue(['user-a', 'user-b'])
    // First succeeds, second fails
    mockCreate
      .mockResolvedValueOnce({ success: true, notificationId: 'n-1' })
      .mockResolvedValueOnce({ success: false, error: 'rate limit' })

    const count = await fanOutToSiteAdmins(baseOpts())
    expect(count).toBe(1)
  })

  it('returns 0 when no admin users found', async () => {
    mockGetAdmins.mockResolvedValue([])

    const count = await fanOutToSiteAdmins(baseOpts())

    expect(count).toBe(0)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('handles createNotification failure gracefully (does not throw)', async () => {
    mockGetAdmins.mockResolvedValue(['user-a', 'user-b'])
    mockCreate
      .mockResolvedValueOnce({ success: false, error: 'DB down' })
      .mockResolvedValueOnce({ success: false, error: 'timeout' })

    // Should not throw
    const count = await fanOutToSiteAdmins(baseOpts())
    expect(count).toBe(0)
  })

  it('maps old notification shape to new schema correctly (domain, type prefix)', async () => {
    mockGetAdmins.mockResolvedValue(['user-x'])
    mockCreate.mockResolvedValue({ success: true, notificationId: 'n-99' })

    const opts = {
      ...baseOpts(),
      domain: 'youtube' as const,
      type: 'youtube.ab_drift',
      payload: { testId: 't-1', delta: 0.12 },
      suggestedAction: 'Review AB test',
      actionHref: '/cms/youtube/ab-lab/t-1',
      groupKey: 'ab-tests',
    }

    await fanOutToSiteAdmins(opts)

    expect(mockCreate).toHaveBeenCalledWith({
      site_id: 'site-1',
      user_id: 'user-x',
      domain: 'youtube',
      type: 'youtube.ab_drift',
      priority: 3,
      title: 'AB drift detected',
      message: 'Variant B is drifting',
      dedup_key: 'ab-drift-test-123',
      payload: { testId: 't-1', delta: 0.12 },
      suggested_action: 'Review AB test',
      action_href: '/cms/youtube/ab-lab/t-1',
      group_key: 'ab-tests',
    })
  })

  it('maps optional fields to null when not provided', async () => {
    mockGetAdmins.mockResolvedValue(['user-y'])
    mockCreate.mockResolvedValue({ success: true, notificationId: 'n-50' })

    await fanOutToSiteAdmins(baseOpts())

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: null,
        suggested_action: null,
        action_href: null,
        group_key: null,
      })
    )
  })
})
