import { STAGE_ORDER } from './up-next-constants'
import type { PipelineItemWithSlot, PlaylistSummary, NewsletterEditionRow } from './up-next-types'

interface SuggestionInput {
  pipelineItems: PipelineItemWithSlot[]
  playlists: PlaylistSummary[]
  newsletterEditions: NewsletterEditionRow[]
}

type Suggestion = { text: string; href: string }

function isActiveItem(item: PipelineItemWithSlot): boolean {
  return STAGE_ORDER[item.stage] < STAGE_ORDER['scheduled']
}

function findBatchOpportunity(items: PipelineItemWithSlot[]): Suggestion | null {
  const activeItems = items.filter(isActiveItem)
  const stageCounts = new Map<string, number>()

  for (const item of activeItems) {
    stageCounts.set(item.stage, (stageCounts.get(item.stage) ?? 0) + 1)
  }

  for (const [stage, count] of stageCounts) {
    if (count >= 2) {
      return {
        text: `Bloco de ${stage}: ${count} itens prontos. Trabalhar juntos?`,
        href: `/cms/pipeline?stage=${stage}`,
      }
    }
  }

  return null
}

function findOrphanedItems(items: PipelineItemWithSlot[]): Suggestion | null {
  const orphaned = items.filter(
    (item) =>
      item.format !== 'blog_post' &&
      item.format !== 'newsletter' &&
      item.youtube_channel_id === null,
  )

  if (orphaned.length === 0) return null

  return {
    text: `${orphaned.length} item(s) sem canal configurado.`,
    href: '/cms/pipeline?filter=orphaned',
  }
}

function findNewsletterWithoutDate(editions: NewsletterEditionRow[]): Suggestion | null {
  const unscheduled = editions.find(
    (e) =>
      (e.status === 'draft' || e.status === 'ready') &&
      e.scheduled_at === null,
  )

  if (!unscheduled) return null

  return {
    text: 'Newsletter sem data de envio.',
    href: '/cms/newsletters',
  }
}

function findNearlyCompletePlaylist(playlists: PlaylistSummary[]): Suggestion | null {
  for (const playlist of playlists) {
    if (playlist.total_items <= 0) continue
    const remaining = playlist.total_items - playlist.done_items
    const ratio = remaining / playlist.total_items
    if (ratio <= 0.2) {
      return {
        text: `${playlist.name} esta a ${remaining} item(s) de ser concluida.`,
        href: `/cms/playlists/${playlist.id}`,
      }
    }
  }
  return null
}

export function selectSuggestion(input: SuggestionInput): Suggestion | null {
  const { pipelineItems, playlists, newsletterEditions } = input

  return (
    findBatchOpportunity(pipelineItems) ??
    findOrphanedItems(pipelineItems) ??
    findNewsletterWithoutDate(newsletterEditions) ??
    findNearlyCompletePlaylist(playlists) ??
    null
  )
}
