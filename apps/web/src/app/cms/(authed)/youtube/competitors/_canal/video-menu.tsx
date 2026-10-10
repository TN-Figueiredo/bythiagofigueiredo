'use client'
/**
 * Menu "Ações do vídeo" (⋯) de um vídeo da página do canal (spec 5.4): padrão menu button, aberto em #flut. No topo, as notas do
 * vídeo (a base do múltiplo e o motivo de cada "não medido"); depois "Fixar"/"Desafixar", "Ampliar thumbnail", "Abrir no YouTube" e
 * "Ver trocas". A Lista (Tarefa 6) usa o mesmo componente. Fixar passa pelo PinProvider da tela: a resposta e o limite aparecem em
 * <PinMessages>. Nenhuma flutuante é filha do cartão.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Popover } from '../_chrome/flut/flut'
import { Icon } from '../_chrome/icons'
import { PinMessage, usePinControl } from '../_chrome/pin-kit'
import type { ChannelVideoView } from './videos-model'

/** A chave da mensagem de fixar deste vídeo no PinProvider. */
const pinKey = (id: string) => 'canal-' + id

function Itens({ v, onAmpliar, onTrocas, onPin, pinLabel, pinBusy }: {
  v: ChannelVideoView; onAmpliar: () => void; onTrocas: () => void; onPin: (() => void) | null; pinLabel: string; pinBusy: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  // o primeiro item recebe o foco ao abrir (padrão menu button)
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true }) }, [])
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    const i = items.indexOf(document.activeElement as HTMLElement)
    const go = (j: number) => { e.preventDefault(); items[(j + items.length) % items.length]?.focus() }
    if (e.key === 'ArrowDown') go(i + 1)
    else if (e.key === 'ArrowUp') go(i - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(items.length - 1)
    // Tab / Shift+Tab: a camada flutuante costura o menu de volta ao botão ⋯ (flut/store.ts)
  }
  const trocas = v.swaps > 0
  return (
    <div ref={ref} onKeyDown={onKey}>
      {v.notas.length ? (
        <div className="det" role="group" aria-label="Sobre este vídeo">{v.notas.map((n, i) => <p key={i}>{n}</p>)}</div>
      ) : null}
      {onPin ? <button type="button" role="menuitem" tabIndex={-1} aria-disabled={pinBusy ? true : undefined} onClick={onPin}>{pinLabel}</button> : null}
      <button type="button" role="menuitem" tabIndex={-1} aria-disabled={v.thumbSrc ? undefined : true} onClick={() => { if (v.thumbSrc) onAmpliar() }}>Ampliar thumbnail</button>
      <a role="menuitem" tabIndex={-1} href={v.url} target="_blank" rel="noopener noreferrer">Abrir no YouTube<span className="obs-ch-sr"> (abre em nova aba)</span></a>
      <button type="button" role="menuitem" tabIndex={-1} aria-disabled={trocas ? undefined : true} onClick={() => { if (trocas) onTrocas() }}>
        <span>Ver trocas</span><small>{trocas ? `${v.swaps} em 30 d` : 'nenhuma em 30 d'}</small>
      </button>
    </div>
  )
}

export function VideoMenu({ v, onAmpliar, onTrocas }: { v: ChannelVideoView; onAmpliar: (v: ChannelVideoView) => void; onTrocas: (v: ChannelVideoView) => void }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const id = 'cv-menu-' + useId().replace(/:/g, '')
  const pc = usePinControl()
  const pin = v.pin
  const fechar = () => { setOpen(false); btn.current?.focus({ preventScroll: true }) }
  return (
    <>
      <button ref={btn} type="button" className="cv-abtn" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={'Ações do vídeo: ' + v.title}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true) } }}>
        {Icon.dots()}
      </button>
      <Popover open={open} anchor={() => btn.current} onClose={() => setOpen(false)} id={id} role="menu" label={'Ações do vídeo: ' + v.title} className="canal-menu" pref="baixo" align="fim" gap={4} maxW={300}>
        <Itens v={v} pinLabel={pin && pc?.pinned(pin) ? 'Desafixar' : 'Fixar'} pinBusy={pin ? !!pc?.busy(pin.videoId) : false}
          onPin={pin && pc ? () => { fechar(); pc.run(pin, pinKey(v.id)) } : null}
          onAmpliar={() => { fechar(); onAmpliar(v) }}
          onTrocas={() => { setOpen(false); onTrocas(v) }} />
      </Popover>
    </>
  )
}

/** As respostas do "Fixar" (o limite, a falha), perto da grade: o cartão não muda de altura. */
export function PinMessages() {
  const pc = usePinControl()
  if (!pc || !pc.msgKeys.length) return null
  return <div className="cv-pinmsgs">{pc.msgKeys.map(k => <PinMessage key={k} k={k} />)}</div>
}
