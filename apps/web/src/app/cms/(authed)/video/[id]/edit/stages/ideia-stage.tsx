'use client'

import { Sparkles, ArrowRight } from 'lucide-react'
import { PILLARS } from '@/lib/pipeline/pillars'
import { CHANNELS } from '@/lib/pipeline/channels'
import { useVideoEditorState, useVideoEditorDispatch } from '../context'
import { useVideoData } from '../data-context'

export function IdeiaStage() {
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const data = useVideoData()
  const lang = state.activeLang
  const cur = data.ideia[lang]
  const channel = CHANNELS.find((c) => c.lang === lang)
  const pillar = PILLARS.find((p) => p.id === data.pillar)
  const hasBeats = (data.roteiro[lang]?.beats.length ?? 0) > 0

  const onTitle = (e: React.FocusEvent<HTMLElement> | React.FormEvent<HTMLElement>) => {
    const text = (e.currentTarget.textContent ?? '').trim()
    void data.saveTitle(lang, text)
    void data.saveIdeia(lang, { title: text })
  }
  const onDirection = (e: React.FocusEvent<HTMLElement>) => {
    void data.saveIdeia(lang, { direction: (e.currentTarget.textContent ?? '').trim() })
  }

  return (
    <div className="vi-canvas fade-in">
      <div className="vi-kicker"><Sparkles size={13} /> Direção · {channel?.name ?? lang.toUpperCase()}</div>
      <h1
        className="vi-title"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-empty={!cur.title.trim()}
        data-ph="Título de trabalho do vídeo…"
        onBlur={onTitle}
      >
        {cur.title}
      </h1>

      <div className="vi-seed">
        <div className="vi-seed-head">
          <span className="vi-seed-ico"><Sparkles size={14} /></span>
          <span className="vi-seed-name">A direção</span>{' '}
          <span className="vi-seed-sub">o ângulo que o roteiro vai desenvolver — ainda solto, de propósito</span>
        </div>
        <div
          className="vi-seed-text"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          data-empty={!cur.direction.trim()}
          data-ph="Qual é a opinião ou a coisa que você quer discutir? Em 2–3 frases."
          onBlur={onDirection}
        >
          {cur.direction}
        </div>
      </div>

      <div className="vi-alts">
        <div className="vi-alts-label">
          <span className="row gap-6"><Sparkles size={12} /> Outras direções do Cowork</span>
          <button type="button" className="vi-alts-gen" onClick={() => data.appendSiblings(lang)}>
            <Sparkles size={12} /> Gerar mais
          </button>
        </div>
        {cur.siblings.map((s, i) => (
          <button key={i} type="button" className="vi-alt">
            <span className="va-n">{i + 1}</span>
            <span className="va-t">{s}</span>
            <span className="va-go"><ArrowRight size={14} /></span>
          </button>
        ))}
        {cur.siblings.length === 0 && (
          <div className="vi-alts-empty">Sem alternativas ainda — peça ao Cowork pra gerar algumas.</div>
        )}
      </div>

      <div className="vi-meta">
        {pillar && <span className="vi-chip"><span className="cdot" style={{ background: pillar.color }} /> {pillar.label}</span>}
        {cur.angles && <span className="vi-chip"><span className="vc-k">Ângulos</span> {cur.angles}</span>}
        {cur.framework && <span className="vi-chip"><span className="vc-k">Framework</span> {cur.framework}</span>}
        {data.durationRange && <span className="vi-chip"><span className="vc-k">Duração</span> {data.durationRange}</span>}
      </div>

      <button type="button" className="vi-next" onClick={() => dispatch({ type: 'SET_STAGE', stage: 'roteiro' })}>
        {hasBeats ? 'Abrir o roteiro' : 'Destrinchar em roteiro'} <ArrowRight size={15} />
      </button>
    </div>
  )
}
