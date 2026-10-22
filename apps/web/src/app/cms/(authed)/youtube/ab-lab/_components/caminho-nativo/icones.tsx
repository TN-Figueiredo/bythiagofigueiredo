import type { ReactElement } from 'react'

export type NomeIcone =
  | 'lab' | 'yt' | 'dot' | 'pause' | 'q' | 'ok' | 'dash' | 'pen' | 'neq' | 'warn'
  | 'ext' | 'bell' | 'copy' | 'down' | 'x' | 'late' | 'back'

const COMUM = { fill: 'none', stroke: 'currentColor' } as const

/** Ícones do mockup M2 (index.html:315-340). Sempre decorativos: o texto ao lado diz o significado. */
export function Icone({ nome }: { nome: NomeIcone }): ReactElement {
  const p = { width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': true as const, focusable: false as const }
  switch (nome) {
    case 'lab': return <svg {...p}><path d="M5 1h4M6 1v4L2 12h10L8 5V1" {...COMUM} strokeWidth="1.5" strokeLinejoin="round" /></svg>
    case 'yt': return <svg {...p}><rect x="1.5" y="3" width="11" height="8" rx="2" {...COMUM} strokeWidth="1.5" strokeDasharray="3 2" /><path d="M6 5.5v3l2.6-1.5z" fill="currentColor" /></svg>
    case 'dot': return <svg {...p}><circle cx="7" cy="7" r="4.5" fill="currentColor" /></svg>
    case 'pause': return <svg {...p}><rect x="3" y="2.5" width="2.6" height="9" rx=".8" fill="currentColor" /><rect x="8.4" y="2.5" width="2.6" height="9" rx=".8" fill="currentColor" /></svg>
    case 'q': return <svg {...p}><circle cx="7" cy="7" r="5.5" {...COMUM} strokeWidth="1.5" /><path d="M5.3 5.5c0-1 .8-1.6 1.7-1.6s1.7.6 1.7 1.5c0 1.2-1.7 1.2-1.7 2.4M7 10v.1" {...COMUM} strokeWidth="1.5" strokeLinecap="round" /></svg>
    case 'ok': return <svg {...p}><path d="M2.5 7.5l3 3 6-7" {...COMUM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'dash': return <svg {...p}><path d="M3 7h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    case 'pen': return <svg {...p}><path d="M2 12l.6-2.8L9.5 2.3l2.2 2.2-6.9 6.9z" {...COMUM} strokeWidth="1.4" strokeLinejoin="round" /></svg>
    case 'neq': return <svg {...p}><path d="M2.5 5.5h9M2.5 8.5h9M9 2.5l-4 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    case 'warn': return <svg {...p}><path d="M7 1.8l5.6 10H1.4z" {...COMUM} strokeWidth="1.5" strokeLinejoin="round" /><path d="M7 5.6v3M7 10.2v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
    case 'ext': return <svg {...p}><path d="M8 2h4v4M12 2L6.5 7.5M10.5 8.5V12H2V3.5h3.5" {...COMUM} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'bell': return <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 11V7a4 4 0 018 0v4l1.2 1.5H2.8zM6.5 14a1.6 1.6 0 003 0" {...COMUM} strokeWidth="1.5" strokeLinejoin="round" /></svg>
    case 'copy': return <svg {...p}><rect x="4.5" y="4.5" width="7.5" height="7.5" rx="1.2" {...COMUM} strokeWidth="1.4" /><path d="M9.5 2H3a1 1 0 00-1 1v6.5" {...COMUM} strokeWidth="1.4" /></svg>
    case 'down': return <svg {...p}><path d="M7 2v7M4 6.5L7 9.5l3-3M2.5 12h9" {...COMUM} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'x': return <svg {...p}><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    case 'late': return <svg {...p}><path d="M3.5 1.5h7M3.5 12.5h7M4 1.5c0 3 3 3.5 3 5.5S4 10.5 4 12.5M10 1.5c0 3-3 3.5-3 5.5s3 3.5 3 5.5" {...COMUM} strokeWidth="1.4" strokeLinecap="round" /></svg>
    case 'back': return <svg {...p}><path d="M8.5 3L4.5 7l4 4" {...COMUM} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  }
}
