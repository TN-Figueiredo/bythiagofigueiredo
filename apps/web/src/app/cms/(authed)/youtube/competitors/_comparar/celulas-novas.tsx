'use client'
/**
 * Células das linhas novas da comparação (A5 E5a T7). As quatro formas nunca trocam de aparência: medido, não medido (hachura + motivo),
 * não carregou (erro) e ainda não existe (pontilhado). Canal próprio: uma linha quieta, nunca zero. Sem estado.
 */
import type { CSSProperties } from 'react'
import { Direcao } from '../_chrome/medidas/direcao'
import { AindaNaoExiste, NaoCarregou, ZeroMedido } from '../_chrome/medidas/marcas'
import { textoDaMarca, type Falta, type Ainda, type CelulaDirecao, type CelulaAcerto, type CelulaContagem, type CelulaNumero, type CelulaReacao } from './medidas-do-lado'
import { TEXTO_LEITURAS_DIFERENTES } from './medidas-do-par'
import type { RelacaoNova } from './relacao-do-par'
import { corVar } from './lados'
import type { CorLado } from './par-model'

export const vars = (cor: string): CSSProperties => ({ '--c': cor } as CSSProperties)

export function Rotulo({ lado }: { lado: 'A' | 'B' }) {
  return <span className="cp-lb" aria-hidden="true">{lado}</span>
}

/** O que mostrar quando não há número. */
export function Sem({ c }: { c: Falta | Ainda }) {
  switch (c.tipo) {
    case 'nao_carregou': return <NaoCarregou />
    case 'canal_proprio': return <small className="why own">{c.porque}</small>
    case 'ainda_nao_existe': return <AindaNaoExiste existeEm={c.existeEm} />
    case 'nao_medido': return <><span className="obs-ch-nm">não medido</span><small className="why">{c.porque}</small></>
    default: { const nunca: never = c; return nunca }
  }
}

export function Td({ lado, cor, children, ruim = false }: { lado: 'A' | 'B'; cor: string; children: React.ReactNode; ruim?: boolean }) {
  return <td role="cell" className={`${lado === 'A' ? 'cA' : 'cB'}${ruim ? ' nd' : ''}`} style={vars(cor)}><Rotulo lado={lado} />{children}</td>
}

export const cor = (c: CorLado) => corVar(c)

export function Direcional({ c }: { c: CelulaDirecao | CelulaContagem }) {
  if (c.tipo !== 'medido') return <Sem c={c} />
  if ('recente' in c) {
    return (
      <>
        <Direcao variante="cheio" simbolo={c.simbolo} pct={c.pct} palavraVisivel />
        <small className="sub num">{c.recente} contra {c.anterior}{c.pct === null ? ' (sem base para percentual)' : ''}</small>
        {c.fora ? <small className="sub" data-fora-da-conta="">{c.fora}</small> : null}
      </>
    )
  }
  return (
    <>
      <Direcao variante="cheio" simbolo={c.simbolo} pct={c.pct} palavraVisivel />
      <small className="sub">{c.sub}</small>
      {c.marca ? <small className="sub cp-marca" data-marca-contagem="">{textoDaMarca(c.marca.ate)}</small> : null}
    </>
  )
}

export function Numerico({ c }: { c: CelulaNumero }) {
  if (c.tipo !== 'medido') return <Sem c={c} />
  return <><span className="v1 num">{c.texto}</span><small className="sub">{c.sub}</small></>
}

export function Casas({ c }: { c: CelulaAcerto }) {
  if (c.tipo !== 'medido') return <Sem c={c} />
  const { acertos, fracassos, meio, total, pct } = c
  const sr = `${acertos} ${acertos === 1 ? 'acerto' : 'acertos'}, ${meio} no meio, ${fracassos} ${fracassos === 1 ? 'fracasso' : 'fracassos'}, de ${total} vídeos`
  return (
    <>
      <span className="v1 num">{acertos === 0 ? <ZeroMedido /> : acertos} de {total}</span>
      {pct !== null && total >= 10 ? <small className="sub num">{pct}% de acerto</small> : null}
      <span className="cp-casas" role="img" aria-label={sr}>
        {Array.from({ length: acertos }, (_, i) => <i key={`a${i}`} className="hit" />)}
        {Array.from({ length: meio }, (_, i) => <i key={`m${i}`} className="mid" />)}
        {Array.from({ length: fracassos }, (_, i) => <i key={`f${i}`} className="fail" />)}
      </span>
    </>
  )
}

export function Reativo({ c }: { c: CelulaReacao }) {
  if (c.tipo !== 'medido') return <Sem c={c} />
  return (
    <>
      <span className="v1 num">{c.texto}</span>
      <span className="cp-chips">
        <span className="cp-chip">{c.idade === 'hoje' ? 'total de hoje' : 'primeiros 30 dias'}</span>
        {c.soCurtidas ? <span className="cp-chip">só curtidas</span> : null}
        {c.soComentarios ? <span className="cp-chip">só comentários</span> : null}
      </span>
    </>
  )
}

export function Relacional({ r, cores, diferentes = false }: { r: RelacaoNova | null; cores: [CorLado, CorLado]; diferentes?: boolean }) {
  if (diferentes) return <td role="cell" className="rel dim"><span className="sy eq" aria-hidden="true">≠</span><span className="rt">{TEXTO_LEITURAS_DIFERENTES}</span></td>
  if (!r) return <td role="cell" className="rel off" />
  if (r.tipo === 'igual') return <td role="cell" className="rel"><span className="sy eq" aria-hidden="true">＝</span><span className="obs-ch-sr">Praticamente iguais. </span><span className="rt">{r.texto.charAt(0).toUpperCase() + r.texto.slice(1)}</span></td>
  return <td role="cell" className="rel"><span className="sy" style={vars(corVar(cores[r.lado]))} aria-hidden="true">▲</span><span className="rt">{r.texto}</span></td>
}

export function Barras({ b, cores }: { b: [number | null, number | null] | null; cores: [CorLado, CorLado] }) {
  if (!b) return <td role="cell" className="cN" />
  return (
    <td role="cell" className="cN">
      <span className="bars2" aria-hidden="true">
        {([0, 1] as const).map(i => (
          <span className="b2" key={i}>
            <span className="b2l" style={vars(corVar(cores[i]))}>{i ? 'B' : 'A'}</span>
            <span className="b2t">{b[i] === null ? <i className="zero" /> : <i style={{ ...vars(corVar(cores[i])), width: `${b[i]! * 100}%` }} />}</span>
          </span>
        ))}
      </span>
    </td>
  )
}
