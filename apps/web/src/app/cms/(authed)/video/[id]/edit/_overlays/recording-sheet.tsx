'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { ChevronLeft, Rss, Pencil } from 'lucide-react'
import { recBeatLines, clampRsScale } from '@/lib/pipeline/recording-sheet-data'
import { splitBeats, itemText } from '@/lib/pipeline/video-perform'
import { videoBeatRead, fmtClock } from '@/lib/pipeline/video-schemas'
import { MARK_GRANS, MARK_GRAN_LABEL, markGranClass, DEFAULT_MARK_GRAN, type MarkGran } from '@/lib/pipeline/video-recording'
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
  /**
   * Pen-marking granularity (shared with the editor-stage print). Default 'off' → a clean
   * script with NO checkboxes anywhere, especially on paper. The shell wires this from the
   * editor context so the overlay control and the persisted preference stay in sync.
   */
  markGran?: MarkGran
  /** Set the marking granularity (dispatches SET_MARK_GRAN in the shell). Optional for standalone use. */
  onSetMarkGran?: (gran: MarkGran) => void
  onClose: () => void
}

export function RecordingSheet(props: RecordingSheetProps) {
  const { code, channelName, channelLabel, pillarLabel, durationRange, recordingLocation, title, beats } = props
  const markGran: MarkGran = props.markGran ?? DEFAULT_MARK_GRAN
  const [showEd, setShowEd] = useState(false)
  const [scale, setScale] = useState(1)
  const [density, setDensity] = useState<'comp' | 'conf'>('conf')
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
  // Actor's sheet: only what's performed on camera. Prep stays as a compact top
  // checklist; editor-directed coverage (b-roll) goes to the editor handoff sheet.
  const { performer, prep } = splitBeats({ version: 3, meta: {}, beats })
  // Beats count = all performer beats; read time = ONLY fala beats (acao beats hold
  // prompts, not spoken lines, so they must not inflate the "Fala ~X" headline).
  const beatsCount = performer.length
  const readSeconds = performer
    .filter((b) => b.kind === 'fala')
    .reduce((acc, b) => acc + videoBeatRead(b.beat), 0)
  const hasBeats = performer.length > 0 || prep.length > 0

  const overlay = (
    <div className={'rec-overlay dens-' + density + ' ' + markGranClass(markGran)} style={{ ['--rs-scale' as string]: String(scale) }}>
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

        <div className="rec-seg" title="Densidade da folha">
          <button type="button" className={density === 'comp' ? 'on' : ''} onClick={() => setDensity('comp')}>Compacto</button>
          <button type="button" className={density === 'conf' ? 'on' : ''} onClick={() => setDensity('conf')}>Confortável</button>
        </div>

        <div className="rec-seg" title="Marcação à mão — caixas pra marcar o que já gravou (padrão: sem caixas)">
          {MARK_GRANS.map((g) => (
            <button
              type="button"
              key={g}
              className={markGran === g ? 'on' : ''}
              onClick={() => props.onSetMarkGran?.(g)}
            >
              {MARK_GRAN_LABEL[g]}
            </button>
          ))}
        </div>

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
            <span><b>Fala</b>~{fmtClock(readSeconds)}</span>
            <span><b>Beats</b>{beatsCount}</span>
            {recordingLocation ? <span><b>Local</b>{recordingLocation}</span> : null}
          </div>

          {prep.length > 0 && (
            <div className="rs-prep">
              <div className="rs-prep-h">Antes de gravar</div>
              {prep.map((kb) => (
                <div className="rs-prep-grp" key={kb.idx}>
                  <span className="rs-prep-nm">{kb.beat.name}</span>
                  <span className="rs-prep-tx">
                    {kb.beat.script.filter((it) => it.type === 'line' || it.type === 'action' || it.type === 'pause').map(itemText).join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {performer.map((kb, s) => {
            const beat = kb.beat
            return (
              <div className={'rs-beat' + (kb.kind === 'acao' ? ' rs-beat-act' : '')} key={kb.idx}>
                <div className="rs-beat-head">
                  {markGran === 'beat' ? <span className="rs-beattick" aria-hidden="true" /> : null}
                  <span className="rs-beat-num">#{s + 1}</span>
                  <span className="rs-beat-name">{beat.name}</span>
                  {kb.kind === 'acao'
                    ? <span className="rs-beat-info">ação na câmera</span>
                    : <span className="rs-beat-info">~{videoBeatRead(beat)}s de fala</span>}
                </div>
                {beat.tone ? (
                  <div className="rs-tone"><span className="rst-k">Direção</span><span>{beat.tone}</span></div>
                ) : null}
                {(() => {
                  // Section starts (for the 'secao' pen-box): a run of consecutive line/action
                  // items, broken at dir/vis/ed — pause does NOT break (mirrors beatSections).
                  // Mark a line as a section-start when no markable line is currently "open".
                  const lines = recBeatLines(beat, showEd, kb.kind === 'acao')
                  let sectionOpen = false
                  return lines.map((line, j) => {
                  const isMarkable = line.kind === 'line' || line.kind === 'action'
                  const startsSection = isMarkable && !sectionOpen
                  if (isMarkable) sectionOpen = true
                  else if (line.kind !== 'pause') sectionOpen = false
                  if (line.kind === 'line' || line.kind === 'action') {
                    return (
                      <div className={'rs-line' + (line.kind === 'action' ? ' rs-line-act' : '') + (line.key ? ' key' : '')} key={j}>
                        {markGran === 'linha'
                          ? <span className="rs-tick" aria-hidden="true" />
                          : markGran === 'secao' && startsSection
                            ? <span className="rs-tick rs-sectick" aria-hidden="true" />
                            : null}
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
                  if (line.kind === 'dir') {
                    return (
                      <div className="rs-tone" key={j}><span className="rst-k">Direção</span><span>{line.text}</span></div>
                    )
                  }
                  return (
                    <div className="rs-note" key={j}>
                      <span className="rsn-tag">{line.kind === 'vis' ? 'Visual' : 'Editor'}</span>
                      <span>{line.text}</span>
                    </div>
                  )
                  })
                })()}
              </div>
            )
          })}

          <div className="rsh-foot">
            <span>tf — Thiago Figueiredo · {channelName}</span>
            <span>{showEd ? 'com notas do editor' : 'só a fala'}{markGran === 'off' ? '' : ' · marque à mão enquanto grava'}</span>
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
