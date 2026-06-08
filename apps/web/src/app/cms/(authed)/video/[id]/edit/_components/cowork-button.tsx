'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { SparklesGlyph } from './sparkles-glyph'
import { toast } from 'sonner'
import type { VideoStage } from '../types'

/** Context prompts per stage (CW_PROMPTS in views-video.jsx ~39-44). */
const CW_PROMPTS: Record<VideoStage, string[]> = {
  ideia: ['Gerar 3 novas direções', 'Qual é o gancho mais forte?', 'Sugerir ângulos (A1–A5)'],
  roteiro: ['Encurtar mantendo os beats', 'Reforçar o hook', 'Sugerir b-roll por beat', 'Marcar palavras de ênfase'],
  pos: ['Gerar instruções de edição', 'B-roll que ainda falta', 'Revisar CTAs/QR por idioma'],
  publicacao: ['Gerar 4 títulos testáveis', 'Brief das 4 thumbnails', 'Sugerir distribuição'],
}

export interface CoworkButtonProps {
  stage: VideoStage
  label?: string
  compact?: boolean
  /**
   * Submit hook — defaults to a sonner toast (wire to the real Cowork batch path
   * later). Returns nothing; the popover closes + clears regardless.
   */
  onSubmit?: (prompt: string) => void
}

/**
 * Inline Cowork trigger with a portaled, fixed-position popover anchored under the
 * button. Closes on Esc + outside-click; ⌘/Ctrl+Enter submits. Mirrors `CoworkButton`
 * in design_handoff_video_module/views-video.jsx (~45-80).
 */
export function CoworkButton({ stage, label = 'Cowork', compact, onSubmit }: CoworkButtonProps) {
  const [open, setOpen] = useState(false)
  const [txt, setTxt] = useState('')
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (popRef.current && !popRef.current.contains(t) && btnRef.current && !btnRef.current.contains(t)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const reposition = () => {
      if (!btnRef.current) return
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 9, right: Math.max(12, window.innerWidth - r.right) })
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
  }, [open])

  const prompts = CW_PROMPTS[stage] ?? []
  const send = (t?: string) => {
    const m = (t ?? txt).trim()
    if (!m) return
    if (onSubmit) onSubmit(m)
    else toast.info('Pedido enviado ao Cowork', { description: m.slice(0, 64) })
    setTxt('')
    setOpen(false)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send()
  }

  const pop =
    open && pos && typeof document !== 'undefined'
      ? createPortal(
          <div className="cw-pop" ref={popRef} style={{ position: 'fixed', top: pos.top, right: pos.right }} role="dialog" aria-label="Cowork">
            <div className="cw-head"><span className="cw-ico"><SparklesGlyph size={13} /></span> Pedir ao Cowork</div>
            <div className="cw-sub">Ele edita ideia, roteiro, pós e publicação — peça uma alteração ou variação.</div>
            {prompts.length > 0 && (
              <div className="cw-quick">
                {prompts.map((p, i) => (
                  <button key={i} type="button" className="cw-chip" onClick={() => send(p)}>{p}</button>
                ))}
              </div>
            )}
            <textarea
              className="cw-input"
              value={txt}
              onChange={(e) => setTxt(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ex.: deixe o hook mais curto e provocativo…"
              rows={3}
              autoFocus
            />
            <div className="cw-foot">
              <span className="cw-kbd">⌘ + ↵</span>
              <button type="button" className="cw-send" onClick={() => send()} disabled={!txt.trim()}>
                <ArrowRight size={13} /> Enviar pro Cowork
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
        aria-expanded={open}
      >
        <SparklesGlyph size={14} /> {label}
      </button>
      {pop}
    </div>
  )
}
