'use client'

import { useState, useCallback, useTransition, useEffect, useRef } from 'react'
import type {
  ResearchDecision,
  DecisionWithSources,
  ThemeId,
  DecisionHorizon,
  DecisionStatus,
} from '@/lib/pipeline/research-types'
import { THEME_META, HORIZON_META, DECISION_STATUS_META } from '@/lib/pipeline/research-types'
import { THEME_IDS, DECISION_HORIZON, DECISION_STATUS } from '@/lib/pipeline/research-schemas'
import { X, CheckCheck, ArrowRight, Check, Archive } from 'lucide-react'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** A non-archived research item available to link as a source. */
export interface DecisionResearchOption {
  id: string
  title: string
  theme_id: ThemeId | null
}

interface DecisionDrawerProps {
  /**
   * The decision being edited. May carry `sources` (DecisionWithSources) to
   * pre-fill the linked-research multi-select. Absent / no `id` = create mode.
   */
  initial?: Partial<ResearchDecision> &
    Partial<Pick<DecisionWithSources, 'sources'>> & { id?: string }
  prefillStatement?: string
  prefillTheme?: ThemeId | null
  /** Source research id to pre-link (takeaway→decision conversion). */
  prefillSourceId?: string
  /** Initial status for a converted takeaway (e.g. 'testando'). */
  prefillStatus?: DecisionStatus
  /** Non-archived research items, passed by research-module, for the source picker. */
  researchOptions: DecisionResearchOption[]
  onClose: () => void
  onSaved: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRIVE_OPTIONS = ['Roteiros', 'Newsletter', 'Thumbnails', 'Script de vídeo']

// ---------------------------------------------------------------------------
// DecisionDrawer
// ---------------------------------------------------------------------------

export function DecisionDrawer({
  initial,
  prefillStatement,
  prefillTheme,
  prefillSourceId,
  prefillStatus,
  researchOptions,
  onClose,
  onSaved,
}: DecisionDrawerProps) {
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(initial?.id)

  // ---- form state ----
  const [form, setForm] = useState({
    statement: initial?.title ?? prefillStatement ?? '',
    rationale: initial?.rationale ?? '',
    context: initial?.context ?? '',
    status: (initial?.status ?? prefillStatus ?? 'decidido') as DecisionStatus,
    metric: initial?.metric ?? '',
    revisit: initial?.revisit ?? '',
    horizon: (initial?.horizon ?? 'agora') as DecisionHorizon,
    theme_id: (initial?.theme_id ?? prefillTheme ?? null) as ThemeId | null,
    drives: (initial?.drives ?? []) as string[],
    sourceIds: (initial?.sources?.map((s) => s.research_id) ??
      (prefillSourceId ? [prefillSourceId] : [])) as string[],
  })

  const patch = useCallback(
    <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  )

  const toggleDrive = useCallback((drive: string) => {
    setForm((prev) => ({
      ...prev,
      drives: prev.drives.includes(drive)
        ? prev.drives.filter((d) => d !== drive)
        : [...prev.drives, drive],
    }))
  }, [])

  const toggleSource = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      sourceIds: prev.sourceIds.includes(id)
        ? prev.sourceIds.filter((s) => s !== id)
        : [...prev.sourceIds, id],
    }))
  }, [])

  // ---- Escape to close ----
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // ---- Auto-focus statement on mount ----
  const statementRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    statementRef.current?.focus()
  }, [])

  // ---- save / archive feedback ----
  const [saveError, setSaveError] = useState<string | null>(null)

  /**
   * Build the decision input. The drawer doesn't edit consequences/history.
   * - Create: seed `consequences` with the prefill (or empty) so the row starts valid.
   * - Update: OMIT `consequences` entirely so we never clobber the DB's value
   *   with a stale snapshot from `initial`.
   */
  const buildInput = useCallback(
    (overrides?: { status?: DecisionStatus }) => {
      const base = {
        title: form.statement.trim() || 'Decisão sem enunciado',
        rationale: form.rationale.trim() || null,
        context: form.context.trim() || null,
        status: overrides?.status ?? form.status,
        metric: form.metric.trim() || null,
        revisit: form.revisit.trim() || null,
        horizon: form.horizon,
        theme_id: form.theme_id,
        drives: form.drives,
        source_research_ids: form.sourceIds,
      }
      if (isEdit) return base
      // Create only: seed consequences so the new row starts with a value.
      return { ...base, consequences: initial?.consequences ?? [] }
    },
    [form, initial, isEdit]
  )

  const persist = useCallback(
    (overrides?: { status?: DecisionStatus }) => {
      setSaveError(null)
      startTransition(async () => {
        const input = buildInput(overrides)
        if (isEdit && initial?.id) {
          const { updateResearchDecision } = await import('../decision-actions')
          const result = await updateResearchDecision(initial.id, input)
          if (result.ok) {
            onSaved()
            onClose()
          } else {
            setSaveError(result.error ?? 'Erro ao salvar')
          }
        } else {
          const { createResearchDecision } = await import('../decision-actions')
          const result = await createResearchDecision(input)
          if (result.ok) {
            onSaved()
            onClose()
          } else {
            setSaveError(result.error ?? 'Erro ao salvar')
          }
        }
      })
    },
    [buildInput, isEdit, initial, onSaved, onClose]
  )

  const handleSave = useCallback(() => {
    if (!form.statement.trim()) return
    persist()
  }, [form.statement, persist])

  const handleArchive = useCallback(() => {
    persist({ status: 'arquivado' })
  }, [persist])

  // ---- render ----
  return (
    <>
      {/* Scrim */}
      <div className="drawer-scrim" onClick={onClose} role="presentation" />

      {/* Panel */}
      <div
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Editar decisão' : 'Nova decisão'}
      >
        {/* Header */}
        <div className="drawer-head">
          <CheckCheck size={17} style={{ color: 'var(--accent-text)' }} />
          <span className="dt">{isEdit ? 'Editar decisão' : 'Nova decisão'}</span>
          <div style={{ flex: 1 }} />
          <button
            className="icon-btn bare"
            onClick={onClose}
            type="button"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="drawer-body">
          {/* A decisão */}
          <div className="fgroup">
            <span className="flabel">A decisão</span>
            <textarea
              ref={statementRef}
              className="finput"
              rows={2}
              value={form.statement}
              onChange={(e) => patch('statement', e.target.value)}
              placeholder="Ex.: Todo vídeo de viagem mostra o contraste de preço em dólar."
            />
          </div>

          {/* Por quê — o racional */}
          <div className="fgroup">
            <span className="flabel">Por quê — o racional</span>
            <textarea
              className="finput"
              rows={3}
              value={form.rationale}
              onChange={(e) => patch('rationale', e.target.value)}
              placeholder="A lógica curta por trás da decisão."
            />
          </div>

          {/* Contexto · opcional */}
          <div className="fgroup">
            <span className="flabel">
              Contexto <span className="dim">· opcional</span>
            </span>
            <textarea
              className="finput"
              rows={3}
              value={form.context}
              onChange={(e) => patch('context', e.target.value)}
              placeholder="O cenário que torna a decisão necessária."
            />
          </div>

          {/* Status — 4-option segmented */}
          <div className="fgroup">
            <span className="flabel">Status</span>
            <div className="seg" style={{ width: '100%' }}>
              {DECISION_STATUS.map((s) => {
                const meta = DECISION_STATUS_META[s]
                return (
                  <button
                    key={s}
                    type="button"
                    className={form.status === s ? 'on' : ''}
                    style={{ flex: 1 }}
                    onClick={() => patch('status', s)}
                  >
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Métrica + Revisitar — side by side */}
          <div className="row gap-8" style={{ alignItems: 'flex-start' }}>
            <div className="fgroup grow">
              <span className="flabel">Métrica</span>
              <input
                className="finput"
                value={form.metric}
                onChange={(e) => patch('metric', e.target.value)}
                placeholder="Retenção ≥ 45%"
              />
            </div>
            <div className="fgroup grow">
              <span className="flabel">Revisitar</span>
              <input
                className="finput"
                value={form.revisit}
                onChange={(e) => patch('revisit', e.target.value)}
                placeholder="Fim de ago 2026"
              />
            </div>
          </div>

          {/* Horizonte — segmented */}
          <div className="fgroup">
            <span className="flabel">Horizonte</span>
            <div className="seg" style={{ width: '100%' }}>
              {DECISION_HORIZON.map((h) => {
                const meta = HORIZON_META[h]
                return (
                  <button
                    key={h}
                    type="button"
                    className={form.horizon === h ? 'on' : ''}
                    style={{ flex: 1 }}
                    onClick={() => patch('horizon', h)}
                  >
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tema — single-select chips */}
          <div className="fgroup">
            <span className="flabel">Tema</span>
            <div className="row gap-8 wrap">
              {THEME_IDS.map((id) => {
                const meta = THEME_META[id]
                if (!meta) return null
                const isOn = form.theme_id === id
                return (
                  <button
                    key={id}
                    type="button"
                    className={`chip sm${isOn ? ' on' : ''}`}
                    onClick={() => patch('theme_id', isOn ? null : id)}
                  >
                    <span className="cdot" style={{ background: meta.color }} />
                    {meta.short}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Alimenta — multi chips */}
          <div className="fgroup">
            <span className="flabel">Alimenta</span>
            <div className="row gap-8 wrap">
              {DRIVE_OPTIONS.map((drive) => {
                const isOn = form.drives.includes(drive)
                return (
                  <button
                    key={drive}
                    type="button"
                    className={`chip sm${isOn ? ' on' : ''}`}
                    onClick={() => toggleDrive(drive)}
                  >
                    <ArrowRight size={11} />
                    {drive}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pesquisa que fundamenta — multi-select pick-rows */}
          <div className="fsection">Pesquisa que fundamenta</div>
          <div className="fgroup">
            <div className="col gap-7">
              {researchOptions.map((opt) => {
                const isOn = form.sourceIds.includes(opt.id)
                const dot = opt.theme_id ? THEME_META[opt.theme_id]?.color : 'var(--text-dim)'
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`pick-row${isOn ? ' on' : ''}`}
                    onClick={() => toggleSource(opt.id)}
                  >
                    <span className="pick-check">{isOn && <Check size={12} />}</span>
                    <span className="cdot" style={{ background: dot }} />
                    <span className="truncate">{opt.title}</span>
                  </button>
                )
              })}
            </div>
            <span className="fhint">
              As pesquisas que sustentam a decisão. Aparecem no detalhe.
            </span>
          </div>

          {/* Archive (edit only) */}
          {isEdit && (
            <>
              <div className="fsection danger">Arquivar</div>
              <button
                type="button"
                className="btn"
                style={{
                  color: 'var(--danger)',
                  borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)',
                  background: 'var(--danger-s)',
                  width: '100%',
                }}
                onClick={handleArchive}
                disabled={pending}
              >
                <Archive size={15} />
                Arquivar decisão
              </button>
            </>
          )}
        </div>

        {/* Error feedback */}
        {saveError && (
          <div
            style={{
              padding: '8px 14px',
              margin: '0 20px',
              fontSize: 12,
              color: 'var(--danger)',
              background: 'var(--danger-s)',
              borderRadius: 8,
            }}
          >
            {saveError}
          </div>
        )}

        {/* Footer */}
        <div className="drawer-foot">
          <button className="btn ghost" onClick={onClose} type="button" disabled={pending}>
            Cancelar
          </button>
          <button
            className="btn primary"
            onClick={handleSave}
            disabled={pending || !form.statement.trim()}
            type="button"
          >
            <Check size={15} />
            {pending ? 'Salvando...' : isEdit ? 'Salvar' : 'Registrar decisão'}
          </button>
        </div>
      </div>
    </>
  )
}
