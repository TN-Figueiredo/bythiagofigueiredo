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

import * as Sentry from '@sentry/nextjs'
import { NO_SITE_ADMINS_ERROR, fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

function detailedOpts() {
  return {
    siteId: 'site-1',
    domain: 'system' as const,
    type: 'system.token_expired',
    priority: 5,
    title: 'Instagram token expired · @thiago.figueiredo',
    message: 'expired — paste a new token at https://x/cms/settings/instagram',
    dedupKey: 'system.token_expired:instagram:site-1:o:1784:2026-09-06:expired',
    actionHref: '/cms/settings/instagram',
    defaultChannels: ['email'] as const,
  }
}

describe('fanOutToSiteAdminsDetailed', () => {
  it('passa defaultChannels (NUNCA channels) para createNotification', async () => {
    mockGetAdmins.mockResolvedValue(['user-a'])
    mockCreate.mockResolvedValue({ success: true, notificationId: 'n-1' })

    await fanOutToSiteAdminsDetailed({ ...detailedOpts(), defaultChannels: ['email'] })
    const arg = mockCreate.mock.calls[0]![0] as Record<string, unknown>
    expect(arg.defaultChannels).toEqual(['email'])
    expect(arg).not.toHaveProperty('channels')
    expect(arg.action_href).toBe('/cms/settings/instagram')
  })

  it('invariante: sent + suppressed + errors.length === total', async () => {
    mockGetAdmins.mockResolvedValue(['a', 'b', 'c'])
    mockCreate
      .mockResolvedValueOnce({ success: true, notificationId: 'n-1' })
      .mockResolvedValueOnce({ success: true, suppressed: true })
      .mockResolvedValueOnce({ success: false, error: 'boom' })

    const r = await fanOutToSiteAdminsDetailed(detailedOpts())
    expect(r).toEqual({ total: 3, sent: 1, suppressed: 1, errors: ['boom'] })
    expect(r.sent + r.suppressed + r.errors.length).toBe(r.total)
  })

  it('errors.length > 0 => captureMessage("partial fan-out","warning")', async () => {
    mockGetAdmins.mockResolvedValue(['a'])
    mockCreate.mockResolvedValue({ success: false, error: 'boom' })
    await fanOutToSiteAdminsDetailed(detailedOpts())
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledWith('partial fan-out', 'warning')
  })

  it('total === 0 é CONDIÇÃO DE ERRO: captureMessage level error, invariante preservada', async () => {
    mockGetAdmins.mockResolvedValue([])
    const r = await fanOutToSiteAdminsDetailed(detailedOpts())
    expect(r).toEqual({ total: 0, sent: 0, suppressed: 0, errors: [] })
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledWith(NO_SITE_ADMINS_ERROR, 'error')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('fanOutToSiteAdmins (a irmã antiga) continua devolvendo number e sem canais', async () => {
    mockGetAdmins.mockResolvedValue(['a', 'b'])
    mockCreate.mockResolvedValue({ success: true, notificationId: 'n-1' })
    const count = await fanOutToSiteAdmins(baseOpts())
    expect(count).toBe(2)
    const arg = mockCreate.mock.calls[0]![0] as Record<string, unknown>
    expect(arg).not.toHaveProperty('defaultChannels')
    expect(arg).not.toHaveProperty('channels')
  })
})
