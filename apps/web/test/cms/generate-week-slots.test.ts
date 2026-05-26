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
    timezone: SITE_TZ,
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
      pipelineItems: [],
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
      pipelineItems: [],
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
      pipelineItems: [],
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
      pipelineItems: [],
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
      pipelineItems: [],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })

    const saturday = slots.find(s => s.day === '2026-05-30')
    const sunday = slots.find(s => s.day === '2026-05-31')
    expect(saturday?.isRestDay).toBe(true)
    expect(sunday?.isRestDay).toBe(true)
  })

  it('assigns most-progressed pipeline item to matching slot', () => {
    const lowerItem = makePipelineItem({ id: 'item-low', stage: 'idea', priority: 1 })
    const higherItem = makePipelineItem({ id: 'item-high', stage: 'edicao', priority: 2 })

    const slots = generateWeekSlots({
      syncSchedules: [makeSyncSchedule({ schedule: { day: 'tuesday', hour: 10 } })],
      blogCadence: null,
      newsletterEditions: [],
      pipelineItems: [lowerItem, higherItem],
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })

    const videoSlot = slots.find(s => s.format === 'video')
    expect(videoSlot?.assignedItem?.id).toBe('item-high')
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
      pipelineItems: [],
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
      pipelineItems: [],
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
      pipelineItems: [],
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
      pipelineItems: [],
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
      pipelineItems: [],
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
      pipelineItems: [],
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
      pipelineItems: [],
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

  it('does not assign same item to two slots', () => {
    const schedules = [
      makeSyncSchedule({ channel_id: 'ch-pt', schedule: { day: 'tuesday', hour: 10 } }),
      makeSyncSchedule({ channel_id: 'ch-pt', schedule: { day: 'wednesday', hour: 10 } }),
    ]
    const items = [makePipelineItem({ id: 'p1', format: 'video', stage: 'gravacao', youtube_channel_id: 'ch-pt', language: 'pt-br' })]
    const slots = generateWeekSlots({
      syncSchedules: schedules,
      blogCadence: null,
      newsletterEditions: [],
      pipelineItems: items,
      weekStart: WEEK_START,
      siteTimezone: SITE_TZ,
      today: TODAY,
    })
    const assignedSlots = slots.filter(s => s.assignedItem?.id === 'p1')
    expect(assignedSlots).toHaveLength(1)
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

    const result = hydrateWeekSlots(slots, items)
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

    const result = hydrateWeekSlots(slots, items)
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

    const result = hydrateWeekSlots(slots, items)
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

    const result = hydrateWeekSlots(slots, items)
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

    const result = hydrateWeekSlots(slots, items)
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

    const result = hydrateWeekSlots(slots, items)
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

    const result = hydrateWeekSlots(slots, items)
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

    const result = hydrateWeekSlots(slots, items)
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

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem?.id).toBe('v1')
  })

  it('skips items without scheduled_at', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({ id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: null })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).toBeNull()
  })

  it('skips items with malformed scheduled_at (too short)', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({ id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05' })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).toBeNull()
  })

  it('skips rest day slots', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-30', dayLabel: 'Sab', hour: null, format: 'video',
      channelLocale: null, channelId: null, isRestDay: true,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({ id: 'v1', scheduled_at: '2026-05-30T00:00:00' })]

    const result = hydrateWeekSlots(slots, items)
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

    const result = hydrateWeekSlots(slots, items)
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

    const result = hydrateWeekSlots(slots, items)
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

    const result = hydrateWeekSlots(slots, items)
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

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).not.toBeNull()
    expect(result[0].effortMinutes).toBe(0)
  })

  it('matches item with timezone-aware scheduled_at (trailing Z)', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T10:00:00Z',
    })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).not.toBeNull()
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

    hydrateWeekSlots(slots, items)
    expect(slots).toEqual(original)
  })

  it('returns empty array when slots is empty', () => {
    expect(hydrateWeekSlots([], [makePipelineItem()])).toEqual([])
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
})
