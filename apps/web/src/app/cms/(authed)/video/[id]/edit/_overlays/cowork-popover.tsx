'use client'

import { useEffect, useRef, useState } from 'react'

export type CoworkStage = 'ideia' | 'roteiro' | 'pos' | 'publicacao'

const CW_PROMPTS: Record<CoworkStage, string[]> = {
  ideia: ['Gere 3 ângulos alternativos', 'Reescreve a logline mais forte', 'Sugira títulos de trabalho'],
  roteiro: ['Aperta o gancho dos 10s', 'Adiciona um beat de payoff', 'Marca os momentos-chave'],
  pos: ['Resume o brief pro editor', 'Lista o b-roll por beat', 'Sugere música/energia'],
  publicacao: ['Sugerir títulos com Cowork', 'Varia o título C mais curioso', 'Brief de thumbnail por variante'],
}

export interface CoworkPopoverProps {
  stage: CoworkStage
  /** Submits the prompt through the batch section update / Cowork API path (source:'cowork',
      format-aware getSectionKey → video writes land on ideia_<lang>/publish_<lang>, §7). */
  onSubmit: (prompt: string) => Promise<void>
  onClose: () => void
}

export function CoworkPopover({ stage, onSubmit, onClose }: CoworkPopoverProps) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { ref.current?.focus() }, [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit() {
    const p = value.trim()
    if (!p) return
    await onSubmit(p)
    setValue('')
  }

  return (
    <div className="cowork-popover" role="dialog" aria-label="Cowork" style={{ position: 'fixed', zIndex: 400 }}>
      <div className="cw-chips">
        {CW_PROMPTS[stage].map(c => (
          <button key={c} type="button" className="cw-chip" onClick={() => setValue(c)}>{c}</button>
        ))}
      </div>
      <textarea
        ref={ref} className="cw-input" value={value} onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void submit() } }}
        placeholder="Peça ao Cowork…"
      />
      <button type="button" className="cw-send" disabled={!value.trim()} onClick={() => void submit()}>Enviar</button>
    </div>
  )
}
