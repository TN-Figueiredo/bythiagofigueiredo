'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  TrendingUp, Info, Layers, Lock, Rss, Radio, Trophy, Image, FileText, Plus, RotateCcw,
} from 'lucide-react'
import { SparklesGlyph } from '../_components/sparkles-glyph'
import { CoworkButton } from '../_components/cowork-button'
import { channelByLang } from '@/lib/pipeline/channels'
import { useOptionalDispatch, useCanEditContent } from '../context'
import { EMPTY_AB_DRAFT } from '../editor-model'
import type { ABDraft } from '@/lib/pipeline/video-schemas'
import type { AbCtaState } from '@/lib/pipeline/video-ab-precondition'
import type { Version } from '../editor-model'
import type { VideoLang } from '../types'

/* Ground truth: design_handoff_video_module/views-video.jsx line 516 */
const AB_COLORS: Record<'A' | 'B' | 'C' | 'D', string> = {
  A: '#8A8F98',
  B: '#E8823C',
  C: '#3FA9C0',
  D: '#A77CE8',
}

const DIST_CHANNELS: [string, string][] = [
  ['Instagram', '#d6336c'],
  ['Bluesky', '#1185fe'],
  ['Comunidade YT', '#ef4444'],
  ['Newsletter', '#a855f7'],
]

/** A draft is "started" once any variant carries a non-empty title or brief. Until then the
 *  Publicação shows the generate/start chooser instead of empty variant cards. Mirrors
 *  briefHasContent in pos-stage. */
function draftHasContent(d: ABDraft | null): boolean {
  if (!d) return false
  return d.variants.some((v) => (v.title ?? '').trim() !== '' || (v.brief ?? '').trim() !== '')
}

export interface PublicacaoStageProps {
  /** Design-handoff Version for the active lang (cur = versions[lang]). */
  cur?: Version
  /** Active language — used to resolve the channel name in .pub-bar. */
  lang?: VideoLang
  draft: ABDraft
  cta: AbCtaState
  published: boolean
  /** ab-lab winner_variant_id; the trophy/"vencedora" badge shows ONLY when this is set.
   *  While the test runs (null), NO leader/winner badge appears on any card. */
  winnerVariantId: string | null
  /** GATED patch for EDITING the A/B draft (title/brief blur, firstOnAir pick, Recomeçar reset). */
  onPatch: (patch: Partial<ABDraft>) => void
  /** CREATE-from-empty seed (forced persist) — "Começar do zero", dispatched alongside
   *  SET_EDIT_MODE('edit') so it must bypass the next-render canEdit gate. Mirrors Pós. */
  onSeed: (patch: Partial<ABDraft>) => void
  onPublish: () => void
}

export function PublicacaoStage({
  lang,
  draft,
  cta,
  published,
  winnerVariantId,
  onPatch,
  onSeed,
  onPublish,
}: PublicacaoStageProps) {
  const dispatch = useOptionalDispatch()
  // THE content-editing gate: edit mode AND stage not scheduled/published. Combined with the
  // existing publish freeze (`published`) → titles/briefs editable, firstOnAir toggle live, ONLY
  // when in edit mode and not published. View mode makes the A/B fields read-only.
  const canEdit = useCanEditContent()
  const canEditFields = canEdit && !published
  const channelName = channelByLang(lang ?? 'pt')?.name ?? 'tnFigueiredo'

  const [confirmReset, setConfirmReset] = useState(false)
  const resetBtnRef = useRef<HTMLButtonElement>(null)

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

  function patchTitle(idx: number, title: string) {
    const variants = draft.variants.map((v, i) =>
      i === idx ? { ...v, title } : v,
    )
    onPatch({ variants: variants as ABDraft['variants'] })
  }

  function patchBrief(idx: number, brief: string) {
    const variants = draft.variants.map((v, i) =>
      i === idx ? { ...v, brief } : v,
    )
    onPatch({ variants: variants as ABDraft['variants'] })
  }

  // "Recomeçar": wipe the draft back to a fresh 4-up → draftHasContent() flips false → the
  // generate/start chooser returns. Two-step inline confirm guards written work.
  const onReset = () => {
    if (!canEditFields) return // defense-in-depth: never write content in view mode / published
    onPatch(EMPTY_AB_DRAFT)
    setConfirmReset(false)
    toast.info('Variações A/B limpas', { description: 'Volte a gerar com o Cowork ou comece do zero.' })
  }

  // CREATE-from-empty: entering edit mode + force-seeding a fresh 4-up in one click. A deliberate
  // create with nothing to lose, so it's available even in view mode (unlike edits). Mirrors Pós.
  const seedFromEmpty = () => {
    dispatch({ type: 'SET_EDIT_MODE', mode: 'edit' })
    onSeed(EMPTY_AB_DRAFT)
  }

  // Not auto-derived: until the draft is generated (Cowork) or started from scratch, show the
  // chooser — never empty variant cards. (Published is always "started" — skip the chooser.)
  if (!published && !draftHasContent(draft)) {
    return (
      <div className="pub-doc fade-in">
        <div className="rot-gen">
          <div className="vi-kicker"><SparklesGlyph size={13} /> Publicação · disputa de capas</div>
          <h1 className="vi-title">Títulos &amp; thumbnails A/B</h1>
          {/* CREATE-from-empty affordances — available regardless of edit mode. Generating has
              nothing to lose: Cowork writes via the pipeline API; "Começar do zero" enters edit
              mode + force-seeds. Only EDITING an existing draft stays gated by canEdit. */}
          <div className="rot-gen-actions">
            <CoworkButton stage="publicacao" label="Gerar títulos com Cowork" />
            <button type="button" className="btn" onClick={seedFromEmpty}>
              <Plus size={15} /> Começar do zero
            </button>
          </div>
          <div className="rot-gen-sub">
            O Cowork sugere 4 variações testáveis a partir do roteiro + ideia, ou comece do zero.
            O canal estreia com 4 capas (mesma DNA, ganchos diferentes); o público escolhe pela retenção.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pub-doc fade-in">
      {/* ── pub-bar ── */}
      <div className="pub-bar">
        <div>
          <div className="pp-kick">
            <TrendingUp size={12} /> Publicação · disputa de capas na estreia
          </div>
          <div className="pp-editor">{channelName} · 4 variações no YouTube Test &amp; Compare</div>
        </div>
        <div className="grow" />
        {canEditFields && (confirmReset ? (
          <span className="rot-reset-confirm">
            Limpar as variações?
            <button type="button" className="rot-reset-yes" onClick={onReset}>limpar</button>
            <button type="button" className="rot-reset-no" onClick={onCancelReset}>cancelar</button>
          </span>
        ) : (
          <button type="button" className="rot-reset" ref={resetBtnRef} onClick={() => setConfirmReset(true)}>
            <RotateCcw size={12} /> Recomeçar
          </button>
        ))}
        {published ? (
          <span className="ed-status live">
            <span className="es-dot" /> No ar · teste rodando
          </span>
        ) : (
          <button
            type="button"
            className="btn primary"
            disabled={!cta.enabled}
            title={cta.tooltip ?? undefined}
            onClick={onPublish}
          >
            <Rss size={14} /> Publicar + iniciar teste
          </button>
        )}
      </div>

      {/* ── pub-note ── */}
      <div className="pub-note">
        <Info size={14} />{' '}
        <span>
          As <b>thumbnails você desenvolve no Claude Design</b> — aqui ficam o{' '}
          <b>brief</b> e o <b>título</b> de cada variação. O canal sempre estreia
          com 4 (mesma DNA, ganchos diferentes); o público escolhe pela retenção.
          {!published && !cta.enabled && cta.deepLink && (
            <>{' '}<a className="ab-deeplink" href={cta.deepLink}>Abrir no A/B Lab</a></>
          )}
        </span>
      </div>

      {/* ── pub-gen-row ── */}
      <div className="pub-gen-row">
        <span className="pp-kick">
          <Layers size={12} /> 4 variações
        </span>
        <span className="grow" />
        {published ? (
          <span className="pub-locknote">
            <Lock size={12} /> no ar — títulos travados
          </span>
        ) : (
          <CoworkButton stage="publicacao" label="Sugerir títulos com Cowork" compact />
        )}
      </div>

      {/* ── ab-grid ── */}
      <div className={`ab-grid${published ? ' locked' : ''}`} role="list" aria-label="Variações A/B/C/D">
        {draft.variants.map((v, idx) => {
          const isFirstOnAir = draft.firstOnAir === v.id
          // A winner badge shows ONLY once the A/B-lab has resolved a winner. While the test runs
          // (winnerVariantId null) NO card gets a leader/winner badge — there is no incumbent.
          const isWinner = published && winnerVariantId != null && winnerVariantId === v.id

          return (
            <div
              key={v.id}
              data-testid="ab-variant-card"
              role="listitem"
              aria-label={`Variação ${v.id}`}
              className={`ab-card${isFirstOnAir ? ' leader' : ''}`}
              style={{ '--vc': AB_COLORS[v.id] } as React.CSSProperties}
            >
              {/* ── ab-thumb ── */}
              <div className="ab-thumb">
                <span className="ab-badge">{v.id}</span>

                <div className="ab-thumb-ph">
                  <Image size={19} />
                  <span className="ab-thumb-tx">1280×720</span>
                  <span className="sr-only">Sem thumbnail definida</span>
                </div>

                {!published && (
                  <button
                    type="button"
                    className="ab-thumb-set"
                    onClick={() =>
                      toast.info(`Abrir no Claude Design`, {
                        description: `Desenvolver a thumb ${v.id} a partir do brief.`,
                      })
                    }
                  >
                    <SparklesGlyph size={12} /> Claude Design
                  </button>
                )}

                {published ? (
                  isWinner ? (
                    <span className="ab-winner" data-testid="ab-trophy">
                      <Trophy size={11} /> vencedora
                    </span>
                  ) : winnerVariantId == null && isFirstOnAir ? (
                    <span className="ab-onair" data-testid="ab-onair">
                      <Radio size={11} /> 1ª no ar
                    </span>
                  ) : null
                ) : canEditFields ? (
                  <button
                    type="button"
                    className={`ab-lead-btn${isFirstOnAir ? ' on' : ''}`}
                    title={isFirstOnAir ? 'Vai ao ar primeiro' : 'Marcar como 1ª no ar'}
                    aria-pressed={isFirstOnAir}
                    onClick={() => onPatch({ firstOnAir: v.id })}
                  >
                    <Radio size={11} /> {isFirstOnAir ? '1ª no ar' : 'no ar primeiro'}
                  </button>
                ) : null}
              </div>

              {/* ── ab-fields ── */}
              <div className="ab-fields">
                <label className="ab-lbl">Título {v.id}</label>
                <div
                  className="ab-title efx"
                  data-testid="ab-title"
                  data-empty={!(v.title ?? '').trim()}
                  data-ph={`Título da variação ${v.id}…`}
                  contentEditable={canEditFields}
                  role="textbox"
                  aria-label={`Título da variação ${v.id}`}
                  aria-readonly={!canEditFields}
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={e => { if (canEditFields) patchTitle(idx, e.currentTarget.textContent ?? '') }}
                >
                  {v.title}
                </div>

                <label className="ab-lbl">
                  Brief da thumb{' '}
                  <span className="ab-lbl-sub">o que ela comunica</span>
                </label>
                <div
                  className="ab-brief efx"
                  data-empty={!(v.brief ?? '').trim()}
                  data-ph="Ex.: rosto + bandeiras, rim-light laranja, olhar pro preço…"
                  contentEditable={canEditFields}
                  role="textbox"
                  aria-label={`Brief da thumbnail ${v.id}`}
                  aria-readonly={!canEditFields}
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={e => { if (canEditFields) patchBrief(idx, e.currentTarget.textContent ?? '') }}
                >
                  {v.brief}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── pub-foot ── */}
      <div className="pub-foot">
        <span className="pp-kick">
          <FileText size={12} /> Distribuição no dia
        </span>
        <div className="pub-dist" role="group" aria-label="Distribuição no dia">
          {DIST_CHANNELS.map(([name, color]) => (
            <button
              key={name}
              type="button"
              className="pub-chan"
              onClick={() =>
                toast.info(name, {
                  description: 'Agendar junto com a estreia.',
                })
              }
            >
              <span className="pc-dot" style={{ background: color }} />
              {' '}{name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
