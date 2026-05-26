'use client'

import { memo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { FORMAT_COLORS } from '@/lib/pipeline/colors'
import { gemMix } from '@/lib/pipeline/gem-design'
import { STAGE_ORDER } from '@/lib/pipeline/up-next-constants'
import { groupCandidatesByPlaylist } from '@/lib/pipeline/suggest-for-slots'
import type { PlaylistGroup } from '@/lib/pipeline/suggest-for-slots'
import type { SlotCandidate, WeekSlot, PlaylistSummary } from '@/lib/pipeline/up-next-types'

export interface PlaylistSuggestionPanelProps {
  candidates: SlotCandidate[]
  weekSlots: WeekSlot[]
  playlistSummaries: PlaylistSummary[]
  onSelectItem: (candidate: SlotCandidate | null) => void
  selectedItem: SlotCandidate | null
  collapsed: boolean
  onToggleCollapse: () => void
}

const STAGE_SHORT: Record<string, string> = {
  idea: 'ideia',
  outline: 'roteiro',
  draft: 'rascunho',
  roteiro: 'roteiro',
  gravacao: 'gravação',
  edicao: 'edição',
  pos_producao: 'pós',
  ready: 'pronto',
}

function ItemChip({
  candidate,
  isSelected,
  onSelect,
}: {
  candidate: SlotCandidate
  isSelected: boolean
  onSelect: (c: SlotCandidate | null) => void
}) {
  const colors = FORMAT_COLORS[candidate.format] ?? {
    accent: 'var(--gem-accent)',
    bg: 'rgba(0,0,0,0.08)',
    text: 'var(--gem-accent)',
    border: 'rgba(0,0,0,0.25)',
  }
  const stageLabel = STAGE_SHORT[candidate.stage] ?? candidate.stage

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={() => onSelect(isSelected ? null : candidate)}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors cursor-pointer shrink-0"
      style={{
        background: isSelected ? gemMix('--gem-accent', 12) : gemMix(colors.accent, 6),
        border: `1px solid ${isSelected ? colors.accent : colors.border}`,
        color: colors.text,
      }}
    >
      <span className="truncate max-w-[120px]">{candidate.title}</span>
      <span
        className="rounded px-1 py-0.5 text-[10px] font-medium shrink-0"
        style={{
          background: gemMix(colors.accent, 15),
          color: colors.text,
        }}
      >
        {stageLabel}
      </span>
    </button>
  )
}

const GROUP_MAX_VISIBLE = 5

function GroupCard({
  group,
  selectedItem,
  onSelectItem,
}: {
  group: PlaylistGroup
  selectedItem: SlotCandidate | null
  onSelectItem: (c: SlotCandidate | null) => void
}) {
  const { playlistId, playlistName, items, progress, nearCompletion } = group
  const progressPct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0
  const [expanded, setExpanded] = useState(false)
  const visibleItems = expanded ? items : items.slice(0, GROUP_MAX_VISIBLE)
  const hasMore = items.length > GROUP_MAX_VISIBLE

  return (
    <div
      className="rounded-lg border p-3 shrink-0 min-w-[220px] max-w-[300px]"
      style={{
        background: 'var(--gem-surface)',
        borderColor: 'var(--gem-border)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-xs font-semibold truncate"
          style={{ color: 'var(--gem-text)' }}
        >
          {playlistName}
        </span>
        {nearCompletion && (
          <span
            className="text-[10px] font-medium rounded px-1.5 py-0.5 shrink-0"
            style={{
              background: gemMix('--gem-done', 15),
              color: 'var(--gem-done)',
            }}
          >
            quase!
          </span>
        )}
      </div>

      {playlistId && (
        <div className="mb-2">
          <div
            className="h-1 rounded-full w-full"
            style={{ background: 'var(--gem-faint)' }}
          >
            <div
              className="h-1 rounded-full transition-all"
              style={{
                width: `${progressPct}%`,
                background: 'var(--gem-done)',
              }}
            />
          </div>
          <span
            className="text-[10px] mt-0.5 block"
            style={{ color: 'var(--gem-muted)' }}
          >
            {progress.done}/{progress.total}
          </span>
        </div>
      )}

      <div className={`flex flex-wrap gap-1${expanded ? ' max-h-[200px] overflow-y-auto' : ''}`}>
        {visibleItems.map((item) => (
          <ItemChip
            key={item.id}
            candidate={item}
            isSelected={selectedItem?.id === item.id}
            onSelect={onSelectItem}
          />
        ))}
      </div>
      {hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[10px] mt-1.5 px-2 py-1 rounded w-full text-center"
          style={{ color: 'var(--gem-accent)', background: gemMix('--gem-accent', 6) }}
        >
          + {items.length - GROUP_MAX_VISIBLE} mais
        </button>
      )}
    </div>
  )
}

export const PlaylistSuggestionPanel = memo(function PlaylistSuggestionPanel({
  candidates,
  weekSlots: _weekSlots,
  playlistSummaries,
  onSelectItem,
  selectedItem,
  collapsed,
  onToggleCollapse,
}: PlaylistSuggestionPanelProps) {
  if (candidates.length === 0) return null

  const groups = groupCandidatesByPlaylist(candidates, playlistSummaries)

  // Sort items within each group: most progressed first, ideas last
  const sortedGroups = groups.map(g => ({
    ...g,
    items: [...g.items].sort((a, b) => (STAGE_ORDER[b.stage] ?? 0) - (STAGE_ORDER[a.stage] ?? 0)),
  }))

  // Sort groups: near-completion first, then by actionable item count, avulsos last
  sortedGroups.sort((a, b) => {
    if (a.nearCompletion !== b.nearCompletion) return a.nearCompletion ? -1 : 1
    const aActionable = a.items.filter(i => i.stage !== 'idea').length
    const bActionable = b.items.filter(i => i.stage !== 'idea').length
    if (aActionable !== bActionable) return bActionable - aActionable
    if (a.playlistId === null) return 1
    if (b.playlistId === null) return -1
    return 0
  })

  const actionableCount = candidates.filter(c => c.stage !== 'idea').length
  const badgeText = actionableCount > 0
    ? `${actionableCount} em progresso`
    : `${candidates.length} no backlog`

  return (
    <section
      role="region"
      aria-label="Sugestões de conteúdo por playlist"
    >
      <button
        type="button"
        data-testid="panel-toggle"
        onClick={onToggleCollapse}
        className="flex items-center gap-2 w-full text-left mb-2 cursor-pointer"
      >
        {collapsed ? (
          <ChevronRight size={14} style={{ color: 'var(--gem-muted)' }} />
        ) : (
          <ChevronDown size={14} style={{ color: 'var(--gem-muted)' }} />
        )}
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--gem-muted)' }}
        >
          Sugestões por Playlist
        </span>
        <span
          className="text-[10px] rounded-full px-2 py-0.5 font-medium"
          style={{
            background: gemMix('--gem-accent', 12),
            color: 'var(--gem-accent)',
          }}
        >
          {badgeText}
        </span>
      </button>

      {selectedItem && !collapsed && (
        <p className="text-[10px] mb-2" style={{ color: 'var(--gem-accent)' }}>
          Clique em um slot compatível na grade acima para atribuir &ldquo;{selectedItem.title}&rdquo;
        </p>
      )}

      {!collapsed && (
        <div className="flex gap-3 overflow-x-auto pb-2 max-h-[280px]">
          {sortedGroups.map((group) => (
            <GroupCard
              key={group.playlistId ?? '__avulsos'}
              group={group}
              selectedItem={selectedItem}
              onSelectItem={onSelectItem}
            />
          ))}
        </div>
      )}
    </section>
  )
})
