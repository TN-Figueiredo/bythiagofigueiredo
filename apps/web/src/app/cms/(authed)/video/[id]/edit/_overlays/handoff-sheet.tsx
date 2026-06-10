'use client'

import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState } from 'react'
import { ChevronLeft, Rss } from 'lucide-react'
import { handoffBeatRows } from '@/lib/pipeline/handoff-sheet-data'
import { fmtClock } from '@/lib/pipeline/video-schemas'
import type { RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'

// The handoff is the editor's document and the editor works in English — so all CHROME is
// localized to the handoff's own language (defaults to EN). The brief CONTENT comes from the
// matching postprod_<lang> variant (the author/Cowork writes the EN brief in English).
const HS_COPY = {
  en: {
    close: 'Close', briefFor: 'Editor brief', untitled: 'Untitled', print: 'Print',
    kicker: 'Editing instructions', editor: 'Editor', deadline: 'Deadline', review: 'Review', versions: 'Versions',
    overview: 'Overview', scope: 'Delivery scope:', energyRef: 'Energy reference:', drive: 'Drive:',
    style: 'Style & rhythm', ctas: 'CTAs & QR', ctasWarn: '⚠ changes per language', target: 'Target',
    moments: 'Key moments & b-roll', scriptRef: '· script reference', broll: 'B-roll', foot: 'editor brief',
  },
  pt: {
    close: 'Fechar', briefFor: 'Brief pro editor', untitled: 'Sem título', print: 'Imprimir',
    kicker: 'Instruções de edição', editor: 'Editor', deadline: 'Prazo', review: 'Revisão', versions: 'Versões',
    overview: 'Visão geral', scope: 'Escopo de entrega:', energyRef: 'Referência de energia:', drive: 'Drive:',
    style: 'Estilo & ritmo', ctas: 'CTAs & QR', ctasWarn: '⚠ muda por idioma', target: 'Destino',
    moments: 'Momentos-chave & b-roll', scriptRef: '· referência do roteiro', broll: 'B-roll', foot: 'brief pro editor',
  },
} as const

export interface HandoffDeliverables {
  editor?: string
  deadline?: string
  turnaround?: string
  drive?: string
  energy?: string
  /** Free-form delivery scope (e.g. "corte principal 8–12min, 3 Shorts, overlays a inserir"). */
  notes?: string
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
  const overlayRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
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

  // Move initial focus to the close button once the portal is mounted.
  useEffect(() => {
    if (mounted) closeBtnRef.current?.focus()
  }, [mounted])

  // Tab trap: keep focus inside the modal-ish print sheet.
  useEffect(() => {
    if (!mounted) return
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const root = overlayRef.current
      if (!root) return
      const focusable = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onTab)
    return () => window.removeEventListener('keydown', onTab)
  }, [mounted])

  if (!mounted) return null

  const t = HS_COPY[activeLang === 'en' ? 'en' : 'pt']
  const rows = handoffBeatRows(beats)

  const meta = (
    [
      [t.editor, d.editor],
      [t.deadline, d.deadline],
      [t.review, d.turnaround],
      [t.versions, versionsLabel],
    ] as const
  ).filter(([, v]) => v?.trim())

  const refsLabel = (d.references ?? []).filter((r) => r?.trim()).join(' · ')
  const overviewParts: string[] = []
  if (refsLabel) overviewParts.push(`${t.energyRef} ${refsLabel}`)
  if (d.drive?.trim()) overviewParts.push(`${t.drive} ${d.drive}`)
  const hasOverview = Boolean(d.energy?.trim() || overviewParts.length > 0 || d.notes?.trim())

  const overlay = (
    <div className="rec-overlay" ref={overlayRef} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="rec-bar">
        <button ref={closeBtnRef} className="rb-back" onClick={props.onClose}><ChevronLeft size={15} /> {t.close}</button>
        <span className="rb-title">{t.briefFor} · {title || t.untitled}</span>
        <span className="rb-spacer" />
        {props.langOptions.length > 1 && (
          <div className="rec-seg">
            {props.langOptions.map((o) => (
              <button key={o.lang} className={o.lang === activeLang ? 'on' : ''} onClick={() => props.onSwitchLang(o.lang)}>
                {o.flag} {o.label}
              </button>
            ))}
          </div>
        )}
        <button className="rb-print" onClick={() => window.print()}><Rss size={14} /> {t.print}</button>
      </div>

      <div className="rec-sheet hs">
        <div className="rsh-kick">{t.kicker} · {channelLabel} · {code}</div>
        <h1 id={titleId} className="rsh-title">{title}</h1>
        {meta.length > 0 && (
          <div className="rsh-meta">
            {meta.map(([k, v]) => (
              <span key={k}><b>{k}</b>{v}</span>
            ))}
          </div>
        )}

        {hasOverview && (
          <div className="hs-sec">
            <h2 className="hs-h">{t.overview}</h2>
            {d.energy?.trim() && <p className="hs-p">{d.energy}</p>}
            {d.notes?.trim() && <p className="hs-p"><b>{t.scope}</b> {d.notes}</p>}
            {overviewParts.length > 0 && <p className="hs-p">{overviewParts.join('. ')}.</p>}
          </div>
        )}

        {style.length > 0 && (
          <div className="hs-sec">
            <h2 className="hs-h">{t.style}</h2>
            {style.map((s, i) => (
              <div key={i} className="hs-style"><span className="hs-sk">{s.k}</span><span className="hs-sv">{s.v}</span></div>
            ))}
          </div>
        )}

        {ctas.rows.length > 0 && (
          <div className="hs-sec">
            <h2 className="hs-h">{t.ctas} <span className="hs-warn">{t.ctasWarn}</span></h2>
            {ctas.note?.trim() && <p className="hs-p"><b>{ctas.note}</b></p>}
            <table className="hs-table">
              <thead><tr><th><span className="sr-only">{t.target}</span></th><th scope="col">🇧🇷 PT</th><th scope="col">🇺🇸 EN</th></tr></thead>
              <tbody>
                {ctas.rows.map((r, i) => (
                  <tr key={i} className={activeLang === 'pt' ? 'hl-pt' : 'hl-en'}>
                    <td className="hs-ck" scope="row">{r.k}</td><td>{r.pt}</td><td>{r.en}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ctas.display?.trim() && <p className="hs-p hs-dim">{ctas.display}</p>}
          </div>
        )}

        {rows.length > 0 && (
          <div className="hs-sec">
            <h2 className="hs-h">{t.moments} <span className="hs-dim">{t.scriptRef}</span></h2>
            {rows.map((r, i) => (
              <div key={i} className="hs-beat">
                <div className="hs-beat-h">
                  <span className="hs-bn">#{r.displayNum}</span> {r.name}
                  {r.duration ? <span className="hs-bdur">{fmtClock(r.duration)}</span> : null}
                </div>
                {r.anchor && <div className="hs-anchor">“{r.anchor}”</div>}
                {r.cues.map((v, j) => (
                  <div key={j} className="hs-cue"><span className="hs-cue-k">{t.broll}</span> {v}</div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="rsh-foot">
          <span>tf — Thiago Figueiredo · {t.foot}</span>
          <span>{channelName}</span>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
