import { describe, it, expect } from 'vitest'
import { scanBufferDepth, type BufferDepthResult, type BufferDepthInput } from '../../src/lib/pipeline/scan-buffer-depth'
import type {
  SyncScheduleWithChannel,
  BlogCadenceRow,
  NewsletterEditionRow,
  PipelineItemWithSlot,
} from '../../src/lib/pipeline/up-next-types'

function makeSync(overrides: Partial<SyncScheduleWithChannel> = {}): SyncScheduleWithChannel {
  return {
    channel_id: 'ch-1',
    channel_name: 'Canal PT',
    locale: 'pt',
    schedule: { day: 'tuesday', hour: 10, tz: 'America/Sao_Paulo', label: 'Tue 10h' },
    ...overrides,
  }
}

function makeBlogCadence(overrides: Partial<BlogCadenceRow> = {}): BlogCadenceRow {
  return {
    site_id: 'site-1',
    cadence_days: 7,
    cadence_start_date: '2026-05-01',
    cadence_paused: false,
    last_published_at: '2026-05-18',
    locale: 'pt',
    ...overrides,
  }
}

function makePipelineItem(overrides: Partial<PipelineItemWithSlot> = {}): PipelineItemWithSlot {
  return {
    id: 'item-1',
    title: 'Test Item',
    stage: 'draft',
    priority: 5,
    format: 'video',
    language: 'pt-br',
    duration_target: null,
    scheduled_at: null,
    youtube_channel_id: 'ch-1',
    playlist_id: null,
    playlist_name: null,
    playlist_position: null,
    playlist_total: null,
    channel_label: 'Canal PT',
    ...overrides,
  }
}

describe('scanBufferDepth', () => {
  const baseInput: BufferDepthInput = {
    syncSchedules: [makeSync()],
    blogCadence: makeBlogCadence(),
    newsletterEditions: [],
    pipelineItems: [],
    today: '2026-05-25',
    siteTimezone: 'America/Sao_Paulo',
    weeksToScan: 16,
  }

  it('returns per-format coverage', () => {
    const result = scanBufferDepth(baseInput)
    expect(result.formats).toBeDefined()
    expect(result.formats.video).toBeDefined()
    expect(result.formats.video.totalSlots).toBeGreaterThan(0)
    expect(result.formats.video.filledSlots).toBe(0) // no items assigned
  })

  it('counts filled slots when items have scheduled_at', () => {
    const items: PipelineItemWithSlot[] = [
      makePipelineItem({
        id: 'v1',
        format: 'video',
        scheduled_at: '2026-05-26T13:00:00Z',
        youtube_channel_id: 'ch-1',
        stage: 'gravacao',
      }),
    ]
    const result = scanBufferDepth({ ...baseInput, pipelineItems: items })
    expect(result.formats.video.filledSlots).toBeGreaterThanOrEqual(1)
  })

  it('computes blog_post coverage from cadence', () => {
    const result = scanBufferDepth(baseInput)
    expect(result.formats.blog_post).toBeDefined()
    expect(result.formats.blog_post.totalSlots).toBeGreaterThan(0)
  })

  it('returns health status: green when >=75% filled', () => {
    // 1 sync schedule = 1 slot per week on Tuesday
    // 4 weeks scanned = 4 total slots
    // 3 items scheduled on Tuesdays = 3 filled = 75% = green
    const tuesdays = ['2026-05-26', '2026-06-02', '2026-06-09']
    const items: PipelineItemWithSlot[] = tuesdays.map((day, i) =>
      makePipelineItem({
        id: `v${i}`,
        format: 'video',
        scheduled_at: `${day}T13:00:00Z`,
        youtube_channel_id: 'ch-1',
        stage: 'scheduled',
      })
    )
    const result = scanBufferDepth({
      ...baseInput,
      blogCadence: null,
      pipelineItems: items,
      weeksToScan: 4,
    })
    expect(result.formats.video.filledSlots).toBe(3)
    expect(result.formats.video.totalSlots).toBe(4)
    expect(result.formats.video.health).toBe('green')
  })

  it('returns health status: yellow when 40-74% filled', () => {
    // 4 weeks, 1 sync = 4 slots, 2 filled = 50% = yellow
    const items: PipelineItemWithSlot[] = ['2026-05-26', '2026-06-02'].map((day, i) =>
      makePipelineItem({
        id: `v${i}`,
        format: 'video',
        scheduled_at: `${day}T13:00:00Z`,
        youtube_channel_id: 'ch-1',
        stage: 'scheduled',
      })
    )
    const result = scanBufferDepth({
      ...baseInput,
      blogCadence: null,
      pipelineItems: items,
      weeksToScan: 4,
    })
    expect(result.formats.video.filledSlots).toBe(2)
    expect(result.formats.video.health).toBe('yellow')
  })

  it('returns health status: red when 0% filled', () => {
    const result = scanBufferDepth({
      ...baseInput,
      blogCadence: null,
      pipelineItems: [],
    })
    expect(result.formats.video.health).toBe('red')
  })

  it('handles empty input (no schedules, no cadence)', () => {
    const result = scanBufferDepth({
      ...baseInput,
      syncSchedules: [],
      blogCadence: null,
      newsletterEditions: [],
    })
    expect(Object.keys(result.formats)).toHaveLength(0)
  })

  it('uses custom weeksToScan', () => {
    const result4 = scanBufferDepth({ ...baseInput, weeksToScan: 4, blogCadence: null })
    const result16 = scanBufferDepth({ ...baseInput, weeksToScan: 16, blogCadence: null })
    expect(result16.formats.video.totalSlots).toBeGreaterThan(result4.formats.video.totalSlots)
  })

  it('includes summary with overall health', () => {
    const result = scanBufferDepth(baseInput)
    expect(result.overallHealth).toBeDefined()
    expect(['green', 'yellow', 'red']).toContain(result.overallHealth)
  })
})
