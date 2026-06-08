'use client'

import { useMemo } from 'react'
import type { RoteiroBeatV3, PosBrief } from '@/lib/pipeline/video-schemas'
import { deriveMomentos, deriveBroll } from '@/lib/pipeline/video-pos-derive'
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

function LegacyPostprodFallback() {
  return (
    <div className="pp-legacy" role="note">
      <p className="pp-legacy-banner">Pós legado (somente leitura) — recrie o brief para editar.</p>
    </div>
  )
}

export function PosStage({ beats, brief, activeLang, onPatch, onOpenHandoff, legacy }: PosStageProps) {
  const momentos = useMemo(() => deriveMomentos(beats), [beats])
  const broll = useMemo(() => deriveBroll(beats), [beats])

  if (legacy && (legacy.schema_version || !('kind' in legacy))) {
    return <LegacyPostprodFallback />
  }
  if (beats.length === 0) {
    return (
      <div className="pp-empty">
        <p>Destrinche o roteiro pra gerar os momentos e o b-roll.</p>
      </div>
    )
  }

  return (
    <div className="pos-stage" data-lang={activeLang}>
      <section className="pp-momentos">
        <h3>Momentos-chave</h3>
        <ul>
          {momentos.map(m => (
            <li key={m.n}><span className="pp-n">#{m.n}</span> <strong>{m.beatName}</strong> — <span className="pp-momento-text">{m.text}</span></li>
          ))}
        </ul>
      </section>

      <section className="pp-broll">
        <h3>B-roll por beat</h3>
        <ul>
          {broll.map(g => (
            <li key={g.n}>
              <strong>{g.beatName}</strong>
              <ul>{g.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="pp-entrega">
        <h3>Entrega</h3>
        <div
          className="pp-field" contentEditable suppressContentEditableWarning
          onBlur={e => onPatch({ deliverables: { ...(brief?.deliverables ?? {}), editor: e.currentTarget.textContent ?? '' } })}
        >{brief?.deliverables?.editor ?? ''}</div>
      </section>

      <section className="pp-ctas">
        <h3>CTAs</h3>
        <table className="pp-cta-table">
          <thead><tr><th>Chave</th><th data-active={activeLang === 'pt'}>PT</th><th data-active={activeLang === 'en'}>EN</th></tr></thead>
          <tbody>
            {(brief?.ctas.rows ?? []).map((r, i) => (
              <tr key={i}><td>{r.k}</td><td data-active={activeLang === 'pt'}>{r.pt}</td><td data-active={activeLang === 'en'}>{r.en}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="pp-cta-warn">A QR/CTA difere por idioma — confira a coluna ativa.</p>
      </section>

      <button type="button" className="pp-handoff-btn" onClick={onOpenHandoff}>Exportar pro editor</button>
    </div>
  )
}
