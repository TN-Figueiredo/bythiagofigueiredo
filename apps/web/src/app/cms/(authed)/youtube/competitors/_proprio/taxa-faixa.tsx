/**
 * A faixa da taxa de clique (mockup de 12/10, A.faixaTaxa), compartilhada pelo canal (13.3), pelo vídeo (13.4) e pelo antes e depois (14).
 * Recebe o modelo JÁ montado (`buildTaxaFaixa`): texto pronto e frações do eixo, nada de banco nem de número privado cru. Componente de
 * servidor (sem estado): as coordenadas são porcentagens do SVG, que ocupa a largura do contêiner sem `viewBox`, então o texto fica em 12 px.
 * O desenho é `aria-hidden`: o nome da região (`alt`) diz a leitura toda em texto. Valor acima do ponto; os dois limites ABAIXO da barra.
 */
import type { TaxaFaixaLinha, TaxaFaixaView } from './taxa-faixa-model'
import './taxa-faixa.css'

const H_LINHA = 58
const Y_BARRA = 16
const H_BARRA = 22
const H_EIXO = 28
// perto das bordas o texto ancora na borda, para não sair do desenho
const BORDA = 0.06
const BORDA_JUNTO = 0.16

const pc = (x: number): string => `${+(x * 100).toFixed(3)}%`
function ancora(pos: number, borda: number): { x: string; anchor: 'start' | 'middle' | 'end' } {
  if (pos < borda) return { x: '0%', anchor: 'start' }
  if (pos > 1 - borda) return { x: '100%', anchor: 'end' }
  return { x: pc(pos), anchor: 'middle' }
}

function Linha({ l }: { l: TaxaFaixaLinha }) {
  const larg = Math.max(l.hi - l.lo, 0.006)
  const v = ancora(l.p, BORDA)
  const j = ancora((l.lo + l.hi) / 2, BORDA_JUNTO)
  return (
    <div className="tf-linha">
      {(l.rotulo || l.nota) && (
        <div className="tf-cab">
          {l.rotulo && <span className="tf-lab">{l.rotulo}</span>}
          {l.nota && <span className="tf-nota">{l.nota}</span>}
        </div>
      )}
      <svg className="tf-svg" width="100%" height={H_LINHA} aria-hidden="true" focusable="false">
        <text className="tf-num" x={v.x} y={11} textAnchor={v.anchor}>{l.valor}</text>
        <rect className={'tf-int ' + l.classe} x={pc(l.lo)} y={Y_BARRA} width={pc(larg)} height={H_BARRA} rx={3} />
        <rect className={'tf-intb ' + l.classe} x={pc(l.lo)} y={Y_BARRA} width={pc(larg)} height={H_BARRA} rx={3} />
        <circle className={'tf-pt ' + l.classe} cx={pc(l.p)} cy={Y_BARRA + H_BARRA / 2} r={6} />
        <text className="tf-lim" x={j.x} y={Y_BARRA + H_BARRA + 14} textAnchor={j.anchor}>{l.loTxt} a {l.hiTxt}</text>
      </svg>
    </div>
  )
}

export function TaxaFaixa({ view }: { view: TaxaFaixaView }) {
  return (
    <div className="tf" role="img" aria-label={view.alt}>
      {view.linhas.map((l, i) => <Linha key={i} l={l} />)}
      <svg className="tf-eixo" width="100%" height={H_EIXO} aria-hidden="true" focusable="false">
        <line className="tf-fio" x1="0%" x2="100%" y1={6} y2={6} />
        {view.eixo.map((t, i) => (
          <g key={i}>
            <line className="tf-fio" x1={pc(t.pos)} x2={pc(t.pos)} y1={2} y2={10} />
            <text className="tf-ax" x={pc(t.pos)} y={24} textAnchor={i === 0 ? 'start' : i === view.eixo.length - 1 ? 'end' : 'middle'}>{t.txt}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}
