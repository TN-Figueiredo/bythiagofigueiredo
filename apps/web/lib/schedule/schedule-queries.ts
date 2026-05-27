import type { SupabaseClient } from '@supabase/supabase-js'
import { generateSlots } from '@tn-figueiredo/newsletter'
import type { CadenceConfig, SlotOptions } from '@tn-figueiredo/newsletter'
import { DAY_INDEX } from '@/lib/pipeline/up-next-constants'
import type { SyncScheduleEntry } from '@/lib/youtube/types'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type ContentType = 'blog' | 'newsletter' | 'video'
export type ItemStatus = 'published' | 'scheduled' | 'queued' | 'overdue' | 'cadence'

export interface CalendarItem {
  id: string
  type: ContentType
  title: string
  status: ItemStatus
  dateKey: string // YYYY-MM-DD
  time: string | null // HH:MM or null
  editUrl: string
}

export interface CadenceSlot {
  dateKey: string
  type: ContentType
  contextId: string
  createUrl: string
}

export interface ScheduleMetrics {
  publishedThisMonth: number
  scheduledAhead: number
  cadenceHealthPct: number
  overdueCount: number
}

export interface BacklogItem {
  id: string
  type: ContentType
  title: string
  editUrl: string
}

export interface ScheduleCalendarData {
  month: string // YYYY-MM
  today: string // YYYY-MM-DD
  items: CalendarItem[]
  cadenceSlots: CadenceSlot[]
  metrics: ScheduleMetrics
  backlog: BacklogItem[]
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getMonthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

function todayInTz(timezone: string): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: timezone })
}

function extractTime(isoOrNull: string | null): string | null {
  if (!isoOrNull) return null
  const d = new Date(isoOrNull)
  if (isNaN(d.getTime())) return null
  const h = String(d.getUTCHours()).padStart(2, '0')
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function extractDateKey(isoOrNull: string | null, timezone: string): string | null {
  if (!isoOrNull) return null
  const d = new Date(isoOrNull)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { timeZone: timezone })
}

export function computeItemStatus(
  rawStatus: string,
  dateKey: string,
  today: string,
): ItemStatus {
  if (rawStatus === 'published' || rawStatus === 'sent') return 'published'
  if (dateKey < today) return 'overdue'
  if (rawStatus === 'scheduled') return 'scheduled'
  return 'queued'
}

export function computeMetrics(
  items: CalendarItem[],
  cadenceSlots: CadenceSlot[],
  month: string,
  today: string,
): ScheduleMetrics {
  const { start, end } = getMonthRange(month)

  const publishedThisMonth = items.filter(
    (i) => i.status === 'published' && i.dateKey >= start && i.dateKey <= end,
  ).length

  const scheduledAhead = items.filter(
    (i) => (i.status === 'scheduled' || i.status === 'queued') && i.dateKey >= today,
  ).length

  const overdueCount = items.filter((i) => i.status === 'overdue').length

  // Cadence health: % of cadence slots within the month that have a matching item
  const monthCadenceSlots = cadenceSlots.filter(
    (s) => s.dateKey >= start && s.dateKey <= end,
  )
  const filledCadence = monthCadenceSlots.filter((slot) =>
    items.some((i) => i.dateKey === slot.dateKey && i.type === slot.type),
  ).length
  const cadenceHealthPct =
    monthCadenceSlots.length === 0
      ? 100
      : Math.round((filledCadence / monthCadenceSlots.length) * 100)

  return { publishedThisMonth, scheduledAhead, cadenceHealthPct, overdueCount }
}

/* ------------------------------------------------------------------ */
/*  Main query                                                        */
/* ------------------------------------------------------------------ */

export async function fetchScheduleData(
  supabase: SupabaseClient,
  siteId: string,
  month: string,
  timezone: string,
): Promise<ScheduleCalendarData> {
  const today = todayInTz(timezone)
  const { start, end } = getMonthRange(month)

  // Expand range to include a few days before/after for display context
  const rangeStart = start
  const rangeEnd = end

  const [blogRes, blogPublishedRes, newsletterRes, newsletterPublishedRes, videoRes, videoPublishedRes, nlTypesRes, ytChannelsRes, blogCadenceRes, backlogBlogRes, backlogNlRes, backlogVideoRes] = await Promise.all([
    // Blog posts: scheduled/queued within month range
    supabase
      .from('blog_posts')
      .select('id, status, slot_date, published_at, blog_translations!inner(title)')
      .eq('site_id', siteId)
      .in('status', ['scheduled', 'queued', 'ready'])
      .not('slot_date', 'is', null)
      .gte('slot_date', rangeStart)
      .lte('slot_date', rangeEnd),

    // Blog posts: published within month range
    supabase
      .from('blog_posts')
      .select('id, status, slot_date, published_at, blog_translations!inner(title)')
      .eq('site_id', siteId)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .gte('published_at', `${rangeStart}T00:00:00`)
      .lte('published_at', `${rangeEnd}T23:59:59`),

    // Newsletter editions: scheduled/ready within month range
    supabase
      .from('newsletter_editions')
      .select('id, subject, status, slot_date, scheduled_at')
      .eq('site_id', siteId)
      .in('status', ['scheduled', 'ready'])
      .not('slot_date', 'is', null)
      .gte('slot_date', rangeStart)
      .lte('slot_date', rangeEnd),

    // Newsletter editions: sent within month range
    supabase
      .from('newsletter_editions')
      .select('id, subject, status, slot_date, scheduled_at, sent_at')
      .eq('site_id', siteId)
      .eq('status', 'sent')
      .not('sent_at', 'is', null)
      .gte('sent_at', `${rangeStart}T00:00:00`)
      .lte('sent_at', `${rangeEnd}T23:59:59`),

    // Video pipeline items: scheduled within month range
    supabase
      .from('content_pipeline')
      .select('id, title, stage, scheduled_at')
      .eq('site_id', siteId)
      .eq('format', 'video')
      .in('stage', ['scheduled'])
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', `${rangeStart}T00:00:00`)
      .lte('scheduled_at', `${rangeEnd}T23:59:59`),

    // Video pipeline items: published within month range
    supabase
      .from('content_pipeline')
      .select('id, title, stage, published_at')
      .eq('site_id', siteId)
      .eq('format', 'video')
      .eq('stage', 'published')
      .not('published_at', 'is', null)
      .gte('published_at', `${rangeStart}T00:00:00`)
      .lte('published_at', `${rangeEnd}T23:59:59`),

    // Newsletter types (for cadence slots)
    supabase
      .from('newsletter_types')
      .select('id, name, cadence_days, cadence_start_date, cadence_paused, last_sent_at')
      .eq('site_id', siteId)
      .eq('active', true),

    // YouTube channels (for video cadence slots)
    supabase
      .from('youtube_channels')
      .select('id, locale, sync_schedules, sync_enabled')
      .eq('site_id', siteId)
      .eq('sync_enabled', true),

    // Blog cadence
    supabase
      .from('blog_cadence')
      .select('id, locale, cadence_days, cadence_start_date, cadence_paused')
      .eq('site_id', siteId)
      .eq('cadence_paused', false),

    // Backlog: blog posts ready with no slot
    supabase
      .from('blog_posts')
      .select('id, blog_translations!inner(title)')
      .eq('site_id', siteId)
      .eq('status', 'ready')
      .is('slot_date', null)
      .order('queue_position', { ascending: true, nullsFirst: false })
      .limit(20),

    // Backlog: newsletter editions ready with no slot
    supabase
      .from('newsletter_editions')
      .select('id, subject')
      .eq('site_id', siteId)
      .eq('status', 'ready')
      .is('slot_date', null)
      .order('queue_position', { ascending: true, nullsFirst: false })
      .limit(20),

    // Backlog: video pipeline items in backlog-like stages
    supabase
      .from('content_pipeline')
      .select('id, title')
      .eq('site_id', siteId)
      .eq('format', 'video')
      .in('stage', ['ready', 'review'])
      .limit(20),
  ])

  if (blogRes.error) console.error('[schedule-queries]', blogRes.error.message)
  if (blogPublishedRes.error) console.error('[schedule-queries]', blogPublishedRes.error.message)
  if (newsletterRes.error) console.error('[schedule-queries]', newsletterRes.error.message)
  if (newsletterPublishedRes.error) console.error('[schedule-queries]', newsletterPublishedRes.error.message)
  if (videoRes.error) console.error('[schedule-queries]', videoRes.error.message)
  if (videoPublishedRes.error) console.error('[schedule-queries]', videoPublishedRes.error.message)
  if (nlTypesRes.error) console.error('[schedule-queries]', nlTypesRes.error.message)
  if (ytChannelsRes.error) console.error('[schedule-queries]', ytChannelsRes.error.message)
  if (blogCadenceRes.error) console.error('[schedule-queries]', blogCadenceRes.error.message)
  if (backlogBlogRes.error) console.error('[schedule-queries]', backlogBlogRes.error.message)
  if (backlogNlRes.error) console.error('[schedule-queries]', backlogNlRes.error.message)
  if (backlogVideoRes.error) console.error('[schedule-queries]', backlogVideoRes.error.message)

  // Map blog items
  const items: CalendarItem[] = []

  for (const row of blogRes.data ?? []) {
    const translations = row.blog_translations as
      | { title: string }[]
      | { title: string }
      | null
    const title = Array.isArray(translations)
      ? translations[0]?.title ?? 'Untitled'
      : (translations as { title: string } | null)?.title ?? 'Untitled'
    const dateKey = (row.slot_date as string) ?? ''
    items.push({
      id: row.id as string,
      type: 'blog',
      title,
      status: computeItemStatus(row.status as string, dateKey, today),
      dateKey,
      time: extractTime(row.published_at as string | null),
      editUrl: `/cms/blog/${row.id}`,
    })
  }

  for (const row of blogPublishedRes.data ?? []) {
    // Skip if already in items (could appear in both queries)
    if (items.some((i) => i.id === row.id)) continue
    const translations = row.blog_translations as
      | { title: string }[]
      | { title: string }
      | null
    const title = Array.isArray(translations)
      ? translations[0]?.title ?? 'Untitled'
      : (translations as { title: string } | null)?.title ?? 'Untitled'
    const dateKey =
      (row.slot_date as string) ??
      extractDateKey(row.published_at as string | null, timezone) ??
      ''
    items.push({
      id: row.id as string,
      type: 'blog',
      title,
      status: 'published',
      dateKey,
      time: extractTime(row.published_at as string | null),
      editUrl: `/cms/blog/${row.id}`,
    })
  }

  // Map newsletter items
  for (const row of newsletterRes.data ?? []) {
    const dateKey = (row.slot_date as string) ?? ''
    items.push({
      id: row.id as string,
      type: 'newsletter',
      title: (row.subject as string) ?? 'Untitled',
      status: computeItemStatus(row.status as string, dateKey, today),
      dateKey,
      time: extractTime(row.scheduled_at as string | null),
      editUrl: `/cms/newsletters/${row.id}`,
    })
  }

  for (const row of newsletterPublishedRes.data ?? []) {
    if (items.some((i) => i.id === row.id)) continue
    const dateKey =
      (row.slot_date as string) ??
      extractDateKey(row.sent_at as string | null, timezone) ??
      ''
    items.push({
      id: row.id as string,
      type: 'newsletter',
      title: (row.subject as string) ?? 'Untitled',
      status: 'published',
      dateKey,
      time: extractTime(row.sent_at as string | null),
      editUrl: `/cms/newsletters/${row.id}`,
    })
  }

  // Map video items
  for (const row of videoRes.data ?? []) {
    const dateKey = extractDateKey(row.scheduled_at as string | null, timezone) ?? ''
    items.push({
      id: row.id as string,
      type: 'video',
      title: (row.title as string) ?? 'Untitled',
      status: computeItemStatus('scheduled', dateKey, today),
      dateKey,
      time: extractTime(row.scheduled_at as string | null),
      editUrl: `/cms/pipeline/${row.id}`,
    })
  }

  for (const row of videoPublishedRes.data ?? []) {
    if (items.some((i) => i.id === row.id)) continue
    const dateKey = extractDateKey(row.published_at as string | null, timezone) ?? ''
    items.push({
      id: row.id as string,
      type: 'video',
      title: (row.title as string) ?? 'Untitled',
      status: 'published',
      dateKey,
      time: extractTime(row.published_at as string | null),
      editUrl: `/cms/pipeline/${row.id}`,
    })
  }

  // Generate cadence slots from newsletter types
  const cadenceSlots: CadenceSlot[] = []
  for (const nlType of nlTypesRes.data ?? []) {
    const cadenceDays = nlType.cadence_days as number | null
    const startDate = nlType.cadence_start_date as string | null
    const paused = nlType.cadence_paused as boolean
    const lastSentAt = nlType.last_sent_at as string | null

    if (!cadenceDays || cadenceDays <= 0 || paused) continue

    const config: CadenceConfig = {
      cadenceDays,
      startDate: startDate ?? rangeStart,
      lastSentAt: lastSentAt,
      paused: false,
    }
    const opts: SlotOptions = {
      today: rangeStart,
      count: 60,
    }

    try {
      const slots = generateSlots(config, opts)
      for (const slotDate of slots) {
        if (slotDate < rangeStart || slotDate > rangeEnd) continue
        cadenceSlots.push({
          dateKey: slotDate,
          type: 'newsletter',
          contextId: nlType.id as string,
          createUrl: `/cms/newsletters/new?type=${nlType.id}&slot=${slotDate}`,
        })
      }
    } catch {
      // Ignore cadence calculation errors
    }
  }

  // --- Video cadence slots from YouTube sync_schedules ---
  for (const channel of ytChannelsRes.data ?? []) {
    const schedules = (channel.sync_schedules ?? []) as SyncScheduleEntry[]
    if (schedules.length === 0) continue

    const scheduleDays = new Set(schedules.map(s => DAY_INDEX[s.day.toLowerCase()]).filter((d): d is number => d !== undefined))
    const [yr, mo] = month.split('-').map(Number) as [number, number]

    for (let day = 1; day <= new Date(Date.UTC(yr, mo, 0)).getUTCDate(); day++) {
      const d = new Date(Date.UTC(yr, mo - 1, day))
      if (!scheduleDays.has(d.getUTCDay())) continue

      const dateKey = d.toISOString().slice(0, 10)
      if (dateKey < rangeStart || dateKey > rangeEnd) continue

      cadenceSlots.push({
        dateKey,
        type: 'video',
        contextId: channel.id as string,
        createUrl: `/cms/pipeline/new?format=video&lang=${(channel.locale as string) === 'pt' ? 'pt-br' : 'en'}`,
      })
    }
  }

  // --- Blog cadence slots ---
  for (const cadence of blogCadenceRes.data ?? []) {
    const cadenceDays = cadence.cadence_days as number
    if (!cadenceDays || cadenceDays <= 0) continue

    const startDateStr = cadence.cadence_start_date as string | null
    if (!startDateStr) continue

    const startMs = new Date(startDateStr + 'T00:00:00Z').getTime()
    const rangeStartMs = new Date(rangeStart + 'T00:00:00Z').getTime()
    const rangeEndMs = new Date(rangeEnd + 'T00:00:00Z').getTime()
    const intervalMs = cadenceDays * 86_400_000

    // Fast-forward to first slot >= rangeStart
    let offsetSlots = Math.max(0, Math.floor((rangeStartMs - startMs) / intervalMs))
    let currentMs = startMs + offsetSlots * intervalMs

    while (currentMs <= rangeEndMs) {
      if (currentMs >= rangeStartMs) {
        const dateKey = new Date(currentMs).toISOString().slice(0, 10)
        cadenceSlots.push({
          dateKey,
          type: 'blog',
          contextId: cadence.id as string,
          createUrl: `/cms/blog/new?locale=${cadence.locale as string}`,
        })
      }
      currentMs += intervalMs
    }
  }

  // Backlog items
  const backlog: BacklogItem[] = []

  for (const row of backlogBlogRes.data ?? []) {
    const translations = row.blog_translations as
      | { title: string }[]
      | { title: string }
      | null
    const title = Array.isArray(translations)
      ? translations[0]?.title ?? 'Untitled'
      : (translations as { title: string } | null)?.title ?? 'Untitled'
    backlog.push({
      id: row.id as string,
      type: 'blog',
      title,
      editUrl: `/cms/blog/${row.id}`,
    })
  }

  for (const row of backlogNlRes.data ?? []) {
    backlog.push({
      id: row.id as string,
      type: 'newsletter',
      title: (row.subject as string) ?? 'Untitled',
      editUrl: `/cms/newsletters/${row.id}`,
    })
  }

  for (const row of backlogVideoRes.data ?? []) {
    backlog.push({
      id: row.id as string,
      type: 'video',
      title: (row.title as string) ?? 'Untitled',
      editUrl: `/cms/pipeline/${row.id}`,
    })
  }

  // Compute metrics
  const metrics = computeMetrics(items, cadenceSlots, month, today)

  return {
    month,
    today,
    items,
    cadenceSlots,
    metrics,
    backlog,
  }
}
