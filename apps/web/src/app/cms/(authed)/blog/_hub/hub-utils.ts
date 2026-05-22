import type { PipelineCardItem, PostCard, UnifiedLanes, LaneDef, LaneId } from './hub-types'
import type { BlogHubStrings } from '../_i18n/types'

export interface RelativeLabels {
  now: string
  minutes: string
  hours: string
  days: string
  months: string
}

const DEFAULT_LABELS: RelativeLabels = {
  now: 'now',
  minutes: 'm',
  hours: 'h',
  days: 'd',
  months: 'mo',
}

export const BLOG_TRANSITIONS: Record<string, string[]> = {
  idea:           ['draft', 'archived'],
  draft:          ['idea', 'ready', 'pending_review', 'archived'],
  pending_review: ['draft', 'ready', 'archived'],
  ready:          ['draft', 'scheduled', 'queued', 'published', 'archived'],
  queued:         ['ready', 'archived'],
  scheduled:      ['ready', 'draft', 'archived'],
  published:      ['archived'],
  archived:       ['idea', 'draft'],
}

export function isValidTransition(from: string, to: string): boolean {
  return BLOG_TRANSITIONS[from]?.includes(to) ?? false
}

export function getValidTargets(status: string): string[] {
  return BLOG_TRANSITIONS[status] ?? []
}

const KANBAN_COLUMN_STATUSES = new Set<string>(['ready', 'scheduled', 'published'])

export function getKanbanMoveTargets(status: string): string[] {
  return (BLOG_TRANSITIONS[status] ?? []).filter(s => KANBAN_COLUMN_STATUSES.has(s))
}

export function computeDisplayId(rowNumber: number): string {
  const padded = rowNumber < 1000 ? String(rowNumber).padStart(3, '0') : String(rowNumber)
  return `#BP-${padded}`
}

export type KanbanColumnId = 'ready' | 'scheduled' | 'published'

export function mapStatusToColumn(status: PostCard['status']): KanbanColumnId {
  switch (status) {
    case 'idea':
    case 'draft':
    case 'pending_review':
    case 'ready':
    case 'queued': return 'ready'
    case 'scheduled': return 'scheduled'
    case 'published':
    case 'archived': return 'published'
  }
}

export function formatRelativeDate(dateStr: string, labels: RelativeLabels = DEFAULT_LABELS): string {
  const time = new Date(dateStr).getTime()
  if (isNaN(time)) return labels.now
  const diff = Date.now() - time
  if (diff < 0) return labels.now
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return labels.now
  if (mins < 60) return `${mins}${labels.minutes}`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}${labels.hours}`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}${labels.days}`
  const months = Math.floor(days / 30)
  return `${months}${labels.months}`
}

export const LANE_DEFS: LaneDef[] = [
  { id: 'idea', label: 'Ideia', color: '#f59e0b', dataSource: 'pipeline' },
  { id: 'draft', label: 'Rascunho', color: '#f97316', dataSource: 'pipeline' },
  { id: 'ready', label: 'Entrega', color: '#06b6d4', dataSource: 'pipeline' },
  { id: 'scheduled', label: 'Agendado', color: '#a78bfa', dataSource: 'pipeline' },
  { id: 'published', label: 'Publicado', color: '#22c55e', dataSource: 'pipeline' },
]

export const SUBSTATUS_BADGES: Record<string, { color: string; labelKey: keyof BlogHubStrings['substatus'] }> = {
  idea: { color: 'bg-gray-400/10 text-gray-400', labelKey: 'idea' },
  draft: { color: 'bg-blue-400/10 text-blue-400', labelKey: 'draft' },
  pending_review: { color: 'bg-amber-400/10 text-amber-400', labelKey: 'pendingReview' },
  ready: { color: 'bg-cyan-400/10 text-cyan-400', labelKey: 'ready' },
  queued: { color: 'bg-purple-400/10 text-purple-400', labelKey: 'queued' },
}

export function buildUnifiedLanes(
  pipelineItems: PipelineCardItem[],
): UnifiedLanes {
  return {
    idea: pipelineItems.filter((i) => i.stage === 'idea'),
    draft: pipelineItems.filter((i) => i.stage === 'draft'),
    ready: pipelineItems.filter((i) => i.stage === 'ready'),
    scheduled: pipelineItems.filter((i) => i.stage === 'scheduled'),
    published: pipelineItems.filter((i) => i.stage === 'published'),
  }
}

export function sortPipelineLane(
  items: PipelineCardItem[],
  _lane: LaneId,
): PipelineCardItem[] {
  return [...items].sort((a, b) => {
    const aHasOrder = a.sort_order !== 0
    const bHasOrder = b.sort_order !== 0
    if (aHasOrder && bHasOrder) return a.sort_order - b.sort_order
    if (aHasOrder !== bHasOrder) return aHasOrder ? -1 : 1
    if (a.priority !== b.priority) return b.priority - a.priority
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

export function isEditableLane(lane: LaneId): lane is 'idea' | 'draft' | 'ready' {
  return lane === 'idea' || lane === 'draft' || lane === 'ready'
}

export function isReadOnlyLane(lane: LaneId): lane is 'scheduled' | 'published' {
  return lane === 'scheduled' || lane === 'published'
}

export const LOCALE_FLAGS: Record<string, string> = {
  'pt-BR': '\u{1F1E7}\u{1F1F7}',
  pt: '\u{1F1E7}\u{1F1F7}',
  en: '\u{1F1FA}\u{1F1F8}',
  es: '\u{1F1EA}\u{1F1F8}',
}
