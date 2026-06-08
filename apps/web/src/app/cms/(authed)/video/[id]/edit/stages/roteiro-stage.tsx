'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layers, Clock, Play, RefreshCw, CheckCheck, Eye, BellOff, Edit, Sparkles } from 'lucide-react'
import { vidTotals, fmtClock } from '@/lib/pipeline/video-schemas'
import { videoLineKeys, videoLineSecsFlat, readPctOf } from '@/lib/pipeline/video-read-math'
import type { RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'
import { useVideoEditorState, useVideoEditorDispatch } from '../context'
import { useVideoData } from '../data-context'
import { RoteiroBeat } from './roteiro-beat'
import type { Version } from '../editor-model'
import type { VideoLang } from '../types'

export interface RoteiroStageProps {
  /** Design-handoff Version for the active lang (cur = versions[lang]). */
  cur?: Version
  lang?: VideoLang
}

// Props are the forward-compatible handoff contract; this body still reads context.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function RoteiroStage(_props: RoteiroStageProps = {}) {
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const data = useVideoData()
  const lang = state.activeLang
  const content = data.roteiro[lang]
  const notes = state.notes
  const overlayOpen = state.recordingOpen || state.handoffOpen || state.coworkOpen

  const [spoken, setSpoken] = useState<Set<string>>(() => new Set())
  const [cursor, setCursor] = useState(0)

  const beats = content?.beats ?? []
  const lineKeys = useMemo(() => (content ? videoLineKeys(content) : []), [content])
  const lineSecs = useMemo(() => (content ? videoLineSecsFlat(content) : []), [content])

  const toggle = useCallback((k: string) => {
    setSpoken((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  }, [])

  // Teleprompter keyboard (single listener). Inert when focus is editable or an overlay owns the key.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (overlayOpen || state.focus) return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON')) return
      if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        setCursor((c) => {
          const k = lineKeys[c]
          if (k) setSpoken((s) => { const n = new Set(s); n.add(k); return n })
          return Math.min(c + 1, Math.max(0, lineKeys.length - 1))
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => {
          const nc = Math.max(c - 1, 0)
          const k = lineKeys[nc]
          if (k) setSpoken((s) => { const n = new Set(s); n.delete(k); return n })
          return nc
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lineKeys, overlayOpen, state.focus])

  // Smooth-scroll the current line to ~35% of the scroll container on cursor change.
  useEffect(() => {
    const k = lineKeys[cursor]
    if (!k) return
    const el = document.querySelector(`.rb-line[data-k="${k}"]`) as HTMLElement | null
    if (!el) return
    const sc =
      (el.closest('.content') as HTMLElement | null) ||
      (document.querySelector('.content') as HTMLElement | null) ||
      (document.querySelector('.ed-scroll') as HTMLElement | null) ||
      (el.closest('main') as HTMLElement | null)
    if (!sc) return
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - sc.clientHeight * 0.35
    sc.scrollTo?.({ top, behavior: reduce ? 'auto' : 'smooth' })
  }, [cursor, lineKeys])

  const onCommitLine = useCallback((beatIdx: number, lineIdx: number, next: string) => {
    if (!content) return
    const updated: RoteiroContentV3 = {
      ...content,
      beats: content.beats.map((b, bi) =>
        bi !== beatIdx ? b : { ...b, script: b.script.map((it, i) => (i === lineIdx && it.type === 'line' ? { ...it, text: next } : it)) },
      ),
    }
    void data.saveRoteiro(lang, updated)
  }, [content, data, lang])

  if (!content || beats.length === 0) {
    return (
      <div className="rot-empty fade-in">
        <div className="card card-pad" style={{ textAlign: 'center', padding: '30px 26px' }}>
          <Edit size={22} />
          <h2>Ainda é só uma ideia</h2>
          <p>
            Esse vídeo tem uma direção, mas o roteiro não foi destrinchado. Quando chegar a hora de gravar, abra a
            direção e quebre em beats.
          </p>
          <button type="button" className="btn primary" style={{ marginTop: 6 }} onClick={() => dispatch({ type: 'SET_STAGE', stage: 'ideia' })}>
            <Sparkles size={15} /> Ver a direção
          </button>
        </div>
      </div>
    )
  }

  const title = data.ideia[lang].title.trim() || 'Sem título'
  const totals = vidTotals(beats)
  const totalLines = lineKeys.length
  const cursorKey = lineKeys[cursor]
  const totalSecs = lineSecs.reduce((a, b) => a + b, 0)
  const elapsedSecs = lineSecs.slice(0, cursor).reduce((a, b) => a + b, 0)
  const readPct = readPctOf(elapsedSecs, totalSecs)

  return (
    <div className="rot-doc fade-in">
      <div className="rot-sum">
        <span className="rs-k"><Layers size={13} /> <b>{beats.length}</b> beats</span>
        <span className="msep">·</span>
        <span className="rs-k"><Clock size={13} /> alvo <b>{data.durationRange ?? fmtClock(totals.dur)}</b></span>
        <span className="msep">·</span>
        <span className="rs-k rot-clock"><Play size={12} /> <b>{fmtClock(elapsedSecs)}</b> / {fmtClock(totalSecs)}</span>
        <span className="grow" />
        {spoken.size > 0 && (
          <button type="button" className="rot-clear" onClick={() => { setSpoken(new Set()); setCursor(0) }}>
            <RefreshCw size={12} /> limpar
          </button>
        )}
        <span className="rot-spoken" title="Falas marcadas durante a leitura">
          <CheckCheck size={13} /> {spoken.size}/{totalLines}
        </span>
        <button type="button" className={'rot-notetgl' + (notes ? ' on' : '')} onClick={() => dispatch({ type: 'TOGGLE_NOTES' })}>
          {notes ? <Eye size={13} /> : <BellOff size={13} />} Notas do editor
        </button>
      </div>
      <div className="rot-readbar"><span style={{ width: `${readPct}%` }} /></div>
      <h1 className="rot-title">{title}</h1>
      <div className="rot-hint">
        <span className="rk">espaço</span> próxima fala <span className="rsep">·</span> <span className="rk">↑</span> voltar{' '}
        <span className="rsep">·</span> clique numa linha pra editar
      </div>
      {beats.map((b, i) => (
        <RoteiroBeat
          key={i}
          beat={b}
          idx={i}
          notes={notes}
          spoken={spoken}
          cursorKey={cursorKey}
          onToggle={toggle}
          onCommitLine={onCommitLine}
        />
      ))}
    </div>
  )
}
