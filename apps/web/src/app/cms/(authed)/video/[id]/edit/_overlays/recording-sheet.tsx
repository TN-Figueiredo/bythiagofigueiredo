'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ChevronLeft, Rss, Pencil } from 'lucide-react'
import { recBeatLines, clampRsScale } from '@/lib/pipeline/recording-sheet-data'
import { splitBeats, itemText, beatSections, type ScriptSection } from '@/lib/pipeline/video-perform'
import { sectionReadSecs } from '@/lib/pipeline/video-read-math'
import { videoBeatRead, fmtClock } from '@/lib/pipeline/video-schemas'
import { MARK_GRANS, MARK_GRAN_LABEL, markGranClass, DEFAULT_MARK_GRAN, beatContentHash, type MarkGran, type RecStatus } from '@/lib/pipeline/video-recording'
import type { RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'

/** **word** → <b class="emph">word</b>, HTML-escaped first. */
function emphHtml(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc.replace(/\*\*(.+?)\*\*/g, '<b class="emph">$1</b>')
}

/**
 * Reader clamp — same step + floor as the sheet's `clampRsScale` (0.85 floor, 2-decimal
 * round) but a wider 2.0 ceiling so a single section can be read across the room on a
 * tablet. The sheet keeps its own 1.4 ceiling for print parity.
 */
function clampReaderScale(current: number, delta: number): number {
  return Math.min(2.0, Math.max(0.85, +(current + delta).toFixed(2)))
}

/** A reader "card": one derived print section paired with its parent beat + a global seq. */
interface ReaderSection {
  beat: RoteiroBeatV3
  /** 1-based index of the parent performer beat (matches the sheet's `#N`). */
  beatSeq: number
  section: ScriptSection
  /** Durable status key — `${lang}:${beat.id}` (falls back to beat seq when no id). */
  beatKey: string
}

const READER_IDLE_MS = 4000
const UNDO_MS = 4000

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
  /**
   * Set the durable recording status of a beat from the reader view (key `${lang}:${beat.id}`).
   * Optional — the shell wiring (local-first persistence) is built separately; the reader
   * calls this defensively (no-op when absent) and keeps its own optimistic UI either way.
   */
  onSetBeatStatus?: (key: string, status: RecStatus) => void
  /**
   * The content_hash each beat was RECORDED against, keyed `${lang}:${beat.id}` (the editor's
   * `recRecordedHash` ledger). The reader compares it against the beat's LIVE text hash to flag
   * a beat as stale ("⚠ roteiro mudou desde a gravação") — so a clean ✓ gravada never sits over
   * rewritten fala. Optional/`{}` for standalone use → nothing is ever flagged stale.
   */
  recordedHash?: Record<string, string>
  onClose: () => void
}

export function RecordingSheet(props: RecordingSheetProps) {
  const { code, channelName, channelLabel, pillarLabel, durationRange, recordingLocation, title, beats } = props
  const markGran: MarkGran = props.markGran ?? DEFAULT_MARK_GRAN
  const onSetBeatStatus = props.onSetBeatStatus
  const [view, setView] = useState<'sheet' | 'reader'>('sheet')
  const [showEd, setShowEd] = useState(false)
  const [scale, setScale] = useState(1)
  const [density, setDensity] = useState<'comp' | 'conf'>('conf')
  const [mounted, setMounted] = useState(false)
  const initLang = props.langOptions.find((o) => o.label === channelLabel)?.lang ?? props.langOptions[0]?.lang ?? ''
  const [curLang, setCurLang] = useState(initLang)

  // Reader-local UI state (NOT in the reducer): which section is on screen, the optimistic
  // per-beat status overlay, the undo buffer, and whether the chrome is idle-dimmed.
  const [secIdx, setSecIdx] = useState(0)
  const [statusOverride, setStatusOverride] = useState<Record<string, RecStatus>>({})
  const [undo, setUndo] = useState<{ key: string; prev: RecStatus; fromIdx: number } | null>(null)
  const [chromeIdle, setChromeIdle] = useState(false)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setMounted(true), [])

  // Focus trap: the overlay is a `createPortal` over the whole app. Without this, the
  // underlying editor's contentEditable lines / buttons stay Tab- and screen-reader-
  // reachable behind the dimmed overlay. Mark every sibling of the portal node `inert`
  // (+ aria-hidden) while mounted; restore on unmount.
  useEffect(() => {
    if (!mounted) return
    const overlay = overlayRef.current
    const portalRoot = overlay?.parentElement ?? null
    const siblings = Array.from(document.body.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el !== portalRoot && el !== overlay,
    )
    const restore = siblings.map((el) => ({
      el,
      inert: el.hasAttribute('inert'),
      ariaHidden: el.getAttribute('aria-hidden'),
    }))
    for (const el of siblings) {
      el.setAttribute('inert', '')
      el.setAttribute('aria-hidden', 'true')
    }
    return () => {
      for (const { el, inert, ariaHidden } of restore) {
        if (!inert) el.removeAttribute('inert')
        if (ariaHidden === null) el.removeAttribute('aria-hidden')
        else el.setAttribute('aria-hidden', ariaHidden)
      }
    }
  }, [mounted])

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

  // Actor's sheet: only what's performed on camera. Prep stays as a compact top
  // checklist; editor-directed coverage (b-roll) goes to the editor handoff sheet.
  const { performer, prep } = useMemo(() => splitBeats({ version: 3, meta: {}, beats }), [beats])

  // Reader sections: flatten the `fala` beats into an ordered list of derived print
  // sections (one card per view). `acao` beats hold prompts, not spoken lines, so they
  // never become reader cards. `beatSeq` mirrors the sheet's `#N` (1-based performer index).
  const readerSections = useMemo<ReaderSection[]>(() => {
    const out: ReaderSection[] = []
    performer.forEach((kb, i) => {
      if (kb.kind !== 'fala') return
      for (const section of beatSections(kb.beat, kb.idx)) {
        const beatKey = `${curLang}:${kb.beat.id ?? `seq${i}`}`
        out.push({ beat: kb.beat, beatSeq: i + 1, section, beatKey })
      }
    })
    return out
  }, [performer, curLang])

  const readLang: 'pt' | 'en' = curLang === 'en' ? 'en' : 'pt'
  const secCount = readerSections.length
  // Clamp the active section into range whenever the derived list shrinks (lang switch, etc.).
  const clampedSec = secCount === 0 ? 0 : Math.min(secIdx, secCount - 1)
  const cur = readerSections[clampedSec]
  const curStatus: RecStatus = cur ? (statusOverride[cur.beatKey] ?? 'pendente') : 'pendente'
  // The current card is STALE when a recorded baseline hash exists for its beat key and no
  // longer matches the beat's live text hash — the fala was rewritten after it was marked.
  // `recordedHash` is keyed `${lang}:${beat.id}`, the same shape as `cur.beatKey`.
  const recordedHash = props.recordedHash
  const curStale: boolean = !!cur && (() => {
    const baseline = recordedHash?.[cur.beatKey]
    return baseline != null && baseline !== beatContentHash(cur.beat)
  })()

  const goSec = useCallback((next: number) => {
    setSecIdx((prev) => {
      const max = Math.max(0, secCount - 1)
      return Math.min(max, Math.max(0, next ?? prev))
    })
  }, [secCount])

  const setStatus = useCallback((status: RecStatus) => {
    // Derive BOTH the target card and the advance from `clampedSec` only — never from a
    // stale `secIdx` (the race: `secIdx` could point past a shrunk list while `clampedSec`
    // is the real on-screen index).
    const at = clampedSec
    const card = readerSections[at]
    if (!card) return
    const prev = statusOverride[card.beatKey] ?? 'pendente'
    // No-op: re-pressing the status already on this card creates no new undo / revert.
    if (status === prev) return
    setStatusOverride((m) => ({ ...m, [card.beatKey]: status }))
    onSetBeatStatus?.(card.beatKey, status)
    if (status === 'gravada') {
      setUndo({ key: card.beatKey, prev, fromIdx: at })
      // Auto-advance to the next section (stay put on the last one).
      setSecIdx(Math.min(secCount - 1, at + 1))
    } else {
      setUndo(null)
    }
  }, [readerSections, clampedSec, statusOverride, onSetBeatStatus, secCount])

  const doUndo = useCallback(() => {
    setUndo((u) => {
      if (!u) return null
      setStatusOverride((m) => ({ ...m, [u.key]: u.prev }))
      onSetBeatStatus?.(u.key, u.prev)
      setSecIdx(u.fromIdx)
      return null
    })
  }, [onSetBeatStatus])

  // Undo toast auto-dismisses after UNDO_MS.
  useEffect(() => {
    if (!undo) return
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS)
    return () => { if (undoTimer.current) clearTimeout(undoTimer.current) }
  }, [undo])

  // Move focus to the section heading on change (a11y: announce the new card).
  useEffect(() => {
    if (view === 'reader') headingRef.current?.focus()
  }, [clampedSec, view])

  // Re-clamp the shared `scale` into the active view's range on view switch: the reader
  // allows up to 2.0, the sheet caps at 1.4 (print parity). Carrying a 2.0 reader scale
  // into Folha would break the printed layout.
  useEffect(() => {
    setScale((s) => (view === 'reader' ? clampReaderScale(s, 0) : clampRsScale(s, 0)))
  }, [view])

  // Idle-dim the chrome after READER_IDLE_MS of no pointer/key activity — reader only.
  useEffect(() => {
    if (view !== 'reader') { setChromeIdle(false); return }
    const wake = () => {
      setChromeIdle(false)
      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => setChromeIdle(true), READER_IDLE_MS)
    }
    wake()
    window.addEventListener('pointermove', wake)
    window.addEventListener('pointerdown', wake)
    window.addEventListener('keydown', wake)
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [view])

  // Reader keyboard: ←/→ + PageUp/Down navigate; g = Gravada+advance; r = Refazer.
  // Escape stays owned by the always-on handler above; Space is left free.
  useEffect(() => {
    if (view !== 'reader') return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goSec(clampedSec - 1) }
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goSec(clampedSec + 1) }
      else if (e.key === 'g' || e.key === 'G') { e.preventDefault(); setStatus('gravada') }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); setStatus('refazer') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, clampedSec, goSec, setStatus])

  if (!mounted) return null

  const bump = (d: number) => setScale((s) => (view === 'reader' ? clampReaderScale(s, d) : clampRsScale(s, d)))
  // Beats count = all performer beats; read time = ONLY fala beats (acao beats hold
  // prompts, not spoken lines, so they must not inflate the "Fala ~X" headline).
  const beatsCount = performer.length
  const readSeconds = performer
    .filter((b) => b.kind === 'fala')
    .reduce((acc, b) => acc + videoBeatRead(b.beat), 0)
  const hasBeats = performer.length > 0 || prep.length > 0

  // Flip to the sheet view, then print on the NEXT frame so the DOM has actually swapped
  // (printing same-tick would capture the reader's still-mounted layout).
  const printSheet = () => { setView('sheet'); requestAnimationFrame(() => window.print()) }

  const overlay = (
    <div
      ref={overlayRef}
      className={
        'rec-overlay dens-' + density + ' ' + markGranClass(markGran) +
        (view === 'reader' ? ' view-reader' : '') +
        (view === 'reader' && chromeIdle ? ' chrome-idle' : '')
      }
      style={{ ['--rs-scale' as string]: String(scale) }}
    >
      <div className="rec-bar">
        <button className="rb-back" onClick={props.onClose}><ChevronLeft size={15} /> Fechar</button>
        <span className="rb-title">{title || 'Sem título'}</span>
        <span className="rb-spacer" />

        <div className="rec-seg" title="Modo de visualização">
          <button type="button" className={view === 'sheet' ? 'on' : ''} onClick={() => setView('sheet')}>Folha</button>
          <button type="button" className={view === 'reader' ? 'on' : ''} onClick={() => setView('reader')}>Leitura</button>
        </div>

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

        <button className="rb-print" onClick={printSheet}><Rss size={14} /> Imprimir</button>
      </div>

      {view === 'reader' && hasBeats ? (
        <ReaderView
          sections={readerSections}
          idx={clampedSec}
          status={curStatus}
          stale={curStale}
          readLang={readLang}
          headingRef={headingRef}
          onPrev={() => goSec(clampedSec - 1)}
          onNext={() => goSec(clampedSec + 1)}
          onRec={() => setStatus('gravada')}
          onRetake={() => setStatus('refazer')}
          undoOpen={undo !== null}
          onUndo={doUndo}
        />
      ) : hasBeats ? (
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

interface ReaderViewProps {
  sections: ReaderSection[]
  idx: number
  status: RecStatus
  /** The current card's beat was rewritten since it was recorded — surface a loud warning. */
  stale: boolean
  readLang: 'pt' | 'en'
  headingRef: RefObject<HTMLHeadingElement | null>
  onPrev: () => void
  onNext: () => void
  onRec: () => void
  onRetake: () => void
  undoOpen: boolean
  onUndo: () => void
}

/**
 * Full-screen reader — one derived section per view, true black/white contrast (set via the
 * `.view-reader` palette override in video.css), huge text, thumb-reachable nav. Recording
 * chrome (nav + set-status + undo) is `aria-hidden` from print by living under `.recr-*`,
 * which `@media print` never renders (print always uses the sheet view).
 */
function ReaderView(props: ReaderViewProps) {
  const { sections, idx, status, stale, readLang, headingRef } = props
  // Stale only "wins" the badge when the beat actually carries a recorded status — a clean
  // pendente card was never recorded, so there's nothing to be stale against.
  const staleHot = stale && (status === 'gravada' || status === 'refazer')
  const cur = sections[idx]
  if (!cur) {
    // `fala` beats exist but none produced a spoken section (e.g. only actions). Nothing to read.
    return (
      <div className="recr">
        <div className="recr-stage">
          <p className="recr-none">Nenhuma seção de fala pra ler — use a Folha pra ver ações e prep.</p>
        </div>
      </div>
    )
  }
  const secs = sectionReadSecs(cur.beat, cur.section, readLang)
  // Only `line` items carry spoken text; non-line idxs (or empty strings) would render as
  // blank <p>s. Filter to non-empty spoken lines.
  const lineTexts = cur.section.lineIdxs
    .map((i) => {
      const it = cur.beat.script[i]
      return it && it.type === 'line' ? it.text : ''
    })
    .filter((tx) => tx.trim().length > 0)

  return (
    <div className="recr">
      <div className="recr-stage">
        <div className={'recr-card st-' + status + (staleHot ? ' st-stale' : '')}>
          <div className="recr-meta">
            <span className="recr-seq">#{cur.beatSeq}</span>
            <span className="recr-bname">{cur.beat.name}</span>
            <span className="recr-dur">~{secs}s de fala</span>
            {staleHot ? (
              // Loud override: the roteiro changed after this beat was recorded — never show a
              // clean ✓ over rewritten fala. The performer must catch it at a glance.
              <span className="recr-badge stale" role="status">⚠ roteiro mudou desde a gravação</span>
            ) : status !== 'pendente' ? (
              <span className={'recr-badge ' + status}>{status === 'gravada' ? '✓ gravada' : '⟲ refazer'}</span>
            ) : null}
          </div>
          <h2 className="recr-head" ref={headingRef} tabIndex={-1}>
            {sections.length > 0 ? `${cur.beat.name} — seção ${idx + 1} de ${sections.length}` : cur.beat.name}
          </h2>
          <div className="recr-body">
            {lineTexts.length > 0 ? (
              lineTexts.map((tx, j) => (
                <p className="recr-tx" key={j} dangerouslySetInnerHTML={{ __html: emphHtml(tx) }} />
              ))
            ) : (
              <p className="recr-none">Nada pra ler nesta seção — use a Folha pra ver ações e prep.</p>
            )}
          </div>
        </div>
      </div>

      <div className="recr-setrow">
        <button type="button" className="recr-set rec" onClick={props.onRec} aria-label="Marcar seção como gravada e avançar">✓ Gravada</button>
        <button type="button" className="recr-set ret" onClick={props.onRetake} aria-label="Marcar seção para refazer">⟲ Refazer</button>
      </div>

      {props.undoOpen ? (
        <div className="recr-toast" role="status">
          <span>Marcado</span>
          <button type="button" className="recr-undo" onClick={props.onUndo}>Desfazer</button>
        </div>
      ) : null}

      <div className="recr-nav">
        <button
          type="button"
          className="recr-navbtn prev"
          onClick={props.onPrev}
          disabled={idx <= 0}
          aria-label="Seção anterior"
        >◀ Seção</button>
        <span className="recr-ind">Seção {idx + 1}/{sections.length}</span>
        <button
          type="button"
          className="recr-navbtn next"
          onClick={props.onNext}
          disabled={idx >= sections.length - 1}
          aria-label="Próxima seção"
        >Seção ▶</button>
      </div>
    </div>
  )
}
