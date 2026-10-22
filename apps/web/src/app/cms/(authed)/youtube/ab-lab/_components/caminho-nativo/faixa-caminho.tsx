'use client'
import type { ReactElement, ReactNode } from 'react'
import { Icone, type NomeIcone } from './icones'
import type { Faixa } from '../faixa-restauracao-texto'
import '../caminho-nativo.css'

export type TomFaixa = 'yt' | 'lab' | 'warn' | 'ok' | 'err' | 'neutra'

const ICONE: Record<TomFaixa, NomeIcone> = { yt: 'yt', lab: 'lab', warn: 'warn', ok: 'ok', err: 'x', neutra: 'dash' }

export function FaixaCaminho({ tom, titulo, children, acoes, role }: {
  tom: TomFaixa
  titulo: string
  children?: ReactNode
  acoes?: ReactNode
  role?: 'status' | 'alert' | 'region'
}): ReactElement {
  return (
    <div className={`cn-faixa ${tom === 'neutra' ? '' : tom}`} role={role} data-tom={tom}>
      <span className="cn-ic"><Icone nome={ICONE[tom]} /></span>
      <div>
        <h3>{titulo}</h3>
        {children ? <p>{children}</p> : null}
        {acoes ? <div className="cn-acts">{acoes}</div> : null}
      </div>
    </div>
  )
}

/**
 * Frases das faixas de restauração (restaurando, falhou, restaurada) vêm de `montarFaixa`
 * (`faixa-restauracao-texto.ts`), para a ficha e o painel do nosso teste não divergirem.
 */
export function propsDaFaixaRestauracao(f: Faixa): { tom: TomFaixa; titulo: string; texto: string } {
  if (f.tom === 'ok') return { tom: 'ok', titulo: f.okline, texto: '' }
  const tom: TomFaixa = f.tom === 'busy' ? 'yt' : f.tom === 'none' ? 'neutra' : f.tom
  return { tom, titulo: f.lbl.replace(/:$/, ''), texto: f.resumo }
}
