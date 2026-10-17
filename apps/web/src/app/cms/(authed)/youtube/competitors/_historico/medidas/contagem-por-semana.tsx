/**
 * E5a Tarefa 21a: a forma "contagem por semana" do gráfico por dia: um ponto por semana com a média por dia, a primeira leitura (sem anterior)
 * em hachura e nenhuma barra por dia. O trecho antes da primeira leitura é tracejado ("sem contagem antes de dd/mm"). Componente de servidor.
 */
import { GraficoLegivel } from '../../_chrome/medidas/grafico-legivel'
import { abrev, dm, milhar } from './formatos'
import type { ContagemPorSemana } from './dias-model'
import './historico-medidas.css'

const W = 760, LM = 52, RM = 16, TM = 16, PH = 110
const PW = W - LM - RM

export function ContagemPorSemanaHistorico({ semana }: { semana: ContagemPorSemana }) {
  const n = semana.pontos.length
  const base = TM + PH
  const maxV = Math.max(1, ...semana.pontos.map((p) => p.mediaPorDia ?? 0))
  const X = (i: number): number => LM + (PW / Math.max(1, n)) * (i + 0.5)
  const Y = (v: number): number => TM + PH * (1 - v / maxV)
  const segs: string[] = []
  let seg: string[] = []
  semana.pontos.forEach((p, i) => {
    if (p.tipo === 'medido' && p.mediaPorDia !== null) seg.push(`${X(i).toFixed(1)},${Y(p.mediaPorDia).toFixed(1)}`)
    else { if (seg.length > 1) segs.push(seg.join(' ')); seg = [] }
  })
  if (seg.length > 1) segs.push(seg.join(' '))
  return (
    <GraficoLegivel
      titulo="Views por semana: média por dia"
      pontos={semana.pontos.map((p) => ({ rotulo: dm(p.dia), fala: p.fala }))}
      tabela={{ cabecalho: ['Semana que termina em', 'Média por dia'], linhas: semana.pontos.map((p) => [dm(p.dia), p.mediaPorDia === null ? (p.tipo === 'primeira' ? 'não medido (primeira leitura)' : 'o total de views diminuiu') : milhar(p.mediaPorDia)]) }}
      legenda={<ul className="ic-leg">{semana.legenda.map((l) => <li key={l}>{l}</li>)}</ul>}
    >
      <svg viewBox={`0 0 ${W} ${base + 28}`} width="100%" aria-hidden="true" data-contagem-por-semana>
        <defs><pattern id="hv-sem" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" className="gl-nm-fundo" /><line x1="0" y1="0" x2="0" y2="6" className="gl-nm-risco" /></pattern></defs>
        <line className="gl-grade" x1={LM} x2={W - RM} y1={base} y2={base} />
        <text className="hv-rot" x={LM - 6} y={TM + 4} textAnchor="end">{abrev(maxV)}</text>
        <text className="hv-rot" x={LM - 6} y={base + 4} textAnchor="end">0</text>
        {segs.map((pts, k) => <polyline key={k} className="hv-sem-seg" fill="none" points={pts} />)}
        {semana.pontos.map((p, i) => (
          <g key={p.dia}>
            {p.tipo === 'medido' && p.mediaPorDia !== null ? <circle className="hv-sem-p" cx={X(i)} cy={Y(p.mediaPorDia)} r={5} /> : <rect className="gl-nm" x={X(i) - 7} y={base - 16} width={14} height={16} fill="url(#hv-sem)" data-hachura={p.tipo} />}
            <text className="hv-rot" x={X(i)} y={base + 18} textAnchor="middle">{dm(p.dia)}</text>
            <rect className="gl-alvo" data-i={i} x={X(i) - PW / Math.max(1, n) / 2} y={TM} width={PW / Math.max(1, n)} height={PH} />
          </g>
        ))}
        {semana.linhaDeCorte ? <text className="hv-corte-l" x={LM} y={TM - 4}>{semana.linhaDeCorte.rotulo}</text> : null}
        {semana.rotuloSemContagem ? <text className="hv-rot" x={LM + 4} y={base - 4}>{semana.rotuloSemContagem}</text> : null}
      </svg>
    </GraficoLegivel>
  )
}
