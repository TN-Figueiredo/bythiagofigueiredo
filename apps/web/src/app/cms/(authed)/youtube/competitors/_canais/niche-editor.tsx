'use client'
/**
 * Niche of each competitor: the per-row select (canais.html nicheSel) and the "Definir nicho dos canais" editor,
 * opened by ?nicheEditor=1 (the chrome's menu item links there). Both call setChannelNiche through the screen.
 */
import { useRef, type KeyboardEvent } from 'react'
import type { Niche } from '@/lib/youtube/observatorio/types'
import type { CanaisRow } from './view-model'

export function NicheSelect({ id, name, niche, ctx, onChange }: { id: string; name: string; niche: Niche | null; ctx: string; onChange: (n: Niche) => void }) {
  return (
    <select
      className={'niche ' + (niche ?? '')} name={`niche-${id}-${ctx}`} aria-label={`Nicho de ${name}`} data-niche={id} data-ctx={ctx}
      value={niche ?? ''} onChange={e => { const v = e.target.value; if (v === 'viagem' || v === 'ia') onChange(v) }}
    >
      {niche == null ? <option value="" disabled>Sem nicho</option> : null}
      <option value="viagem">Viagem</option>
      <option value="ia">IA</option>
    </select>
  )
}

export function NicheEditorDialog({ rows, onNiche, onClose, trap }: {
  rows: CanaisRow[]; onNiche: (r: CanaisRow, n: Niche) => void; onClose: () => void; trap: (e: KeyboardEvent<HTMLElement>) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  return (
    <div className="modal on" role="dialog" aria-modal="true" aria-labelledby="cn-ne-t" onKeyDown={trap}>
      <div className="box" ref={box} style={{ width: 'min(520px,100%)' }}>
        <h4 id="cn-ne-t">Definir nicho dos canais</h4>
        <p>O nicho decide em que grupo o canal aparece e com quem ele é comparado. Seu canal não tem nicho aqui.</p>
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
