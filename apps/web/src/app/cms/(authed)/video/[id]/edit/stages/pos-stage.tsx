'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Edit, CheckCheck, Target, Film, SlidersHorizontal, Link, Eye, Info, AlertTriangle, Rss, Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { SparklesGlyph } from '../_components/sparkles-glyph'
import { CoworkButton } from '../_components/cowork-button'
import type { RoteiroBeatV3, PosBrief } from '@/lib/pipeline/video-schemas'
import { spokenAnchorText, visNotes } from '@/lib/pipeline/video-pos-derive'
import { CHANNELS } from '@/lib/pipeline/channels'
import { useVideoEditorDispatch, useCanEditContent } from '../context'
import type { Version } from '../editor-model'

/** "Começar do zero" seed: the editor-brief skeleton (channel-standard categories, empty
 * values) so the editor has the structure to fill — the Cowork fills the values instead. */
const POS_TEMPLATE: PosBrief = {
  kind: 'brief',
  deliverables: { editor: '', deadline: '', turnaround: '', drive: '', energy: '', notes: '', references: [] },
  style: [
    { k: 'Zoom & reframe', v: '' },
    { k: 'Ritmo de corte', v: '' },
    { k: 'Speed ramp', v: '' },
    { k: 'Sound design', v: '' },
    { k: 'Música', v: '' },
    { k: 'Texto na tela', v: '' },
  ],
  ctas: {
    note: 'O QR do newsletter é DIFERENTE por idioma — confira antes de finalizar.',
    rows: [
      { k: 'Newsletter QR', pt: '', en: '' },
      { k: 'Cross-promo', pt: '', en: '' },
      { k: 'Instagram', pt: '', en: '' },
    ],
    display: 'QR aparece nos últimos 8–10s, canto inferior direito. Confirme que o código casa com o idioma da versão.',
  },
}

/** Empty CTA shape — kept as a const so `ctas ?? EMPTY_CTAS` is referentially stable. */
const EMPTY_CTAS: NonNullable<PosBrief['ctas']> = { note: '', rows: [], display: '' }

/** Logistics fields of the delivery brief. Cowork usually can't fill editor/prazo (those are
 * decided by a human), so the card splits: filled fields → editable grid; empty ones → a single
 * muted "a combinar" pill row (click focuses the field) instead of 4 dead input rows. */
const DELIVERABLES = [
  { k: 'editor', label: 'Editor', ph: 'Nome do editor' },
  { k: 'deadline', label: 'Prazo', ph: 'Prazo' },
  { k: 'turnaround', label: 'Revisão', ph: 'Turnaround' },
  { k: 'drive', label: 'Drive', ph: 'Pasta no Drive', wide: true },
] as const

type DeliverableKey = (typeof DELIVERABLES)[number]['k']

/** A brief is "started" once it carries any style/CTA rows, a filled deliverable field, a
 * non-empty CTA note/display, or at least one reference. Until then the Pós shows the
 * generate/start chooser instead of empty template cards. */
function briefHasContent(b: PosBrief | null): boolean {
  if (!b) return false
  if (b.style?.length) return true
  if (b.ctas?.rows?.length) return true
  if (b.ctas?.note?.trim()) return true
  if (b.ctas?.display?.trim()) return true
  const del = b.deliverables ?? {}
  if ((del.references ?? []).some((r) => r.trim() !== '')) return true
  return Object.values(del).some((v) => typeof v === 'string' && v.trim() !== '')
}

export interface PosStageProps {
  /** Design-handoff Version for the active lang (cur = versions[lang]). */
  cur?: Version
  beats: RoteiroBeatV3[]
  brief: PosBrief | null
  activeLang: 'pt' | 'en'
  /** GATED patch for EDITING existing brief content (field blur, CTA edits, Recomeçar reset). */
  onPatch: (patch: Partial<PosBrief>) => void
  /**
   * CREATE-from-empty seed (forced persist). Used by "Começar do zero" / legacy "Recriar brief" —
   * dispatched together with SET_EDIT_MODE('edit'), so it must bypass the next-render canEdit gate.
   */
  onSeed: (patch: Partial<PosBrief>) => void
  onOpenHandoff: () => void
  /** Legacy rich postprod payload (schema_version present / no kind) → read-only fallback (§3.10). */
  legacy: Record<string, unknown> | null
  /** Present language labels (e.g. "PT-BR + EN"), computed by the shell from versions. */
  langLabels?: string
}

/* contentEditable field that commits on blur — gated by `canEdit` (view mode → read-only) */
function EF({
  value,
  onChange,
  canEdit,
  tag = 'b',
  className = '',
  ph,
  id,
}: {
  value: string
  onChange: (v: string) => void
  /** content-editing gate: false → non-editable (no caret/focus) and the blur commit is skipped */
  canEdit: boolean
  tag?: 'b' | 'span'
  className?: string
  ph?: string
  /** Optional DOM id so a sibling affordance (e.g. "a combinar" pill) can focus the field. */
  id?: string
}) {
  const Tag = tag
  return (
    <Tag
      id={id}
      className={('efx ' + className).trim()}
      contentEditable={canEdit}
      role="textbox"
      aria-label={ph}
      aria-readonly={!canEdit}
      suppressContentEditableWarning
      spellCheck={false}
      data-empty={!String(value || '').trim() || undefined}
      data-ph={ph}
      onBlur={e => {
        if (!canEdit) return // view mode: never commit
        onChange((e.currentTarget as HTMLElement).textContent ?? '')
      }}
    >
      {value}
    </Tag>
  )
}

/* Card shell matching .pp-card > .pp-head + .pp-body */
function PPCard({
  icon,
  title,
  sub,
  children,
}: {
  icon: React.ReactNode
  title: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <section className="pp-card">
      <div className="pp-head">
        <span className="pp-ico">{icon}</span>
        <h2 className="pp-title">{title}</h2>
        {sub && <span className="pp-sub">{sub}</span>}
      </div>
      <div className="pp-body">{children}</div>
    </section>
  )
}

/**
 * The Pós generate/start chooser — the SAME experience for an empty Pós and a legacy one
 * (so a legacy brief reads as "let's make a new one", not a dead read-only banner). Both
 * affordances are CREATE-from-empty: "Gerar pós com Cowork" writes via the pipeline API;
 * "Começar do zero" enters edit mode + force-seeds. Available regardless of edit mode.
 */
function PosGenerateChooser({ onStart, legacy = false }: { onStart: () => void; legacy?: boolean }) {
  return (
    <div className="pp-doc fade-in">
      <div className="rot-gen">
        <div className="vi-kicker"><SparklesGlyph size={13} /> Pós · brief pro editor</div>
        <h1 className="vi-title">Instruções pro editor</h1>
        <div className="rot-gen-actions">
          <CoworkButton stage="pos" label="Gerar pós com Cowork" />
          <button type="button" className="btn" onClick={onStart}>
            <Plus size={15} /> Começar do zero
          </button>
        </div>
        <div className="rot-gen-sub">
          {legacy
            ? 'Há um pós em formato antigo guardado neste vídeo. Gere com o Cowork ou comece do zero pra ter o brief novo, editável — o conteúdo legado é substituído.'
            : 'O Cowork sugere a partir do roteiro, ou comece do zero. Os momentos-chave saem do roteiro e são referenciados nas sugestões.'}
        </div>
      </div>
    </div>
  )
}

export function PosStage({ beats, brief, activeLang, onPatch, onSeed, onOpenHandoff, legacy, langLabels }: PosStageProps) {
  const dispatch = useVideoEditorDispatch()
  // THE content-editing gate: edit mode AND stage not scheduled/published. View mode makes the
  // editable brief fields (deliverables / energy / style / CTAs) read-only. Derived Momentos-chave /
  // B-roll stay as-is (already read-only).
  const canEdit = useCanEditContent()

  const [confirmReset, setConfirmReset] = useState(false)
  const resetBtnRef = useRef<HTMLButtonElement>(null)
  // Empty deliverable fields the user opened from their "a combinar" pill (render as editable rows).
  const [revealed, setRevealed] = useState<Set<DeliverableKey>>(() => new Set())

  const onCancelReset = useCallback(() => {
    setConfirmReset(false)
    requestAnimationFrame(() => resetBtnRef.current?.focus())
  }, [])

  // Escape cancels the inline confirm (and restores focus to the Recomeçar button).
  useEffect(() => {
    if (!confirmReset) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelReset() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmReset, onCancelReset])

  const del = brief?.deliverables ?? {}
  const style = brief?.style ?? []
  const ctas = brief?.ctas ?? EMPTY_CTAS

  const patchDel = (k: keyof NonNullable<PosBrief['deliverables']>, v: string) =>
    onPatch({ deliverables: { ...del, [k]: v } })

  // Adaptive Entrega: split the logistics fields by whether they're filled. A field a user clicked
  // open via its "a combinar" pill (revealed) also renders as an editable row even while empty.
  const delVal = (k: DeliverableKey) => (del[k] ?? '').trim()
  const fieldId = (k: DeliverableKey) => `pp-del-${k}`
  const shownDel = DELIVERABLES.filter((f) => delVal(f.k) !== '' || revealed.has(f.k))
  const todoDel = DELIVERABLES.filter((f) => delVal(f.k) === '' && !revealed.has(f.k))
  // Pills reveal + focus the field (edit mode only). In view mode the EFs aren't focusable, so the
  // pills stay a non-interactive "falta preencher" affordance.
  const revealDelField = (k: DeliverableKey) => {
    if (!canEdit) return
    setRevealed((prev) => new Set(prev).add(k))
    requestAnimationFrame(() => document.getElementById(fieldId(k))?.focus())
  }

  const patchStyleRow = (i: number, v: string) => {
    const next = style.map((s, j) => (j === i ? { ...s, v } : s))
    onPatch({ style: next })
  }

  const patchCta = (rowIdx: number, lang: 'pt' | 'en', v: string) => {
    const rows = ctas.rows.map((r, j) => (j === rowIdx ? { ...r, [lang]: v } : r))
    onPatch({ ctas: { ...ctas, rows } })
  }

  const patchCtaField = (field: 'note' | 'display', v: string) =>
    onPatch({ ctas: { ...ctas, [field]: v } })

  // "Recomeçar": wipe the brief back to an empty shell → briefHasContent() flips false →
  // the generate/start chooser returns. Two-step inline confirm guards written work.
  const onReset = () => {
    if (!canEdit) return // defense-in-depth: never write content in view mode
    onPatch({ kind: 'brief', deliverables: {}, style: [], ctas: { note: '', rows: [], display: '' } })
    setConfirmReset(false)
    toast.info('Brief de pós limpo', { description: 'Volte a gerar com o Cowork ou comece do zero.' })
  }

  // CREATE-from-empty: entering edit mode + force-seeding the template in one click. This is a
  // deliberate create with nothing to lose, so it's available even in view mode (unlike edits).
  const seedFromEmpty = () => {
    dispatch({ type: 'SET_EDIT_MODE', mode: 'edit' })
    onSeed(POS_TEMPLATE)
  }

  const hasBriefKind = brief && 'kind' in brief

  // Legacy postprod (old schema / no `kind`) is now the SAME generate/start chooser as an
  // empty Pós (with a note that legacy content exists) — not a dead read-only banner.
  if (legacy && (legacy.schema_version || !hasBriefKind)) {
    return <PosGenerateChooser onStart={seedFromEmpty} legacy />
  }

  // Not auto-derived: the Pós is a SUGGESTIONS brief for the editor. Until it's generated
  // (Cowork) or started from scratch, show the chooser — never empty template cards.
  if (!briefHasContent(brief)) {
    return <PosGenerateChooser onStart={seedFromEmpty} />
  }

  // Present language labels (computed by the shell from versions); fall back to all
  // channels when rendered bare (tests / no shell).
  const langs = langLabels ?? CHANNELS.map((c) => c.label).join(' + ')

  const goRoteiro = () => dispatch({ type: 'SET_STAGE', stage: 'roteiro' })

  // Derived lists computed once so we can branch on emptiness (empty → fallback, not blank card).
  const moments = beats
    .map((b, i) => ({ i, line: spokenAnchorText(b), cue: visNotes(b)[0] }))
    .filter((m) => m.line)
  const brollRows = beats
    .map((b, i) => ({ i, name: b.name, vs: visNotes(b) }))
    .filter((r) => r.vs.length > 0)

  return (
    <div className="pp-doc fade-in">
      {/* ── top bar ── */}
      <div className="pp-bar">
        <div className="pp-bar-head">
          <div className="vi-kicker"><SparklesGlyph size={12} /> Pós-produção · brief pro editor</div>
          <h1 className="vi-title pp-bar-title">Instruções pro editor</h1>
          <div className="pp-editor"><Edit size={11} /> Tudo editável · ajuste por vídeo</div>
        </div>
        <div className="grow" />
        {canEdit && (confirmReset ? (
          <span className="rot-reset-confirm">
            Limpar o brief?
            <button type="button" className="rot-reset-yes" onClick={onReset}>limpar</button>
            <button type="button" className="rot-reset-no" onClick={onCancelReset}>cancelar</button>
          </span>
        ) : (
          <button type="button" className="rot-reset" ref={resetBtnRef} onClick={() => setConfirmReset(true)}>
            <RotateCcw size={12} /> Recomeçar
          </button>
        ))}
        <button type="button" className="btn primary" onClick={onOpenHandoff}>
          <Rss size={14} /> Exportar pro editor
        </button>
      </div>

      {/* ── cards grid ── */}
      <div className="pp-grid">

        {/* ── Entrega ── */}
        <PPCard icon={<CheckCheck size={14} />} title="Entrega" sub="o combinado · clique para editar">
          <div className="pp-fields">
            {shownDel.map((f) => (
              <div key={f.k} className={'wide' in f && f.wide ? 'pp-f wide' : 'pp-f'}>
                <span>{f.label}</span>
                <EF id={fieldId(f.k)} value={del[f.k] ?? ''} canEdit={canEdit} onChange={v => patchDel(f.k, v)} ph={f.ph} />
              </div>
            ))}
            {/* Versões is derived from the present languages — always shown, never empty. */}
            <div className="pp-f">
              <span>Versões</span><b>{langs}</b>
            </div>
            {/* Escopo: free-form "what to actually cut/deliver". Wide + always editable. */}
            <div className="pp-f wide">
              <span>Escopo</span>
              <EF
                value={del.notes ?? ''}
                canEdit={canEdit}
                onChange={v => patchDel('notes', v)}
                ph="Ex: corte principal 8–12min, 3 Shorts, overlays a inserir"
              />
            </div>
          </div>
          {todoDel.length > 0 && (
            <div className="pp-todo">
              <span className="pp-todo-lbl">A combinar</span>
              {todoDel.map((f) => (
                <button
                  key={f.k}
                  type="button"
                  className="pp-todo-pill"
                  disabled={!canEdit}
                  onClick={() => revealDelField(f.k)}
                >
                  <Plus size={11} /> {f.label}
                </button>
              ))}
            </div>
          )}
          <div className="pp-energy">
            <Eye size={13} />
            <span>
              <b>Energia:</b>{' '}
              <EF tag="span" className="ef-inline" value={del.energy ?? ''} canEdit={canEdit} onChange={v => patchDel('energy', v)} ph="Energia/tom" />
              {(del.references ?? []).length > 0 && <i> Ref: {(del.references ?? []).join(' · ')}</i>}
            </span>
          </div>
        </PPCard>

        {/* ── Estilo & ritmo ── */}
        <PPCard icon={<SlidersHorizontal size={14} />} title="Estilo &amp; ritmo" sub="o jeito do canal — editável">
          <div className="pp-style">
            {style.map((s, i) => (
              <div key={i} className="pp-srow">
                <span className="pp-sk">{s.k}</span>
                <EF tag="span" className="pp-sv" value={s.v} canEdit={canEdit} onChange={v => patchStyleRow(i, v)} ph={s.k} />
              </div>
            ))}
          </div>
        </PPCard>

        {/* ── CTAs & QR ── */}
        <PPCard icon={<Link size={14} />} title="CTAs &amp; QR" sub="atenção: muda por idioma">
          <div className="pp-cta-note">
            <AlertTriangle size={13} />{' '}
            <EF tag="span" className="ef-inline" value={ctas.note ?? ''} canEdit={canEdit} onChange={v => patchCtaField('note', v)} ph="Aviso pro editor" />
          </div>
          <div className="pp-cta-table" role="table">
            <div className="pp-cta-h" role="row">
              <span role="columnheader" aria-label="Destino" />
              <span role="columnheader" className={activeLang === 'pt' ? 'on' : ''} aria-current={activeLang === 'pt' ? 'true' : undefined}>🇧🇷 PT</span>
              <span role="columnheader" className={activeLang === 'en' ? 'on' : ''} aria-current={activeLang === 'en' ? 'true' : undefined}>🇺🇸 EN</span>
            </div>
            {ctas.rows.map((r, i) => (
              <div key={i} className="pp-cta-row" role="row">
                <span className="pp-ck" role="rowheader">{r.k}</span>
                <span role="cell" className={activeLang === 'pt' ? 'on' : ''} aria-current={activeLang === 'pt' ? 'true' : undefined}>
                  <EF tag="span" className="ef-inline" value={r.pt} canEdit={canEdit} onChange={v => patchCta(i, 'pt', v)} ph={`${r.k} · PT`} />
                </span>
                <span role="cell" className={activeLang === 'en' ? 'on' : ''} aria-current={activeLang === 'en' ? 'true' : undefined}>
                  <EF tag="span" className="ef-inline" value={r.en} canEdit={canEdit} onChange={v => patchCta(i, 'en', v)} ph={`${r.k} · EN`} />
                </span>
              </div>
            ))}
          </div>
          <div className="pp-cta-disp">
            <Info size={12} />{' '}
            <EF tag="span" className="ef-inline" value={ctas.display ?? ''} canEdit={canEdit} onChange={v => patchCtaField('display', v)} ph="Onde/quando o QR aparece" />
          </div>
        </PPCard>

        {/* ── Momentos-chave + B-roll (from beats) — derived REFERENCE, last (same order as the
            printed handoff: editable instructions first, the long script appendix after) ── */}
        {beats.length > 0 ? (
          <>
            <PPCard icon={<Target size={14} />} title="Momentos-chave" sub="frase-âncora + cue visual, por beat">
              {moments.length > 0 ? (
                <div className="pp-moments">
                  {moments.map((m, n) => (
                    <div key={m.i} className="pp-moment">
                      <span className="pp-mnum">#{n + 1}</span>
                      <div className="pp-mbody">
                        <div className="pp-mline">&ldquo;{m.line}&rdquo;</div>
                        {m.cue && (
                          <div className="pp-mcue">
                            <Film size={12} /> {m.cue}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pp-empty">Nenhum beat falado ainda — os momentos saem das falas do roteiro.</div>
              )}
            </PPCard>

            <PPCard icon={<Film size={14} />} title="B-roll por beat" sub="o que cobrir em cada trecho">
              {brollRows.length > 0 ? (
                <div className="pp-broll">
                  {brollRows.map((r) => (
                    <div key={r.i} className="pp-broll-row">
                      <span className="pp-bname">#{r.i + 1} · {r.name}</span>
                      <ul>
                        {r.vs.map((v, j) => <li key={j}>{v}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pp-empty">Nenhum beat tem cue visual ainda — o B-roll sai das notas do roteiro.</div>
              )}
            </PPCard>
          </>
        ) : (
          <PPCard icon={<Target size={14} />} title="Momentos-chave &amp; b-roll">
            <div className="pp-empty">
              Saem do roteiro.{' '}
              <button type="button" className="pp-link" onClick={goRoteiro}>
                Destrinche o roteiro
              </button>
              {' '}e eles aparecem aqui automaticamente.
            </div>
          </PPCard>
        )}

      </div>
    </div>
  )
}
