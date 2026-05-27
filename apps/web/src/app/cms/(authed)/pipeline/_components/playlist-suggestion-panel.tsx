'use client'

import { memo, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { FORMAT_COLORS, getPlaylistColor } from '@/lib/pipeline/colors'
import { gemMix } from '@/lib/pipeline/gem-design'
import { STAGE_ORDER } from '@/lib/pipeline/up-next-constants'
import { groupCandidatesByPlaylist } from '@/lib/pipeline/suggest-for-slots'
import type { PlaylistGroup } from '@/lib/pipeline/suggest-for-slots'
import type { SlotCandidate, PlaylistSummary } from '@/lib/pipeline/up-next-types'

const LANG_FLAG: Record<string, string> = {
  'pt-br': '🇧🇷',
  en: '🇺🇸',
  both: '🌐',
}

export interface PlaylistSuggestionPanelProps {
  candidates: SlotCandidate[]
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

const ItemChip = memo(function ItemChip({
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
    <div
      className="group/chip relative flex items-center w-full rounded-md text-xs min-h-[44px]"
      style={{
        background: isSelected ? gemMix('--gem-accent', 12) : gemMix(colors.accent, 6),
        border: `1px solid ${isSelected ? colors.accent : colors.border}`,
      }}
    >
      <Link
        href={`/cms/pipeline/items/${candidate.id}`}
        className="flex flex-1 min-w-0 items-center gap-1.5 px-2 py-1 pr-1 cursor-pointer hover:opacity-80 motion-safe:transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none rounded-l-md"
        style={{ color: colors.text }}
        title={candidate.title}
        aria-label={`${candidate.title} — ${stageLabel}, ${candidate.format === 'video' ? 'vídeo' : candidate.format === 'blog_post' ? 'blog' : 'newsletter'}`}
      >
        {candidate.language && LANG_FLAG[candidate.language] && (
          <span className="shrink-0 text-xs" aria-hidden="true">{LANG_FLAG[candidate.language]}</span>
        )}
        <span className="truncate min-w-0 flex-1">{candidate.title}</span>
        <span
          className="rounded px-1 py-0.5 text-[10px] font-medium shrink-0"
          style={{
            background: gemMix(colors.accent, 15),
            color: colors.text,
          }}
          aria-hidden="true"
        >
          {stageLabel}
        </span>
      </Link>
      <button
        type="button"
        aria-pressed={isSelected}
        aria-label={isSelected ? `Desmarcar "${candidate.title}"` : `Atribuir "${candidate.title}" a um slot`}
        onClick={() => onSelect(isSelected ? null : candidate)}
        className="flex items-center justify-center px-2 min-w-[44px] min-h-[44px] rounded-r-md opacity-60 group-hover/chip:opacity-100 focus-visible:opacity-100 motion-safe:transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
        style={{ color: colors.text }}
      >
        {isSelected ? <X size={14} /> : <Plus size={14} />}
      </button>
    </div>
  )
})

const GROUP_MAX_VISIBLE = 5

const GroupCard = memo(function GroupCard({
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
  const groupColor = playlistId ? getPlaylistColor(playlistId) : null

  return (
    <div
      className="rounded-lg border p-3 shrink-0 min-w-[260px] max-w-[360px] snap-start"
      style={{
        background: 'var(--gem-surface)',
        borderColor: 'var(--gem-border)',
        borderTopColor: groupColor?.accent ?? 'var(--gem-border)',
        borderTopWidth: groupColor ? '2px' : undefined,
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
            aria-label={`Faltam ${progress.total - progress.done} itens para completar ${playlistName}`}
          >
            {progress.total - progress.done} restante{progress.total - progress.done !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {playlistId && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs" style={{ color: 'var(--gem-muted)' }}>
              {progress.done}/{progress.total}
            </span>
            {progressPct > 0 && (
              <span className="text-xs font-medium" style={{ color: 'var(--gem-done)' }} aria-hidden="true">
                {Math.round(progressPct)}%
              </span>
            )}
          </div>
          <div
            className="h-2 rounded-full w-full"
            style={{ background: 'var(--gem-faint)' }}
            role="progressbar"
            aria-valuenow={progress.done}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-label={`${playlistName} progresso`}
            aria-valuetext={`${progress.done} de ${progress.total} concluídos`}
          >
            <div
              className="h-2 rounded-full motion-safe:transition-all"
              style={{
                width: `${progressPct}%`,
                background: 'var(--gem-done)',
              }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
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
          className="text-xs mt-1.5 px-2 py-1 rounded w-full text-center min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
          style={{ color: 'var(--gem-accent)', background: gemMix('--gem-accent', 6) }}
          aria-label={`Ver mais ${items.length - GROUP_MAX_VISIBLE} itens de ${playlistName}`}
        >
          + {items.length - GROUP_MAX_VISIBLE} mais
        </button>
      )}
    </div>
  )
})

export const PlaylistSuggestionPanel = memo(function PlaylistSuggestionPanel({
  candidates,
  playlistSummaries,
  onSelectItem,
  selectedItem,
  collapsed,
  onToggleCollapse,
}: PlaylistSuggestionPanelProps) {
  const sortedGroups = useMemo(() => {
    if (candidates.length === 0) return []
    const groups = groupCandidatesByPlaylist(candidates, playlistSummaries)
    const withSortedItems = groups.map(g => {
      const items = [...g.items].sort((a, b) => (STAGE_ORDER[b.stage] ?? 0) - (STAGE_ORDER[a.stage] ?? 0))
      return { ...g, items, actionableCount: items.filter(i => i.stage !== 'idea').length }
    })
    withSortedItems.sort((a, b) => {
      if (a.nearCompletion !== b.nearCompletion) return a.nearCompletion ? -1 : 1
      if (a.actionableCount !== b.actionableCount) return b.actionableCount - a.actionableCount
      if (a.playlistId === null) return 1
      if (b.playlistId === null) return -1
      return 0
    })
    return withSortedItems
  }, [candidates, playlistSummaries])

  const actionableCount = useMemo(() => candidates.filter(c => c.stage !== 'idea').length, [candidates])

  if (candidates.length === 0) return null
  const badgeText = actionableCount > 0
    ? `${actionableCount} em progresso`
    : `${candidates.length} no backlog`

  return (
    <section
      aria-label="Sugestões de conteúdo por playlist"
    >
      <button
        type="button"
        data-testid="panel-toggle"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        aria-controls="playlist-suggestion-content"
        className="flex items-center gap-2 w-full text-left mb-2 cursor-pointer min-h-[44px] rounded focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
      >
        {collapsed ? (
          <ChevronRight size={14} style={{ color: 'var(--gem-muted)' }} aria-hidden="true" />
        ) : (
          <ChevronDown size={14} style={{ color: 'var(--gem-muted)' }} aria-hidden="true" />
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

      <div id="playlist-suggestion-content" hidden={collapsed ? true : undefined}>
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs mb-3 ${selectedItem ? 'border-l-2 font-medium' : ''}`}
          style={{
            background: selectedItem ? gemMix('--gem-accent', 10) : 'var(--gem-faint)',
            borderColor: selectedItem ? 'var(--gem-accent)' : 'transparent',
            color: selectedItem ? 'var(--gem-accent)' : 'var(--gem-muted)',
          }}
        >
          {selectedItem
            ? <span className="truncate">Clique em um slot compatível na grade acima para atribuir &ldquo;{selectedItem.title}&rdquo;</span>
            : 'Selecione um item abaixo e depois clique em um slot vazio na grade acima'}
        </div>

        <div className="relative">
          <div className="flex gap-3 overflow-x-auto pb-2 max-h-[480px] scroll-smooth snap-x snap-mandatory" tabIndex={0} role="region" aria-label="Cards de playlists — role para ver mais" onKeyDown={(e) => {
              if (e.key === 'ArrowRight') { e.currentTarget.scrollBy({ left: 280, behavior: 'smooth' }); e.preventDefault() }
              if (e.key === 'ArrowLeft') { e.currentTarget.scrollBy({ left: -280, behavior: 'smooth' }); e.preventDefault() }
            }}>
            {sortedGroups.map((group) => (
              <GroupCard
                key={group.playlistId ?? '__avulsos'}
                group={group}
                selectedItem={selectedItem}
                onSelectItem={onSelectItem}
              />
            ))}
          </div>
          {sortedGroups.length > 3 && (
            <div
              className="absolute right-0 top-0 bottom-2 w-8 pointer-events-none"
              style={{ background: 'linear-gradient(to right, transparent, var(--gem-surface))' }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>
    </section>
  )
})
