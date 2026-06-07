'use client'

import { useMemo, useState, useEffect } from 'react'
import type { RoteiroContent, RoteiroBeat } from '@/lib/pipeline/roteiro-schemas'
import { fmtDur, beatReadTime } from '@/lib/pipeline/roteiro-schemas'
import './script-view-mode.css'

interface ScriptViewModeProps {
  content: RoteiroContent
  title?: string
}

function Overview({ beats }: { beats: RoteiroBeat[] }) {
  const totalDur = beats.reduce((s, b) => s + (b.duration ?? 0), 0)
  const totalRead = beats.reduce((s, b) => s + beatReadTime(b), 0)

  return (
    <div className="sv-overview">
      <div className="sv-label" style={{ marginBottom: 6 }}>Beats</div>
      <table>
        <thead>
          <tr>
            <th className="sv-ov-num" />
            <th className="sv-ov-name">Beat</th>
            <th className="sv-ov-dur">Status</th>
            <th className="sv-ov-dur">Dur</th>
            <th className="sv-ov-words">Leitura</th>
          </tr>
        </thead>
        <tbody>
          {beats.map((b, i) => (
            <tr key={i}>
              <td className="sv-ov-num">#{b.idx + 1}</td>
              <td className="sv-ov-name">{b.name}</td>
              <td className="sv-ov-dur" style={{ textAlign: 'center' }}>{b.status === 'DONE' ? '✓' : '—'}</td>
              <td className="sv-ov-dur">{b.duration ? fmtDur(b.duration) : '-'}</td>
              <td className="sv-ov-words">~{beatReadTime(b)}s</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td className="sv-ov-name">Total</td>
            <td />
            <td className="sv-ov-dur">{fmtDur(totalDur)}</td>
            <td className="sv-ov-words">~{totalRead}s</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}


function BeatSection({ beat }: { beat: RoteiroBeat }) {
  const readSec = beatReadTime(beat)

  return (
    <div className="sv-beat">
      <div className="sv-beat-header">
        <span className="sv-beat-num">#{beat.idx + 1}</span>
        <span className="sv-beat-name">{beat.name}</span>
        <span className="sv-beat-info">
          {beat.duration ? `${fmtDur(beat.duration)} · ` : ''}~{readSec}s
        </span>
      </div>
      {beat.script.map((item, i) => {
        if (item.type === 'note') {
          return (
            <div key={i} className="sv-dir-block">
              <span className={`sv-dir-label sv-${item.tag.toLowerCase()}`}>{item.tag}:</span>
              {item.text}
            </div>
          )
        }
        if (item.type === 'line') {
          return (
            <div key={i} className="sv-line">
              {item.text}
            </div>
          )
        }
        if (item.type === 'pause') {
          return (
            <div key={i} className="sv-pause">
              &#9208; {item.duration}s
            </div>
          )
        }
        if (item.type === 'ref') {
          return (
            <div key={i} className="sv-ref">
              <span className="sv-ref-tag">REF</span>
              {item.text}
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

export function ScriptViewMode({ content, title }: ScriptViewModeProps) {
  const { meta, beats } = content

  const [printDate, setPrintDate] = useState('')
  useEffect(() => { setPrintDate(new Date().toLocaleDateString('pt-BR')) }, [])

  const metaEntries = useMemo(
    () =>
      [
        ['Canal', meta.canal],
        ['Formato', meta.formato],
        ['Angulos', meta.angulos],
        ['Duracao', meta.duracao],
        ['Framework', meta.framework],
        ['VVS', meta.fonte_vvs],
      ].filter(([, v]) => v) as [string, string][],
    [meta],
  )

  return (
    <div className="script-view">
      {/* Header */}
      <header className="sv-header">
        <div className="sv-header-label">
          Roteiro {'·'} v2 {'·'} {beats.length} beats
        </div>
        {title && <h1 className="sv-header-title">{title}</h1>}
        {metaEntries.length > 0 && (
          <div className="sv-header-meta">
            {metaEntries.map(([label, value]) => (
              <div key={label}>
                <strong>{label} </strong>
                {value}
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Overview */}
      {beats.length > 0 && <Overview beats={beats} />}

      {/* Beats */}
      {beats.map((beat, i) => (
        <BeatSection key={i} beat={beat} />
      ))}

      {/* Footer */}
      <footer className="sv-footer">
        <span>tf &#10086; Pipeline CMS</span>
        <span>{printDate}</span>
      </footer>
    </div>
  )
}
