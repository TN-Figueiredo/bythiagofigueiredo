import { describe, it, expect } from 'vitest'
import {
  buildNotification,
  NOTIFICATION_PRIORITIES,
} from '@/lib/youtube/notification-service'

describe('playoff_created notification', () => {
  it('has priority 3', () => {
    expect(NOTIFICATION_PRIORITIES.playoff_created).toBe(3)
  })

  it('builds correct payload', () => {
    const payload = buildNotification({
      type: 'playoff_created',
      videoId: 'vid-1',
      videoTitle: 'My Video Title',
      testName: 'Test: My Video',
      variant1Label: 'B',
      variant2Label: 'C',
      weekIso: '2026-W22',
    })

    expect(payload.type).toBe('playoff_created')
    expect(payload.priority).toBe(3)
    expect(payload.title).toContain('Playoff')
    expect(payload.message).toContain('B')
    expect(payload.message).toContain('C')
    expect(payload.message).toContain('4h')
    expect(payload.dedup_key).toBe('playoff_created:vid-1:2026-W22')
    expect(payload.action_href).toBe('/cms/youtube/ab-lab')
  })
})
