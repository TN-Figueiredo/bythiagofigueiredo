import { describe, it, expect } from 'vitest'
import type {
  SyncScheduleWithChannel,
  BlogCadenceRow,
  NewsletterEditionRow,
  PipelineItemWithSlot,
} from '../../src/lib/pipeline/up-next-types'
import { generateWeekSlots } from '../../src/lib/pipeline/generate-week-slots'

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
})
