'use client'

import { useMemo } from 'react'
import { Edit, CheckCheck, Target, Film, SlidersHorizontal, Link, Eye, Info, AlertTriangle, Rss } from 'lucide-react'
import { SparklesGlyph } from '../_components/sparkles-glyph'
import type { RoteiroBeatV3, PosBrief } from '@/lib/pipeline/video-schemas'
import { keyLineText, visNotes } from '@/lib/pipeline/video-pos-derive'
import { CHANNELS } from '@/lib/pipeline/channels'
import { useVideoEditorDispatch } from '../context'
import { useVideoData } from '../data-context'
import type { Version } from '../editor-model'

export interface PosStageProps {
  /** Design-handoff Version for the active lang (cur = versions[lang]). */
  cur?: Version
  beats: RoteiroBeatV3[]
  brief: PosBrief | null
  activeLang: 'pt' | 'en'
  onPatch: (patch: Partial<PosBrief>) => void
  onOpenHandoff: () => void
  /** Legacy rich postprod payload (schema_version present / no kind) → read-only fallback (§3.10). */
  legacy: Record<string, unknown> | null
}

/* contentEditable field that commits on blur */
function EF({
  value,
  onChange,
  tag = 'b',
  className = '',
  ph,
}: {
  value: string
  onChange: (v: string) => void
  tag?: 'b' | 'span'
  className?: string
  ph?: string
}) {
  const Tag = tag
  return (
    <Tag
      className={('efx ' + className).trim()}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-empty={!String(value || '').trim() || undefined}
      data-ph={ph}
      onBlur={e => onChange((e.currentTarget as HTMLElement).textContent ?? '')}
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
        <span className="pp-title">{title}</span>
        {sub && <span className="pp-sub">{sub}</span>}
      </div>
      <div className="pp-body">{children}</div>
    </section>
  )
}

function LegacyPostprodFallback() {
  return (
    <div className="pp-legacy" role="note">
      <p className="pp-legacy-banner">Pós legado (somente leitura) — recrie o brief para editar.</p>
    </div>
  )
}

export function PosStage({ beats, brief, activeLang, onPatch, onOpenHandoff, legacy }: PosStageProps) {
  const dispatch = useVideoEditorDispatch()
  const data = useVideoData()

  const del = brief?.deliverables ?? {}
  const style = brief?.style ?? []
  const ctas = brief?.ctas ?? { note: '', rows: [], display: '' }

  const patchDel = (k: keyof NonNullable<PosBrief['deliverables']>, v: string) =>
    onPatch({ deliverables: { ...del, [k]: v } })

  const patchStyleRow = (i: number, v: string) => {
    const next = style.map((s, j) => (j === i ? { ...s, v } : s))
    onPatch({ style: next })
  }

  const hasBriefKind = brief && 'kind' in brief

  if (legacy && (legacy.schema_version || !hasBriefKind)) {
    return <LegacyPostprodFallback />
  }

  // Present language labels only (mirrors handoff: versions[l] with content → channel.label
  // joined " + "). Our model always carries both pt/en objects, so test for actual content.
  const langs =
    CHANNELS.filter((c) => {
      const v = data.versions?.[c.lang]
      return !!v && (!!v.title?.trim() || !!v.direction?.trim() || (v.beats?.length ?? 0) > 0)
    })
      .map((c) => c.label)
      .join(' + ') || (CHANNELS.find((c) => c.lang === activeLang)?.label ?? '')

  const goRoteiro = () => dispatch({ type: 'SET_STAGE', stage: 'roteiro' })

  return (
    <div className="pp-doc fade-in">
      {/* ── top bar ── */}
      <div className="pp-bar">
        <div>
          <div className="pp-kick">
            <SparklesGlyph size={12} /> Pós-produção · brief pro editor
          </div>
          <div className="pp-editor">
            <Edit size={11} /> tudo editável · ajuste por vídeo
          </div>
        </div>
        <div className="grow" />
        <button type="button" className="btn" onClick={onOpenHandoff}>
          <Rss size={14} /> Exportar pro editor
        </button>
      </div>

      {/* ── cards grid ── */}
      <div className="pp-grid">

        {/* ── Entrega ── */}
        <PPCard icon={<CheckCheck size={14} />} title="Entrega" sub="o combinado · clique para editar">
          <div className="pp-fields">
            <div className="pp-f">
              <span>Editor</span>
              <EF value={del.editor ?? ''} onChange={v => patchDel('editor', v)} ph="Nome do editor" />
            </div>
            <div className="pp-f">
              <span>Prazo</span>
              <EF value={del.deadline ?? ''} onChange={v => patchDel('deadline', v)} ph="Prazo" />
            </div>
            <div className="pp-f">
              <span>Revisão</span>
              <EF value={del.turnaround ?? ''} onChange={v => patchDel('turnaround', v)} ph="Turnaround" />
            </div>
            <div className="pp-f">
              <span>Versões</span><b>{langs}</b>
            </div>
            <div className="pp-f wide">
              <span>Drive</span>
              <EF value={del.drive ?? ''} onChange={v => patchDel('drive', v)} ph="Pasta no Drive" />
            </div>
          </div>
          <div className="pp-energy">
            <Eye size={13} />
            <span>
              <b>Energia:</b>{' '}
              <EF tag="span" className="ef-inline" value={del.energy ?? ''} onChange={v => patchDel('energy', v)} ph="Energia/tom" />
              <i> Ref: {(del.references ?? []).join(' · ')}</i>
            </span>
          </div>
        </PPCard>

        {/* ── Momentos-chave + B-roll (from beats) ── */}
        {beats.length > 0 ? (
          <>
            <PPCard icon={<Target size={14} />} title="Momentos-chave" sub="frase-âncora + cue visual, por beat">
              <div className="pp-moments">
                {beats.map((b, i) => {
                  const line = keyLineText(b)
                  const cue = visNotes(b)[0]
                  return (
                    <div key={i} className="pp-moment">
                      <span className="pp-mnum">#{i + 1}</span>
                      <div className="pp-mbody">
                        <div className="pp-mline">&ldquo;{line}&rdquo;</div>
                        {cue && (
                          <div className="pp-mcue">
                            <Film size={12} /> {cue}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </PPCard>

            <PPCard icon={<Film size={14} />} title="B-roll por beat" sub="o que cobrir em cada trecho">
              <div className="pp-broll">
                {beats.map((b, i) => {
                  const vs = visNotes(b)
                  if (!vs.length) return null
                  return (
                    <div key={i} className="pp-broll-row">
                      <span className="pp-bname">#{i + 1} · {b.name}</span>
                      <ul>
                        {vs.map((v, j) => <li key={j}>{v}</li>)}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </PPCard>
          </>
        ) : (
          <PPCard icon={<Target size={14} />} title="Momentos-chave &amp; b-roll">
            <div className="pp-empty">
              Saem do roteiro.{' '}
              <a
                className="pp-link"
                role="button"
                tabIndex={0}
                onClick={goRoteiro}
                onKeyDown={e => e.key === 'Enter' && goRoteiro()}
              >
                Destrinche o roteiro
              </a>
              {' '}e eles aparecem aqui automaticamente.
            </div>
          </PPCard>
        )}

        {/* ── Estilo & ritmo ── */}
        <PPCard icon={<SlidersHorizontal size={14} />} title="Estilo &amp; ritmo" sub="o jeito do canal — editável">
          <div className="pp-style">
            {style.map((s, i) => (
              <div key={i} className="pp-srow">
                <span className="pp-sk">{s.k}</span>
                <EF tag="span" className="pp-sv" value={s.v} onChange={v => patchStyleRow(i, v)} />
              </div>
            ))}
          </div>
        </PPCard>

        {/* ── CTAs & QR ── */}
        <PPCard icon={<Link size={14} />} title="CTAs &amp; QR" sub="atenção: muda por idioma">
          <div className="pp-cta-note">
            <AlertTriangle size={13} /> {ctas.note}
          </div>
          <div className="pp-cta-table">
            <div className="pp-cta-h">
              <span />
              <span className={activeLang === 'pt' ? 'on' : ''}>🇧🇷 PT</span>
              <span className={activeLang === 'en' ? 'on' : ''}>🇺🇸 EN</span>
            </div>
            {ctas.rows.map((r, i) => (
              <div key={i} className="pp-cta-row">
                <span className="pp-ck">{r.k}</span>
                <span className={activeLang === 'pt' ? 'on' : ''}>{r.pt}</span>
                <span className={activeLang === 'en' ? 'on' : ''}>{r.en}</span>
              </div>
            ))}
          </div>
          <div className="pp-cta-disp">
            <Info size={12} /> {ctas.display}
          </div>
        </PPCard>

      </div>
    </div>
  )
}
