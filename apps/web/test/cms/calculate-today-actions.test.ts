import { describe, it, expect } from 'vitest'
import { calculateTodayActions } from '../../src/lib/pipeline/calculate-today-actions'
import type {
  TodayActionsInput,
  PipelineItemWithSlot,
  SyncScheduleWithChannel,
  BlogCadenceRow,
  NewsletterEditionRow,
} from '../../src/lib/pipeline/up-next-types'

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeItem(overrides: Partial<PipelineItemWithSlot> = {}): PipelineItemWithSlot {
  return {
    id: 'item-1',
    title: 'Meu Video',
    stage: 'roteiro',
    priority: 5,
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

function makeSchedule(overrides: Partial<SyncScheduleWithChannel> = {}): SyncScheduleWithChannel {
  return {
    channel_id: 'ch-pt',
    channel_name: 'Canal PT',
    locale: 'pt',
    schedule: { day: 'friday', hour: 18 },
    timezone: 'America/Sao_Paulo',
    ...overrides,
  }
}

function makeBlogCadence(overrides: Partial<BlogCadenceRow> = {}): BlogCadenceRow {
  return {
    site_id: 'site-1',
    cadence_days: 7,
    cadence_start_date: '2026-05-01',
    cadence_paused: false,
    last_published_at: null,
    locale: 'pt',
    ...overrides,
  }
}

function makeEdition(overrides: Partial<NewsletterEditionRow> = {}): NewsletterEditionRow {
  return {
    id: 'edition-1',
    subject: 'Newsletter Semanal',
    status: 'draft',
    scheduled_at: '2026-05-29T18:00:00Z',
    ...overrides,
  }
}

function makeInput(overrides: Partial<TodayActionsInput> = {}): TodayActionsInput {
  return {
    pipelineItems: [],
    blogCadence: null,
    newsletterEditions: [],
    syncSchedules: [],
    siteTimezone: 'America/Sao_Paulo',
    now: new Date('2026-05-26T12:00:00Z'),
    maxCards: 10,
    doneToday: 0,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('calculateTodayActions', () => {
  // 1. Returns empty when no schedules / cadence / editions
  it('returns empty result when no schedules, cadence, or editions', () => {
    const result = calculateTodayActions(makeInput())
    expect(result.actions).toHaveLength(0)
    expect(result.overflow).toBe(0)
    expect(result.totalSurfaced).toBe(0)
    expect(result.totalEffortMinutes).toBe(0)
  })

  // 2. Generates action for video item matching sync schedule
  it('generates action for video item matching sync schedule', () => {
    // Week of 2026-05-25 (Mon) to 2026-05-31 (Sun). Friday = 2026-05-29.
    // now = 2026-05-26 (Tue), siteTimezone = UTC for simplicity.
    // deadline for roteiro from 2026-05-29 is pub-4 = 2026-05-25 (overdue)
    const now = new Date('2026-05-26T12:00:00Z')
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      syncSchedules: [makeSchedule()],
      pipelineItems: [makeItem({ youtube_channel_id: 'ch-pt', language: 'pt-br', stage: 'roteiro' })],
    }))
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].format).toBe('video')
    expect(result.actions[0].stage).toBe('roteiro')
  })

  // 3. Uses EFFORT_DEFAULTS when duration_target is null
  it('uses EFFORT_DEFAULTS when duration_target is null', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      syncSchedules: [makeSchedule()],
      pipelineItems: [makeItem({ duration_target: null, stage: 'roteiro' })],
    }))
    // EFFORT_DEFAULTS['video:roteiro'] = { effort: 'deep', minutes: 180 }
    expect(result.actions[0].effort).toBe('deep')
    expect(result.actions[0].effortMinutes).toBe(180)
    expect(result.actions[0].effortEstimate).toBe('~3h')
  })

  // 4. Uses duration_target when positive
  it('uses duration_target when positive', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      syncSchedules: [makeSchedule()],
      pipelineItems: [makeItem({ duration_target: 45, stage: 'roteiro' })],
    }))
    expect(result.actions[0].effortMinutes).toBe(45)
    expect(result.actions[0].effortEstimate).toBe('~45min')
  })

  // 5. Generates blog action when cadence deadline within week
  it('generates blog action when cadence deadline is within this week', () => {
    // now = 2026-05-26 (Tue) UTC. Blog cadence every 7 days from 2026-05-01.
    // next pub from 2026-05-01 + 7*n >= today: 2026-05-29 (Fri). Deadline = 2026-05-28 (Thu).
    // Thu is within this week (Mon-Sun 2026-05-25 to 2026-05-31).
    const now = new Date('2026-05-26T12:00:00Z')
    const cadence = makeBlogCadence({ cadence_start_date: '2026-05-01', cadence_days: 7 })
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      blogCadence: cadence,
    }))
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].format).toBe('blog_post')
  })

  // 6. Skips blog when cadence_paused
  it('skips blog when cadence_paused is true', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    const cadence = makeBlogCadence({ cadence_paused: true })
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      blogCadence: cadence,
    }))
    expect(result.actions).toHaveLength(0)
  })

  // 7. Generates newsletter action from edition
  it('generates newsletter action from draft edition', () => {
    // now = 2026-05-26 (Tue) UTC. Edition scheduled for 2026-05-27. Deadline = 2026-05-26 = today.
    const now = new Date('2026-05-26T12:00:00Z')
    const edition = makeEdition({ scheduled_at: '2026-05-27T18:00:00Z', status: 'draft' })
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      newsletterEditions: [edition],
    }))
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].format).toBe('newsletter')
    expect(result.actions[0].itemTitle).toBe('Newsletter Semanal')
  })

  // 8. Skips newsletter when status not draft/ready
  it('skips newsletter when status is not draft or ready', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    const edition = makeEdition({ status: 'queued', scheduled_at: '2026-05-27T18:00:00Z' })
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      newsletterEditions: [edition],
    }))
    expect(result.actions).toHaveLength(0)
  })

  // 9. Sorts by urgency then effort then priority
  it('sorts by urgency then effort then priority', () => {
    // now = 2026-05-26 (Tue) UTC.
    // Edition A: scheduled tomorrow (2026-05-27), deadline today → urgency: today, status: draft (deep)
    // Edition B: scheduled day after (2026-05-28), deadline tomorrow → urgency: tomorrow, status: draft (deep)
    // They have different deadlines so different urgency → A comes first.
    // Use different ids so batch keys differ: edition A has id 'a', B has id 'b'
    // To avoid batching, give them different stages by using different statuses
    const now = new Date('2026-05-26T12:00:00Z')
    const editionA = makeEdition({
      id: 'a',
      subject: 'A',
      scheduled_at: '2026-05-27T18:00:00Z',
      status: 'draft',  // deep effort, deadline today → urgency: today
    })
    const editionB = makeEdition({
      id: 'b',
      subject: 'B',
      scheduled_at: '2026-05-28T18:00:00Z',
      status: 'ready',  // quick effort, deadline tomorrow → urgency: tomorrow
    })
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      newsletterEditions: [editionB, editionA],
    }))
    expect(result.actions[0].itemTitle).toBe('A')
    expect(result.actions[1].itemTitle).toBe('B')
  })

  // 10. Batches 2+ items with same key
  it('batches 2+ items with the same effort|stage|format|channelLabel key', () => {
    // Two schedules for the same channel (same name) but different days in the week.
    // Each schedule has a matching video item → two separate actions with same batch key.
    const now = new Date('2026-05-26T12:00:00Z')
    const item1 = makeItem({ id: 'v1', title: 'Video 1', stage: 'roteiro', youtube_channel_id: 'ch-pt' })
    const item2 = makeItem({ id: 'v2', title: 'Video 2', stage: 'roteiro', youtube_channel_id: 'ch-pt' })
    const schedFriday = makeSchedule({ channel_id: 'ch-pt', channel_name: 'Canal PT', schedule: { day: 'friday', hour: 18 } })
    const schedThursday = makeSchedule({ channel_id: 'ch-pt', channel_name: 'Canal PT', schedule: { day: 'thursday', hour: 18 } })
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      syncSchedules: [schedFriday, schedThursday],
      pipelineItems: [item1, item2],
    }))
    // Both actions have key "deep|roteiro|video|Canal PT" → should be batched
    const videoActions = result.actions.filter((a) => a.format === 'video')
    expect(videoActions).toHaveLength(1)
    expect(videoActions[0].batchItems).toBeDefined()
    expect(videoActions[0].batchItems!.length).toBe(2)
  })

  // 11. Respects maxCards and computes overflow
  it('respects maxCards and computes overflow correctly', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    // Create 3 separate actions that won't batch:
    // - 2 newsletter editions (draft, ready — different stages → different batch keys)
    // - 1 blog cadence action
    // Blog cadence: next pub 2026-05-29, deadline 2026-05-28 ≤ weekEnd ✓
    const editions: NewsletterEditionRow[] = [
      { id: 'e1', subject: 'E1', status: 'draft', scheduled_at: '2026-05-27T18:00:00Z' },
      { id: 'e2', subject: 'E2', status: 'ready', scheduled_at: '2026-05-28T18:00:00Z' },
    ]
    const cadence = makeBlogCadence({ cadence_start_date: '2026-05-01', cadence_days: 7 })
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      newsletterEditions: editions,
      blogCadence: cadence,
      maxCards: 2,
    }))
    expect(result.actions).toHaveLength(2)
    expect(result.totalSurfaced).toBe(3)
    expect(result.overflow).toBe(1)
  })

  // 12. Formats effort as ~Xmin for < 60
  it('formats effort as ~Xmin for minutes < 60', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    const edition = makeEdition({ scheduled_at: '2026-05-27T18:00:00Z', status: 'draft' })
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      newsletterEditions: [edition],
    }))
    // EFFORT_DEFAULTS['newsletter:draft'] = { effort: 'deep', minutes: 60 }
    // 60 minutes = ~1h (boundary is >=60 → hours)
    expect(result.actions[0].effortEstimate).toBe('~1h')
  })

  // 13. Formats effort as ~Xh for >= 60
  it('formats effort as ~Xh for minutes >= 60', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      syncSchedules: [makeSchedule()],
      pipelineItems: [makeItem({ stage: 'gravacao', duration_target: 120 })],
    }))
    expect(result.actions[0].effortEstimate).toBe('~2h')
  })

  // 14. Language "both" matches any channel locale
  it('language "both" matches any channel locale', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    const itemBoth = makeItem({ language: 'both', youtube_channel_id: 'ch-pt' })
    const scheduleEn = makeSchedule({ channel_id: 'ch-pt', locale: 'en' })
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      syncSchedules: [scheduleEn],
      pipelineItems: [itemBoth],
    }))
    expect(result.actions).toHaveLength(1)
  })

  // 15. Excludes items at scheduled stage
  it('excludes pipeline items at or past scheduled stage', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    const scheduledItem = makeItem({ stage: 'scheduled' })
    const publishedItem = makeItem({ id: 'item-2', stage: 'published' })
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      syncSchedules: [makeSchedule()],
      pipelineItems: [scheduledItem, publishedItem],
    }))
    expect(result.actions).toHaveLength(0)
  })

  // 16. Computes totalEffortMinutes
  it('computes totalEffortMinutes as sum of all surfaced actions', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    // Two newsletter editions both within deadline
    const editions: NewsletterEditionRow[] = [
      { id: 'e1', subject: 'E1', status: 'draft', scheduled_at: '2026-05-27T18:00:00Z' },
      { id: 'e2', subject: 'E2', status: 'ready', scheduled_at: '2026-05-27T18:00:00Z' },
    ]
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      newsletterEditions: editions,
      maxCards: 10,
    }))
    // draft=60min, ready=20min → total=80min
    expect(result.totalEffortMinutes).toBe(80)
  })

  // Extra: doneToday passes through
  it('passes doneToday through to result', () => {
    const result = calculateTodayActions(makeInput({ doneToday: 3 }))
    expect(result.doneToday).toBe(3)
  })

  // Extra: action label for video + roteiro
  it('sets actionLabel to "Finalizar roteiro" for video at roteiro stage', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      syncSchedules: [makeSchedule()],
      pipelineItems: [makeItem({ stage: 'roteiro' })],
    }))
    expect(result.actions[0].actionLabel).toBe('Finalizar roteiro')
  })

  // Extra: action label for video + gravacao
  it('sets actionLabel to "Gravar" for video at gravacao stage', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      syncSchedules: [makeSchedule()],
      pipelineItems: [makeItem({ stage: 'gravacao' })],
    }))
    expect(result.actions[0].actionLabel).toBe('Gravar')
  })

  // Extra: action label for newsletter + ready
  it('sets actionLabel to "Revisar newsletter" for newsletter at ready stage', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    const edition = makeEdition({ status: 'ready', scheduled_at: '2026-05-27T18:00:00Z' })
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      newsletterEditions: [edition],
    }))
    expect(result.actions[0].actionLabel).toBe('Revisar newsletter')
  })

  // Extra: blog item matched to pipeline item
  it('matches blog cadence action to pipeline blog_post item', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    const cadence = makeBlogCadence({ cadence_start_date: '2026-05-01', cadence_days: 7 })
    const blogItem = makeItem({ id: 'blog-1', format: 'blog_post', stage: 'draft', language: 'pt-br' })
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      blogCadence: cadence,
      pipelineItems: [blogItem],
    }))
    expect(result.actions[0].stage).toBe('draft')
    expect(result.actions[0].id).toBe('blog-1')
  })

  // Extra: skips newsletter with null scheduled_at
  it('skips newsletter edition with null scheduled_at', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    const edition = makeEdition({ scheduled_at: null, status: 'draft' })
    const result = calculateTodayActions(makeInput({
      now,
      siteTimezone: 'UTC',
      newsletterEditions: [edition],
    }))
    expect(result.actions).toHaveLength(0)
  })
})
