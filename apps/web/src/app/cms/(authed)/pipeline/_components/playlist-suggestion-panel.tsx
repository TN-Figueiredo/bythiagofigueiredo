'use client'

import { memo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { FORMAT_COLORS } from '@/lib/pipeline/colors'
import { gemMix } from '@/lib/pipeline/gem-design'
import { groupCandidatesByPlaylist } from '@/lib/pipeline/suggest-for-slots'
import type { PlaylistGroup } from '@/lib/pipeline/suggest-for-slots'
import type { SlotCandidate, WeekSlot } from '@/lib/pipeline/up-next-types'

export interface PlaylistSuggestionPanelProps {
  candidates: SlotCandidate[]
  weekSlots: WeekSlot[]
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

      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <ItemChip
            key={item.id}
            candidate={item}
            isSelected={selectedItem?.id === item.id}
            onSelect={onSelectItem}
          />
        ))}
      </div>
    </div>
  )
}

export const PlaylistSuggestionPanel = memo(function PlaylistSuggestionPanel({
  candidates,
  weekSlots: _weekSlots,
  onSelectItem,
  selectedItem,
  collapsed,
  onToggleCollapse,
}: PlaylistSuggestionPanelProps) {
  if (candidates.length === 0) return null

  const groups = groupCandidatesByPlaylist(candidates)

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
          {candidates.length} disponíveis
        </span>
      </button>

      {!collapsed && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {groups.map((group) => (
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
