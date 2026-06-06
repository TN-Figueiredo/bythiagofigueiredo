'use client'

import { useState, useCallback, useTransition, useEffect, useRef } from 'react'
import { Target, X, Check, Archive } from 'lucide-react'
import type {
  ResearchFoco,
  ThemeId,
  DecisionHorizon,
} from '@/lib/pipeline/research-types'
import { THEME_META, HORIZON_META, FOCO_STATE_META } from '@/lib/pipeline/research-types'
import { THEME_IDS, FOCO_STATE, DECISION_HORIZON } from '@/lib/pipeline/research-schemas'
import type { FocoState } from '@/lib/pipeline/research-schemas'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FocoDrawerProps {
  initial?: Partial<ResearchFoco> & { id?: string; themes?: ThemeId[] }
  onClose: () => void
  onSaved: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FocoDrawer({ initial, onClose, onSaved }: FocoDrawerProps) {
  const isNew = !initial?.id

  // --- Form state ---

  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    horizon: (initial?.horizon ?? 'agora') as DecisionHorizon,
    state: (initial?.state ?? 'rascunho') as FocoState,
    rationale: initial?.rationale ?? '',
    metric: initial?.metric ?? '',
    window_label: initial?.window_label ?? '',
    theme_ids: (initial?.themes ?? []) as ThemeId[],
  })

  const set = useCallback(
    <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  )

  // --- Theme toggle ---

  const toggleTheme = useCallback((id: ThemeId) => {
    setForm((prev) => ({
      ...prev,
      theme_ids: prev.theme_ids.includes(id)
        ? prev.theme_ids.filter((t) => t !== id)
        : [...prev.theme_ids, id],
    }))
  }, [])

  // --- Save ---

  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = useCallback(() => {
    if (!form.title.trim()) return
    setSaveError(null)

    startTransition(async () => {
      const { saveFocoFull } = await import('../foco-actions')
      const result = await saveFocoFull({
        id: initial?.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        horizon: form.horizon,
        state: form.state,
        rationale: form.rationale.trim() || null,
        metric: form.metric.trim() || null,
        window_label: form.window_label.trim() || null,
        theme_ids: form.theme_ids,
        pinned_research_ids: [],
      })
      if (result.ok) {
        onSaved()
        onClose()
      } else {
        setSaveError(result.error ?? 'Erro ao salvar')
      }
    })
  }, [form, initial, onSaved, onClose])

  // --- Archive ---

  const handleArchive = useCallback(() => {
    if (!initial?.id) return
    setSaveError(null)

    startTransition(async () => {
      const { archiveResearchFoco } = await import('../foco-actions')
      const result = await archiveResearchFoco(initial.id!)
      if (result.ok) {
        onSaved()
        onClose()
      } else {
        setSaveError(result.error ?? 'Erro ao arquivar')
      }
    })
  }, [initial, onSaved, onClose])

  // --- Keyboard: Escape to close ---

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // --- Auto-focus title on mount ---

  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  // --- Render ---

  const canArchive = !isNew && initial?.state !== 'arquivado'
  const isActive = initial?.active === true

  return (
    <>
      {/* Scrim */}
      <div className="drawer-scrim" onClick={onClose} role="presentation" />

      {/* Panel */}
      <div className="drawer-panel" role="dialog" aria-modal="true" aria-label={isNew ? 'Novo foco' : 'Editar foco'}>
        {/* Header */}
        <div className="drawer-head">
          <Target size={17} style={{ color: 'var(--accent-text)' }} />
          <span className="dt">{isNew ? 'Novo foco' : 'Editar foco'}</span>
          <div style={{ flex: 1 }} />
          <button className="icon-btn bare" onClick={onClose} title="Fechar" aria-label="Fechar" type="button">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="drawer-body">
          {/* Title */}
          <div className="fgroup">
            <span className="flabel">Titulo</span>
            <input
              ref={titleRef}
              className="finput"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ex.: A transicao Brasil para Asia"
            />
          </div>

          {/* Description */}
          <div className="fgroup">
            <span className="flabel">Descricao</span>
            <textarea
              className="finput"
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="A narrativa em torno da qual o trimestre se organiza..."
            />
          </div>

          {/* Horizon + Window side by side */}
          <div className="drawer-row">
            <div className="fgroup">
              <span className="flabel">Horizonte</span>
              <div className="seg" style={{ width: '100%' }}>
                {DECISION_HORIZON.map((h) => {
                  const meta = HORIZON_META[h]
                  return (
                    <button
                      key={h}
                      className={form.horizon === h ? 'on' : ''}
                      onClick={() => set('horizon', h)}
                      type="button"
                    >
                      {meta.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="fgroup">
              <span className="flabel">Janela</span>
              <input
                className="finput"
                value={form.window_label}
                onChange={(e) => set('window_label', e.target.value)}
                placeholder="Jun - Ago 2026"
              />
            </div>
          </div>

          {/* State */}
          <div className="fgroup">
            <span className="flabel">Estado</span>
            <select
              className="finput"
              value={form.state}
              onChange={(e) => set('state', e.target.value as FocoState)}
            >
              {FOCO_STATE.map((s) => {
                const meta = FOCO_STATE_META[s]
                return (
                  <option key={s} value={s}>
                    {meta.label}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Rationale */}
          <div className="fgroup">
            <span className="flabel">Por que este foco?</span>
            <textarea
              className="finput"
              rows={3}
              value={form.rationale}
              onChange={(e) => set('rationale', e.target.value)}
              placeholder="Justificativa estrategica..."
            />
          </div>

          {/* Metric */}
          <div className="fgroup">
            <span className="flabel">Como medir progresso?</span>
            <input
              className="finput"
              value={form.metric}
              onChange={(e) => set('metric', e.target.value)}
              placeholder="8 de 11 videos do trimestre"
            />
          </div>

          {/* Themes */}
          <div className="fgroup">
            <span className="flabel">Temas</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {THEME_IDS.map((id) => {
                const meta = THEME_META[id]
                if (!meta) return null
                const isOn = form.theme_ids.includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    className={`chip sm${isOn ? ' on' : ''}`}
                    onClick={() => toggleTheme(id)}
                  >
                    <span className="cdot" style={{ background: meta.color }} />
                    {meta.short}
                  </button>
                )
              })}
            </div>
            <span className="fhint">Selecione os temas que se aplicam a este foco.</span>
          </div>

          {/* Archive section */}
          {canArchive && (
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
                disabled={isPending}
              >
                <Archive size={15} />
                {isActive ? 'Encerrar este foco' : 'Arquivar aposta'}
              </button>
              {isActive && (
                <span className="fhint" style={{ marginTop: -8 }}>
                  Encerra o foco do trimestre. Voce volta a tela de definir foco.
                </span>
              )}
            </>
          )}
        </div>

        {/* Error feedback */}
        {saveError && (
          <div style={{
            padding: '8px 14px',
            margin: '0 20px',
            fontSize: 12,
            color: 'var(--danger)',
            background: 'var(--danger-s)',
            borderRadius: 8,
          }}>
            {saveError}
          </div>
        )}

        {/* Footer */}
        <div className="drawer-foot">
          <button type="button" className="btn" onClick={onClose} disabled={isPending}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleSave}
            disabled={isPending || !form.title.trim()}
          >
            <Check size={15} />
            {isPending ? 'Salvando...' : 'Salvar foco'}
          </button>
        </div>
      </div>
    </>
  )
}
