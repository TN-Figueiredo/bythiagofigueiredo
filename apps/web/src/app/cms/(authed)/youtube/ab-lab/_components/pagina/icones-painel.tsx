// Ícones do painel de escolha (mockup M7b r4, símbolos `i-*`). Todos decorativos: o sentido vai no texto.
import type { ReactElement } from 'react'

const CAMINHOS = {
  ok: <path d="M3 8.5l3.2 3L13 4.5" />,
  dot: <circle cx="8" cy="8" r="5.2" fill="currentColor" stroke="none" />,
  x: <><circle cx="8" cy="8" r="6" /><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" /></>,
  info: <><circle cx="8" cy="8" r="6" /><path d="M8 7.2v3.6M8 5.2v.1" /></>,
  star: <path d="M8 2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.2 4.4 13.1l.7-4L2.2 6.3l4-.6z" />,
  user: <><circle cx="8" cy="5.5" r="2.6" /><path d="M3 13.5c.6-2.6 2.6-3.8 5-3.8s4.4 1.2 5 3.8" /></>,
  arrow: <path d="M3 8h10M9 4l4 4-4 4" />,
  tri: <><circle cx="8" cy="8" r="6" /><path d="M8 5v3.6M8 10.8v.1" /></>,
  img: <><rect x="2" y="3" width="12" height="10" rx="1.6" /><path d="M2.6 11l3-3 2.2 2.2M9.4 9.2l1.4-1.4 2.6 2.6M11 5.8v.1" /><path d="M13.6 2.4l-11 11" /></>,
  clock: <><circle cx="8" cy="8" r="6" /><path d="M8 4.8V8l2.2 1.4" /></>,
  off: <><circle cx="8" cy="8" r="6" /><path d="M3.8 12.2l8.4-8.4" /></>,
  chev: <path d="M6 3l5 5-5 5" />,
  spin: <path d="M8 2a6 6 0 1 0 6 6" />,
  lock: <><rect x="3.4" y="7" width="9.2" height="6.4" rx="1.4" /><path d="M5.4 7V5.4a2.6 2.6 0 0 1 5.2 0V7" /></>,
} as const

export type NomeIcone = keyof typeof CAMINHOS

export function Ic({ n, girar = false }: { n: NomeIcone; girar?: boolean }): ReactElement {
  return (
    <svg className={`pe-ic${girar ? ' pe-spin' : ''}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false">{CAMINHOS[n]}</svg>
  )
}
