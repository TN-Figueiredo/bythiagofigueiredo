/**
 * E5a Tarefa 17: as primeiras 72 horas do canal. Componente de servidor. A curva é a mediana, entre os vídeos, da parte das views das 72
 * horas que já aconteceu em cada hora; hora sem mediana (menos de 3 vídeos com contagem) deixa o traço aberto, nunca interpola.
 * Não medido traz o motivo de `frases-das-horas`, sem data inventada.
 */
import { GraficoLegivel } from '../../_chrome/medidas/grafico-legivel'
import { PastilhaAusencia } from '../../_chrome/ausencia/pastilhas'
import type { ModeloDe72Horas } from './lancamentos-model'
import './canal-medidas.css'

const W = 640, H = 120, LM = 46, RM = 12, TM = 10, BM = 28
const PW = W - LM - RM, PH = H - TM - BM

function Curva({ m }: { m: Extract<ModeloDe72Horas, { tipo: 'medido' }> }) {
  const X = (h: number) => LM + (PW * h) / 72
  const Y = (v: number) => TM + PH * (1 - v)
  let d = ''
  let aberto = false
  m.fracaoPorHora.forEach((f, i) => {
    if (f === null) { aberto = false; return }
    d += `${aberto ? 'L' : 'M'}${X(i + 1).toFixed(1)} ${Y(f).toFixed(1)}`
    aberto = true
  })
  return (
    <svg className="pc-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      {[0, 0.5, 1].map(f => (
        <g key={f}>
          <line className="ic-grid" x1={LM} x2={W - RM} y1={Y(f)} y2={Y(f)} />
          <text className="ic-ax" x={LM - 6} y={Y(f) + 4} textAnchor="end">{Math.round(f * 100)}%</text>
        </g>
      ))}
      <path className="pc-ln med" d={d} />
      <line className="pc-pub" x1={X(m.metade)} x2={X(m.metade)} y1={Y(0.5)} y2={TM + PH} />
      <circle className="pc-mk med" cx={X(m.metade)} cy={Y(0.5)} r={5} data-i={1} />
      {[0, 24, 48, 72].map((h, i) => <text key={h} className="ic-ax" x={X(h)} y={H - 8} textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}>{`${h} h`}</text>)}
    </svg>
  )
}

export function HorasDoCanal({ modelo }: { modelo: ModeloDe72Horas }) {
  if (modelo.tipo === 'nao_carregou') return <div className="pc-lc"><PastilhaAusencia estado="falhou" motivo="72 horas" /><p>{modelo.motivo}</p></div>
  if (modelo.tipo === 'nao_medido') return <div className="pc-lc"><span className="obs-ch-nm">não medido</span><p>{modelo.motivo}</p></div>
  const pontos = [
    { rotulo: '1/4 das views', fala: `${modelo.umQuarto} ${modelo.umQuarto === 1 ? 'hora' : 'horas'} depois de publicar` },
    { rotulo: '1/2 das views', fala: `${modelo.metade} ${modelo.metade === 1 ? 'hora' : 'horas'} depois de publicar` },
    { rotulo: '3/4 das views', fala: `${modelo.tresQuartos} ${modelo.tresQuartos === 1 ? 'hora' : 'horas'} depois de publicar` },
  ]
  return (
    <>
      <p className="pc-fr3" data-frase-das-72h><b>{modelo.frase.negrito}</b>{modelo.frase.resto}</p>
      {modelo.aviso ? <p className="pc-pgl">{modelo.aviso}</p> : null}
      <GraficoLegivel titulo={`Parte das views das primeiras 72 horas que já aconteceu em cada hora. Metade em ${modelo.metade} horas.`} pontos={pontos}>
        <div className="pc-h72"><Curva m={modelo} /></div>
      </GraficoLegivel>
    </>
  )
}
