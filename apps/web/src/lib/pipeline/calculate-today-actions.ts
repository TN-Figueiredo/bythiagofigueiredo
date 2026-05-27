import { parseISO, formatISO, addDays, subDays, startOfISOWeek, endOfISOWeek } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import {
  STAGE_ORDER,
  URGENCY_ORDER,
  EFFORT_DEFAULTS,
  LOCALE_TO_LANGUAGE,
  DAY_INDEX,
  type Stage,
} from './up-next-constants'
import { getProductionDeadline } from './get-production-deadline'
import { computeUrgencyScore } from './compute-urgency-score'
import type {
  TodayActionsInput,
  TodayActionsResult,
  TodayAction,
  PipelineItemWithSlot,
} from './up-next-types'

/* ------------------------------------------------------------------ */
/*  Private helpers                                                     */
/* ------------------------------------------------------------------ */

function formatEffort(minutes: number): string {
  if (minutes < 60) return `~${minutes}min`
  return `~${Math.round(minutes / 60)}h`
}

function getEffort(
  item: Pick<PipelineItemWithSlot, 'duration_target' | 'format' | 'stage'>,
): { effort: 'deep' | 'medium' | 'quick'; minutes: number } {
  if (item.duration_target !== null && item.duration_target > 0) {
    const effort: 'deep' | 'medium' | 'quick' =
      item.duration_target <= 30
        ? 'quick'
        : item.duration_target <= 90
          ? 'medium'
          : 'deep'
    return { effort, minutes: item.duration_target }
  }
  const key = `${item.format}:${item.stage}`
  return EFFORT_DEFAULTS[key] ?? { effort: 'quick', minutes: 30 }
}

function computeUrgency(deadline: string, today: string): 'overdue' | 'today' | 'tomorrow' | 'this_week' {
  if (deadline < today) return 'overdue'
  if (deadline === today) return 'today'
  const tomorrow = formatISO(addDays(parseISO(today), 1), { representation: 'date' })
  if (deadline === tomorrow) return 'tomorrow'
  return 'this_week'
}

function getActionLabel(
  format: 'video' | 'blog_post' | 'newsletter' | 'course' | 'campaign',
  stage: Stage,
): string {
  if (format === 'video') {
    if (STAGE_ORDER[stage] <= STAGE_ORDER['roteiro']) return 'Finalizar roteiro'
    if (stage === 'gravacao') return 'Gravar'
    return 'Revisar edicao'
  }
  if (format === 'blog_post') {
    if (stage === 'ready') return 'Revisar post'
    return 'Escrever post'
  }
  if (format === 'newsletter') {
    if (stage === 'ready') return 'Revisar newsletter'
    return 'Escrever newsletter'
  }
  return 'Trabalhar'
}

function deadlineLabel(deadline: string, today: string): string {
  const urgency = computeUrgency(deadline, today)
  if (urgency === 'overdue') return 'Atrasado'
  if (urgency === 'today') return 'Hoje'
  if (urgency === 'tomorrow') return 'Amanhã'
  return 'Esta semana'
}

/* ------------------------------------------------------------------ */
/*  Main function                                                       */
/* ------------------------------------------------------------------ */

export function calculateTodayActions(input: TodayActionsInput): TodayActionsResult {
  const {
    pipelineItems,
    blogCadence,
    newsletterEditions,
    syncSchedules,
    siteTimezone,
    now,
    maxCards,
    doneToday,
  } = input

  // Guard: nothing to process
  if (
    syncSchedules.length === 0 &&
    blogCadence === null &&
    newsletterEditions.length === 0
  ) {
    return { actions: [], overflow: 0, doneToday, totalSurfaced: 0, totalEffortMinutes: 0 }
  }

  const zonedNow = toZonedTime(now, siteTimezone)
  const today = formatISO(zonedNow, { representation: 'date' })
  const weekStart = formatISO(startOfISOWeek(zonedNow), { representation: 'date' })
  const weekEnd = formatISO(endOfISOWeek(zonedNow), { representation: 'date' })

  // Only items that haven't been scheduled/published yet
  const activePipelineItems = pipelineItems.filter(
    (item) => STAGE_ORDER[item.stage] < STAGE_ORDER['scheduled'],
  )

  const unsortedActions: TodayAction[] = []
  const assignedIds = new Set<string>()

  /* ---------------------------------------------------------------- */
  /*  Path 1 — Video (from syncSchedules)                             */
  /* ---------------------------------------------------------------- */
  for (const schedule of syncSchedules) {
    const { day, hour } = schedule.schedule
    const dayIdx = DAY_INDEX[day.toLowerCase()]
    if (dayIdx === undefined) continue

    // Compute slot day within current ISO week (Mon=1 … Sun=7, but we store Sun=0)
    // startOfISOWeek gives Monday. Adjust: Mon=1 maps to +0, Sun=0 maps to +6
    const weekMon = startOfISOWeek(zonedNow)
    const offsetDays = dayIdx === 0 ? 6 : dayIdx - 1
    const slotDay = formatISO(addDays(weekMon, offsetDays), { representation: 'date' })

    if (slotDay < weekStart || slotDay > weekEnd) continue

    const channelLang = LOCALE_TO_LANGUAGE[schedule.locale]

    // Find matching pipeline items: video format, matching channel (orphan=null matches any), matching language
    const candidates = activePipelineItems.filter((item) => {
      if (item.format !== 'video') return false
      if (item.youtube_channel_id !== null && item.youtube_channel_id !== schedule.channel_id) return false
      if (item.language !== 'both' && item.language !== channelLang) return false
      if (assignedIds.has(item.id)) return false
      return true
    })

    if (candidates.length === 0) continue

    // Take the most-progressed item (highest STAGE_ORDER)
    const best = candidates.reduce((prev, curr) =>
      STAGE_ORDER[curr.stage] > STAGE_ORDER[prev.stage] ? curr : prev,
    )
    assignedIds.add(best.id)

    const deadline = getProductionDeadline(slotDay, best.stage)
    if (!deadline) continue
    if (deadline > weekEnd) continue

    const { effort, minutes } = getEffort(best)
    const urgency = computeUrgency(deadline, today)
    const actionLabel = getActionLabel('video', best.stage)

    unsortedActions.push({
      id: best.id,
      itemTitle: best.title,
      actionLabel,
      format: 'video',
      language: best.language,
      effort,
      effortEstimate: formatEffort(minutes),
      effortMinutes: minutes,
      urgency,
      priority: best.priority,
      stage: best.stage,
      deadline: { label: deadlineLabel(deadline, today), date: deadline },
      playlistContext:
        best.playlist_id && best.playlist_name && best.playlist_position !== null && best.playlist_total !== null
          ? { name: best.playlist_name, position: best.playlist_position, total: best.playlist_total }
          : null,
      channelLabel: schedule.channel_name,
      pubDate: slotDay,
      urgencyScore: computeUrgencyScore({
        deadline: deadline,
        today,
        stage: best.stage,
        effortMinutes: minutes,
      }),
    })
  }

  /* ---------------------------------------------------------------- */
  /*  Path 2 — Blog (from blogCadence)                                */
  /* ---------------------------------------------------------------- */
  if (
    blogCadence !== null &&
    !blogCadence.cadence_paused &&
    (blogCadence.cadence_days ?? 0) > 0 &&
    blogCadence.cadence_start_date !== null
  ) {
    const cadenceDays = blogCadence.cadence_days as number
    const todayDate = parseISO(today)

    // Compute next publication date — unified with generateWeekSlots logic
    let nextPub: Date
    if (blogCadence.last_published_at !== null) {
      nextPub = addDays(parseISO(blogCadence.last_published_at), cadenceDays)
    } else {
      nextPub = parseISO(blogCadence.cadence_start_date)
    }
    while (nextPub < todayDate) {
      nextPub = addDays(nextPub, cadenceDays)
    }

    const nextPubStr = formatISO(nextPub, { representation: 'date' })
    const blogDeadline = formatISO(subDays(nextPub, 1), { representation: 'date' })

    // Fire if deadline is within this week (deadline <= weekEnd) AND deadline <= today or within week
    if (blogDeadline <= weekEnd) {
      // Find best matching blog_post item
      const blogCandidates = activePipelineItems.filter((item) => item.format === 'blog_post')

      const best =
        blogCandidates.length > 0
          ? blogCandidates.reduce((prev, curr) =>
              STAGE_ORDER[curr.stage] > STAGE_ORDER[prev.stage] ? curr : prev,
            )
          : null

      const stage: Stage = best?.stage ?? 'idea'
      const { effort, minutes } = best ? getEffort(best) : (EFFORT_DEFAULTS['blog_post:idea'] ?? { effort: 'deep', minutes: 120 })
      const urgency = computeUrgency(blogDeadline, today)
      const actionLabel = getActionLabel('blog_post', stage)

      unsortedActions.push({
        id: best?.id ?? `blog-cadence-${nextPubStr}`,
        itemTitle: best?.title ?? 'Post do Blog',
        actionLabel,
        format: 'blog_post',
        language: best?.language ?? 'pt-br',
        effort,
        effortEstimate: formatEffort(minutes),
        effortMinutes: minutes,
        urgency,
        priority: best?.priority ?? 5,
        stage,
        deadline: { label: deadlineLabel(blogDeadline, today), date: blogDeadline },
        playlistContext: null,
        channelLabel: null,
        pubDate: nextPubStr,
        urgencyScore: computeUrgencyScore({
          deadline: blogDeadline,
          today,
          stage,
          effortMinutes: minutes,
        }),
        ...(best === null && { isPhantom: true }),
      })
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Path 3 — Newsletter (from newsletterEditions)                   */
  /* ---------------------------------------------------------------- */
  for (const edition of newsletterEditions) {
    if (edition.status !== 'draft' && edition.status !== 'ready') continue
    if (!edition.scheduled_at) continue

    const pubDate = formatISO(parseISO(edition.scheduled_at), { representation: 'date' })

    // Skip if scheduled_at is already in the past
    if (pubDate < today) continue

    const deadlineDate = formatISO(subDays(parseISO(pubDate), 1), { representation: 'date' })

    if (deadlineDate > weekEnd) continue

    const stage: Stage = edition.status === 'ready' ? 'ready' : 'draft'
    const effortKey = `newsletter:${stage}`
    const { effort, minutes } = EFFORT_DEFAULTS[effortKey] ?? { effort: 'quick', minutes: 30 }
    const urgency = computeUrgency(deadlineDate, today)
    const actionLabel = getActionLabel('newsletter', stage)

    unsortedActions.push({
      id: edition.id,
      itemTitle: edition.subject,
      actionLabel,
      format: 'newsletter',
      language: 'pt-br',
      effort,
      effortEstimate: formatEffort(minutes),
      effortMinutes: minutes,
      urgency,
      priority: 5,
      stage,
      deadline: { label: deadlineLabel(deadlineDate, today), date: deadlineDate },
      playlistContext: null,
      channelLabel: null,
      pubDate,
      urgencyScore: computeUrgencyScore({
        deadline: deadlineDate,
        today,
        stage,
        effortMinutes: minutes,
      }),
    })
  }

  /* ---------------------------------------------------------------- */
  /*  Batching                                                         */
  /* ---------------------------------------------------------------- */
  type BatchKey = string
  const batchMap = new Map<BatchKey, TodayAction[]>()

  for (const action of unsortedActions) {
    const key: BatchKey = `${action.effort}|${action.stage}|${action.format}|${action.channelLabel ?? ''}`
    const existing = batchMap.get(key)
    if (existing) {
      existing.push(action)
    } else {
      batchMap.set(key, [action])
    }
  }

  const mergedActions: TodayAction[] = []

  for (const [, group] of batchMap) {
    const first = group[0]
    if (!first) continue

    if (group.length === 1) {
      mergedActions.push(first)
    } else {
      // Merge into batch card
      const totalMinutes = group.reduce((sum, a) => sum + a.effortMinutes, 0)
      const earliestDeadline = group.reduce(
        (min, a) => (a.deadline.date < min ? a.deadline.date : min),
        first.deadline.date,
      )
      const highestUrgency = group.reduce((best, a) =>
        (URGENCY_ORDER[a.urgency] ?? 99) < (URGENCY_ORDER[best.urgency] ?? 99) ? a : best,
        first,
      )
      const highestPriority = Math.max(...group.map((a) => a.priority))

      const { format } = first
      const batchTitle =
        format === 'video'
          ? `Gravar ${group.length} videos`
          : format === 'blog_post'
            ? `Escrever ${group.length} posts`
            : `Escrever ${group.length} newsletters`

      const maxUrgencyScore = Math.max(...group.map(a => a.urgencyScore ?? 0))

      const batchCard: TodayAction = {
        ...first,
        itemTitle: batchTitle,
        effortMinutes: totalMinutes,
        effortEstimate: formatEffort(totalMinutes),
        urgency: highestUrgency.urgency,
        priority: highestPriority,
        deadline: { label: deadlineLabel(earliestDeadline, today), date: earliestDeadline },
        batchItems: group.map((a) => a.id),
        urgencyScore: maxUrgencyScore,
      }
      mergedActions.push(batchCard)
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Sorting                                                          */
  /* ---------------------------------------------------------------- */
  mergedActions.sort((a, b) => {
    // 1. urgencyScore DESC (higher = more urgent = first)
    const scoreDiff = (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0)
    if (scoreDiff !== 0) return scoreDiff

    // 2. urgency bucket ASC (tiebreaker within same score)
    const urgencyDiff = (URGENCY_ORDER[a.urgency] ?? 99) - (URGENCY_ORDER[b.urgency] ?? 99)
    if (urgencyDiff !== 0) return urgencyDiff

    // 3. priority DESC
    const priorityDiff = b.priority - a.priority
    if (priorityDiff !== 0) return priorityDiff

    // 4. pubDate ASC (nulls last)
    if (a.pubDate && b.pubDate) {
      if (a.pubDate < b.pubDate) return -1
      if (a.pubDate > b.pubDate) return 1
      return 0
    }
    if (a.pubDate) return -1
    if (b.pubDate) return 1

    // 5. id ASC
    return a.id.localeCompare(b.id)
  })

  /* ---------------------------------------------------------------- */
  /*  Output                                                           */
  /* ---------------------------------------------------------------- */
  const totalSurfaced = mergedActions.length
  const totalEffortMinutes = mergedActions.reduce((sum, a) => sum + a.effortMinutes, 0)
  const actions = mergedActions.slice(0, maxCards)
  const overflow = totalSurfaced - actions.length

  return { actions, overflow, doneToday, totalSurfaced, totalEffortMinutes }
}
