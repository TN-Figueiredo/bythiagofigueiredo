'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import type { RoteiroContent, RoteiroBeat, ScriptLine } from '@/lib/pipeline/roteiro-schemas'
import './script-view-mode.css'

interface ScriptViewModeProps {
  content: RoteiroContent
  title?: string
  onExitView: () => void
}

function fmtDur(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${m}m`
}

function beatWordCount(beat: RoteiroBeat): number {
  return beat.script
    .filter((l): l is ScriptLine & { type: 'line' } => l.type === 'line')
    .reduce((n, l) => n + l.text.split(/\s+/).length, 0)
}

function beatReadTime(beat: RoteiroBeat): number {
  const words = beatWordCount(beat)
  const pauses = beat.script
    .filter((l): l is ScriptLine & { type: 'pause' } => l.type === 'pause')
    .reduce((n, l) => n + l.duration, 0)
  return Math.ceil(words / 2.5 + pauses)
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
            <th className="sv-ov-dur">Dur</th>
            <th className="sv-ov-words">Leitura</th>
          </tr>
        </thead>
        <tbody>
          {beats.map((b) => (
            <tr key={b.idx}>
              <td className="sv-ov-num">#{b.idx}</td>
              <td className="sv-ov-name">{b.name}</td>
              <td className="sv-ov-dur">{b.duration ? fmtDur(b.duration) : '-'}</td>
              <td className="sv-ov-words">~{beatReadTime(b)}s</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td className="sv-ov-name">Total</td>
            <td className="sv-ov-dur">{fmtDur(totalDur)}</td>
            <td className="sv-ov-words">~{totalRead}s</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function DirBlock({ notes }: { notes: (ScriptLine & { type: 'note' })[] }) {
  if (notes.length === 0) return null
  return (
    <div className="sv-dir-block">
      {notes.map((n, i) => (
        <div key={i} className="sv-dir-row">
          <span className={`sv-dir-label sv-${n.tag.toLowerCase()}`}>{n.tag}:</span>
          {n.text}
        </div>
      ))}
    </div>
  )
}

function BeatSection({ beat }: { beat: RoteiroBeat }) {
  const notes = beat.script.filter(
    (s): s is ScriptLine & { type: 'note' } => s.type === 'note',
  )
  const body = beat.script.filter((s) => s.type !== 'note')
  const readSec = beatReadTime(beat)

  return (
    <div className="sv-beat">
      <div className="sv-beat-header">
        <span className="sv-beat-num">#{beat.idx}</span>
        <span className="sv-beat-name">{beat.name}</span>
        <span className="sv-beat-info">
          {beat.duration ? `${fmtDur(beat.duration)} · ` : ''}~{readSec}s
        </span>
      </div>
      <DirBlock notes={notes} />
      <div className="sv-lines">
        {body.map((item, i) => {
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
    </div>
  )
}

export function ScriptViewMode({ content, title, onExitView }: ScriptViewModeProps) {
  const [dark, setDark] = useState(false)
  const { meta, beats } = content

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'd' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setDark((d) => !d)
      }
      if (e.key === 'Escape') {
        onExitView()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onExitView])

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
    <div className={`script-view ${dark ? 'sv-dark' : ''}`}>
      {/* Controls bar */}
      <div className="sv-controls">
        <button type="button" onClick={() => setDark(!dark)} title="Toggle dark/light (D)">
          &#9684; Tema
        </button>
        <button type="button" onClick={() => window.print()} title="Print">
          &#9112; Print
        </button>
        <button type="button" onClick={onExitView} title="Back to edit (Esc)">
          &#8592; Editar
        </button>
      </div>

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
      {beats.map((beat) => (
        <BeatSection key={beat.idx} beat={beat} />
      ))}

      {/* Footer */}
      <footer className="sv-footer">
        <span>tf &#10086; Pipeline CMS</span>
        <span>{new Date().toLocaleDateString('pt-BR')}</span>
      </footer>
    </div>
  )
}
