/** Manutenção M5, T11: as formas do aviso do banco (puro SVG; o texto está sempre ao lado, cor nunca é o único sinal). */
import type { ReactElement } from 'react'
import { DESENHO_DA_FORMA } from '../formas-arquivo'
import type { Forma } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'

const P: Partial<Record<Forma, ReactElement>> = {
  ...DESENHO_DA_FORMA,
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
