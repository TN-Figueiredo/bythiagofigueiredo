'use client'

import { useState, useMemo } from 'react'
import {
  Target,
  ArrowRight,
  FlaskConical,
  Pencil,
  BookOpen,
  Plus,
} from 'lucide-react'
import type {
  ResearchDecision,
  DecisionHorizon,
} from '@/lib/pipeline/research-types'
import { HORIZON_META } from '@/lib/pipeline/research-types'
import { buildCoworkInstruction } from '@/lib/pipeline/cowork-instructions'
import { CoworkDeepLink } from '@/components/cms/cowork-deep-link'
import { DecisionStatusBadge, HorizonChip, TemaTag } from './atoms'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TabDecisoesProps {
  decisions: ResearchDecision[]
  decisionSources?: Record<string, Array<{ research_id: string; research_title: string; note: string | null }>>
  onOpenItem: (id: string) => void
  onEditDecision: (id: string) => void
  onCreateDecision: () => void
  /** Opens the decision fullscreen (DecisionDoc). Threaded from research-module. */
  onOpenDecision?: (id: string) => void
}

// ---------------------------------------------------------------------------
// Icon map -- horizon icons for group headers
// ---------------------------------------------------------------------------

const HORIZON_ICONS: Record<DecisionHorizon, React.ElementType> = {
  agora: Target,
  proximo: ArrowRight,
  explorar: FlaskConical,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  return `${months}mo`
}

// ---------------------------------------------------------------------------
// DecisionCard
// ---------------------------------------------------------------------------

export interface ResearchBacklink {
  research_id: string
  research_title: string
}

export function DecisionCard({
  decision,
  backlinks,
  onEdit,
  onOpenItem,
  onOpen,
}: {
  decision: ResearchDecision
  backlinks: ResearchBacklink[]
  onEdit: (id: string) => void
  onOpenItem: (id: string) => void
  /** When set, renders a trailing "Abrir →" affordance that opens the decision. */
  onOpen?: (id: string) => void
}) {
  const isArchived = decision.status === 'arquivado'
  const dateDisplay = decision.date_label || timeAgo(decision.created_at)
  const hasLinks = backlinks.length > 0 || decision.drives.length > 0
  const showFooter = hasLinks || Boolean(onOpen)
  const interactive = Boolean(onOpen)

  return (
    <div
      className={'dcard' + (isArchived ? ' arch' : '') + (interactive ? ' clickable' : '')}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => onOpen?.(decision.id) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen?.(decision.id)
              }
            }
          : undefined
      }
    >
      <div className="dcard-top">
        <DecisionStatusBadge status={decision.status} />
        <HorizonChip horizon={decision.horizon} />
        {decision.theme_id && <TemaTag id={decision.theme_id} />}
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--text-dim, #686a76)',
          }}
        >
          {dateDisplay}
        </span>
        <button
          className="icon-btn bare dcard-edit"
          title="Editar decisão"
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(decision.id)
          }}
        >
          <Pencil size={14} />
        </button>
      </div>

      <div className="dcard-stmt">{decision.title}</div>

      {decision.rationale && (
        <div
          className="dcard-why"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {decision.rationale}
        </div>
      )}

      {showFooter && (
        <div className="dcard-links">
          {backlinks.map((src) => (
            <button
              key={src.research_id}
              className="link-chip"
              title={src.research_title}
              onClick={(e) => {
                e.stopPropagation()
                onOpenItem(src.research_id)
              }}
            >
              <BookOpen size={11} />
              {src.research_title}
            </button>
          ))}
          {decision.drives.map((drive) => (
            <span key={drive} className="drive-chip">
              <ArrowRight size={11} />
              {drive}
            </span>
          ))}
          {onOpen && (
            <>
              <div style={{ flex: 1 }} />
              <button
                className="dcard-open"
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpen(decision.id)
                }}
              >
                Abrir <ArrowRight size={12} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TabDecisoes
// ---------------------------------------------------------------------------

export function TabDecisoes({
  decisions,
  decisionSources,
  onOpenItem,
  onEditDecision,
  onCreateDecision,
  onOpenDecision,
}: TabDecisoesProps) {
  const [hzFilter, setHzFilter] = useState<DecisionHorizon | null>(null)

  // -- Counts for filter chips -------------------------------------------------
  const counts = useMemo(() => {
    const active = decisions.filter((d) => d.status !== 'arquivado')
    return {
      all: active.length,
      agora: active.filter((d) => d.horizon === 'agora').length,
      proximo: active.filter((d) => d.horizon === 'proximo').length,
      explorar: active.filter((d) => d.horizon === 'explorar').length,
    }
  }, [decisions])

  // -- Grouped decisions -------------------------------------------------------
  const groups = useMemo(() => {
    const horizons: DecisionHorizon[] = ['agora', 'proximo', 'explorar']
    return horizons
      .map((hz) => {
        let filtered = decisions.filter((d) => d.status !== 'arquivado')
        if (hzFilter) {
          filtered = filtered.filter((d) => d.horizon === hzFilter)
        } else {
          filtered = filtered.filter((d) => d.horizon === hz)
        }
        return { horizon: hz, decisions: filtered }
      })
      .filter((g) => (hzFilter ? g.horizon === hzFilter : g.decisions.length > 0))
  }, [decisions, hzFilter])

  const totalVisible = groups.reduce((sum, g) => sum + g.decisions.length, 0)

  // -- Build backlinks for a decision ------------------------------------------
  const getBacklinks = useMemo(() => {
    return (decisionId: string): ResearchBacklink[] => {
      const sources = decisionSources?.[decisionId] ?? []
      return sources.map(src => ({
        research_id: src.research_id,
        research_title: src.research_title,
      }))
    }
  }, [decisionSources])

  // -- Filter chips ------------------------------------------------------------
  const filterChips: Array<{ key: DecisionHorizon | null; label: string; count: number }> = [
    { key: null, label: 'Todos os horizontes', count: counts.all },
    { key: 'agora', label: 'Agora', count: counts.agora },
    { key: 'proximo', label: 'Próximo', count: counts.proximo },
    { key: 'explorar', label: 'Explorar', count: counts.explorar },
  ]

  return (
    <div>
      {/* Header: Cowork distill deep-link */}
      <div className="row between sec-head" style={{ marginTop: 0 }}>
        <span className="section-label row gap-8">
          <Target size={13} aria-hidden="true" /> Decisões
        </span>
        <CoworkDeepLink
          instruction={buildCoworkInstruction('decisao-log', {})}
          label="Abrir no Cowork"
          variant="button"
        />
      </div>

      {/* Horizon filter chips + create button */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        {filterChips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className={'chip sm' + (hzFilter === chip.key ? ' on' : '')}
            onClick={() => setHzFilter(chip.key)}
          >
            {chip.label}
            {chip.count > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  opacity: 0.7,
                }}
              >
                {chip.count}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          className="btn primary sm"
          onClick={onCreateDecision}
          style={{ marginLeft: 'auto', flexShrink: 0 }}
        >
          <Plus size={14} />
          Nova decisão
        </button>
      </div>

      {/* Decision groups */}
      {groups.map((group) => {
        const hMeta = HORIZON_META[group.horizon]
        const HIcon = HORIZON_ICONS[group.horizon]
        return (
          <div key={group.horizon} className="dec-group">
            <div className="dec-group-head">
              <HIcon size={14} style={{ color: hMeta.color }} />
              <span>{hMeta.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-dim, #686a76)' }}>
                · {hMeta.sub}
              </span>
              <span className="dec-count">{group.decisions.length}</span>
            </div>
            <div className="dec-list">
              {group.decisions.map((d) => (
                <DecisionCard
                  key={d.id}
                  decision={d}
                  backlinks={getBacklinks(d.id)}
                  onEdit={onEditDecision}
                  onOpenItem={onOpenItem}
                  onOpen={(id) => onOpenDecision?.(id)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Empty state */}
      {totalVisible === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 160,
            padding: '40px 24px',
            background: 'var(--surface, #15161d)',
            border: '1px solid var(--border, #606370)',
            borderRadius: 'var(--radius, 12px)',
            textAlign: 'center',
          }}
        >
          <Target size={24} style={{ color: 'var(--text-dim, #686a76)', opacity: 0.5 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text, #ececf1)' }}>
            {hzFilter ? 'Nenhuma decisão neste horizonte' : 'Nenhuma decisão registrada'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim, #686a76)', maxWidth: '40ch' }}>
            Registre uma decisão ou transforme um takeaway de pesquisa.
          </span>
          <button
            className="btn primary sm"
            type="button"
            style={{ marginTop: 8 }}
            onClick={onCreateDecision}
          >
            <Plus size={14} />
            Nova decisão
          </button>
        </div>
      )}
    </div>
  )
}
