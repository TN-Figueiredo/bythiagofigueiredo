'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Layers, Clock, Play, RefreshCw, RotateCcw, CheckCheck, Eye, BellOff, Edit, Plus, CircleDot, CircleOff } from 'lucide-react'
import { toast } from 'sonner'
import { SparklesGlyph } from '../_components/sparkles-glyph'
import { CoworkButton } from '../_components/cowork-button'
import { CHANNELS } from '@/lib/pipeline/channels'
import { vidTotals, fmtClock } from '@/lib/pipeline/video-schemas'
import { videoLineKeys, videoLineSecsFlat, readPctOf } from '@/lib/pipeline/video-read-math'
import type { RoteiroContentV3, RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'
import { splitBeats, markableIdxs } from '@/lib/pipeline/video-perform'
import { ensureBeatIds, markGranClass, beatContentHash } from '@/lib/pipeline/video-recording'
import { useVideoEditorState, useVideoEditorDispatch, useCanEditContent } from '../context'
import { useVideoData } from '../data-context'
import { RoteiroBeat } from './roteiro-beat'
import { RoteiroActionBeat } from './roteiro-action-beat'
import { PrepStrip, EditorHandoff } from './roteiro-aside'
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
  // THE content-edit gate (View/Edit mode + not scheduled/published). Drives every
  // content-mutating affordance below; reading + recording-status stay live regardless.
  const canEdit = useCanEditContent()
  const data = useVideoData()
  const lang = state.activeLang
  const rawContent = data.roteiro[lang]
  const notes = state.notes
  const showRecStatus = state.showRecStatus
  const markGran = state.markGran
  const recStatus = state.recStatus
  const retakeNotes = state.retakeNotes
  // The content_hash each beat was RECORDED against (lang-qualified `${lang}:${beat.id}`).
  // A beat is STALE when this baseline exists AND differs from the beat's current text hash —
  // i.e. the fala was rewritten after being marked gravada/refazer. Empty {} when never hydrated.
  const recRecordedHash = state.recRecordedHash ?? {}
  const overlayOpen = state.recordingOpen || state.handoffOpen || state.coworkOpen

  // Stamp stable beat ids in memory so per-beat recording status has a durable key.
  // Persistence of these ids is Slice 4 — never triggers a save here. `content` is the
  // id-stamped view; every downstream read (lanes, lineKeys, save callbacks) uses it.
  const content = useMemo(() => (rawContent ? ensureBeatIds(rawContent).content : rawContent), [rawContent])
  // Lang-qualified durable key for a beat: `${lang}:${beat.id}` (PT/EN never collide).
  const beatKey = useCallback((id: string | undefined) => (id ? `${lang}:${id}` : ''), [lang])
  // STALE = a recorded baseline hash exists for this beat's key AND it no longer matches the
  // beat's live text hash. `beatContentHash` is cheap (FNV-1a over the normalized fala text),
  // so it's computed inline per render. Empty/absent baseline → never stale.
  const isStale = useCallback(
    (beat: RoteiroBeatV3): boolean => {
      const recorded = recRecordedHash[beatKey(beat.id)]
      return recorded != null && recorded !== beatContentHash(beat)
    },
    [beatKey, recRecordedHash],
  )

  const [spoken, setSpoken] = useState<Set<string>>(() => new Set())
  const [cursor, setCursor] = useState(0)
  const [confirmReset, setConfirmReset] = useState(false)
  const resetBtnRef = useRef<HTMLButtonElement>(null)

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

  // Jump to a beat from the navigation rail. Reuses the cursor-scroll container
  // resolution (.content → .ed-scroll → closest main) and reduced-motion awareness.
  const jumpTo = useCallback((i: number) => {
    const el = document.getElementById(`rb-${i}`)
    if (!el) return
    const sc =
      (el.closest('.content') as HTMLElement | null) ||
      (document.querySelector('.content') as HTMLElement | null) ||
      (document.querySelector('.ed-scroll') as HTMLElement | null) ||
      (el.closest('main') as HTMLElement | null)
    if (!sc) return
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 64
    sc.scrollTo?.({ top, behavior: reduce ? 'auto' : 'smooth' })
  }, [])

  const onCommitLine = useCallback((beatIdx: number, lineIdx: number, next: string) => {
    if (!content || !canEdit) return // defense-in-depth: never write content in view mode
    const updated: RoteiroContentV3 = {
      ...content,
      beats: content.beats.map((b, bi) =>
        bi !== beatIdx ? b : { ...b, script: b.script.map((it, i) => (i === lineIdx && it.type === 'line' ? { ...it, text: next } : it)) },
      ),
    }
    void data.saveRoteiro(lang, updated)
  }, [content, data, lang, canEdit])

  // Edit an editor cue (vis/ed) in place. Empty text removes the item.
  const onCommitNote = useCallback((beatIdx: number, itemIdx: number, next: string) => {
    if (!content || !canEdit) return // defense-in-depth: never write content in view mode
    const updated: RoteiroContentV3 = {
      ...content,
      beats: content.beats.map((b, bi) => {
        if (bi !== beatIdx) return b
        const script = next.trim()
          ? b.script.map((it, i) => (i === itemIdx && (it.type === 'vis' || it.type === 'ed') ? { ...it, text: next } : it))
          : b.script.filter((_, i) => i !== itemIdx)
        return { ...b, script }
      }),
    }
    void data.saveRoteiro(lang, updated)
  }, [content, data, lang, canEdit])

  // Append a b-roll cue for the editor to a beat (the real "how to add" path).
  const onAddCue = useCallback((beatIdx: number) => {
    if (!content || !canEdit) return // defense-in-depth: never write content in view mode
    const updated: RoteiroContentV3 = {
      ...content,
      beats: content.beats.map((b, bi) =>
        bi !== beatIdx ? b : { ...b, script: [...b.script, { type: 'vis', text: 'nova cue pro editor' }] },
      ),
    }
    void data.saveRoteiro(lang, updated)
  }, [content, data, lang, canEdit])

  // Recover a mis-classified beat: stamp an explicit kind (overrides the heuristic).
  // Content mutation → gated. No-op in view mode so the recover ("é fala?") + direction-
  // swap controls (rendered by out-of-scope aside/action-beat) can't rewrite the roteiro.
  const onSetKind = useCallback((beatIdx: number, kind: 'fala' | 'acao' | 'prep' | 'editor') => {
    if (!content || !canEdit) return
    const updated: RoteiroContentV3 = {
      ...content,
      beats: content.beats.map((b, bi) => (bi !== beatIdx ? b : { ...b, kind })),
    }
    void data.saveRoteiro(lang, updated)
  }, [content, data, lang, canEdit])

  const ideia = data.ideia[lang]
  const channel = CHANNELS.find((c) => c.lang === lang)
  const onStartBlank = () => {
    if (!canEdit) return // defense-in-depth: never write content in view mode
    void data.saveRoteiro(lang, { version: 3, meta: {}, beats: [{ idx: 0, name: 'Beat 1', status: 'PENDING', script: [] }] })
  }
  // "Recomeçar": clear all beats → back to the generation chooser (the empty-with-
  // direction state). Two-step inline confirm guards against deleting written work.
  const onReset = () => {
    if (!canEdit) return // defense-in-depth: never write content in view mode
    void data.saveRoteiro(lang, { version: 3, meta: {}, beats: [] })
    setConfirmReset(false)
    setSpoken(new Set())
    setCursor(0)
    toast.info('Roteiro limpo', { description: 'Volte a gerar com o Cowork ou comece do zero.' })
  }
  const onCancelReset = useCallback(() => {
    setConfirmReset(false)
    requestAnimationFrame(() => resetBtnRef.current?.focus())
  }, [])

  // Escape cancels the inline confirm (and restores focus to the Recomeçar button).
  useEffect(() => {
    if (!confirmReset) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelReset() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmReset, onCancelReset])

  // If the beats empty out underneath an open confirm, drop the now-stale confirm.
  useEffect(() => { if (beats.length === 0) setConfirmReset(false) }, [beats.length])

  if (!content || beats.length === 0) {
    if ((ideia.direction ?? '').trim()) {
      return (
        <div className="rot-gen fade-in">
          <div className="vi-kicker"><SparklesGlyph size={13} /> Roteiro · {channel?.name ?? lang.toUpperCase()}</div>
          <h1 className="vi-title">{ideia.title || 'Sem título'}</h1>
          <div className="vi-seed">
            <div className="vi-seed-head">
              <span className="vi-seed-ico"><SparklesGlyph size={14} /></span>
              <span className="vi-seed-name">A direção</span>
              <button type="button" className="vi-seed-edit" onClick={() => dispatch({ type: 'SET_STAGE', stage: 'ideia' })}>editar</button>
            </div>
            <div className="vi-seed-text">{ideia.direction}</div>
          </div>
          {canEdit && (
            <div className="rot-gen-actions">
              <CoworkButton stage="roteiro" label="Gerar roteiro com Cowork" />
              <button type="button" className="btn" onClick={onStartBlank}><Plus size={15} /> Começar do zero</button>
            </div>
          )}
          <div className="rot-gen-sub">
            {canEdit
              ? 'O Cowork rascunha 4 beats a partir da direção — você destrincha até virar a sua fala.'
              : 'Esse vídeo ainda é só uma direção. Entre no modo de edição para gerar o roteiro.'}
          </div>
        </div>
      )
    }
    return (
      <div className="rot-empty fade-in">
        <div className="card card-pad" style={{ textAlign: 'center', padding: '30px 26px' }}>
          <div className="empty">
            <div className="empty-ico"><Edit size={22} /></div>
            <div className="empty-title">Ainda é só uma ideia</div>
            <div className="empty-sub">
              Esse vídeo tem uma direção, mas o roteiro não foi destrinchado. Quando chegar a hora de gravar, abra a
              direção e quebre em beats.
            </div>
          </div>
          <button type="button" className="btn primary" style={{ marginTop: 6 }} onClick={() => dispatch({ type: 'SET_STAGE', stage: 'ideia' })}>
            <SparklesGlyph size={15} /> Ver a direção
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

  // Three lanes: what the talent performs (fala + acao), shoot-day prep (collapsed),
  // and editor-directed coverage (routed to Pós). Only the performer lane reads.
  const { performer, prep, editor } = splitBeats(content)
  // Spoken-line progress must count ONLY fala lines — actions live in the same
  // `spoken` Set but are a do-list, not "faladas".
  const spokenFalas = lineKeys.reduce((n, k) => n + (spoken.has(k) ? 1 : 0), 0)
  // B-roll cues authored inline as `vis` items inside fala beats also belong to the
  // editor — count them so the handoff footer reflects all coverage, not just whole
  // editor beats.
  const visInFala = performer.reduce(
    (n, kb) => n + (kb.kind === 'fala' ? kb.beat.script.filter((it) => it.type === 'vis').length : 0),
    0,
  )
  const goPos = () => dispatch({ type: 'SET_STAGE', stage: 'pos' })

  // Recording-status summary over the fala beats only (one fala beat ≈ one take).
  const falaBeats = performer.filter((kb) => kb.kind === 'fala')
  const recDone = falaBeats.filter((kb) => recStatus[beatKey(kb.beat.id)] === 'gravada').length
  const recRetake = falaBeats.filter((kb) => recStatus[beatKey(kb.beat.id)] === 'refazer').length

  return (
    <div className={'rot-doc fade-in ' + markGranClass(markGran) + (showRecStatus ? ' show-recst' : '')}>
      <div className="rot-sum">
        <span className="rs-k"><Layers size={13} /> <b>{performer.length}</b> beats</span>
        <span className="msep">·</span>
        <span className="rs-k"><Clock size={13} /> alvo <b>{data.durationRange ?? fmtClock(totals.dur)}</b></span>
        <span className="msep">·</span>
        <span className="rs-k rot-clock"><Play size={12} /> <b>{fmtClock(elapsedSecs)}</b> / {fmtClock(totalSecs)}</span>
        <span className="grow" />
        {canEdit && (confirmReset ? (
          <span className="rot-reset-confirm">
            Apagar o roteiro?
            <button type="button" className="rot-reset-yes" onClick={onReset}>apagar</button>
            <button type="button" className="rot-reset-no" onClick={onCancelReset}>cancelar</button>
          </span>
        ) : (
          <button type="button" className="rot-reset" ref={resetBtnRef} onClick={() => setConfirmReset(true)}>
            <RotateCcw size={12} /> Recomeçar
          </button>
        ))}
        {spoken.size > 0 && (
          <button type="button" className="rot-clear" onClick={() => { setSpoken(new Set()); setCursor(0) }}>
            <RefreshCw size={12} /> limpar
          </button>
        )}
        {showRecStatus ? (
          <span className="rot-secsum" title="Beats de fala já gravados">
            {recDone}/{falaBeats.length} beats gravados{recRetake > 0 ? ` · ${recRetake} refazer` : ''}
          </span>
        ) : (
          <span className="rot-spoken" title="Falas marcadas durante a leitura">
            <CheckCheck size={13} /> {spokenFalas}/{totalLines}
          </span>
        )}
        <button type="button" className={'rot-notetgl' + (showRecStatus ? ' on' : '')} onClick={() => dispatch({ type: 'TOGGLE_REC_STATUS' })}>
          {showRecStatus ? <CircleDot size={13} /> : <CircleOff size={13} />} Status de gravação
        </button>
        <button type="button" className={'rot-notetgl' + (notes ? ' on' : '')} onClick={() => dispatch({ type: 'TOGGLE_NOTES' })}>
          {notes ? <Eye size={13} /> : <BellOff size={13} />} Notas do editor
        </button>
      </div>
      <div className="rot-readbar"><span style={{ width: `${readPct}%` }} /></div>
      <h1 className="rot-title">{title}</h1>
      <div className="rot-hint">
        <span className="rk">espaço</span> próxima fala <span className="rsep">·</span> <span className="rk">↑</span> voltar
        {canEdit && <>{' '}<span className="rsep">·</span> clique numa linha pra editar</>}
      </div>
      <PrepStrip prep={prep} onSetKind={onSetKind} canEdit={canEdit} />
      {performer.length > 1 && (
        <div className="rot-rail">
          {performer.map((kb, s) => {
            const marks = markableIdxs(kb.beat, kb.kind)
            const doneCount = marks.filter((j) => spoken.has(`${kb.idx}-${j}`)).length
            const done = marks.length > 0 && doneCount === marks.length
            return (
              <button
                key={kb.idx}
                type="button"
                className={'rrl-chip' + (kb.kind === 'acao' ? ' act' : '') + (done ? ' done' : '')}
                onClick={() => jumpTo(kb.idx)}
                title={kb.beat.name}
              >
                <span className="rrl-n">{s + 1}</span><span className="rrl-nm">{kb.beat.name}</span>
              </button>
            )
          })}
        </div>
      )}
      {performer.map((kb, s) => {
        // Stagger entrance by performer position (robust against the variable number
        // of preceding nodes — prep strip, rail — that broke the old nth-child rule).
        const delay = { animationDelay: `${Math.min(s, 5) * 0.05}s` }
        return kb.kind === 'acao' ? (
          <RoteiroActionBeat
            key={kb.idx}
            beat={kb.beat}
            idx={kb.idx}
            seq={s + 1}
            style={delay}
            inferred={!kb.beat.kind}
            notes={notes}
            spoken={spoken}
            onToggle={toggle}
            onSetKind={onSetKind}
            canEdit={canEdit}
          />
        ) : (
          <RoteiroBeat
            key={kb.idx}
            beat={kb.beat}
            idx={kb.idx}
            seq={s + 1}
            style={delay}
            notes={notes}
            spoken={spoken}
            cursorKey={cursorKey}
            onToggle={toggle}
            onCommitLine={onCommitLine}
            onCommitNote={onCommitNote}
            onAddCue={onAddCue}
            canEdit={canEdit}
            showRecStatus={showRecStatus}
            recStatus={recStatus[beatKey(kb.beat.id)] ?? 'pendente'}
            stale={isStale(kb.beat)}
            retakeNote={retakeNotes[beatKey(kb.beat.id)] ?? ''}
            onCycleStatus={() => dispatch({ type: 'CYCLE_BEAT_STATUS', key: beatKey(kb.beat.id) })}
            onCommitRetake={(text) => dispatch({ type: 'SET_RETAKE_NOTE', key: beatKey(kb.beat.id), text })}
          />
        )
      })}
      <EditorHandoff editor={editor} visInFala={visInFala} notes={notes} goPos={goPos} onSetKind={onSetKind} canEdit={canEdit} />
    </div>
  )
}
