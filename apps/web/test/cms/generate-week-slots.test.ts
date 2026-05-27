import { describe, it, expect } from 'vitest'
import type {
  SyncScheduleWithChannel,
  BlogCadenceRow,
  NewsletterEditionRow,
  PipelineItemWithSlot,
} from '../../src/lib/pipeline/up-next-types'
import { generateWeekSlots, hydrateWeekSlots } from '../../src/lib/pipeline/generate-week-slots'
import type { WeekSlot } from '../../src/lib/pipeline/up-next-types'

const WEEK_START = '2026-05-25' // Monday
const SITE_TZ = 'America/Sao_Paulo'
const TODAY = '2026-05-25'

function makeSyncSchedule(overrides: Partial<SyncScheduleWithChannel> = {}): SyncScheduleWithChannel {
  return {
    channel_id: 'ch-pt',
    channel_name: 'Canal PT',
    locale: 'pt',
    schedule: { day: 'tuesday', hour: 10 },
    ...overrides,
  }
}

function makeBlogCadence(overrides: Partial<BlogCadenceRow> = {}): BlogCadenceRow {
  return {
    site_id: 'site-1',
    cadence_days: 7,
    cadence_start_date: '2026-05-18',
    cadence_paused: false,
    last_published_at: '2026-05-18',
    locale: 'pt',
    ...overrides,
  }
}

function makeNewsletterEdition(overrides: Partial<NewsletterEditionRow> = {}): NewsletterEditionRow {
  return {
    id: 'nl-1',
    subject: 'Weekly Update',
    status: 'scheduled',
    scheduled_at: '2026-05-27T10:00:00Z',
    ...overrides,
  }
}

function makePipelineItem(overrides: Partial<PipelineItemWithSlot> = {}): PipelineItemWithSlot {
  return {
    id: 'item-1',
    title: 'My Video',
    stage: 'roteiro',
    priority: 1,
    format: 'video',
    language: 'pt-br',
    duration_target: null,
    scheduled_at: null,
    youtube_channel_id: 'ch-pt',
    playlist_id: null,
    playlist_name: null,
    playlist_position: null,
    playlist_total: null,
    channel_label: 'Canal PT',
    ...overrides,
  }
}

describe('generateWeekSlots', () => {
  it('generates video slot for sync schedule on matching day', () => {
    const slots = generateWeekSlots({
      syncSchedules: [makeSyncSchedule({ schedule: { day: 'tuesday', hour: 10 } })],
      blogCadence: null,
      newsletterEditions: [],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })

    const videoSlot = slots.find(s => s.format === 'video')
    expect(videoSlot).toBeDefined()
    expect(videoSlot?.day).toBe('2026-05-26') // Tuesday
    expect(videoSlot?.hour).toBe('10:00')
    expect(videoSlot?.channelLocale).toBe('pt')
    expect(videoSlot?.isRestDay).toBe(false)
  })

  it('generates blog slot from cadence', () => {
    const cadence = makeBlogCadence({
      cadence_days: 7,
      last_published_at: '2026-05-18',
      cadence_paused: false,
    })

    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: cadence,
      newsletterEditions: [],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })

    const blogSlot = slots.find(s => s.format === 'blog_post')
    expect(blogSlot).toBeDefined()
    expect(blogSlot?.day).toBe('2026-05-25') // last_published + 7 = 2026-05-25
    expect(blogSlot?.hour).toBeNull()
    expect(blogSlot?.isRestDay).toBe(false)
  })

  it('skips blog slot when cadence is paused', () => {
    const cadence = makeBlogCadence({ cadence_paused: true })

    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: cadence,
      newsletterEditions: [],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })

    expect(slots.filter(s => s.format === 'blog_post')).toHaveLength(0)
  })

  it('generates newsletter slot from edition with scheduled_at in week', () => {
    const edition = makeNewsletterEdition({
      status: 'scheduled',
      scheduled_at: '2026-05-27T10:00:00Z',
    })

    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: null,
      newsletterEditions: [edition],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })

    const nlSlot = slots.find(s => s.format === 'newsletter')
    expect(nlSlot).toBeDefined()
    expect(nlSlot?.day).toBe('2026-05-27')
  })

  it('marks Saturday and Sunday as rest days when no schedules', () => {
    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: null,
      newsletterEditions: [],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })

    const saturday = slots.find(s => s.day === '2026-05-30')
    const sunday = slots.find(s => s.day === '2026-05-31')
    expect(saturday?.isRestDay).toBe(true)
    expect(sunday?.isRestDay).toBe(true)
  })

  it('stacks two schedules on same day as separate slots', () => {
    const schedules: SyncScheduleWithChannel[] = [
      makeSyncSchedule({
        channel_id: 'ch-pt',
        locale: 'pt',
        schedule: { day: 'tuesday', hour: 10 },
      }),
      makeSyncSchedule({
        channel_id: 'ch-en',
        channel_name: 'Canal EN',
        locale: 'en',
        schedule: { day: 'tuesday', hour: 14 },
      }),
    ]

    const slots = generateWeekSlots({
      syncSchedules: schedules,
      blogCadence: null,
      newsletterEditions: [],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })

    const tuesdaySlots = slots.filter(s => s.day === '2026-05-26' && s.format === 'video')
    expect(tuesdaySlots).toHaveLength(2)
    const locales = tuesdaySlots.map(s => s.channelLocale).sort()
    expect(locales).toEqual(['en', 'pt'])
  })

  it('handles empty inputs gracefully (only rest day sentinels)', () => {
    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: null,
      newsletterEditions: [],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })

    // No content slots — only the two rest day sentinels for Sat/Sun
    expect(slots.filter(s => !s.isRestDay)).toHaveLength(0)
    expect(slots.every(s => s.isRestDay)).toBe(true)
    expect(slots).toHaveLength(2)
  })

  it('uses cadence_start_date when last_published_at is null and start is before today', () => {
    // last_published_at=null → start from cadence_start_date (2026-05-01, Thursday)
    // Advance in cadence_days (7) intervals: 05-01→05-08→05-15→05-22→05-29→06-05
    // 2026-06-05 (Thursday) is within week [2026-06-01..2026-06-07] → preserves cadence rhythm
    const cadence: BlogCadenceRow = {
      site_id: 's1', cadence_days: 7, cadence_start_date: '2026-05-01',
      cadence_paused: false, last_published_at: null, locale: 'pt',
    }
    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: cadence,
      newsletterEditions: [],
      weekStart: '2026-06-01',
      siteTimezone: 'America/Sao_Paulo',
      today: '2026-06-01',
    })
    const blogSlots = slots.filter(s => s.format === 'blog_post')
    expect(blogSlots).toHaveLength(1)
    expect(blogSlots[0].day).toBe('2026-06-05')
  })

  it('excludes newsletter editions with sent status', () => {
    const editions: NewsletterEditionRow[] = [{
      id: 'ne-1', subject: 'Sent', status: 'sent',
      scheduled_at: '2026-05-27T14:00:00Z',
    }]
    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: null,
      newsletterEditions: editions,
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })
    expect(slots.filter(s => s.format === 'newsletter')).toHaveLength(0)
  })

  it('skips blog slot when cadence_days is 0', () => {
    const cadence = makeBlogCadence({ cadence_days: 0 })
    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: cadence,
      newsletterEditions: [],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })
    expect(slots.filter(s => s.format === 'blog_post')).toHaveLength(0)
  })

  it('skips newsletter with null scheduled_at', () => {
    const edition = makeNewsletterEdition({ scheduled_at: null })
    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: null,
      newsletterEditions: [edition],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })
    expect(slots.filter(s => s.format === 'newsletter')).toHaveLength(0)
  })

  it('sorts slots by day ASC then hour ASC', () => {
    const schedules: SyncScheduleWithChannel[] = [
      makeSyncSchedule({ channel_id: 'ch-en', channel_name: 'Canal EN', locale: 'en', schedule: { day: 'wednesday', hour: 14 } }),
      makeSyncSchedule({ channel_id: 'ch-pt', channel_name: 'Canal PT', locale: 'pt', schedule: { day: 'tuesday', hour: 18 } }),
      makeSyncSchedule({ channel_id: 'ch-pt2', channel_name: 'Canal PT2', locale: 'pt', schedule: { day: 'tuesday', hour: 10 } }),
    ]
    const slots = generateWeekSlots({
      syncSchedules: schedules,
      blogCadence: null,
      newsletterEditions: [],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })
    // Filter to non-rest-day slots only (the content slots)
    const contentSlots = slots.filter(s => !s.isRestDay)
    expect(contentSlots).toHaveLength(3)
    // Tuesday 10:00 < Tuesday 18:00 < Wednesday 14:00
    expect(contentSlots[0].day).toBe('2026-05-26')
    expect(contentSlots[0].hour).toBe('10:00')
    expect(contentSlots[1].day).toBe('2026-05-26')
    expect(contentSlots[1].hour).toBe('18:00')
    expect(contentSlots[2].day).toBe('2026-05-27')
    expect(contentSlots[2].hour).toBe('14:00')
  })

  it('skips blog slot when cadence next-pub falls after the week', () => {
    // last_published_at is far enough back that the next publication lands AFTER weekEnd (2026-05-31)
    // last_published_at = 2026-05-25 + 7 days = 2026-06-01, which is outside [2026-05-25..2026-05-31]
    const cadence = makeBlogCadence({
      cadence_days: 7,
      last_published_at: '2026-05-25',
    })

    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: cadence,
      newsletterEditions: [],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })

    expect(slots.filter(s => s.format === 'blog_post')).toHaveLength(0)
  })

  it('excludes newsletter edition with status "queued"', () => {
    // 'queued', 'sending', 'sent' should NOT produce slots; only 'draft', 'ready', 'scheduled'
    const editions: NewsletterEditionRow[] = [
      makeNewsletterEdition({ id: 'nl-queued', status: 'queued', scheduled_at: '2026-05-27T10:00:00Z' }),
      makeNewsletterEdition({ id: 'nl-sending', status: 'sending', scheduled_at: '2026-05-27T12:00:00Z' }),
    ]

    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: null,
      newsletterEditions: editions,
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })

    expect(slots.filter(s => s.format === 'newsletter')).toHaveLength(0)
  })

  it('newsletter on Saturday with existing sync schedule marks isRestDay=false', () => {
    // Saturday has a sync schedule → scheduledDayIndices includes 6
    // Newsletter also lands on Saturday → newsletter slot should have isRestDay: false
    const saturdaySchedule = makeSyncSchedule({
      channel_id: 'ch-pt',
      locale: 'pt',
      schedule: { day: 'saturday', hour: 10 },
    })
    // 2026-05-30T14:00:00Z = 2026-05-30 11:00 BRT — Saturday within the week
    const edition = makeNewsletterEdition({
      id: 'nl-sat',
      status: 'scheduled',
      scheduled_at: '2026-05-30T14:00:00Z',
    })

    const slots = generateWeekSlots({
      syncSchedules: [saturdaySchedule],
      blogCadence: null,
      newsletterEditions: [edition],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })

    const nlSlot = slots.find(s => s.format === 'newsletter')
    expect(nlSlot).toBeDefined()
    expect(nlSlot?.day).toBe('2026-05-30')
    expect(nlSlot?.isRestDay).toBe(false)
  })

  it('advances blog cadence from distant past to current week', () => {
    // last_published_at = 3 months ago (2026-02-25), cadence_days = 7
    // Should advance week by week until it lands inside [2026-05-25..2026-05-31]
    // 2026-02-25 + n*7 until >= today (2026-05-25):
    // 2026-02-25 → 2026-03-04 → ... → 2026-05-20 → 2026-05-27 (within week)
    const cadence = makeBlogCadence({
      cadence_days: 7,
      last_published_at: '2026-02-25',
    })

    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: cadence,
      newsletterEditions: [],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })

    const blogSlots = slots.filter(s => s.format === 'blog_post')
    expect(blogSlots).toHaveLength(1)
    // Must be within the current week [2026-05-25..2026-05-31]
    expect(blogSlots[0].day >= '2026-05-25').toBe(true)
    expect(blogSlots[0].day <= '2026-05-31').toBe(true)
    // Must preserve the day-of-week rhythm: 2026-02-25 is Wednesday, so result must also be Wednesday
    expect(blogSlots[0].day).toBe('2026-05-27')
  })

  it('all slots have assignedItem null and effortMinutes 0', () => {
    const slots = generateWeekSlots({
      syncSchedules: [makeSyncSchedule({ schedule: { day: 'tuesday', hour: 10 } })],
      blogCadence: makeBlogCadence(),
      newsletterEditions: [makeNewsletterEdition()],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })

    const contentSlots = slots.filter(s => !s.isRestDay)
    expect(contentSlots.length).toBeGreaterThan(0)
    for (const slot of slots) {
      expect(slot.assignedItem).toBeNull()
      expect(slot.effortMinutes).toBe(0)
    }
  })
})

describe('hydrateWeekSlots', () => {
  it('matches a pipeline item with scheduled_at to the correct slot', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', title: 'My Video', stage: 'edicao', format: 'video',
      youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem).toEqual({ id: 'v1', title: 'My Video', stage: 'edicao' })
    expect(result[0].effortMinutes).toBe(90)
  })

  it('does not match item when day differs', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-27T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem).toBeNull()
  })

  it('does not match item when format differs', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'b1', format: 'blog_post', youtube_channel_id: null,
      scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem).toBeNull()
  })

  it('does not match item when hour differs on a slot that has hour', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T14:00:00',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem).toBeNull()
  })

  it('does not match item to wrong channel on same-day same-hour slots', () => {
    const slots: WeekSlot[] = [
      {
        day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
        channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
        assignedItem: null, effortMinutes: 0,
      },
      {
        day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
        channelLocale: 'en', channelId: 'ch-en', isRestDay: false,
        assignedItem: null, effortMinutes: 0,
      },
    ]
    const items = [makePipelineItem({
      id: 'v1', title: 'PT Video', youtube_channel_id: 'ch-pt',
      scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem?.id).toBe('v1')
    expect(result[1].assignedItem).toBeNull()
  })

  it('matches blog slot with hour=null by day+format only', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-25', dayLabel: 'Seg', hour: null, format: 'blog_post',
      channelLocale: null, channelId: null, isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'b1', title: 'Blog Post', stage: 'draft', format: 'blog_post',
      youtube_channel_id: null, scheduled_at: '2026-05-25T00:00:00',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem).toEqual({ id: 'b1', title: 'Blog Post', stage: 'draft' })
  })

  it('matches newsletter slot by day+format', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-27', dayLabel: 'Qua', hour: null, format: 'newsletter',
      channelLocale: null, channelId: null, isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'nl1', title: 'Newsletter', stage: 'draft', format: 'newsletter',
      youtube_channel_id: null, scheduled_at: '2026-05-27T14:00:00',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem).toEqual({ id: 'nl1', title: 'Newsletter', stage: 'draft' })
  })

  it('does not assign same item to two slots', () => {
    const slots: WeekSlot[] = [
      {
        day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
        channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
        assignedItem: null, effortMinutes: 0,
      },
      {
        day: '2026-05-26', dayLabel: 'Ter', hour: '14:00', format: 'video',
        channelLocale: 'en', channelId: 'ch-en', isRestDay: false,
        assignedItem: null, effortMinutes: 0,
      },
    ]
    const items = [makePipelineItem({
      id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    const assigned = result.filter(s => s.assignedItem !== null)
    expect(assigned).toHaveLength(1)
    expect(assigned[0].hour).toBe('10:00')
  })

  it('assigns first matching item when multiple items match same slot', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [
      makePipelineItem({ id: 'v1', title: 'First', stage: 'edicao', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T10:00:00' }),
      makePipelineItem({ id: 'v2', title: 'Second', stage: 'gravacao', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T10:00:00' }),
    ]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem?.id).toBe('v1')
  })

  it('skips items without scheduled_at', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({ id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: null })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem).toBeNull()
  })

  it('skips items with malformed scheduled_at (too short)', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({ id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05' })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem).toBeNull()
  })

  it('skips rest day slots', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-30', dayLabel: 'Sab', hour: null, format: 'video',
      channelLocale: null, channelId: null, isRestDay: true,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({ id: 'v1', scheduled_at: '2026-05-30T00:00:00' })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem).toBeNull()
  })

  it('preserves slot that already has an assignedItem', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: { id: 'existing', title: 'Already Here', stage: 'gravacao' },
      effortMinutes: 240,
    }]
    const items = [makePipelineItem({
      id: 'different', title: 'New Item', stage: 'edicao',
      youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem?.id).toBe('existing')
    expect(result[0].effortMinutes).toBe(240)
  })

  it('does not match channel-less item to channel-specific slot', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', youtube_channel_id: null, scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem).toBeNull()
  })

  it('returns effortMinutes 0 for items at published stage', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', stage: 'published', youtube_channel_id: 'ch-pt',
      scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem).not.toBeNull()
    expect(result[0].effortMinutes).toBe(0)
  })

  it('returns effortMinutes 0 for items at scheduled stage or later', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', stage: 'scheduled', youtube_channel_id: 'ch-pt',
      scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem).not.toBeNull()
    expect(result[0].effortMinutes).toBe(0)
  })

  it('matches item with timezone-aware scheduled_at (trailing Z, local hour match)', () => {
    // 2026-05-26T13:00:00Z = 10:00 BRT (America/Sao_Paulo = UTC-3)
    // slot hour '10:00' is a local BRT hour — must match local time, not UTC
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T13:00:00Z',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem).not.toBeNull()
  })

  it('does not match item whose UTC time is same hour but different local hour', () => {
    // 2026-05-26T10:00:00Z = 07:00 BRT — should NOT match slot hour '10:00'
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T10:00:00Z',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    expect(result[0].assignedItem).toBeNull()
  })

  it('does not mutate input slots array', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const original = JSON.parse(JSON.stringify(slots))
    const items = [makePipelineItem({
      id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T10:00:00',
    })]

    hydrateWeekSlots(slots, items, SITE_TZ)
    expect(slots).toEqual(original)
  })

  it('returns empty array when slots is empty', () => {
    expect(hydrateWeekSlots([], [makePipelineItem()], SITE_TZ)).toEqual([])
  })

  it('returns unchanged slots when pipelineItems is empty', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const result = hydrateWeekSlots(slots, [])
    expect(result[0].assignedItem).toBeNull()
  })

  it('matches newsletter item scheduled at 01:00Z to BRT date (not UTC date)', () => {
    // 2026-05-27T01:00:00Z = 2026-05-26T22:00:00 BRT (UTC-3)
    // The local BRT date is May 26, NOT May 27
    // generateWeekSlots uses toZonedTime + formatInTimeZone so slot.day = '2026-05-26'
    // hydrateWeekSlots must also use formatInTimeZone so it matches the same slot
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: null, format: 'newsletter',
      channelLocale: null, channelId: null, isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'nl-tz', title: 'TZ Newsletter', stage: 'draft', format: 'newsletter',
      youtube_channel_id: null, scheduled_at: '2026-05-27T01:00:00Z',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    // Local BRT date of the item is 2026-05-26, same as slot.day → must match
    expect(result[0].assignedItem).toEqual({ id: 'nl-tz', title: 'TZ Newsletter', stage: 'draft' })
  })

  it('does not match item when UTC midnight-crossing shifts local date to the next day', () => {
    // 2026-05-27T05:00:00Z = 2026-05-27T02:00:00 BRT — local date is May 27
    // slot.day = '2026-05-26' — should NOT match because local dates differ
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: null, format: 'newsletter',
      channelLocale: null, channelId: null, isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'nl-next', title: 'Next Day NL', stage: 'draft', format: 'newsletter',
      youtube_channel_id: null, scheduled_at: '2026-05-27T05:00:00Z',
    })]

    const result = hydrateWeekSlots(slots, items, SITE_TZ)
    // Local BRT date is 2026-05-27, different from slot.day '2026-05-26' → no match
    expect(result[0].assignedItem).toBeNull()
  })
})

describe('blog cadence multi-week', () => {
  it('generates blog slot for week 3 (future week)', () => {
    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: makeBlogCadence({
        cadence_days: 7,
        cadence_start_date: '2026-05-18',
        last_published_at: '2026-05-18',
      }),
      newsletterEditions: [],
      weekStart: '2026-06-08', // Week 3
      siteTimezone: SITE_TZ,
      today: '2026-05-25',
    })
    const blogSlots = slots.filter(s => s.format === 'blog_post' && !s.isRestDay)
    expect(blogSlots.length).toBe(1)
    expect(blogSlots[0]!.day).toBe('2026-06-08')
  })

  it('generates blog slot for week 5 (far future)', () => {
    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: makeBlogCadence({
        cadence_days: 7,
        cadence_start_date: '2026-05-18',
        last_published_at: '2026-05-18',
      }),
      newsletterEditions: [],
      weekStart: '2026-06-22', // Week 5
      siteTimezone: SITE_TZ,
      today: '2026-05-25',
    })
    const blogSlots = slots.filter(s => s.format === 'blog_post' && !s.isRestDay)
    expect(blogSlots.length).toBe(1)
    expect(blogSlots[0]!.day).toBe('2026-06-22')
  })

  it('generates multiple blog slots in one week with short cadence (2 days)', () => {
    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: makeBlogCadence({
        cadence_days: 2,
        cadence_start_date: '2026-05-18',
        last_published_at: '2026-05-24',
      }),
      newsletterEditions: [],
      weekStart: '2026-05-25', // current week
      siteTimezone: SITE_TZ,
      today: '2026-05-25',
    })
    const allBlogSlots = slots.filter(s => s.format === 'blog_post')
    // 2026-05-26, 2026-05-28, 2026-05-30 (every 2 days within Mon-Sun)
    expect(allBlogSlots.length).toBe(3)
    // 2026-05-30 is Saturday → isRestDay=true (no sync schedules override it)
    const nonRestBlogSlots = allBlogSlots.filter(s => !s.isRestDay)
    expect(nonRestBlogSlots.length).toBe(2)
  })

  it('generates no blog slot for weeks before cadence starts', () => {
    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: makeBlogCadence({
        cadence_days: 7,
        cadence_start_date: '2026-06-15',
        last_published_at: null,
      }),
      newsletterEditions: [],
      weekStart: '2026-06-01',
      siteTimezone: SITE_TZ,
      today: '2026-05-25',
    })
    const blogSlots = slots.filter(s => s.format === 'blog_post' && !s.isRestDay)
    expect(blogSlots.length).toBe(0)
  })
})
