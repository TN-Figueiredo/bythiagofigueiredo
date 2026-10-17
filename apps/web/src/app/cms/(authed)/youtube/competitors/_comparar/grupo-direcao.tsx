'use client'
/**
 * O grupo "Direção" (A5 E5a T7, mockup 17a): uma leitura principal, duas de apoio ("para conferir, não são vereditos"), os longos publicados,
 * a régua por nicho e a frase de cada lado. Linhas dentro da <table> de "Número a número". Sem estado.
 */
import { Fragment, type CSSProperties } from 'react'
import { fraseEscrita, type LinhaDeDirecao, type ReguaDeDirecao } from './direcao-model'
import type { MedidasDoPar } from './medidas-do-par'
import { corVar } from './lados'
import type { CorLado } from './par-model'
import { Direcional, Relacional, Td } from './celulas-novas'

const COR_LETRA = (l: 'A' | 'B', cores: [CorLado, CorLado]) => corVar(cores[l === 'A' ? 0 : 1])

function Regua({ r, cores }: { r: ReguaDeDirecao; cores: [CorLado, CorLado] }) {
  return (
    <div className="cp-rd">
      {r.nicho ? <small className="cp-rd-n">{r.nicho}</small> : null}
      <span className="cp-rd-t" role="img" aria-label={r.alt}>
        <i className="cp-rd-0" aria-hidden="true" />
        {r.tracos.map((f, i) => <i key={i} className="cp-rd-k" aria-hidden="true" style={{ left: `${f * 100}%` }} />)}
        {r.marcas.map(m => {
          // dois marcadores no mesmo ponto (ex.: os dois em 0%): afastados um de cada lado, para o A não ficar escondido atrás do B (Gio G-4)
          const junto = r.marcas.length > 1 && r.marcas.every(o => o.fracao === m.fracao)
          const desloca = junto ? (m.letra === 'A' ? -11 : 11) : 0
          return (
          <b key={m.letra} className="cp-rd-m" aria-hidden="true" data-junto={junto ? '' : undefined} style={{ left: `${m.fracao * 100}%`, marginLeft: desloca, '--c': COR_LETRA(m.letra, cores) } as CSSProperties}>{m.letra}{m.fora ? (m.fora === 'acima' ? '›' : '‹') : ''}</b>
          )
        })}
      </span>
      {r.semTraco.length ? <small className="cp-rd-s">Sem traço: {r.semTraco.join(', ')}.</small> : null}
    </div>
  )
}

function Linha({ l, m, cores }: { l: LinhaDeDirecao; m: MedidasDoPar; cores: [CorLado, CorLado] }) {
  const [ca, cb] = cores
  const principal = l.papel === 'principal'
  return (
    <tr role="row" className={principal ? 'dir-p' : 'dir-a'} data-leitura={l.id} data-papel={l.papel}>
      <th scope="row" role="rowheader" className="rl">
        {principal ? <span className="cp-tagp">◆ leitura principal</span> : null}
        {l.titulo}<small>{l.sub}</small>
        {l.nota ? <small className="cp-nota-c">{l.nota}</small> : null}
      </th>
      <Td lado="A" cor={corVar(ca)} ruim={l.lados[0].tipo !== 'medido'}><Direcional c={l.lados[0]} /></Td>
      <Td lado="B" cor={corVar(cb)} ruim={l.lados[1].tipo !== 'medido'}><Direcional c={l.lados[1]} /></Td>
      <td role="cell" className="cN">{l.reguas.map((r, i) => <Regua key={i} r={r} cores={cores} />)}</td>
      <Relacional r={l.relacao} cores={cores} />
    </tr>
  )
}

export function GrupoDirecao({ m, cores }: { m: MedidasDoPar; cores: [CorLado, CorLado] }) {
  const d = m.direcao
  const principal = d.linhas.filter(l => l.papel === 'principal')
  const apoios = d.linhas.filter(l => l.papel === 'apoio')
  const pub = d.linhas.filter(l => l.papel === 'contagem')
  return (
    <tbody role="rowgroup" data-grupo="direcao">
      <tr role="row" className="grp"><th scope="rowgroup" role="rowheader" colSpan={5}><svg className="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12l4-4.5 3 2.5 5-6M10.5 4h3.5v3.5" /></svg>Direção<small className="cp-gsub">{d.leituraPrincipal}</small></th></tr>
      {principal.map(l => <Linha key={l.id} l={l} m={m} cores={cores} />)}
      <tr role="row" className="cp-fr"><td role="cell" colSpan={5}>
        <ul>{d.frases.map((f, i) => <li key={i} data-lado={i ? 'B' : 'A'}>{fraseEscrita(f)}</li>)}</ul>
      </td></tr>
      <tr role="row" className="sub-grp"><th scope="rowgroup" role="rowheader" colSpan={5}>Para conferir (leituras de apoio, não são vereditos)</th></tr>
      {apoios.map(l => <Linha key={l.id} l={l} m={m} cores={cores} />)}
      {pub.map(l => <Fragment key={l.id}><Linha l={l} m={m} cores={cores} /></Fragment>)}
    </tbody>
  )
}
