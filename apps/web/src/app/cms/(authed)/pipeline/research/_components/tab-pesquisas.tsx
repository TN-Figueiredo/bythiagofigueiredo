'use client'

import { useState, useMemo } from 'react'
import { Search, Zap, Pin, Plus } from 'lucide-react'
import type { ResearchItemSummary, ResearchStatus, ThemeId } from '@/lib/pipeline/research-types'
import { THEMES } from '@/lib/pipeline/research-types'
import { buildCoworkInstruction } from '@/lib/pipeline/cowork-instructions'
import { CoworkDeepLink } from '@/components/cms/cowork-deep-link'
import { TemaDot, StatusBadge, SourceTag } from './atoms'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  return `${weeks}sem`
}

// ---------------------------------------------------------------------------
// Status filter options
// ---------------------------------------------------------------------------

const STATUS_FILTERS: Array<{ key: ResearchStatus | null; label: string }> = [
  { key: null,        label: 'Todas' },
  { key: 'fresca',    label: 'Frescas' },
  { key: 'analise',   label: 'Em análise' },
  { key: 'aplicada',  label: 'Aplicadas' },
  { key: 'arquivada', label: 'Arquivadas' },
]

// ---------------------------------------------------------------------------
// ResearchCard
// ---------------------------------------------------------------------------

export function ResearchCard({
  item,
  onOpen,
}: {
  item: ResearchItemSummary
  onOpen: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className={'rcard' + (item.pinned ? ' pinned' : '')}
    >
      {/* Top row: theme + status */}
      <div className="rcard-top">
        <TemaDot id={item.theme_id} showLabel />
        <div style={{ flex: 1 }} />
        <StatusBadge status={item.status} />
      </div>

      {/* Title */}
      <div className="rcard-title truncate2">
        {item.title}
      </div>

      {/* Summary */}
      <div className="rcard-sum">
        {item.summary}
      </div>

      {/* Footer */}
      <div className="rcard-foot">
        <SourceTag source={item.source} />
        <span className="rmeta">
          <Zap size={12} />
          {item.takeaways.length}
        </span>
        {/* Second metric is the DECISION-derived count (Target icon). The
            summary type carries no decision count, so we omit the metric
            rather than mislabel item.sources (citations) as decisions. */}
        <div style={{ flex: 1 }} />
        <span className="rcard-time">
          {timeAgo(item.updated_at)}
        </span>
      </div>

      {/* Pin indicator */}
      {item.pinned && (
        <span className="rcard-pin" title="No foco atual">
          <Pin size={13} />
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// TabPesquisas (main export)
// ---------------------------------------------------------------------------

interface TabPesquisasProps {
  items: ResearchItemSummary[]
  onOpenItem: (id: string) => void
  /** Optional — parent wires the "Nova pesquisa" empty-state action. No-op safe. */
  onCreate?: () => void
}

export function TabPesquisas({ items, onOpenItem, onCreate }: TabPesquisasProps) {
  const [activeTema, setActiveTema] = useState<ThemeId | null>(null)
  const [statusFilter, setStatusFilter] = useState<ResearchStatus | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Theme counts — include ALL docs (incl. archived), matching the prototype.
  const themeCounts = useMemo(() => {
    const counts: Record<ThemeId, number> = { asia: 0, ia: 0, dev: 0, games: 0, grana: 0, canal: 0 }
    for (const item of items) {
      counts[item.theme_id]++
    }
    return counts
  }, [items])

  // Filtering
  const filtered = useMemo(() => {
    let list = items
    if (activeTema) list = list.filter(i => i.theme_id === activeTema)
    if (statusFilter) list = list.filter(i => i.status === statusFilter)
    if (searchQuery) {
      const q = normalize(searchQuery)
      list = list.filter(i =>
        normalize(i.title).includes(q) || normalize(i.summary ?? '').includes(q),
      )
    }
    return list.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
  }, [items, activeTema, statusFilter, searchQuery])

  // "Todas" count — includes ALL docs (incl. archived), matching the prototype.
  const totalCount = items.length

  return (
    <div className="fade-in">
      {/* ---- Header: Cowork triage deep-link ---- */}
      <div className="row between sec-head" style={{ marginTop: 0 }}>
        <span className="section-label row gap-8">
          <Search size={13} aria-hidden="true" /> Biblioteca de pesquisas
        </span>
        <CoworkDeepLink
          instruction={buildCoworkInstruction('research-triage', {})}
          label="Abrir no Cowork"
          variant="button"
        />
      </div>

      {/* ---- Theme rail ---- */}
      <div className="cat-rail scrollable">
        <button
          type="button"
          className={'cat-chip' + (activeTema === null ? ' on' : '')}
          onClick={() => setActiveTema(null)}
        >
          Todas
          {totalCount > 0 && <span className="ccount">{totalCount}</span>}
        </button>
        {THEMES.map((t) => {
          const count = themeCounts[t.id]
          return (
            <button
              key={t.id}
              type="button"
              className={'cat-chip' + (activeTema === t.id ? ' on' : '')}
              onClick={() => setActiveTema(t.id)}
            >
              <span className="tdot" style={{ background: t.color }} />
              {t.label}
              {count > 0 && <span className="ccount">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* ---- Toolbar: Search + Status filters ---- */}
      <div className="search-bar">
        {/* Search */}
        <div className="search-input">
          <Search size={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar pesquisas..."
          />
        </div>

        {/* Status chips */}
        <div className="row gap-6">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={label}
              type="button"
              className={'chip sm' + (statusFilter === key ? ' on' : '')}
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Card grid ---- */}
      {filtered.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '48px 24px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius, 14px)',
            minHeight: 180,
          }}
        >
          <Search size={24} style={{ color: 'var(--text-faint)', opacity: 0.5 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
            Nenhuma pesquisa aqui
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Ajuste os filtros ou peça uma pesquisa nova ao Claude Cowork.
          </span>
          <button
            type="button"
            className="btn primary sm mt-8"
            onClick={() => onCreate?.()}
          >
            <Plus size={14} /> Nova pesquisa
          </button>
        </div>
      ) : (
        <div className="rgrid">
          {filtered.map((item) => (
            <ResearchCard key={item.id} item={item} onOpen={onOpenItem} />
          ))}
        </div>
      )}
    </div>
  )
}

