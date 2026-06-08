'use client'

import { toast } from 'sonner'
import {
  TrendingUp, Info, Layers, Lock, Rss, Sparkles, Trophy, Image, FileText,
} from 'lucide-react'
import { channelByLang } from '@/lib/pipeline/channels'
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

export interface PublicacaoStageProps {
  /** Design-handoff Version for the active lang (cur = versions[lang]). */
  cur?: Version
  /** Active language — used to resolve the channel name in .pub-bar. */
  lang?: VideoLang
  draft: ABDraft
  cta: AbCtaState
  published: boolean
  /** ab-lab winner_variant_id; trophy shows on the winner ONLY (§3.8).
   *  When null + published, falls back to the leader card (test-running phase). */
  winnerVariantId: string | null
  onPatch: (patch: Partial<ABDraft>) => void
  onPublish: () => void
  onSuggest: () => void
}

export function PublicacaoStage({
  lang,
  draft,
  cta,
  published,
  winnerVariantId,
  onPatch,
  onPublish,
  onSuggest,
}: PublicacaoStageProps) {
  const channelName = channelByLang(lang ?? 'pt')?.name ?? 'tnFigueiredo'
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

  return (
    <div className="pub-doc fade-in">
      {/* ── pub-bar ── */}
      <div className="pub-bar">
        <div>
          <div className="pp-kick">
            <TrendingUp size={12} /> Publicação · teste A/B na estreia
          </div>
          <div className="pp-editor">{channelName} · 4 variações no YouTube Test &amp; Compare</div>
        </div>
        <div className="grow" />
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
          <button type="button" className="cw-btn compact" onClick={onSuggest}>
            <Sparkles size={13} /> Sugerir títulos com Cowork
          </button>
        )}
      </div>

      {/* ── ab-grid ── */}
      <div className={`ab-grid${published ? ' locked' : ''}`}>
        {draft.variants.map((v, idx) => {
          const isLeader = draft.leader === v.id
          const isWinner = published && (
            winnerVariantId ? winnerVariantId === v.id : v.id === draft.leader
          )

          return (
            <div
              key={v.id}
              data-testid="ab-variant-card"
              className={`ab-card${isLeader ? ' leader' : ''}`}
              style={{ '--vc': AB_COLORS[v.id] } as React.CSSProperties}
            >
              {/* ── ab-thumb ── */}
              <div className="ab-thumb">
                <span className="ab-badge">{v.id}</span>

                <div className="ab-thumb-ph">
                  <Image size={19} />
                  <span className="ab-thumb-tx">1280×720</span>
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
                    <Sparkles size={12} /> Claude Design
                  </button>
                )}

                {v.tag && <span className="ab-tag">{v.tag}</span>}

                {published ? (
                  isWinner ? (
                    <span className="ab-winner" data-testid="ab-trophy">
                      <Trophy size={11} /> liderando
                    </span>
                  ) : null
                ) : (
                  <button
                    type="button"
                    className={`ab-lead-btn${isLeader ? ' on' : ''}`}
                    title={isLeader ? 'Variação líder' : 'Marcar como líder'}
                    onClick={() => onPatch({ leader: v.id })}
                  >
                    <Trophy size={11} /> {isLeader ? 'líder' : 'líder?'}
                  </button>
                )}
              </div>

              {/* ── ab-fields ── */}
              <div className="ab-fields">
                <label className="ab-lbl">Título {v.id}</label>
                <div
                  className="ab-title efx"
                  data-testid="ab-title"
                  data-empty={!(v.title ?? '').trim()}
                  data-ph={`Título da variação ${v.id}…`}
                  contentEditable={!published}
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={e => patchTitle(idx, e.currentTarget.textContent ?? '')}
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
                  contentEditable={!published}
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={e => patchBrief(idx, e.currentTarget.textContent ?? '')}
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
        <div className="pub-dist">
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
