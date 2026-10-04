'use client'
/** "Adicionar canal" dialog (port of canais.html #addDlg / openAdd / addForm.onsubmit). The action does the rest. */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Niche } from '@/lib/youtube/observatorio/types'
import type { CanaisView } from './view-model'
import { parseChannelInput } from './channel-input'
import { Ic } from './cells'

export interface AddInput { channel: string; niche: Niche; videoLimit: number }
export type AddFn = (input: AddInput) => Promise<{ ok: boolean; error?: string; title?: string }>
/** Up to this many niches the dialog offers buttons; above it, a select. */
const ADD_NICHE_BUTTONS = 3


export function AddChannelForm({ view, onAdd, onClose, onAdded, trap }: {
  view: CanaisView; onAdd: AddFn; onClose: () => void; onAdded: (input: AddInput, title?: string) => void; trap: (e: KeyboardEvent<HTMLElement>) => void
}) {
  const [h, setH] = useState('')
  const [lim, setLim] = useState(String(view.add.defaultLimit))
  const [niche, setNiche] = useState<Niche>(view.add.defaultNiche)
  const [hErr, setHErr] = useState('')
  const [limErr, setLimErr] = useState('')
  const [busy, setBusy] = useState(false)
  const hRef = useRef<HTMLInputElement>(null), limRef = useRef<HTMLInputElement>(null)
  const full = view.slots.free === 0
  useEffect(() => { hRef.current?.focus() }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (full) { setHErr('Sem vagas: remova um canal para adicionar outro.'); return }
    const v = h.trim(), n = Number(lim)
    if (!parseChannelInput(v)) { setHErr('Use o @handle (ex.: @LukeDamant) ou a URL do canal (youtube.com/@…).'); hRef.current?.focus(); return }
    if (!(n >= 10 && n <= view.add.limitMax)) { setLimErr(`Escolha entre 10 e ${view.add.limitMax} vídeos.`); limRef.current?.focus(); return }
    setBusy(true)
    try {
      const input = { channel: v, niche, videoLimit: n }
      const res = await onAdd(input)
      if (res.ok) onAdded(input, res.title)
      else { setHErr(res.error ?? 'Não deu para adicionar o canal.'); hRef.current?.focus() }
    } catch {
      // the action did not answer (network, timeout): the channel may or may not have been added
      setHErr('O servidor não respondeu. Recarregue a página para ver se o canal entrou antes de tentar de novo.'); hRef.current?.focus()
    } finally { setBusy(false) }
  }

  return (
    <div className="modal on" role="dialog" aria-modal="true" aria-labelledby="cn-addT" onKeyDown={trap}>
      <form className="box" noValidate onSubmit={submit}>
        <h4 id="cn-addT">Adicionar canal</h4>
        <p>{view.add.cap}</p>
        <label className="fld"><span>Canal do YouTube</span>
          <input ref={hRef} name="addH" type="text" placeholder="@handle ou URL do canal" autoComplete="off" value={h}
            aria-invalid={hErr ? true : undefined} aria-describedby="cn-addHErr" aria-errormessage="cn-addHErr"
            onChange={e => { setH(e.target.value); setHErr('') }} />
        </label>
        <span className="err" id="cn-addHErr" role="alert">{hErr}</span>
        <div className="fld"><span id="cn-addNL">Nicho</span>
          {/* up to 3 niches, buttons (as always); from 4 on, a select, so the dialog keeps one line */}
          {view.add.niches.length <= ADD_NICHE_BUTTONS ? (
            <div className="seg" role="group" aria-labelledby="cn-addNL">
              {view.add.niches.map(o => <button key={o.id} type="button" aria-pressed={niche === o.id} onClick={() => setNiche(o.id)}>{o.label}</button>)}
            </div>
          ) : (
            <select className="sel" name="addNiche" aria-labelledby="cn-addNL" style={{ alignSelf: 'flex-start', minWidth: 180 }} value={niche}
              onChange={e => { const v = e.target.value; if (view.add.niches.some(o => o.id === v)) setNiche(v) }}>
              {view.add.niches.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          )}
        </div>
        <label className="fld"><span>Vídeos acompanhados</span>
          <input ref={limRef} name="addLim" type="number" min={10} max={view.add.limitMax} step={10} value={lim}
            aria-invalid={limErr ? true : undefined} aria-describedby="cn-addLimErr cn-addLimH" onChange={e => { setLim(e.target.value); setLimErr('') }} />
        </label>
        <span className="err" id="cn-addLimErr" role="alert">{limErr}</span>
        <span className="hint" id="cn-addLimH">Os vídeos mais recentes, até {view.add.limitMax}. Cada vídeo acompanhado ganha uma contagem diária de views.</span>
        <p className="hint">{view.add.when}</p>
        <div className="acts">
          <button type="button" className="btn" disabled={busy} onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={full || busy} aria-busy={busy || undefined}>{busy ? <><Ic n="spin" spin />Adicionando…</> : 'Adicionar canal'}</button>
        </div>
      </form>
    </div>
  )
}
