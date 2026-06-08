'use client'

import { ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { SparklesGlyph } from '../_components/sparkles-glyph'
import { CoworkButton } from '../_components/cowork-button'
import { pillarById } from '@/lib/pipeline/pillars'
import { CHANNELS } from '@/lib/pipeline/channels'
import { useVideoEditorState, useVideoEditorDispatch } from '../context'
import { useVideoData } from '../data-context'
import type { Version } from '../editor-model'
import type { VideoLang } from '../types'

export interface IdeiaStageProps {
  /** Design-handoff Version for the active lang (cur = versions[lang]). */
  cur?: Version
  lang?: VideoLang
}

export function IdeiaStage({ cur: curProp, lang: langProp }: IdeiaStageProps = {}) {
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const data = useVideoData()

  // Use props when provided by the shell; fall back to context derivation for
  // backwards-compatible usage (e.g. tests that mount bare <IdeiaStage />).
  const lang: VideoLang = langProp ?? state.activeLang
  const rawIdeia = data.ideia[lang]
  const cur: Version = curProp ?? {
    title: rawIdeia.title ?? '',
    direction: rawIdeia.direction ?? '',
    siblings: rawIdeia.siblings ?? [],
    logline: rawIdeia.logline ?? '',
    pillar: data.pillar,
    angles: rawIdeia.angles ?? '',
    framework: rawIdeia.framework ?? '',
    duration: data.durationRange ?? '',
    location: '',
    recorded: '—',
    beats: data.roteiro[lang]?.beats ?? [],
  }

  const channel = CHANNELS.find((c) => c.lang === lang)
  const pillar = pillarById(cur.pillar)
  const hasBeats = cur.beats.length > 0

  const onTitle = (e: React.FormEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => {
    const text = (e.currentTarget.textContent ?? '').trim()
    if (!text) return // never clear the title via a blank contentEditable (server also guards)
    void data.saveTitle(lang, text)
    void data.saveIdeia(lang, { title: text })
  }
  const onDirection = (e: React.FormEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => {
    void data.saveIdeia(lang, { direction: (e.currentTarget.textContent ?? '').trim() })
  }

  const onAltClick = (index: number) => {
    const chosen = cur.siblings[index]
    if (chosen == null) return
    // Swap: clicked alternative becomes the active direction; the previously-active
    // direction takes the clicked slot. Persist both fields together.
    const swapped = cur.siblings.map((s, j) => (j === index ? cur.direction : s))
    void data.saveIdeia(lang, { direction: chosen, siblings: swapped })
    toast.success('Direção trocada', { description: chosen })
  }

  return (
    <div className="vi-canvas fade-in">
      <div className="vi-kicker">
        <SparklesGlyph size={13} /> Direção · {channel?.name ?? lang.toUpperCase()}
      </div>
      <h1
        className="vi-title"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-empty={!(cur.title ?? '').trim()}
        data-ph="Título de trabalho do vídeo…"
        onBlur={onTitle}
      >
        {cur.title}
      </h1>

      <div className="vi-seed">
        <div className="vi-seed-head">
          <span className="vi-seed-ico"><SparklesGlyph size={14} /></span>
          <span className="vi-seed-name">A direção</span>{' '}
          <span className="vi-seed-sub">o ângulo que o roteiro vai desenvolver — ainda solto, de propósito</span>
        </div>
        <div
          className="vi-seed-text"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          data-empty={!(cur.direction ?? '').trim()}
          data-ph="Qual é a opinião ou a coisa que você quer discutir? Em 2–3 frases."
          onBlur={onDirection}
        >
          {cur.direction}
        </div>
      </div>

      <div className="vi-alts">
        <div className="vi-alts-label">
          <span className="row gap-6"><SparklesGlyph size={12} /> Outras direções do Cowork</span>
          <CoworkButton stage="ideia" label="Gerar mais" compact />
        </div>
        {cur.siblings.map((s, i) => (
          <button key={i} type="button" className="vi-alt" onClick={() => onAltClick(i)}>
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
        {pillar && (
          <span className="vi-chip">
            <span className="cdot" style={{ background: pillar.color }} /> {pillar.label}
          </span>
        )}
        {cur.angles && <span className="vi-chip"><span className="vc-k">Ângulos</span> {cur.angles}</span>}
        {cur.framework && <span className="vi-chip"><span className="vc-k">Framework</span> {cur.framework}</span>}
        {cur.duration && <span className="vi-chip"><span className="vc-k">Duração</span> {cur.duration}</span>}
      </div>

      <button
        type="button"
        className="vi-next"
        onClick={() => dispatch({ type: 'SET_STAGE', stage: 'roteiro' })}
      >
        {hasBeats ? 'Abrir o roteiro' : 'Gerar o roteiro'} <ArrowRight size={15} />
      </button>
    </div>
  )
}
