'use client'
import type { ReactElement, ReactNode } from 'react'
import { Icone, type NomeIcone } from './icones'
import '../caminho-nativo.css'

export type TipoSelo = 'yt' | 'yts' | 'warn' | 'ok' | 'unk' | 'dim' | 'mute-neq' | 'mute-late' | 'pen' | 'resb'

/** Classe e ícone de cada selo (mockup M2 index.html:84-93 e 331-340). Todo selo = forma + símbolo + palavra. */
const SELOS: Record<TipoSelo, { classe: string; icone: NomeIcone }> = {
  yt: { classe: 'yt', icone: 'yt' },
  yts: { classe: 'yts', icone: 'dot' },
  warn: { classe: 'warn', icone: 'pause' },
  ok: { classe: 'ok', icone: 'ok' },
  unk: { classe: 'unk', icone: 'q' },
  dim: { classe: 'dim', icone: 'dash' },
  pen: { classe: 'yt', icone: 'pen' },
  // "Sem vencedor": token cinza `mute`, não o azul-acinzentado de "em teste no Studio" (Naksu, r3.1).
  'mute-neq': { classe: 'mute', icone: 'neq' },
  'mute-late': { classe: 'mute', icone: 'late' },
  resb: { classe: 'warn', icone: 'warn' },
}

export function SeloCaminho({ tipo, children }: { tipo: TipoSelo; children: ReactNode }): ReactElement {
  const s = SELOS[tipo]
  return (
    <span className={`cn-selo ${s.classe}`} data-selo={tipo}>
      <Icone nome={s.icone} />
      {children}
    </span>
  )
}
