'use client'

import {
  ChevronLeft,
  Pen,
  CheckCheck,
  Info,
  Zap,
  Gauge,
  Clock,
  Calendar,
  ArrowRight,
  FileSearch,
  Target,
  FlaskConical,
  CheckCircle2,
  RefreshCw,
  Archive,
} from 'lucide-react'
import type {
  DecisionWithSources,
  DecisionHorizon,
  DecisionStatus,
} from '@/lib/pipeline/research-types'
import {
  THEME_META,
  HORIZON_META,
  DECISION_STATUS_META,
} from '@/lib/pipeline/research-types'
import { DECISION_STATUS } from '@/lib/pipeline/research-schemas'

// ---------------------------------------------------------------------------
// Icon maps — resolve horizon / decision-status to lucide nodes (matches atoms)
// ---------------------------------------------------------------------------

const HORIZON_ICONS: Record<DecisionHorizon, React.ReactNode> = {
  agora: <Target size={13} />,
  proximo: <ArrowRight size={13} />,
  explorar: <FlaskConical size={13} />,
}

const DECISION_STATUS_ICONS: Record<DecisionStatus, React.ReactNode> = {
  decidido: <CheckCircle2 size={13} />,
  testando: <FlaskConical size={13} />,
  revisar: <RefreshCw size={13} />,
  arquivado: <Archive size={13} />,
}

/**
 * History `date` is now stored as a real ISO timestamp; legacy rows may carry a
 * display literal like 'hoje'. Format ISO to a short pt-BR date; pass anything
 * non-parseable straight through as a display fallback.
 */
function formatHistoryDate(raw: string): string {
  const ms = Date.parse(raw)
  if (Number.isNaN(ms)) return raw
  return new Date(ms).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DecisionDocProps {
  decision: DecisionWithSources
  onBack: () => void
  onEdit: (id: string) => void
  onPatchStatus: (id: string, status: string) => void
  onOpenDoc: (researchId: string) => void
  /**
   * Optimistic status-change in flight (owned by research-module). While true,
   * the picker highlights `pendingStatus` and disables every option so a second
   * click can't double-fire the patch.
   */
  statusPending?: boolean
  /** The optimistic target status to highlight while `statusPending` is true. */
  pendingStatus?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DecisionDoc({
  decision,
  onBack,
  onEdit,
  onPatchStatus,
  onOpenDoc,
  statusPending = false,
  pendingStatus,
}: DecisionDocProps) {
  // While an optimistic status change is in flight, highlight the target the
  // parent is moving to, not the (stale) persisted status.
  const highlightStatus = statusPending && pendingStatus ? pendingStatus : decision.status
  const theme = decision.theme_id ? THEME_META[decision.theme_id] : null
  const horizon = HORIZON_META[decision.horizon]
  // The large top-bar pill mirrors the optimistic highlight too, so it doesn't
  // flash the stale persisted status while a status change is in flight.
  const highlightMeta = DECISION_STATUS_META[highlightStatus as DecisionStatus]
  const statusTone =
    highlightMeta.kind === 'muted' ? 'var(--text-dim)' : `var(--${highlightMeta.kind})`

  const consequences = decision.consequences ?? []
  const drives = decision.drives ?? []
  const history = decision.history ?? []
  const sources = decision.sources ?? []

  return (
    <div className="doc-view dec-view fade-in">
      {/* ---- Top bar ---- */}
      <div className="doc-bar">
        <button type="button" className="btn ghost sm" onClick={onBack}>
          <ChevronLeft size={15} />
          Decisões
        </button>

        <span className="doc-bar-crumb">
          <span style={{ color: horizon.color, display: 'inline-flex' }}>
            {HORIZON_ICONS[decision.horizon]}
          </span>
          {horizon.label}
        </span>

        {theme && (
          <span className="doc-bar-crumb">
            <span className="tdot" style={{ background: theme.color }} />
            {theme.label}
          </span>
        )}

        <div style={{ flex: 1 }} />

        <span
          className="dstat lg"
          style={{ '--ds': statusTone } as React.CSSProperties}
        >
          {DECISION_STATUS_ICONS[highlightStatus as DecisionStatus]}
          {highlightMeta.label}
        </span>

        <button
          type="button"
          className="btn sm"
          onClick={() => onEdit(decision.id)}
        >
          <Pen size={14} />
          Editar
        </button>
      </div>

      {/* ---- Main grid: content + inspector ---- */}
      <div className="doc-grid">
        {/* ---- Main column ---- */}
        <div className="doc-main">
          <div className="dec-hero">
            <div className="dec-eyebrow">
              <CheckCheck size={14} />
              Decisão · {horizon.label}
              {decision.date_label && (
                <span className="dec-eyebrow-date mono">
                  {decision.date_label}
                </span>
              )}
            </div>
            <h1 className="dec-statement">{decision.title}</h1>
            {decision.rationale && (
              <p className="dec-rationale">{decision.rationale}</p>
            )}
          </div>

          {decision.context && (
            <section className="dec-section">
              <div className="dec-sec-h">
                <Info size={14} />
                Contexto
              </div>
              <p className="dec-prose">{decision.context}</p>
            </section>
          )}

          {consequences.length > 0 && (
            <section className="dec-section">
              <div className="dec-sec-h">
                <Zap size={14} />
                O que isso decide
              </div>
              <ul className="dec-conseq">
                {consequences.map((c, i) => (
                  <li key={i}>
                    <span className="dc-mark" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="doc-endmark">
            <span />
            <CheckCheck size={13} />
            <span />
          </div>
        </div>

        {/* ---- Inspector sidebar ---- */}
        <aside className="doc-insp">
          {/* Status picker */}
          <div className="insp-block">
            <div className="insp-h">
              <Pen size={13} />
              Status
            </div>
            <div className="dec-status-pick">
              {DECISION_STATUS.map((key) => {
                const meta = DECISION_STATUS_META[key]
                const tone =
                  meta.kind === 'muted'
                    ? 'var(--text-dim)'
                    : `var(--${meta.kind})`
                return (
                  <button
                    key={key}
                    type="button"
                    className={`dsp-opt${highlightStatus === key ? ' on' : ''}`}
                    style={{ '--ds': tone } as React.CSSProperties}
                    disabled={statusPending}
                    onClick={() => onPatchStatus(decision.id, key)}
                  >
                    {DECISION_STATUS_ICONS[key]}
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Metric */}
          {decision.metric && (
            <div className="insp-block">
              <div className="insp-h">
                <Gauge size={13} />
                Métrica de sucesso
              </div>
              <div className="dec-metric">{decision.metric}</div>
            </div>
          )}

          {/* Revisit */}
          {decision.revisit && (
            <div className="insp-block">
              <div className="insp-h">
                <Clock size={13} />
                Revisitar
              </div>
              <div className="dec-revisit">
                <Calendar size={13} />
                {decision.revisit}
              </div>
            </div>
          )}

          {/* Source research */}
          <div className="insp-block">
            <div className="insp-h">
              <FileSearch size={13} />
              Pesquisa que fundamenta
            </div>
            {sources.length === 0 ? (
              <div className="insp-empty">Decisão sem pesquisa ligada.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {sources.map((s) => (
                  <button
                    key={s.research_id}
                    type="button"
                    className="insp-dec"
                    onClick={() => onOpenDoc(s.research_id)}
                  >
                    <FileSearch
                      size={13}
                      style={{ color: 'var(--c-courses)', flexShrink: 0 }}
                    />
                    <span className="truncate2">{s.research_title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Drives / feeds */}
          {drives.length > 0 && (
            <div className="insp-block">
              <div className="insp-h">
                <ArrowRight size={13} />
                Alimenta
              </div>
              <div className="dec-drives">
                {drives.map((w) => (
                  <span key={w} className="drive-chip">
                    <ArrowRight size={11} />
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* History timeline */}
          {history.length > 0 && (
            <div className="insp-block">
              <div className="insp-h">
                <Clock size={13} />
                Histórico
              </div>
              <div className="dec-timeline">
                {history.map((h, i) => (
                  <div key={i} className="dtl-row">
                    <span className="dtl-dot" />
                    <div className="dtl-body">
                      <div className="dtl-head">
                        <b>{h.label}</b>
                        <span className="mono">{formatHistoryDate(h.date)}</span>
                      </div>
                      {h.note && <div className="dtl-note">{h.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
