'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { ChevronLeft, Rss, Pencil } from 'lucide-react'
import { recBeatLines, recSheetMeta, clampRsScale } from '@/lib/pipeline/recording-sheet-data'
import { videoBeatRead, fmtClock } from '@/lib/pipeline/video-schemas'
import type { RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'

/** **word** → <b class="emph">word</b>, HTML-escaped first. */
function emphHtml(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc.replace(/\*\*(.+?)\*\*/g, '<b class="emph">$1</b>')
}

export interface RecordingSheetLangOption {
  lang: string
  label: string
  flag: string
}

export interface RecordingSheetProps {
  code: string
  channelName: string
  channelLabel: string
  channelFlag: string
  pillarLabel: string
  durationRange: string
  recordingLocation?: string
  title: string
  beats: RoteiroBeatV3[]
  /** Overlay-local PT/EN segmented control options (empty/1 → control hidden). */
  langOptions: RecordingSheetLangOption[]
  onSwitchLang: (lang: string) => void
  onClose: () => void
}

export function RecordingSheet(props: RecordingSheetProps) {
  const { code, channelName, channelLabel, pillarLabel, durationRange, recordingLocation, title, beats } = props
  const [showEd, setShowEd] = useState(false)
  const [scale, setScale] = useState(1)
  const [mounted, setMounted] = useState(false)
  const initLang = props.langOptions.find((o) => o.label === channelLabel)?.lang ?? props.langOptions[0]?.lang ?? ''
  const [curLang, setCurLang] = useState(initLang)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    document.body.classList.add('recording')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('recording')
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!mounted) return null

  const bump = (d: number) => setScale((s) => clampRsScale(s, d))
  const meta = recSheetMeta(beats)
  const hasBeats = beats.length > 0

  const overlay = (
    <div className="rec-overlay" style={{ ['--rs-scale' as string]: String(scale) }}>
      <div className="rec-bar">
        <button className="rb-back" onClick={props.onClose}><ChevronLeft size={15} /> Fechar</button>
        <span className="rb-title">{title || 'Sem título'}</span>
        <span className="rb-spacer" />

        {props.langOptions.length > 1 && (
          <div className="rec-seg">
            {props.langOptions.map((o) => (
              <button
                key={o.lang}
                className={o.lang === curLang ? 'on' : ''}
                onClick={() => { setCurLang(o.lang); props.onSwitchLang(o.lang) }}
              >
                {o.flag} {o.label}
              </button>
            ))}
          </div>
        )}

        <label className="rb-toggle" onClick={() => setShowEd((s) => !s)}>
          <span className={'tg' + (showEd ? ' on' : '')} /> Notas do editor
        </label>

        <div className="rec-ctl">
          <span className="rec-ctl-lbl">Texto</span>
          <button onClick={() => bump(-0.05)} title="Menor">A−</button>
          <button onClick={() => bump(0.05)} title="Maior" style={{ fontSize: 16 }}>A+</button>
        </div>

        <button className="rb-print" onClick={() => window.print()}><Rss size={14} /> Imprimir</button>
      </div>

      {hasBeats ? (
        <div className="rec-sheet">
          <div className="rsh-kick">Roteiro de Gravação · {channelLabel} · {code}</div>
          <h1 className="rsh-title">{title}</h1>
          <div className="rsh-meta">
            <span><b>Canal</b>{channelName}</span>
            <span><b>Pilar</b>{pillarLabel}</span>
            <span><b>Duração</b>{durationRange || '—'}</span>
            <span><b>Fala</b>~{fmtClock(meta.readSeconds)}</span>
            <span><b>Beats</b>{meta.beatsCount}</span>
            {recordingLocation ? <span><b>Local</b>{recordingLocation}</span> : null}
          </div>

          {beats.map((beat, i) => (
            <div className="rs-beat" key={i}>
              <div className="rs-beat-head">
                <span className="rs-beat-num">#{i + 1}</span>
                <span className="rs-beat-name">{beat.name}</span>
                <span className="rs-beat-info">~{videoBeatRead(beat)}s de fala</span>
              </div>
              {beat.tone ? (
                <div className="rs-tone"><span className="rst-k">Direção</span><span>{beat.tone}</span></div>
              ) : null}
              {recBeatLines(beat, showEd).map((line, j) => {
                if (line.kind === 'line') {
                  return (
                    <div className={'rs-line' + (line.key ? ' key' : '')} key={j}>
                      <span className="rs-tick" aria-hidden="true" />
                      <span className="rs-line-tx" dangerouslySetInnerHTML={{ __html: emphHtml(line.text ?? '') }} />
                    </div>
                  )
                }
                if (line.kind === 'pause') {
                  return (
                    <div className="rs-pause" key={j}>
                      <span className="rs-breath">respira <span className="rs-dur">{String(line.duration ?? 0).replace('.', ',')}s</span></span>
                    </div>
                  )
                }
                return (
                  <div className="rs-note" key={j}>
                    <span className="rsn-tag">{line.kind === 'vis' ? 'Visual' : 'Editor'}</span>
                    <span>{line.text}</span>
                  </div>
                )
              })}
            </div>
          ))}

          <div className="rsh-foot">
            <span>tf — Thiago Figueiredo · {channelName}</span>
            <span>{showEd ? 'com notas do editor' : 'só a fala'} · marque à mão antes de gravar</span>
          </div>
        </div>
      ) : (
        <div className="rec-empty">
          <Pencil size={34} />
          <h3>Esse vídeo ainda não tem roteiro</h3>
          <p>É só uma direção por enquanto. Volte pra etapa <b>Ideia</b>, destrinche em beats, e o modo de gravação fica pronto pra imprimir.</p>
        </div>
      )}
    </div>
  )

  return createPortal(overlay, document.body)
}
