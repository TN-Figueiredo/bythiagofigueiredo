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

  it('builds group key when videoId is null', () => {
    const key = buildDedupKey('grade_drop', null, '2026-W20')
    expect(key).toBe('grade_drop:group:2026-W20')
  })

  it('is consistent across calls with the same arguments', () => {
    const key1 = buildDedupKey('ctr_drop', 'vid-1', '2026-W21')
    const key2 = buildDedupKey('ctr_drop', 'vid-1', '2026-W21')
    expect(key1).toBe(key2)
  })

  it('produces unique keys for different videoIds', () => {
    const keyA = buildDedupKey('grade_drop', 'vid-1', '2026-W20')
    const keyB = buildDedupKey('grade_drop', 'vid-2', '2026-W20')
    expect(keyA).not.toBe(keyB)
  })

  it('produces unique keys for different types on the same video', () => {
    const keyA = buildDedupKey('grade_drop', 'vid-1', '2026-W20')
    const keyB = buildDedupKey('ctr_drop', 'vid-1', '2026-W20')
    expect(keyA).not.toBe(keyB)
  })

  it('produces unique keys for different weeks on the same video', () => {
    const keyA = buildDedupKey('grade_drop', 'vid-1', '2026-W20')
    const keyB = buildDedupKey('grade_drop', 'vid-1', '2026-W21')
    expect(keyA).not.toBe(keyB)
  })

  it('treats empty string videoId as group (same as null)', () => {
    const key = buildDedupKey('grade_drop', '', '2026-W20')
    expect(key).toBe('grade_drop:group:2026-W20')
  })

  it('works for all 8 notification types', () => {
    const types = [
      'grade_drop',
      'ctr_drop',
      'monitoring_alert',
      'ab_test_completed',
      'retest_suggested',
      'optimization_available',
      'trending_viral',
      'optimization_resolved',
    ] as const
    for (const type of types) {
      const key = buildDedupKey(type, 'vid-x', '2026-W01')
      expect(key).toBe(`${type}:vid-x:2026-W01`)
    }
  })
})

describe('shouldAggregate', () => {
  it('returns false for count below threshold (< 3)', () => {
    expect(shouldAggregate(0)).toBe(false)
    expect(shouldAggregate(1)).toBe(false)
    expect(shouldAggregate(2)).toBe(false)
  })

  it('returns true at the threshold boundary (= 3)', () => {
    expect(shouldAggregate(3)).toBe(true)
  })

  it('returns true for 3+ same-type notifications', () => {
    expect(shouldAggregate(3)).toBe(true)
  })

  it('returns true for count above threshold', () => {
    expect(shouldAggregate(10)).toBe(true)
    expect(shouldAggregate(100)).toBe(true)
  })

  it('returns false for 1-2 notifications', () => {
    expect(shouldAggregate(2)).toBe(false)
    expect(shouldAggregate(1)).toBe(false)
  })
})

describe('buildNotification', () => {
  const week = '2026-W20'

  describe('grade_drop', () => {
    it('produces correct shape', () => {
      const n = buildNotification({
        type: 'grade_drop',
        videoId: 'vid-1',
        videoTitle: 'Como ganhar dinheiro',
        oldGrade: 'A',
        newGrade: 'D',
        weekIso: week,
      })
      expect(n.type).toBe('grade_drop')
      expect(n.priority).toBe(5)
      expect(n.title).toContain('Queda')
      expect(n.dedup_key).toContain('grade_drop:vid-1:2026-W20')
      expect(n.message).toContain('A')
      expect(n.message).toContain('D')
      expect(n.video_id).toBe('vid-1')
      expect(n.action_href).toContain('/cms/youtube/analytics')
      expect(n.action_href).toContain('vid-1')
      expect(n.suggested_action).toBeTruthy()
    })

    it('truncates long titles to 40 chars in the title field', () => {
      const longTitle = 'A'.repeat(60)
      const n = buildNotification({
        type: 'grade_drop',
        videoId: 'vid-2',
        videoTitle: longTitle,
        oldGrade: 'A',
        newGrade: 'C',
        weekIso: week,
      })
      const titleContent = n.title.replace('Queda de grade: ', '')
      expect(titleContent.length).toBeLessThanOrEqual(40)
    })

    it('includes both grade values in the message', () => {
      const n = buildNotification({
        type: 'grade_drop',
        videoId: 'vid-1',
        videoTitle: 'Test',
        oldGrade: 'B',
        newGrade: 'D',
        weekIso: week,
      })
      expect(n.message).toContain('B')
      expect(n.message).toContain('D')
    })
  })

  describe('ctr_drop', () => {
    it('produces correct shape', () => {
      const n = buildNotification({
        type: 'ctr_drop',
        videoId: 'vid-2',
        videoTitle: 'CTR Test Video',
        currentCtr: 2.3,
        avgCtr: 5.0,
        weekIso: week,
      })
      expect(n.type).toBe('ctr_drop')
      expect(n.priority).toBe(4)
      expect(n.title).toContain('CTR Test Video')
      expect(n.message).toContain('2.3')
      expect(n.message).toContain('5.0')
      expect(n.dedup_key).toBe(`ctr_drop:vid-2:${week}`)
      expect(n.video_id).toBe('vid-2')
      expect(n.action_href).toContain('vid-2')
      expect(n.suggested_action).toBeUndefined()
    })

    it('formats CTR values to 1 decimal place', () => {
      const n = buildNotification({
        type: 'ctr_drop',
        videoId: 'vid-2',
        videoTitle: 'Test',
        currentCtr: 2.3456,
        avgCtr: 5.6789,
        weekIso: week,
      })
      expect(n.message).toContain('2.3')
      expect(n.message).toContain('5.7')
    })
  })

  describe('monitoring_alert', () => {
    it('produces correct shape with positive delta', () => {
      const n = buildNotification({
        type: 'monitoring_alert',
        videoId: 'vid-3',
        videoTitle: 'Monitoring Video',
        checkDay: 7,
        ctrDelta: 2.5,
        weekIso: week,
      })
      expect(n.type).toBe('monitoring_alert')
      expect(n.priority).toBe(4)
      expect(n.title).toContain('Monitoring Video')
      expect(n.message).toContain('Dia 7')
      expect(n.message).toContain('+2.5')
      expect(n.dedup_key).toBe(`monitoring_alert:vid-3:${week}`)
      expect(n.video_id).toBe('vid-3')
    })

    it('omits + prefix for negative delta', () => {
      const n = buildNotification({
        type: 'monitoring_alert',
        videoId: 'vid-3',
        videoTitle: 'Test',
        checkDay: 14,
        ctrDelta: -1.5,
        weekIso: week,
      })
      expect(n.message).not.toContain('+-')
      expect(n.message).toContain('-1.5')
    })

    it('includes check day number in message', () => {
      const n = buildNotification({
        type: 'monitoring_alert',
        videoId: 'vid-3',
        videoTitle: 'Test',
        checkDay: 30,
        ctrDelta: 0.5,
        weekIso: week,
      })
      expect(n.message).toContain('Dia 30')
    })
  })

  describe('ab_test_completed', () => {
    it('produces correct shape', () => {
      const n = buildNotification({
        type: 'ab_test_completed',
        videoId: 'vid-3',
        videoTitle: 'Test video',
        testName: 'Thumb Test 1',
        winnerLabel: 'Variante B',
        ctrLift: 18.5,
        weekIso: week,
      })
      expect(n.type).toBe('ab_test_completed')
      expect(n.priority).toBe(3)
      expect(n.title).toContain('Thumb Test 1')
      expect(n.message).toContain('Variante B')
      expect(n.message).toContain('+18.5%')
      expect(n.dedup_key).toBe(`ab_test_completed:vid-3:${week}`)
      expect(n.video_id).toBe('vid-3')
      expect(n.action_href).toContain('/cms/youtube/ab-lab')
    })

    it('formats ctrLift to 1 decimal place', () => {
      const n = buildNotification({
        type: 'ab_test_completed',
        videoId: 'vid-4',
        videoTitle: 'Test',
        testName: 'Test',
        winnerLabel: 'A',
        ctrLift: 8.123,
        weekIso: week,
      })
      expect(n.message).toContain('8.1')
    })
  })

  describe('retest_suggested', () => {
    it('produces correct shape', () => {
      const n = buildNotification({
        type: 'retest_suggested',
        videoId: 'vid-5',
        videoTitle: 'Retest Video',
        weekIso: week,
      })
      expect(n.type).toBe('retest_suggested')
      expect(n.priority).toBe(3)
      expect(n.title).toContain('Retest Video')
      expect(n.message).toBeTruthy()
      expect(n.dedup_key).toBe(`retest_suggested:vid-5:${week}`)
      expect(n.video_id).toBe('vid-5')
      expect(n.action_href).toContain('vid-5')
    })
  })

  describe('optimization_available', () => {
    it('produces correct shape', () => {
      const n = buildNotification({
        type: 'optimization_available',
        videoId: 'vid-6',
        videoTitle: 'Optimize Me',
        weekIso: week,
      })
      expect(n.type).toBe('optimization_available')
      expect(n.priority).toBe(2)
      expect(n.title).toContain('Optimize Me')
      expect(n.message).toBeTruthy()
      expect(n.dedup_key).toBe(`optimization_available:vid-6:${week}`)
      expect(n.video_id).toBe('vid-6')
      expect(n.action_href).toContain('vid-6')
    })
  })

  describe('trending_viral', () => {
    it('produces correct shape', () => {
      const n = buildNotification({
        type: 'trending_viral',
        videoId: 'vid-2',
        videoTitle: 'Video viral',
        views48h: 50000,
        channelAvg48h: 5000,
        weekIso: week,
      })
      expect(n.type).toBe('trending_viral')
      expect(n.priority).toBe(2)
      expect(n.title).toContain('viral')
      expect(n.message).toContain('Video viral')
      expect(n.message).toContain('10x')
      expect(n.dedup_key).toBe(`trending_viral:vid-2:${week}`)
      expect(n.video_id).toBe('vid-2')
      expect(n.action_href).toContain('vid-2')
    })

    it('rounds multiplier correctly', () => {
      const n = buildNotification({
        type: 'trending_viral',
        videoId: 'vid-7',
        videoTitle: 'Test',
        views48h: 15000,
        channelAvg48h: 3000,
        weekIso: week,
      })
      // 15000 / 3000 = 5x
      expect(n.message).toContain('5x')
    })

    it('truncates long videoTitle to 30 chars in message', () => {
      const longTitle = 'Z'.repeat(50)
      const n = buildNotification({
        type: 'trending_viral',
        videoId: 'vid-7',
        videoTitle: longTitle,
        views48h: 10000,
        channelAvg48h: 1000,
        weekIso: week,
      })
      const sliced = longTitle.slice(0, 30)
      expect(n.message).toContain(sliced)
      expect(n.message).not.toContain(longTitle)
    })
  })

  describe('optimization_resolved', () => {
    it('produces correct shape', () => {
      const n = buildNotification({
        type: 'optimization_resolved',
        videoId: 'vid-8',
        videoTitle: 'Resolved Video',
        weekIso: week,
      })
      expect(n.type).toBe('optimization_resolved')
      expect(n.priority).toBe(2)
      expect(n.title).toBeTruthy()
      expect(n.message).toContain('Resolved Video')
      expect(n.dedup_key).toBe(`optimization_resolved:vid-8:${week}`)
      expect(n.video_id).toBe('vid-8')
      expect(n.action_href).toContain('vid-8')
    })

    it('truncates long videoTitle to 30 chars in message', () => {
      const longTitle = 'X'.repeat(50)
      const n = buildNotification({
        type: 'optimization_resolved',
        videoId: 'vid-8',
        videoTitle: longTitle,
        weekIso: week,
      })
      const sliced = longTitle.slice(0, 30)
      expect(n.message).toContain(sliced)
      expect(n.message).not.toContain(longTitle)
    })
  })

  describe('shared shape invariants', () => {
    it('every notification type has all required fields', () => {
      const notifications = [
        buildNotification({ type: 'grade_drop', videoId: 'v', videoTitle: 'T', oldGrade: 'A', newGrade: 'C', weekIso: week }),
        buildNotification({ type: 'ctr_drop', videoId: 'v', videoTitle: 'T', currentCtr: 2.0, avgCtr: 5.0, weekIso: week }),
        buildNotification({ type: 'monitoring_alert', videoId: 'v', videoTitle: 'T', checkDay: 7, ctrDelta: 1.0, weekIso: week }),
        buildNotification({ type: 'ab_test_completed', videoId: 'v', videoTitle: 'T', testName: 'N', winnerLabel: 'B', ctrLift: 5.0, weekIso: week }),
        buildNotification({ type: 'retest_suggested', videoId: 'v', videoTitle: 'T', weekIso: week }),
        buildNotification({ type: 'optimization_available', videoId: 'v', videoTitle: 'T', weekIso: week }),
        buildNotification({ type: 'trending_viral', videoId: 'v', videoTitle: 'T', views48h: 10000, channelAvg48h: 1000, weekIso: week }),
        buildNotification({ type: 'optimization_resolved', videoId: 'v', videoTitle: 'T', weekIso: week }),
      ]
      for (const n of notifications) {
        expect(typeof n.type).toBe('string')
        expect(typeof n.priority).toBe('number')
        expect(n.priority).toBeGreaterThan(0)
        expect(typeof n.title).toBe('string')
        expect(n.title.length).toBeGreaterThan(0)
        expect(typeof n.message).toBe('string')
        expect(n.message.length).toBeGreaterThan(0)
        expect(typeof n.dedup_key).toBe('string')
        expect(n.dedup_key.length).toBeGreaterThan(0)
      }
    })

    it('dedup_key always contains the type and weekIso', () => {
      const n = buildNotification({
        type: 'grade_drop',
        videoId: 'vid-x',
        videoTitle: 'Test',
        oldGrade: 'B',
        newGrade: 'D',
        weekIso: '2026-W42',
      })
      expect(n.dedup_key).toContain('grade_drop')
      expect(n.dedup_key).toContain('2026-W42')
    })

    it('priority matches NOTIFICATION_PRIORITIES for each type', () => {
      const cases = [
        { type: 'grade_drop', extra: { oldGrade: 'A', newGrade: 'C' } },
        { type: 'ctr_drop', extra: { currentCtr: 2.0, avgCtr: 5.0 } },
        { type: 'monitoring_alert', extra: { checkDay: 7, ctrDelta: 0.5 } },
        { type: 'ab_test_completed', extra: { testName: 'T', winnerLabel: 'B', ctrLift: 5.0 } },
        { type: 'retest_suggested', extra: {} },
        { type: 'optimization_available', extra: {} },
        { type: 'trending_viral', extra: { views48h: 10000, channelAvg48h: 1000 } },
        { type: 'optimization_resolved', extra: {} },
      ] as const

      for (const { type, extra } of cases) {
        const n = buildNotification({ type, videoId: 'v', videoTitle: 'T', weekIso: week, ...extra } as Parameters<typeof buildNotification>[0])
        expect(n.priority).toBe(NOTIFICATION_PRIORITIES[type])
      }
    })
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

  it('produces group dedup key — no videoId in key', () => {
    const result = buildGroupNotification(
      'grade_drop',
      [{ videoTitle: 'Video A', oldGrade: 'B', newGrade: 'D' }],
      '2026-W20',
    )
    expect(result.dedup_key).toBe('grade_drop:group:2026-W20')
    expect(result.dedup_key).not.toContain(':vid')
  })

  it('video_id is absent (group notification)', () => {
    const result = buildGroupNotification('grade_drop', [{ videoTitle: 'T' }], '2026-W20')
    expect(result.video_id).toBeUndefined()
  })

  it('includes bullet list in message', () => {
    const items = [
      { videoTitle: 'Alpha', oldGrade: 'A', newGrade: 'C' },
      { videoTitle: 'Beta', oldGrade: 'B', newGrade: 'D' },
    ]
    const result = buildGroupNotification('grade_drop', items, '2026-W20')
    expect(result.message).toContain('•')
    expect(result.message).toContain('Alpha')
    expect(result.message).toContain('Beta')
  })

  it('includes grade transition arrows when grades provided', () => {
    const items = [{ videoTitle: 'Test', oldGrade: 'A', newGrade: 'D' }]
    const result = buildGroupNotification('grade_drop', items, '2026-W20')
    expect(result.message).toContain('→')
    expect(result.message).toContain('A')
    expect(result.message).toContain('D')
  })

  it('omits grade arrows when grades not provided', () => {
    const items = [{ videoTitle: 'Test' }]
    const result = buildGroupNotification('ctr_drop', items, '2026-W20')
    expect(result.message).not.toContain('→')
  })

  it('action_href points to analytics grades tab', () => {
    const result = buildGroupNotification('grade_drop', [{ videoTitle: 'T' }], '2026-W20')
    expect(result.action_href).toContain('/cms/youtube/analytics')
    expect(result.action_href).toContain('grades')
  })

  it('priority matches NOTIFICATION_PRIORITIES for the type', () => {
    const result = buildGroupNotification('grade_drop', [{ videoTitle: 'T' }], '2026-W20')
    expect(result.priority).toBe(NOTIFICATION_PRIORITIES.grade_drop)
  })
})
