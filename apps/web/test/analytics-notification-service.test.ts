import { describe, it, expect } from 'vitest'
import {
  buildNotification,
  buildDedupKey,
  shouldAggregate,
  buildGroupNotification,
  NOTIFICATION_PRIORITIES,
} from '@/lib/youtube/notification-service'

describe('NOTIFICATION_PRIORITIES', () => {
  it('has correct priorities for all types', () => {
    expect(NOTIFICATION_PRIORITIES.grade_drop).toBe(5)
    expect(NOTIFICATION_PRIORITIES.ctr_drop).toBe(4)
    expect(NOTIFICATION_PRIORITIES.monitoring_alert).toBe(4)
    expect(NOTIFICATION_PRIORITIES.ab_test_completed).toBe(3)
    expect(NOTIFICATION_PRIORITIES.retest_suggested).toBe(3)
    expect(NOTIFICATION_PRIORITIES.optimization_available).toBe(2)
    expect(NOTIFICATION_PRIORITIES.trending_viral).toBe(2)
    expect(NOTIFICATION_PRIORITIES.optimization_resolved).toBe(2)
  })
})

describe('buildDedupKey', () => {
  it('builds video-specific key with week', () => {
    const key = buildDedupKey('ctr_drop', 'vid-123', '2026-W20')
    expect(key).toBe('ctr_drop:vid-123:2026-W20')
  })
  it('builds group key', () => {
    const key = buildDedupKey('grade_drop', null, '2026-W20')
    expect(key).toBe('grade_drop:group:2026-W20')
  })
})

describe('buildNotification', () => {
  it('builds a grade_drop notification', () => {
    const n = buildNotification({
      type: 'grade_drop',
      videoId: 'vid-1',
      videoTitle: 'Como ganhar dinheiro',
      oldGrade: 'A',
      newGrade: 'D',
      weekIso: '2026-W20',
    })
    expect(n.type).toBe('grade_drop')
    expect(n.priority).toBe(5)
    expect(n.title).toContain('Queda')
    expect(n.dedup_key).toContain('grade_drop:vid-1:2026-W20')
  })
  it('builds a trending_viral notification', () => {
    const n = buildNotification({
      type: 'trending_viral',
      videoId: 'vid-2',
      videoTitle: 'Video viral',
      views48h: 50000,
      channelAvg48h: 5000,
      weekIso: '2026-W20',
    })
    expect(n.type).toBe('trending_viral')
    expect(n.priority).toBe(2)
    expect(n.title).toContain('viral')
  })
  it('builds an ab_test_completed notification', () => {
    const n = buildNotification({
      type: 'ab_test_completed',
      videoId: 'vid-3',
      videoTitle: 'Test video',
      testName: 'Thumb Test 1',
      winnerLabel: 'Variante B',
      ctrLift: 18.5,
      weekIso: '2026-W20',
    })
    expect(n.type).toBe('ab_test_completed')
    expect(n.priority).toBe(3)
    expect(n.message).toContain('+18.5%')
  })
})

describe('shouldAggregate', () => {
  it('returns true for 3+ same-type notifications', () => {
    expect(shouldAggregate(3)).toBe(true)
  })
  it('returns false for 1-2 notifications', () => {
    expect(shouldAggregate(2)).toBe(false)
    expect(shouldAggregate(1)).toBe(false)
  })
})

describe('buildGroupNotification', () => {
  it('aggregates multiple grade drops into one', () => {
    const items = [
      { videoTitle: 'Video A', oldGrade: 'A', newGrade: 'C' },
      { videoTitle: 'Video B', oldGrade: 'B', newGrade: 'D' },
      { videoTitle: 'Video C', oldGrade: 'A', newGrade: 'D' },
    ]
    const group = buildGroupNotification('grade_drop', items, '2026-W20')
    expect(group.title).toContain('3 vídeos')
    expect(group.message).toContain('Video A')
    expect(group.message).toContain('Video B')
    expect(group.message).toContain('Video C')
    expect(group.dedup_key).toBe('grade_drop:group:2026-W20')
  })
})
