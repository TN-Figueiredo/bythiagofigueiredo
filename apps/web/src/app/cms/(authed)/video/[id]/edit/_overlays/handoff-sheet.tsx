'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { handoffBeatRows } from '@/lib/pipeline/handoff-sheet-data'
import { fmtClock } from '@/lib/pipeline/video-schemas'
import type { RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'

export interface HandoffDeliverables {
  editor?: string
  deadline?: string
  turnaround?: string
  drive?: string
  energy?: string
  references?: string[]
}

export interface HandoffCtas {
  note: string
  rows: { k: string; pt: string; en: string }[]
  display: string
}

export interface HandoffSheetLangOption {
  lang: string
  label: string
  flag: string
}

export interface HandoffSheetProps {
  code: string
  channelLabel: string
  channelName: string
  activeLang: string
  versionsLabel: string
  title: string
  deliverables: HandoffDeliverables
  style: { k: string; v: string }[]
  ctas: HandoffCtas
  beats: RoteiroBeatV3[]
  langOptions: HandoffSheetLangOption[]
  onSwitchLang: (lang: string) => void
  onClose: () => void
}

export function HandoffSheet(props: HandoffSheetProps) {
  const { code, channelLabel, channelName, activeLang, versionsLabel, title, deliverables: d, style, ctas, beats } = props
  const [mounted, setMounted] = useState(false)
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

  const rows = handoffBeatRows(beats)

  const overlay = (
    <div className="rec-overlay">
      <div className="rec-bar">
        <button className="rb-back" onClick={props.onClose}>‹ Fechar</button>
        <span className="rb-title">Brief pro editor · {title || 'Sem título'}</span>
        <span className="rb-spacer" />
        {props.langOptions.length > 1 && (
          <div className="rec-seg">
            {props.langOptions.map((o) => (
              <button key={o.lang} className={o.label === channelLabel ? 'on' : ''} onClick={() => props.onSwitchLang(o.lang)}>
                {o.flag} {o.label}
              </button>
            ))}
          </div>
        )}
        <button className="rb-print" onClick={() => window.print()}>Imprimir</button>
      </div>

      <div className="rec-sheet hs">
        <div className="rsh-kick">Instruções de edição · {channelLabel} · {code}</div>
        <h1 className="rsh-title">{title}</h1>
        <div className="rsh-meta">
          <span><b>Editor</b>{d.editor}</span>
          <span><b>Prazo</b>{d.deadline}</span>
          <span><b>Revisão</b>{d.turnaround}</span>
          <span><b>Versões</b>{versionsLabel}</span>
        </div>

        <div className="hs-sec">
          <h2 className="hs-h">Visão geral</h2>
          <p className="hs-p">{d.energy}</p>
          <p className="hs-p"><b>Referência de energia:</b> {(d.references ?? []).join(' · ')}. <b>Drive:</b> {d.drive}.</p>
        </div>

        {rows.length > 0 && (
          <div className="hs-sec">
            <h2 className="hs-h">Momentos-chave & b-roll</h2>
            {rows.map((r, i) => (
              <div key={i} className="hs-beat">
                <div className="hs-beat-h">
                  <span className="hs-bn">#{r.displayNum}</span> {r.name}
                  <span className="hs-bdur">{fmtClock(r.duration ?? 0)}</span>
                </div>
                <div className="hs-anchor">"{r.anchor}"</div>
                {r.cues.map((v, j) => (
                  <div key={j} className="hs-cue"><span className="hs-cue-k">B-roll</span> {v}</div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="hs-sec">
          <h2 className="hs-h">Estilo & ritmo</h2>
          {style.map((s, i) => (
            <div key={i} className="hs-style"><span className="hs-sk">{s.k}</span><span className="hs-sv">{s.v}</span></div>
          ))}
        </div>

        <div className="hs-sec">
          <h2 className="hs-h">CTAs & QR <span className="hs-warn">⚠ muda por idioma</span></h2>
          <table className="hs-table">
            <thead><tr><th></th><th>🇧🇷 PT</th><th>🇺🇸 EN</th></tr></thead>
            <tbody>
              {ctas.rows.map((r, i) => (
                <tr key={i} className={activeLang === 'pt' ? 'hl-pt' : 'hl-en'}>
                  <td className="hs-ck">{r.k}</td><td>{r.pt}</td><td>{r.en}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hs-p hs-dim">{ctas.display}</p>
        </div>

        <div className="rsh-foot">
          <span>tf — Thiago Figueiredo · brief pro editor</span>
          <span>{channelName}</span>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
