'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { SparklesGlyph } from './sparkles-glyph'
import { useVideoEditorState } from '../context'
import { openCowork } from '@/lib/pipeline/cowork-deeplink'
import type { VideoStage } from '../types'

/** Stage label for the instruction context handed to Cowork. */
const STAGE_LABEL: Record<VideoStage, string> = {
  ideia: 'Ideia', roteiro: 'Roteiro', pos: 'Pós', publicacao: 'Publicação',
}

/**
 * Per-stage target hint appended to the deep-link context so Cowork knows the exact
 * section + schema to write (and how to derive it). Optional per stage — a stage with
 * no hint keeps its prior freeform behavior.
 */
const STAGE_TARGET_HINT: Partial<Record<VideoStage, (itemId: string, lang: string) => string>> = {
  pos: (itemId, lang) =>
    `→ escreva a seção \`postprod\` (PosBriefSchema, kind:'brief') via PATCH /items/${itemId}/sections/postprod?lang=${lang}; ` +
    `derive estilo & ritmo, CTAs e QR a partir do roteiro (leia GET /items/${itemId}/sections/roteiro?lang=${lang} primeiro).`,
  publicacao: (itemId, lang) =>
    `→ escreva a seção \`publish\` (ABDraftSchema) via PATCH /items/${itemId}/sections/publish?lang=${lang}; ` +
    `leia GET /items/${itemId}/sections/roteiro?lang=${lang} e a ideia primeiro, então gere EXATAMENTE 4 variantes testáveis A–D ({id, title, brief}), ` +
    `cada variante = um TÍTULO testável + um BRIEF DE THUMBNAIL (o conceito visual da capa: o que ela mostra/comunica), ` +
    `cada uma num ângulo distinto (emocional/dados/curiosidade/promessa) derivado do roteiro + ideia; ` +
    `só TEXTO (título + brief da capa), nunca URLs/imagens — a arte é feita no Claude Design; ` +
    `todas role:'challenger' (sem 'winner', sem 'original'); firstOnAir = a capa que entra primeiro no ar.`,
}

/** Context prompts per stage (CW_PROMPTS in views-video.jsx ~39-44). */
const CW_PROMPTS: Record<VideoStage, string[]> = {
  ideia: ['Gerar 3 novas direções', 'Qual é o gancho mais forte?', 'Sugerir ângulos (A1–A5)'],
  roteiro: ['Encurtar mantendo os beats', 'Reforçar o hook', 'Sugerir b-roll por beat', 'Marcar ênfases'],
  pos: ['Gerar instruções de edição', 'Que b-roll ainda falta?', 'Revisar CTAs/QR por idioma'],
  publicacao: ['Gerar 4 variações: título + thumbnail', 'Variar os ângulos de gancho', 'Sugerir distribuição'],
}

/** Per-stage textarea placeholder — phrased as if you're talking to a sharp collaborator. */
const CW_PLACEHOLDER: Record<VideoStage, string> = {
  ideia: 'ex.: e se o gancho fosse mais incômodo? me dá 3 caminhos…',
  roteiro: 'ex.: corta 15s no meio sem perder o beat do CTA…',
  pos: 'ex.: o ritmo tá arrastado depois do hook — sugere cortes…',
  publicacao: 'ex.: títulos menos óbvios, mais curiosidade que promessa…',
}

/** Send lifecycle — modelled explicitly so the receipt + exit are honest (no fake load). */
type Phase = 'idle' | 'sending' | 'sent' | 'closing'

/** Estimated popover height used to decide whether to flip above the trigger. */
const EST_POP_HEIGHT = 340

export interface CoworkButtonProps {
  stage: VideoStage
  label?: string
  compact?: boolean
}

/**
 * Inline Cowork trigger with a portaled, fixed-position popover anchored to the
 * button (flips above when it would overflow the viewport bottom). Closes on Esc +
 * outside-click; ⌘/Ctrl+Enter sends; Tab/Shift+Tab is trapped inside the dialog. On
 * send it opens Claude (Cowork) with the video/section context as a deep-link, toasts
 * a durable receipt, then plays an exit animation, clears + closes + returns focus.
 */
export function CoworkButton({ stage, label = 'Cowork', compact }: CoworkButtonProps) {
  const editor = useVideoEditorState()
  const [open, setOpen] = useState(false)
  const [txt, setTxt] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [anchor, setAnchor] = useState<{ top?: number; bottom?: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const popId = useId()
  const headId = useId()
  const subId = useId()

  // Every close path returns focus to the trigger so keyboard/SR users aren't dropped.
  const close = () => {
    setOpen(false)
    setPhase('idle')
    setTxt('')
    btnRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (popRef.current && !popRef.current.contains(t) && btnRef.current && !btnRef.current.contains(t)) {
        close()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return }
      // Focus trap: cycle Tab/Shift+Tab within the popover, wrapping first↔last.
      if (e.key === 'Tab' && popRef.current) {
        const nodes = popRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([aria-disabled="true"]), textarea, [href], [tabindex]:not([tabindex="-1"])',
        )
        const focusables = Array.from(nodes)
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (!first || !last) return
        const activeInPop = popRef.current.contains(document.activeElement)
        if (e.shiftKey) {
          if (!activeInPop || document.activeElement === first) { e.preventDefault(); last.focus() }
        } else if (!activeInPop || document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
      }
    }
    // Measure synchronously (so the popover mounts on open); flip above when it would
    // overflow the viewport bottom.
    const measure = () => {
      if (!btnRef.current) return
      const r = btnRef.current.getBoundingClientRect()
      const right = Math.max(12, window.innerWidth - r.right)
      if (r.bottom + EST_POP_HEIGHT > window.innerHeight && r.top - EST_POP_HEIGHT > 0) {
        setAnchor({ bottom: Math.max(12, window.innerHeight - r.top + 9), right })
      } else {
        setAnchor({ top: r.bottom + 9, right })
      }
    }
    // Throttle scroll/resize repositioning to ≤1 setState/frame.
    let raf = 0
    const reposition = () => {
      if (raf) return
      raf = window.requestAnimationFrame(() => { raf = 0; measure() })
    }
    measure()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, { capture: true, passive: true })
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, { capture: true } as EventListenerOptions)
    }
    // `close` is stable enough for our purposes; re-running only on `open` keeps listeners fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Safety net for the exit: if the exit animation is suppressed (reduced-motion) or
  // never fires, still unmount after a short fallback so 'closing' can't get stuck.
  useEffect(() => {
    if (phase !== 'closing') return
    const id = window.setTimeout(() => close(), 220)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const prompts = CW_PROMPTS[stage] ?? []

  const send = (t?: string) => {
    const m = (t ?? txt).trim()
    if (!m || phase !== 'idle') return
    setPhase('sending')
    // openCowork is synchronous — open Claude (Cowork) with the message + the
    // video/section context so it knows exactly which item/section to act on.
    const lang = editor.activeLang
    const head = `[Vídeo ${editor.code} · ${STAGE_LABEL[stage]} · ${lang.toUpperCase()} · item ${editor.itemId}]`
    const hint = STAGE_TARGET_HINT[stage]?.(editor.itemId, lang)
    const ctx = hint ? `${head}\n${hint}` : head
    openCowork(`${ctx}\n\n${m}`)
    // Reflect the receipt next frame (so the 'sending' label paints first).
    window.requestAnimationFrame(() => {
      setPhase('sent')
      toast.success('Mandado pro Cowork', {
        description: 'ele recebeu o contexto do vídeo — é só continuar no Claude.',
      })
      window.setTimeout(() => setPhase('closing'), 900)
    })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send()
  }

  // When the exit animation finishes (or immediately under reduced-motion, where the
  // animation is suppressed and onAnimationEnd never fires), unmount + return focus.
  const onPopAnimEnd = () => {
    if (phase === 'closing') close()
  }

  const pop =
    open && anchor && typeof document !== 'undefined'
      ? createPortal(
          <div
            className={'cw-pop' + (phase === 'closing' ? ' is-closing' : '')}
            id={popId}
            ref={popRef}
            style={{ position: 'fixed', top: anchor.top, bottom: anchor.bottom, right: anchor.right }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headId}
            aria-describedby={subId}
            onAnimationEnd={onPopAnimEnd}
          >
            <h2 className="cw-head" id={headId}>
              <span className="cw-ico"><SparklesGlyph size={14} /></span>
              <span className="cw-kick">manda pro</span> <span className="cw-name">Cowork</span>
            </h2>
            <div className="cw-sub" id={subId}>
              ele escreve direto na pipeline — pede o ajuste e ele mexe na ideia, no roteiro, no pós e na publicação.
            </div>
            {prompts.length > 0 && (
              <div className="cw-quick">
                {prompts.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    className="cw-chip"
                    style={{ '--i': i } as React.CSSProperties}
                    onClick={() => send(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            <textarea
              className="cw-input"
              value={txt}
              onChange={(e) => setTxt(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={CW_PLACEHOLDER[stage]}
              aria-label="Mensagem para o Cowork"
              rows={3}
              autoFocus
            />
            <div className="cw-foot">
              <span className="cw-kbd" aria-hidden="true">⌘↵</span>
              <button
                type="button"
                className={'cw-send' + (phase === 'sent' || phase === 'closing' ? ' is-sent' : '')}
                onClick={() => send()}
                disabled={!txt.trim() || phase !== 'idle'}
              >
                {phase === 'sending' ? (
                  <><SparklesGlyph size={13} /> mandando…</>
                ) : phase === 'sent' || phase === 'closing' ? (
                  <><SparklesGlyph size={13} /> enviado</>
                ) : (
                  <><ArrowRight size={13} /> mandar</>
                )}
              </button>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className="cw-wrap">
      <button
        ref={btnRef}
        type="button"
        className={'cw-btn' + (compact ? ' compact' : '') + (open ? ' on' : '')}
        onClick={() => setOpen((o) => !o)}
        title="Pedir ao Cowork"
        aria-haspopup="dialog"
        aria-controls={open ? popId : undefined}
        aria-expanded={open}
      >
        <SparklesGlyph size={14} /> {label}
      </button>
      {pop}
    </div>
  )
}
