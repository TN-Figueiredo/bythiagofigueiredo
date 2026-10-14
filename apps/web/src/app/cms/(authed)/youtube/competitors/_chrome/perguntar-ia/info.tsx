'use client'
// A5 · E17 degrau 1, Tarefa 10: o ⓘ do diálogo (painel dentro do próprio <dialog>, que está na camada de cima) e os ícones de traço do mockup 22.
import type { ReactNode } from 'react'
import * as F from './frases-do-dialogo'

const Svg = ({ children, className }: { children: ReactNode; className?: string }) => (
  <svg className={`i ${className ?? ''}`.trim()} viewBox="0 0 16 16" aria-hidden="true" focusable="false">{children}</svg>
)

export const Icones = {
  ia: () => <Svg><path d="M2.4 3.2h11.2v7.4H8.8L5.4 13.4v-2.8H2.4Z" /><path d="M8 4.9v3.8M6.1 6.8h3.8" /></Svg>,
  ok: () => <Svg><path d="M3 8.4 6.4 12 13 4.6" /></Svg>,
  corte: () => <Svg><circle cx="4.2" cy="12" r="1.7" /><circle cx="11.8" cy="12" r="1.7" /><path d="M5.4 10.7 12.6 2.8M10.6 10.7 3.4 2.8" /></Svg>,
  cadeado: () => <Svg><rect x="3.4" y="7" width="9.2" height="6.6" rx="1.4" /><path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" /></Svg>,
  nunca: () => <Svg><path d="M8 2 13 3.9v3.9c0 2.7-2 4.6-5 6-3-1.4-5-3.3-5-6V3.9Z" /><path d="M5.8 8.2h4.4" /></Svg>,
  nao: () => <Svg><circle cx="8" cy="8" r="5.6" strokeDasharray="1.7 2.2" /></Svg>,
  aviso: () => <Svg><path d="M8 2.2 14.4 13.4H1.6Z" /><path d="M8 6.6v3.2M8 11.5v.1" /></Svg>,
  x: () => <Svg><path d="M4 4l8 8M12 4l-8 8" /></Svg>,
  baixar: () => <Svg><path d="M8 2.6v7.2M4.8 7 8 10.2 11.2 7M3 13h10" /></Svg>,
  copiar: () => <Svg><rect x="5.4" y="5.4" width="8" height="8.2" rx="1.4" /><path d="M10.6 5.4V3.6a1.2 1.2 0 0 0-1.2-1.2H4.2A1.2 1.2 0 0 0 3 3.6v6.2a1.2 1.2 0 0 0 1.2 1.2h1.2" /></Svg>,
  info: () => <Svg><circle cx="8" cy="8" r="5.8" /><path d="M8 7.2v3.6M8 5v.1" /></Svg>,
}

export type InfoId = 'metodo' | 'tamanho' | 'numeros'
export type ConteudoDoInfo = { readonly titulo: string; readonly itens: readonly (readonly [string, string])[] }
export const INFOS: Record<InfoId, ConteudoDoInfo> = { metodo: F.INFO_METODO, tamanho: F.INFO_TAMANHO, numeros: F.INFO_NUMEROS }

/** O botão ⓘ; o painel é desenhado por `PainelDoInfo`, que o diálogo põe dentro de si. */
export function BotaoInfo({ id, aberto, onAlternar }: { id: InfoId; aberto: boolean; onAlternar: (id: InfoId) => void }) {
  return (
    <button type="button" className="ibtn pi-ibtn" aria-expanded={aberto} aria-controls={`pi-i-${id}`} aria-label={INFOS[id].titulo} data-info={id} onClick={() => onAlternar(id)}>
      <Icones.info />
    </button>
  )
}

export function PainelDoInfo({ id }: { id: InfoId }) {
  const c = INFOS[id]
  return (
    <div className="pi-pop" id={`pi-i-${id}`} role="note" aria-label={c.titulo} data-de={id}>
      <h3>{c.titulo}</h3>
      <ul>{c.itens.map(([a, b]) => <li key={a}><b>{a}</b>{b}</li>)}</ul>
    </div>
  )
}
