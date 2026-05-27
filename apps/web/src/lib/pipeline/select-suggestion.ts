import { STAGE_ORDER, DEFAULT_WIP_LIMITS } from './up-next-constants'
import type { PipelineItemWithSlot, PlaylistSummary, NewsletterEditionRow } from './up-next-types'

interface SuggestionInput {
  pipelineItems: PipelineItemWithSlot[]
  playlists: PlaylistSummary[]
  newsletterEditions: NewsletterEditionRow[]
  stageCounts?: Record<string, number>
  wipLimits?: Record<string, number>
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

  // Sort by STAGE_ORDER descending so the most-progressed stage wins deterministically
  const sortedStages = [...stageCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([a], [b]) => (STAGE_ORDER[b as keyof typeof STAGE_ORDER] ?? 0) - (STAGE_ORDER[a as keyof typeof STAGE_ORDER] ?? 0))

  if (sortedStages.length > 0) {
    const [stage, count] = sortedStages[0]!
    return {
      text: `Bloco de ${stage}: ${count} itens prontos. Trabalhar juntos?`,
      href: `/cms/pipeline?stage=${stage}`,
    }
  }

  return null
}

function findOrphanedItems(items: PipelineItemWithSlot[]): Suggestion | null {
  const orphaned = items.filter(
    (item) =>
      item.format !== 'blog_post' &&
      item.format !== 'newsletter' &&
      item.youtube_channel_id === null &&
      STAGE_ORDER[item.stage] < STAGE_ORDER['scheduled'],
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
    if (ratio <= 0.2 && remaining > 0) {
      return {
        text: `${playlist.name} esta a ${remaining} item(s) de ser concluida.`,
        href: `/cms/playlists/${playlist.id}`,
      }
    }
  }
  return null
}

function findWipViolation(
  stageCounts: Record<string, number> | undefined,
  wipLimits: Record<string, number> = DEFAULT_WIP_LIMITS,
): Suggestion | null {
  if (!stageCounts) return null
  let worstGroup: string | null = null
  let worstExcess = 0
  for (const [group, limit] of Object.entries(wipLimits)) {
    const count = stageCounts[group] ?? 0
    const excess = count - limit
    if (excess > 0 && excess > worstExcess) {
      worstGroup = group
      worstExcess = excess
    }
  }
  if (!worstGroup) return null
  const count = stageCounts[worstGroup] ?? 0
  const limit = wipLimits[worstGroup] ?? 0
  return {
    text: `${worstGroup} acima do limite: ${count}/${limit}. Avançar itens antes de criar novos.`,
    href: `/cms/pipeline?group=${worstGroup}`,
  }
}

const BUFFER_GROUPS = ['gravar', 'pos-prod']

function findBufferGap(stageCounts: Record<string, number> | undefined): Suggestion | null {
  if (!stageCounts) return null
  for (const group of BUFFER_GROUPS) {
    if ((stageCounts[group] ?? 0) === 0) {
      return {
        text: `Nenhum item em ${group}. Avançar itens de escrita para manter o fluxo.`,
        href: `/cms/pipeline?group=${group}`,
      }
    }
  }
  return null
}

export function selectSuggestion(input: SuggestionInput): Suggestion | null {
  const { pipelineItems, playlists, newsletterEditions, stageCounts, wipLimits } = input

  return (
    findWipViolation(stageCounts, wipLimits) ??
    findOrphanedItems(pipelineItems) ??
    findBatchOpportunity(pipelineItems) ??
    findNewsletterWithoutDate(newsletterEditions) ??
    findNearlyCompletePlaylist(playlists) ??
    findBufferGap(stageCounts) ??
    null
  )
}
