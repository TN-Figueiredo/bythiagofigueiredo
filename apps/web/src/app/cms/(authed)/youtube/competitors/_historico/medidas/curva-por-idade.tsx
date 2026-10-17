/**
 * E5a Tarefa 21a: "Views por idade: o vídeo contra o normal do canal". Os dez pontos num eixo por categoria; o vídeo é a linha cheia azul
 * (círculo), o normal do canal a linha tracejada areia (quadrado). Quatro estados que não trocam de aparência: medido (marca cheia),
 * não medido (hachura), ainda não existe (círculo pontilhado) e zero (a mesma escala, no chão). Tudo o que o gráfico diz existe como texto
 * (`fala` de cada ponto) dentro de `GraficoLegivel`. Componente de servidor.
 */
import { GraficoLegivel } from '../../_chrome/medidas/grafico-legivel'
import { NaoCarregou } from '../../_chrome/medidas/marcas'
import { BlocoAindaNaoExiste, BlocoNaoMedido, CabecaDoBloco } from './hv-pecas'
import { Pares } from './pares'
import { abrev, dm } from './formatos'
import type { BlocoDeIdade, PontoDeIdade } from './idade-model'
import './historico-medidas.css'

export const TITULO_DA_IDADE = 'Views por idade: o vídeo contra o normal do canal'
// TEXTO-A-REVISAR: o ⓘ do bloco (texto do NOTAS 13, enxugado)
export const INFO_DA_IDADE = [
  'Cada ponto: views do vídeo no instante “publicação + N dias”, calculadas entre as duas leituras vizinhas.',
  'O normal do canal: mediana das views dos outros vídeos longos do canal na mesma idade, entre os publicados nos últimos 180 dias. Cada ponto mostra o n; com menos de 3 vídeos fica “não medido”.',
  'Fora do normal: vídeos ao vivo e estreias.',
  'Limite: as idades altas só têm os vídeos mais velhos; a curva não é de um mesmo grupo.',
  'Cálculo do Observatório sobre dados públicos do YouTube.',
]

const W = 640, LM = 52, RM = 16, TM = 16, PH = 150, BM = 54
const PW = W - LM - RM

function nice(max: number): number {
  if (max <= 0) return 1
  const e = Math.pow(10, Math.floor(Math.log10(max)))
  const f = max / e
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e
}

function Grafico({ pontos }: { pontos: PontoDeIdade[] }) {
  const n = pontos.length
  const vals = pontos.flatMap((p) => [p.video.tipo === 'medido' ? p.video.views : 0, p.normal.tipo === 'medido' ? p.normal.views : 0])
  const ymax = nice(Math.max(...vals, 1))
  const X = (i: number): number => LM + (PW / n) * (i + 0.5)
  const Y = (v: number): number => TM + PH * (1 - v / ymax)
  const base = TM + PH
  const trechos = (pega: (p: PontoDeIdade) => number | null): string[] => {
    const out: string[] = []
    let seg: string[] = []
    const fecha = (): void => { if (seg.length > 1) out.push(seg.join(' ')); seg = [] }
    pontos.forEach((p, i) => { const v = pega(p); if (v === null) fecha(); else seg.push(`${X(i).toFixed(1)},${Y(v).toFixed(1)}`) })
    fecha()
    return out
  }
  const tv = trechos((p) => (p.video.tipo === 'medido' ? p.video.views : null))
  const tn = trechos((p) => (p.normal.tipo === 'medido' ? p.normal.views : null))
  return (
    <svg className="ic-svg" viewBox={`0 0 ${W} ${base + BM}`} width={W} height={base + BM} aria-hidden="true">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line className="gl-grade" x1={LM} x2={W - RM} y1={Y(ymax * f)} y2={Y(ymax * f)} />
          <text className="hv-rot" x={LM - 6} y={Y(ymax * f) + 4} textAnchor="end">{abrev(ymax * f)}</text>
        </g>
      ))}
      {tn.map((pts, k) => <polyline key={`n${k}`} className="hv-nor" points={pts} />)}
      {tv.map((pts, k) => <polyline key={`v${k}`} className="hv-vid" points={pts} />)}
      {pontos.map((p, i) => (
        <g key={p.idade}>
          {p.normal.tipo === 'medido' ? <rect className="hv-nor-p" x={X(i) - 4.5} y={Y(p.normal.views) - 4.5} width={9} height={9} /> : null}
          {p.video.tipo === 'medido' ? <circle className="hv-vid-p" cx={X(i)} cy={Y(p.video.views)} r={5} /> : null}
          {p.video.tipo === 'nao_medido' ? <rect className="gl-nm" x={X(i) - 8} y={base - 14} width={16} height={14} fill="url(#hv-hach)" /> : null}
          {p.video.tipo === 'ainda_nao_existe' ? <circle className="hv-ainda" cx={X(i)} cy={base - 8} r={6} /> : null}
          <text className="hv-rot t" x={X(i)} y={base + 16} textAnchor="middle">{p.rotulo}</text>
          <text className="hv-nrow" x={X(i)} y={base + 32} textAnchor="middle">{p.normal.tipo === 'medido' ? `n=${p.normal.n}` : p.normal.tipo === 'nao_medido' ? `n=${p.normal.n}` : ''}</text>
          <rect className="gl-alvo" data-i={i} x={X(i) - PW / n / 2} y={TM} width={PW / n} height={PH + 24} />
        </g>
      ))}
      <defs>
        <pattern id="hv-hach" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" className="gl-nm-fundo" /><line x1="0" y1="0" x2="0" y2="6" className="gl-nm-risco" /></pattern>
      </defs>
    </svg>
  )
}

export function CurvaPorIdade({ bloco }: { bloco: BlocoDeIdade }) {
  const ROT = 'Como ler a curva por idade'
  if (bloco.tipo === 'nao_carregou') {
    return (
      <section className="hv-card" aria-labelledby="hIdade" data-bloco-estado="nao_carregou">
        <CabecaDoBloco id="hIdade" titulo={TITULO_DA_IDADE} info={INFO_DA_IDADE} rotuloDoInfo={ROT} />
        <NaoCarregou medida="Views por idade" />
        <p className="hv-fr hv-mut">{bloco.frase}</p>
      </section>
    )
  }
  if (bloco.tipo === 'ainda_nao_existe') return <BlocoAindaNaoExiste titulo={TITULO_DA_IDADE} linhas={[bloco.frase]} />
  if (bloco.tipo === 'nao_medido') {
    return <BlocoNaoMedido id="hIdade" titulo={TITULO_DA_IDADE} curta={bloco.curto} motivo={bloco.motivo} extra={bloco.extra} info={INFO_DA_IDADE} rotuloDoInfo={ROT} />
  }
  const futuro = bloco.pontos.find((p) => p.video.tipo === 'ainda_nao_existe' && p.video.fechaEm)
  return (
    <section className="hv-card" aria-labelledby="hIdade" data-bloco-estado="ok">
      <CabecaDoBloco id="hIdade" titulo={TITULO_DA_IDADE} info={INFO_DA_IDADE} rotuloDoInfo={ROT} />
      <p className="hv-fr" data-frase-da-idade>{bloco.frase}</p>
      <div className="hv-2c">
        <div>
          <GraficoLegivel
            titulo="Views por idade: o vídeo contra o normal do canal"
            pontos={bloco.pontos.map((p) => ({ rotulo: p.rotulo, fala: p.fala }))}
            tabela={{
              cabecalho: ['Idade', 'Vídeo', 'Normal do canal', 'Razão'],
              linhas: bloco.pontos.map((p) => [
                p.rotulo,
                p.video.tipo === 'medido' ? abrev(p.video.views) : p.video.tipo === 'ainda_nao_existe' ? 'ainda não existe' : p.video.curto,
                p.normal.tipo === 'medido' ? `${abrev(p.normal.views)} (${p.normal.n} vídeos)` : p.normal.frase,
                p.razao?.texto ?? '',
              ]),
            }}
            legenda={
              <ul className="ic-leg">
                <li><span className="hv-sw-vid" aria-hidden="true" /> este vídeo</li>
                {bloco.aoVivo ? null : <li><span className="hv-sw-nor" aria-hidden="true" /> normal do canal</li>}
                <li><span className="hv-sw-ai" aria-hidden="true" /> ainda não existe</li>
                <li><span className="hv-sw-bk" aria-hidden="true" /> não medido</li>
              </ul>
            }
          >
            <Grafico pontos={bloco.pontos} />
          </GraficoLegivel>
          <p className="hv-rola" data-rola>Role o gráfico para o lado para ver todas as idades.</p>
          {futuro && futuro.video.tipo === 'ainda_nao_existe' && futuro.video.fechaEm ? <p className="hv-mut sr">O ponto de {futuro.rotulo} fecha em {dm(futuro.video.fechaEm)}.</p> : null}
        </div>
        <div>
          <p className="hv-pares-t">Os mesmos pontos, lado a lado:</p>
          <Pares pares={bloco.pares} />
        </div>
      </div>
    </section>
  )
}
