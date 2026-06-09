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
}

/** Context prompts per stage (CW_PROMPTS in views-video.jsx ~39-44). */
const CW_PROMPTS: Record<VideoStage, string[]> = {
  ideia: ['Gerar 3 novas direções', 'Qual é o gancho mais forte?', 'Sugerir ângulos (A1–A5)'],
  roteiro: ['Encurtar mantendo os beats', 'Reforçar o hook', 'Sugerir b-roll por beat', 'Marcar ênfases'],
  pos: ['Gerar instruções de edição', 'Que b-roll ainda falta?', 'Revisar CTAs/QR por idioma'],
  publicacao: ['Gerar 4 títulos testáveis', 'Brief das 4 thumbnails', 'Sugerir distribuição'],
}

/** Per-stage textarea placeholder — phrased as if you're talking to a sharp collaborator. */
const CW_PLACEHOLDER: Record<VideoStage, string> = {
  ideia: 'ex.: e se o gancho fosse mais incômodo? me dá 3 caminhos…',
  roteiro: 'ex.: corta 15s no meio sem perder o beat do CTA…',
  pos: 'ex.: o ritmo tá arrastado depois do hook — sugere cortes…',
  publicacao: 'ex.: títulos menos óbvios, mais curiosidade que promessa…',
}

export interface CoworkButtonProps {
  stage: VideoStage
  label?: string
  compact?: boolean
}

/**
 * Inline Cowork trigger with a portaled, fixed-position popover anchored under the
 * button. Closes on Esc + outside-click; ⌘/Ctrl+Enter sends. On send it opens Claude
 * (Cowork) with the video/section context as a deep-link, toasts confirmation, then
 * clears + closes + returns focus to the trigger.
 */
export function CoworkButton({ stage, label = 'Cowork', compact }: CoworkButtonProps) {
  const editor = useVideoEditorState()
  const [open, setOpen] = useState(false)
  const [txt, setTxt] = useState('')
  const [sending, setSending] = useState(false)
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const popId = useId()

  // Every close path returns focus to the trigger so keyboard/SR users aren't dropped.
  const close = () => {
    setOpen(false)
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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const reposition = () => {
      if (!btnRef.current) return
      const r = btnRef.current.getBoundingClientRect()
      setAnchor({ top: r.bottom + 9, right: Math.max(12, window.innerWidth - r.right) })
    }
    reposition()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
    // `close` is stable enough for our purposes; re-running only on `open` keeps listeners fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const prompts = CW_PROMPTS[stage] ?? []

  const send = (t?: string) => {
    const m = (t ?? txt).trim()
    if (!m || sending) return
    setSending(true)
    // Open Claude (Cowork) with the message + the video/section context so it knows
    // exactly which item/section to act on via the pipeline API.
    const lang = editor.activeLang
    const head = `[Vídeo ${editor.code} · ${STAGE_LABEL[stage]} · ${lang.toUpperCase()} · item ${editor.itemId}]`
    const hint = STAGE_TARGET_HINT[stage]?.(editor.itemId, lang)
    const ctx = hint ? `${head}\n${hint}` : head
    openCowork(`${ctx}\n\n${m}`)
    toast.success('Aberto no Claude', { description: 'Cowork recebeu o contexto do vídeo.' })
    window.setTimeout(() => {
      setSending(false)
      setTxt('')
      close()
    }, 420)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send()
  }

  const pop =
    open && anchor && typeof document !== 'undefined'
      ? createPortal(
          <div className="cw-pop" id={popId} ref={popRef} style={{ position: 'fixed', top: anchor.top, right: anchor.right }} role="dialog" aria-label="Cowork">
            <div className="cw-head">
              <span className="cw-ico"><SparklesGlyph size={14} /></span> manda pro <span className="cw-name">Cowork</span>
            </div>
            <div className="cw-sub">ele mexe na ideia, no roteiro, no pós e na publicação — pede um ajuste e ele escreve direto na pipeline.</div>
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
              <span className="cw-kbd" aria-hidden="true">⌘ + ↵</span>
              <button type="button" className="cw-send" onClick={() => send()} disabled={!txt.trim() || sending}>
                {sending ? (
                  <><SparklesGlyph size={13} /> mandando…</>
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
        aria-controls={popId}
        aria-expanded={open}
      >
        <SparklesGlyph size={14} /> {label}
      </button>
      {pop}
    </div>
  )
}
