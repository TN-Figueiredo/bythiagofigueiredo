'use client'
/**
 * Niche of a channel: the per-row select (canais.html nicheSel), also on the own channels, and the "Definir nicho dos
 * canais" editor (competitors only), opened by ?nicheEditor=1 (the chrome's menu item links there). The screen picks
 * the server action: setChannelNiche for a competitor, setOwnChannelNiche for an own channel.
 */
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { Niche } from '@/lib/youtube/observatorio/types'
import { BUILTIN_NICHES } from '@/lib/youtube/observatorio/niche'
import type { NicheOption, NicheVars } from './view-model'

/** Niche picked and not yet confirmed by the server data, per channel id (the screen owns it). `busy`: the action is still running. */
export type NichePending = Record<string, { niche: Niche; busy: boolean }>
export const NichePendingContext = createContext<NichePending>({})
/**
 * The site's niches, in the tab order (view.niches): the options of every NicheSelect. The screen provides them once;
 * without a provider (a select drawn alone) the two built-in niches stand, as before niches became data.
 */
export const NicheOptionsContext = createContext<readonly NicheOption[]>(BUILTIN_NICHES.map(n => ({ id: n.id, label: n.label, color: null })))
/** The colour of a niche the owner created, as CSS variables (the same pair the chrome's niche bar uses, plus the fills). */
export const nicheStyle = (c: NicheVars): CSSProperties => ({ ['--obs-sw-dark' as string]: c.dark, ['--obs-sw-light' as string]: c.light, ['--obs-sw-dark-subtle' as string]: c.darkSubtle, ['--obs-sw-light-subtle' as string]: c.lightSubtle })

export function NicheSelect({ id, name, niche, ctx, onChange }: { id: string; name: string; niche: Niche | null; ctx: string; onChange: (n: Niche) => void }) {
  const pending = useContext(NichePendingContext)[id]
  const options = useContext(NicheOptionsContext)
  const shown = pending?.niche ?? niche
  const cur = shown == null ? undefined : options.find(o => o.id === shown)
  // .niche.viagem / .niche.ia keep their own classes; a niche the owner created takes .custom and its colour by variable
  return (
    <select
      className={'niche ' + (shown == null ? 'none' : cur?.color ? 'custom' : shown)} style={cur?.color ? nicheStyle(cur.color) : undefined} aria-busy={pending?.busy || undefined} name={`niche-${id}-${ctx}`} aria-label={`Nicho de ${name}${niche ? '' : ': sem nicho, escolha um'}`} data-niche={id} data-ctx={ctx}
      value={shown ?? ''} onChange={e => { const v = e.target.value; if (options.some(o => o.id === v)) onChange(v) }}
    >
      {niche == null ? <option value="" disabled>Escolher nicho</option> : null}
      {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  )
}

type NicheRow = { id: string; name: string; niche: Niche | null }
/** Where the focus goes back: what had it when the dialog opened, else the chrome's menu ⋯ (its usual opener). */
const opener = (): HTMLElement | null => {
  const a = typeof document === 'undefined' ? null : document.activeElement
  // on the server there is no document and no HTMLElement: `null instanceof HTMLElement` would throw a ReferenceError
  return a != null && a instanceof HTMLElement && a !== document.body && a.isConnected ? a : null
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
