'use client'
/** Primeiros dias (M1), acerto (M4) e reação do público (M7): três grupos de linhas da tabela "Número a número" (A5 E5a T7). */
import type { MedidasDoPar } from './medidas-do-par'
import type { CorLado } from './par-model'
import { Barras, Casas, Numerico, Reativo, Relacional, Td, cor } from './celulas-novas'

const Cab = ({ nome, sub }: { nome: string; sub?: string }) => (
  <tr role="row" className="grp"><th scope="rowgroup" role="rowheader" colSpan={5}>{nome}{sub ? <small className="cp-gsub">{sub}</small> : null}</th></tr>
)

export function GrupoPrimeirosDias({ m, cores }: { m: MedidasDoPar; cores: [CorLado, CorLado] }) {
  const [ca, cb] = cores
  return (
    <tbody role="rowgroup" data-grupo="primeiros-dias">
      <Cab nome="Primeiros dias dos vídeos longos" />
      {m.primeiros.linhas.map(l => (
        <tr role="row" key={l.idade} data-idade={l.idade}>
          <th scope="row" role="rowheader" className="rl">{l.titulo}<small>{l.sub}</small></th>
          <Td lado="A" cor={cor(ca)} ruim={l.lados[0].tipo !== 'medido'}><Numerico c={l.lados[0]} /></Td>
          <Td lado="B" cor={cor(cb)} ruim={l.lados[1].tipo !== 'medido'}><Numerico c={l.lados[1]} /></Td>
          <Barras b={l.barras} cores={cores} />
          <Relacional r={l.relacao} cores={cores} />
        </tr>
      ))}
    </tbody>
  )
}

export function GrupoAcerto({ m, cores }: { m: MedidasDoPar; cores: [CorLado, CorLado] }) {
  const [ca, cb] = cores
  const [x, y] = m.acerto.lados
  return (
    <tbody role="rowgroup" data-grupo="acerto">
      <Cab nome="Acerto" />
      <tr role="row">
        <th scope="row" role="rowheader" className="rl">Vídeos longos que acertaram<small>{m.acerto.nota ?? 'contra a mediana do próprio canal'}</small></th>
        <Td lado="A" cor={cor(ca)} ruim={x.tipo !== 'medido'}><Casas c={x} /></Td>
        <Td lado="B" cor={cor(cb)} ruim={y.tipo !== 'medido'}><Casas c={y} /></Td>
        <td role="cell" className="cN" />
        <td role="cell" className="rel off" />
      </tr>
    </tbody>
  )
}

export function GrupoReacao({ m, cores }: { m: MedidasDoPar; cores: [CorLado, CorLado] }) {
  const [ca, cb] = cores
  const [x, y] = m.reacao.lados
  return (
    <tbody role="rowgroup" data-grupo="reacao">
      <Cab nome="Reação do público" />
      <tr role="row">
        <th scope="row" role="rowheader" className="rl">Engajamento<small>curtidas e comentários por view, mediana dos longos</small></th>
        <Td lado="A" cor={cor(ca)} ruim={x.tipo !== 'medido'}><Reativo c={x} /></Td>
        <Td lado="B" cor={cor(cb)} ruim={y.tipo !== 'medido'}><Reativo c={y} /></Td>
        <td role="cell" className="cN" />
        <Relacional r={m.reacao.relacao} cores={cores} diferentes={m.reacao.diferentes} />
      </tr>
    </tbody>
  )
}
