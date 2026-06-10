'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Edit, CheckCheck, Target, Film, SlidersHorizontal, Link, Eye, Info, AlertTriangle, Rss, Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { SparklesGlyph } from '../_components/sparkles-glyph'
import { CoworkButton } from '../_components/cowork-button'
import type { RoteiroBeatV3, PosBrief, PosOverrides } from '@/lib/pipeline/video-schemas'
import { handoffBeatRows } from '@/lib/pipeline/handoff-sheet-data'
import { CHANNELS } from '@/lib/pipeline/channels'
import { useVideoEditorDispatch, useCanEditContent } from '../context'
import type { Version } from '../editor-model'

/** "Começar do zero" seed: the editor-brief skeleton (channel-standard categories, empty
 * values) so the editor has the structure to fill — the Cowork fills the values instead.
 * Per-language: the PT skeleton on the PT version, the EN one on the EN version (the EN
 * editor brief must not be seeded with PT style keys / CTA copy). */
const POS_TEMPLATE_PT: PosBrief = {
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

const POS_TEMPLATE_EN: PosBrief = {
  kind: 'brief',
  deliverables: { editor: '', deadline: '', turnaround: '', drive: '', energy: '', notes: '', references: [] },
  style: [
    { k: 'Zoom & reframe', v: '' },
    { k: 'Cut pacing', v: '' },
    { k: 'Speed ramp', v: '' },
    { k: 'Sound design', v: '' },
    { k: 'Music', v: '' },
    { k: 'On-screen text', v: '' },
  ],
  ctas: {
    note: 'The newsletter QR is DIFFERENT per language — double-check it before the final render.',
    rows: [
      { k: 'Newsletter QR', pt: '', en: '' },
      { k: 'Cross-promo', pt: '', en: '' },
      { k: 'Instagram', pt: '', en: '' },
    ],
    display: 'QR shows in the last 8–10s, bottom-right corner. Confirm the code matches this version\'s language.',
  },
}

const POS_TEMPLATES: Record<'pt' | 'en', PosBrief> = { pt: POS_TEMPLATE_PT, en: POS_TEMPLATE_EN }

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
 * non-empty CTA note/display, a per-beat override, or at least one reference. Until then
 * the Pós shows the generate/start chooser instead of empty template cards. */
function briefHasContent(b: PosBrief | null): boolean {
  if (!b) return false
  if (b.style?.length) return true
  if (b.ctas?.rows?.length) return true
  if (b.ctas?.note?.trim()) return true
  if (b.ctas?.display?.trim()) return true
  if (Object.keys(b.overrides ?? {}).length > 0) return true
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

/** `contentEditable="plaintext-only"` support (Chrome/Safari/Opera; Firefox throws or keeps
 * "true") — detected once. Unsupported → fallback `true` + the onPaste rich-paste strip below. */
const PLAINTEXT_ONLY_SUPPORTED = (() => {
  if (typeof document === 'undefined') return false
  const el = document.createElement('div')
  try { el.contentEditable = 'plaintext-only' } catch { return false }
  return el.contentEditable === 'plaintext-only'
})()

/* contentEditable field that commits on blur — gated by `canEdit` (view mode → read-only).
 * Keyboard semantics: Enter = commit (blur, never a newline); Esc = revert to the pre-focus
 * value and blur without committing. In view mode the placeholder ghost is dropped (an empty
 * field renders a plain "—", not an editable-looking hint). */
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
  // Esc support: the value at focus time (to revert to) + whether the pending blur is an
  // Esc-revert (→ skip the commit; without the flag the revert itself would be committed,
  // e.g. minting a per-beat override equal to the derived value).
  const esc = useRef({ prev: '', reverting: false })
  const empty = !String(value || '').trim()
  return (
    <Tag
      id={id}
      className={('efx ' + className).trim()}
      contentEditable={canEdit ? (PLAINTEXT_ONLY_SUPPORTED ? 'plaintext-only' : true) : false}
      role="textbox"
      aria-label={ph}
      aria-readonly={!canEdit}
      suppressContentEditableWarning
      spellCheck={false}
      data-empty={empty || undefined}
      data-ph={canEdit ? ph : undefined}
      onFocus={e => {
        esc.current = { prev: (e.currentTarget as HTMLElement).textContent ?? '', reverting: false }
      }}
      onKeyDown={e => {
        if (!canEdit) return
        if (e.key === 'Enter') {
          e.preventDefault() // single-line field: Enter commits (blur), never inserts a newline
          ;(e.currentTarget as HTMLElement).blur()
        } else if (e.key === 'Escape') {
          esc.current.reverting = true
          ;(e.currentTarget as HTMLElement).textContent = esc.current.prev
          ;(e.currentTarget as HTMLElement).blur()
        }
      }}
      onPaste={e => {
        if (!canEdit || PLAINTEXT_ONLY_SUPPORTED) return
        e.preventDefault() // plaintext-only unsupported → strip rich paste manually
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
      }}
      onBlur={e => {
        if (!canEdit) return // view mode: never commit
        if (esc.current.reverting) { esc.current.reverting = false; return } // Esc: revert, no commit
        onChange((e.currentTarget as HTMLElement).textContent ?? '')
      }}
    >
      {empty && !canEdit ? '—' : value}
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
  // editable brief fields (deliverables / energy / style / CTAs / Momentos-chave / B-roll
  // overrides) read-only.
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

  // --- Per-beat overrides (Momentos-chave / B-roll): the roteiro stays the source; an
  // override only shadows the DERIVED value for the Pós + handoff. Clearing a value
  // (empty after trim) deletes the field — and the key when the entry goes empty — so
  // the row falls back to the derivation.
  const overrides: PosOverrides = brief?.overrides ?? {}

  const writeOverrideEntry = (key: string, entry: NonNullable<PosOverrides[string]>) => {
    const next: PosOverrides = { ...overrides }
    if (Object.keys(entry).length === 0) delete next[key]
    else next[key] = entry
    onPatch({ overrides: next })
  }

  /** Override the momento line ('line', max 280) or visual cue ('cue', max 200) of a beat. */
  const patchMomentField = (key: string, field: 'line' | 'cue', raw: string) => {
    const v = raw.trim().slice(0, field === 'line' ? 280 : 200)
    const entry = { ...(overrides[key] ?? {}) }
    if (v === '') delete entry[field]
    else entry[field] = v
    writeOverrideEntry(key, entry)
  }

  /** Edit b-roll item `j`: stores the full effective list (max 8 × 200ch) as the override;
   * clearing an item drops it; an empty resulting list deletes the field (→ derived). */
  const patchBrollItem = (key: string, effList: string[], j: number, raw: string) => {
    const v = raw.trim().slice(0, 200)
    const list = effList
      .map((item, idx) => (idx === j ? v : item))
      .filter((item) => item.trim() !== '')
      .slice(0, 8)
    const entry = { ...(overrides[key] ?? {}) }
    if (list.length === 0) delete entry.broll
    else entry.broll = list
    writeOverrideEntry(key, entry)
  }

  // "Recomeçar": wipe the brief back to an empty shell → briefHasContent() flips false →
  // the generate/start chooser returns. Two-step inline confirm guards written work, and the
  // toast offers "Desfazer" (~8s) — the wipe persists immediately and may be destroying a
  // Cowork-written brief, so the pre-reset brief is stashed and restorable via onSeed
  // (force persist: after the wipe the chooser is up and gated onPatch edits don't apply).
  const preResetRef = useRef<PosBrief | null>(null)
  const onReset = () => {
    if (!canEdit) return // defense-in-depth: never write content in view mode
    preResetRef.current = brief
    onPatch({ kind: 'brief', deliverables: {}, style: [], ctas: { note: '', rows: [], display: '' }, overrides: {} })
    setConfirmReset(false)
    toast.info('Brief de pós limpo', {
      description: 'Volte a gerar com o Cowork ou comece do zero.',
      duration: 8000,
      action: {
        label: 'Desfazer',
        onClick: () => {
          const prev = preResetRef.current
          if (prev) onSeed(prev) // restores overrides too — they live on the stashed brief
        },
      },
    })
  }

  // CREATE-from-empty: entering edit mode + force-seeding the template in one click. This is a
  // deliberate create with nothing to lose, so it's available even in view mode (unlike edits).
  // The skeleton follows the version's language (PT keys/copy on PT, EN on EN).
  const seedFromEmpty = () => {
    dispatch({ type: 'SET_EDIT_MODE', mode: 'edit' })
    onSeed(POS_TEMPLATES[activeLang])
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

  // ONE beat projection for screen AND paper: `handoffBeatRows` is the same
  // (derived ⤳ override-shadowed, non-spoken/cue-less dropped, contiguously numbered)
  // projection the printed handoff renders. Both cards are subsets of these rows and
  // show `displayNum` — so "#3" names the same beat in Momentos, B-roll and the print.
  const rows = handoffBeatRows(beats, overrides)
  const moments = rows.filter((r) => r.anchor)
  const brollRows = rows.filter((r) => r.cues.length > 0)

  return (
    <div className="pp-doc fade-in">
      {/* ── top bar ── */}
      <div className="pp-bar">
        <div className="pp-bar-head">
          <div className="vi-kicker"><SparklesGlyph size={12} /> Pós-produção · brief pro editor</div>
          <h1 className="vi-title pp-bar-title">Instruções pro editor</h1>
          {/* honest mode line: only claim editability when content edits actually apply */}
          <div className="pp-editor">
            {canEdit
              ? <><Edit size={11} /> Tudo editável · ajuste por vídeo</>
              : <><Eye size={11} /> Somente leitura — ative o lápis pra editar</>}
          </div>
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
        <PPCard icon={<CheckCheck size={14} />} title="Entrega" sub={canEdit ? 'o combinado · clique para editar' : 'o combinado'}>
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
        <PPCard icon={<SlidersHorizontal size={14} />} title="Estilo &amp; ritmo" sub={canEdit ? 'o jeito do canal — editável' : 'o jeito do canal'}>
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

        {/* ── Momentos-chave + B-roll (from beats) — derived from the roteiro, editable via
            per-beat OVERRIDES (the roteiro stays the source; clearing falls back). Last in the
            grid (same order as the printed handoff: editable instructions first, the long
            script appendix after) ── */}
        {beats.length > 0 ? (
          <>
            <PPCard icon={<Target size={14} />} title="Momentos-chave" sub={canEdit ? 'frase-âncora + cue visual, por beat — editável' : 'frase-âncora + cue visual, por beat'}>
              {moments.length > 0 ? (
                <div className="pp-moments">
                  {moments.map((m) => (
                    <div key={m.overrideKey} className="pp-moment">
                      {/* the row's projection number — the SAME #N the B-roll card and the printed handoff show */}
                      <span className="pp-mnum">#{m.displayNum}</span>
                      <div className="pp-mbody">
                        <div className="pp-mline">
                          &ldquo;<EF
                            tag="span"
                            className={m.ov.line ? 'ef-inline pp-ov' : 'ef-inline'}
                            value={m.anchor}
                            canEdit={canEdit}
                            onChange={(v) => patchMomentField(m.overrideKey, 'line', v)}
                            ph="Frase-âncora"
                          />&rdquo;
                        </div>
                        {/* edit mode keeps the cue row even when empty (so a cue can be added) */}
                        {(m.cue || canEdit) && (
                          <div className="pp-mcue">
                            <Film size={12} />{' '}
                            <EF
                              tag="span"
                              className={m.ov.cue ? 'ef-inline pp-ov' : 'ef-inline'}
                              value={m.cue}
                              canEdit={canEdit}
                              onChange={(v) => patchMomentField(m.overrideKey, 'cue', v)}
                              ph="Cue visual"
                            />
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

            <PPCard icon={<Film size={14} />} title="B-roll por beat" sub={canEdit ? 'o que cobrir em cada trecho — editável' : 'o que cobrir em cada trecho'}>
              {brollRows.length > 0 ? (
                <div className="pp-broll">
                  {brollRows.map((r) => (
                    <div key={r.overrideKey} className="pp-broll-row">
                      <span className="pp-bname">#{r.displayNum} · {r.name}</span>
                      <ul>
                        {r.cues.map((v, j) => (
                          <li key={j}>
                            <EF
                              tag="span"
                              className={r.ov.broll ? 'ef-inline pp-ov' : 'ef-inline'}
                              value={v}
                              canEdit={canEdit}
                              onChange={(nv) => patchBrollItem(r.overrideKey, r.cues, j, nv)}
                              ph="Item de b-roll"
                            />
                          </li>
                        ))}
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
