'use client'
/**
 * Niche of a channel: the per-row select (canais.html nicheSel), also on the own channels, and the "Definir nicho dos
 * canais" editor (competitors only), opened by ?nicheEditor=1 (the chrome's menu item links there). The screen picks
 * the server action: setChannelNiche for a competitor, setOwnChannelNiche for an own channel.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Niche } from '@/lib/youtube/observatorio/types'

export function NicheSelect({ id, name, niche, ctx, onChange }: { id: string; name: string; niche: Niche | null; ctx: string; onChange: (n: Niche) => void }) {
  return (
    <select
      className={'niche ' + (niche ?? 'none')} name={`niche-${id}-${ctx}`} aria-label={`Nicho de ${name}${niche ? '' : ': sem nicho, escolha um'}`} data-niche={id} data-ctx={ctx}
      value={niche ?? ''} onChange={e => { const v = e.target.value; if (v === 'viagem' || v === 'ia') onChange(v) }}
    >
      {niche == null ? <option value="" disabled>Escolher nicho</option> : null}
      <option value="viagem">Viagem</option>
      <option value="ia">IA</option>
    </select>
  )
}

type NicheRow = { id: string; name: string; niche: Niche | null }
/** Where the focus goes back: what had it when the dialog opened, else the chrome's menu ⋯ (its usual opener). */
const opener = (): HTMLElement | null => {
  const a = typeof document === 'undefined' ? null : document.activeElement
  return a instanceof HTMLElement && a !== document.body && a.isConnected ? a : null
}
const chromeMenu = () => document.querySelector<HTMLElement>('[data-obs-chrome] button[aria-label="Mais ações"]')

export function NicheEditorDialog({ rows, onNiche, onClose, trap }: {
  rows: NicheRow[]; onNiche: (r: NicheRow, n: Niche) => void; onClose: () => void; trap: (e: KeyboardEvent<HTMLElement>) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  // read during the first render, before the dialog takes the focus
  const [back] = useState(opener)
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('select')?.focus()
    return () => { const t = back && back.isConnected ? back : chromeMenu(); t?.focus() }
  }, [back])
  return (
    <div className="modal on" role="dialog" aria-modal="true" aria-labelledby="cn-ne-t" onKeyDown={trap}>
      <div className="box" ref={box} style={{ width: 'min(520px,100%)' }}>
        <h4 id="cn-ne-t">Definir nicho dos canais</h4>
        <p>O nicho decide em que grupo o canal aparece e com quem ele é comparado.</p>
        <div style={{ display: 'grid', gap: 6, maxHeight: '55vh', overflowY: 'auto' }}>
          {rows.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
              <span>{r.name}</span>
              <NicheSelect id={r.id} name={r.name} niche={r.niche} ctx="editor" onChange={n => onNiche(r, n)} />
            </div>
          ))}
        </div>
        <div className="acts"><button type="button" className="btn" onClick={onClose}>Fechar</button></div>
      </div>
    </div>
  )
}
