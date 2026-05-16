import type { PipelineCardItem, PostCard, UnifiedLanes, LaneDef, LaneId } from './hub-types'

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

export function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  return `${months}mo`
}

export const LANE_DEFS: LaneDef[] = [
  { id: 'idea', label: 'Ideia', color: '#f59e0b', dataSource: 'pipeline' },
  { id: 'draft', label: 'Rascunho', color: '#f97316', dataSource: 'pipeline' },
  { id: 'ready', label: 'Pronto', color: '#06b6d4', dataSource: 'pipeline' },
  { id: 'editing', label: 'Em Edição', color: '#3b82f6', dataSource: 'blog' },
  { id: 'scheduled', label: 'Agendado', color: '#a78bfa', dataSource: 'blog' },
  { id: 'published', label: 'Publicado', color: '#22c55e', dataSource: 'blog' },
]

export const SUBSTATUS_BADGES: Record<string, { color: string; labelKey: string }> = {
  idea: { color: 'bg-gray-400/10 text-gray-400', labelKey: 'idea' },
  draft: { color: 'bg-blue-400/10 text-blue-400', labelKey: 'draft' },
  pending_review: { color: 'bg-amber-400/10 text-amber-400', labelKey: 'pendingReview' },
  ready: { color: 'bg-cyan-400/10 text-cyan-400', labelKey: 'ready' },
  queued: { color: 'bg-purple-400/10 text-purple-400', labelKey: 'queued' },
}

const EDITING_STATUSES = new Set(['idea', 'draft', 'pending_review', 'ready', 'queued'])

export function buildUnifiedLanes(
  pipelineItems: PipelineCardItem[],
  posts: PostCard[],
): UnifiedLanes {
  return {
    idea: pipelineItems.filter((i) => i.stage === 'idea'),
    draft: pipelineItems.filter((i) => i.stage === 'draft'),
    ready: pipelineItems.filter((i) => i.stage === 'ready'),
    editing: posts.filter((p) => EDITING_STATUSES.has(p.status)),
    scheduled: posts.filter((p) => p.status === 'scheduled'),
    published: posts.filter((p) => p.status === 'published'),
  }
}

export function sortPipelineLane(
  items: PipelineCardItem[],
  _lane: 'idea' | 'draft' | 'ready',
): PipelineCardItem[] {
  return [...items].sort((a, b) => {
    if (a.sort_order !== 0 || b.sort_order !== 0) {
      return a.sort_order - b.sort_order
    }
    if (a.priority !== b.priority) return b.priority - a.priority
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

export function sortBlogLane(posts: PostCard[], lane: 'editing' | 'scheduled' | 'published'): PostCard[] {
  return [...posts].sort((a, b) => {
    switch (lane) {
      case 'editing':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case 'scheduled':
        return new Date(a.scheduledFor ?? a.createdAt).getTime() - new Date(b.scheduledFor ?? b.createdAt).getTime()
      case 'published':
        return new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime()
    }
  })
}

export function isPipelineLane(lane: LaneId): lane is 'idea' | 'draft' | 'ready' {
  return lane === 'idea' || lane === 'draft' || lane === 'ready'
}

export function isBlogLane(lane: LaneId): lane is 'editing' | 'scheduled' | 'published' {
  return lane === 'editing' || lane === 'scheduled' || lane === 'published'
}
