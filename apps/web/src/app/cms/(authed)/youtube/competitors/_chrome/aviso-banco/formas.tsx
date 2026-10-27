/** Manutenção M5, T11: as formas do aviso do banco (puro SVG; o texto está sempre ao lado, cor nunca é o único sinal). */
import type { ReactElement } from 'react'
import type { Forma } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'

const P: Partial<Record<Forma, ReactElement>> = {
  visto: <><circle cx="8" cy="8" r="6.2" /><path d="M5.2 8.3 7.2 10.3 10.9 6" /></>,
  triangulo: <><path d="M8 2.2 14.4 13.4H1.6Z" /><path d="M8 6.6v3.2M8 11.5v.1" /></>,
  octogono: <><path d="M5.2 1.8h5.6l3.4 3.4v5.6l-3.4 3.4H5.2L1.8 10.8V5.2z" /><path d="M8 4.8v3.8M8 11v.1" /></>,
  pontilhado: <circle cx="8" cy="8" r="6.2" strokeDasharray="2.4 2.2" />,
  arquivo: <><rect x="2" y="3" width="12" height="3.5" rx="1" /><path d="M3 6.5V13h10V6.5M6.5 9.5h3" /></>,
  hachura: <><rect x="2" y="2" width="12" height="12" rx="2" /><path d="M2.5 9.5 9.5 2.5M2.5 13.5l11-11M6.5 13.5l7-7" /></>,
}
export function FormaBl({ forma }: { forma: Forma }): ReactElement {
  return (
    <svg className={`bl-ic bl-f-${forma}`} viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[forma] ?? P.pontilhado}
    </svg>
  )
}
