// Ícones da lista (F3 T5), do mockup M3. Decorativos: aria-hidden.
import type { ReactElement } from 'react'

const sv = (w: number, d: ReactElement, vb = w): ReactElement => <svg width={w} height={w} viewBox={`0 0 ${vb} ${vb}`} aria-hidden="true">{d}</svg>
const tr = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const Ic = {
  ok: (w = 14) => sv(w, <path d="M2.5 7.5l3 3 6-7" {...tr} strokeWidth={2} />, 14),
  warn: (w = 14) => sv(w, <><path d="M7 1.8l5.6 10H1.4z" {...tr} strokeWidth={1.5} /><path d="M7 5.6v3M7 10.2v.1" {...tr} strokeWidth={1.6} /></>, 14),
  ext: () => sv(14, <path d="M8 2h4v4M12 2L6.5 7.5M10.5 8.5V12H2V3.5h3.5" {...tr} strokeWidth={1.5} />),
  late: () => sv(14, <path d="M3.5 1.5h7M3.5 12.5h7M4 1.5c0 3 3 3.5 3 5.5S4 10.5 4 12.5M10 1.5c0 3-3 3.5-3 5.5s3 3.5 3 5.5" {...tr} strokeWidth={1.4} />),
  pin: () => sv(14, <><path d="M5.5 13s-4-4.2-4-7.2a4 4 0 018 0c0 3-4 7.2-4 7.2z" {...tr} strokeWidth={1.4} /><circle cx={5.5} cy={5.8} r={1.4} fill="currentColor" /><path d="M9.5 4.5l3-3M10 1.5h2.5V4" {...tr} strokeWidth={1.4} /></>),
  flame: () => sv(14, <path d="M7 13c-2.6 0-4.3-1.8-4.3-4.2 0-2.6 2.2-3.8 2.6-6.3 1.6.9 2.4 2.4 2.3 3.9.6-.4 1-1.1 1.1-1.9 1.4 1.1 2.6 2.6 2.6 4.4C11.3 11.2 9.6 13 7 13z" {...tr} strokeWidth={1.4} />),
  dots: () => sv(18, <><circle cx={4} cy={9} r={1.6} fill="currentColor" /><circle cx={9} cy={9} r={1.6} fill="currentColor" /><circle cx={14} cy={9} r={1.6} fill="currentColor" /></>),
  calm: () => sv(18, <circle cx={9} cy={9} r={5.5} {...tr} strokeWidth={1.6} />),
  wait: (w = 18) => sv(w, <><circle cx={9} cy={9} r={6.5} {...tr} strokeWidth={1.6} /><path d="M9 5v4.2l2.8 1.8" {...tr} strokeWidth={1.6} /></>, 18),
  q: () => sv(18, <><circle cx={7} cy={7} r={5.5} {...tr} strokeWidth={1.5} /><path d="M5.3 5.5c0-1 .8-1.6 1.7-1.6s1.7.6 1.7 1.5c0 1.2-1.7 1.2-1.7 2.4M7 10v.1" {...tr} strokeWidth={1.5} /></>, 14),
  chev: () => sv(16, <path d="M3.5 6l4.5 4.5L12.5 6" {...tr} strokeWidth={1.8} />),
  vid: () => sv(14, <><rect x={1.5} y={3} width={11} height={8} rx={2} {...tr} strokeWidth={1.4} /><path d="M6 5.5v3l2.6-1.5z" fill="currentColor" /></>),
}
