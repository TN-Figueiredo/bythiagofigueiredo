/**
 * E5a Tarefa 21a: "As primeiras 72 horas, hora a hora". As 72 barras numa escala só, a do tempo real (a primeira é parcial, da publicação à
 * hora cheia). Cinco formas que não trocam de aparência: barra cheia (medido), caixa vazada (zero medido), hachura (não medido ou a contagem
 * diminuiu), pontilhado (ainda não existe) e a hachura do trecho antes da primeira contagem. O total e os marcos vêm do modelo (acumulado por
 * bordas), nunca da soma das barras aqui. Componente de servidor; leitura por teclado e tabela no `GraficoLegivel`.
 */
import type { ReactNode } from 'react'
import { GraficoLegivel } from '../../_chrome/medidas/grafico-legivel'
import { NaoCarregou } from '../../_chrome/medidas/marcas'
import { BlocoAindaNaoExiste, BlocoNaoMedido, CabecaDoBloco } from './hv-pecas'
import { Regua72h } from './regua-72h'
import { milhar } from './formatos'
import type { BlocoDeHoras, BlocoDeHorasOk } from './horas-model'
import './historico-medidas.css'

export const TITULO_DAS_HORAS = 'As primeiras 72 horas, hora a hora'
// TEXTO-A-REVISAR: o ⓘ do bloco (texto do NOTAS 13, enxugado)
export const INFO_DAS_HORAS = [
  'Cada barra: views ganhas naquela hora, em horário de São Paulo (diferença entre duas leituras seguidas, uma por hora cheia). O eixo é o tempo real: a primeira barra é parcial, da hora da publicação até a primeira hora cheia.',
  'O total das 72 horas para na última hora cheia antes de o vídeo completar 3 dias; por isso pode ficar um pouco abaixo do “Com 3 dias” da curva por idade.',
  'Começa na primeira leitura depois que o site descobre o vídeo; antes disso fica “não medido”.',
  '1/2 das views: a primeira hora em que o vídeo chega à metade do que tinha com 72 horas.',
  'Cálculo do Observatório sobre dados públicos do YouTube.',
]

const W = 760, LM = 46, RM = 12, TM = 22, PH = 120
const PW = W - LM - RM

function Grafico({ b }: { b: BlocoDeHorasOk }) {
  const X = (h: number): number => LM + (PW * h) / 72
  const maxGanho = Math.max(1, ...b.barras.map((x) => x.ganho ?? 0))
  const base = TM + PH
  const H = (g: number): number => Math.max(2, (PH * g) / maxGanho)
  return (
    <svg className="hv-svg72" viewBox={`0 0 ${W} ${base + 38}`} width={W} height={base + 38} aria-hidden="true">
      <defs>
        <pattern id="hv-h72" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" className="gl-nm-fundo" /><line x1="0" y1="0" x2="0" y2="6" className="gl-nm-risco" /></pattern>
      </defs>
      <line className="gl-grade" x1={LM} x2={W - RM} y1={base} y2={base} />
      <line className="gl-grade" x1={LM} x2={W - RM} y1={TM} y2={TM} />
      <text className="hv-rot" x={LM - 6} y={TM + 4} textAnchor="end">{milhar(maxGanho)}</text>
      <text className="hv-rot" x={LM - 6} y={base + 4} textAnchor="end">0</text>
      {b.antesDaPrimeira ? <rect className="gl-nm" data-antes-da-primeira x={X(0)} y={TM} width={X(b.antesDaPrimeira.xAte) - X(0)} height={PH} fill="url(#hv-h72)" /> : null}
      {b.barras.map((x) => {
        const w = Math.max(1, X(x.xAte) - X(x.xDe) - 1)
        const p = { x: X(x.xDe) + 0.5, width: w }
        if (x.tipo === 'medido' && x.ganho !== null) return <rect key={x.j} className="gl-barra" data-barra={x.j} {...p} y={base - H(x.ganho)} height={H(x.ganho)} />
        if (x.tipo === 'zero') return <rect key={x.j} className="gl-zero" data-barra={x.j} data-zero {...p} y={base - 6} height={6} />
        if (x.tipo === 'ainda_nao_existe') return <rect key={x.j} className="gl-pontilhado" data-barra={x.j} {...p} y={TM} height={PH} />
        if (x.motivo === 'antes_da_primeira_contagem') return null
        return <rect key={x.j} className="gl-nm" data-barra={x.j} data-hachura={x.motivo ?? x.tipo} {...p} y={TM} height={PH} fill="url(#hv-h72)" />
      })}
      {b.linhaDaMetade ? (
        <g data-linha-da-metade>
          <line className="gl-corte" x1={X(b.linhaDaMetade.x)} x2={X(b.linhaDaMetade.x)} y1={TM - 6} y2={base} />
          <text className="hv-seg-l" x={X(b.linhaDaMetade.x) + 4} y={TM - 8}>1/2 das views</text>
        </g>
      ) : null}
      {b.pico ? <text className="hv-lab" x={X(b.barras[b.pico.j - 1]!.xDe)} y={TM - 8}>{`${b.pico.nome}: ${b.pico.rotulo}`}</text> : null}
      {b.eixo.map((m) => (
        <g key={m.x}>
          <line className="gl-grade" x1={X(m.x)} x2={X(m.x)} y1={base} y2={base + 5} />
          <text className="hv-rot" x={X(m.x)} y={base + 18} textAnchor="middle">{m.rotulo}</text>
          {m.data ? <text className="hv-rot" x={X(m.x)} y={base + 32} textAnchor="middle">{m.data}</text> : null}
        </g>
      ))}
      {b.barras.map((x, k) => <rect key={`a${x.j}`} className="gl-alvo" data-i={k} x={X(x.xDe)} y={TM} width={Math.max(2, X(x.xAte) - X(x.xDe))} height={PH} />)}
    </svg>
  )
}

/** Defeito 4 (Gio): a amostra de cada item da legenda é o mesmo desenho e a mesma classe do gráfico (como o N1 da Linha do tempo). */
function Amostra({ i }: { i: number }) {
  let corpo: ReactNode = null
  if (i === 0) corpo = <rect className="gl-barra" x={1} y={3} width={14} height={10} />
  else if (i === 1) corpo = <rect className="gl-zero" x={1} y={9} width={14} height={6} />
  else if (i === 2) corpo = <><rect className="gl-nm-fundo gl-nm" x={1} y={2} width={14} height={12} /><line className="gl-nm-risco" x1={2} y1={13} x2={14} y2={3} /></>
  else if (i === 3) corpo = <line className="gl-grade hv-am-pub" x1={8} x2={8} y1={1} y2={15} />
  if (!corpo) return null
  return <svg className="hv-amostra" viewBox="0 0 16 16" width={16} height={16} aria-hidden="true" data-amostra={i}>{corpo}</svg>
}

function Estado({ texto, tipo }: { texto: string; tipo: string }) {
  return <p className="hv-fr hv-mut" data-estado-da-leitura={tipo}>Leitura por hora: {texto}.</p>
}

export function Horas72({ bloco }: { bloco: BlocoDeHoras }) {
  const ROT = 'Como ler as 72 horas'
  if (bloco.tipo === 'nao_carregou') {
    return (
      <section className="hv-card" aria-labelledby="hHoras" data-bloco-estado="nao_carregou">
        <CabecaDoBloco id="hHoras" titulo={TITULO_DAS_HORAS} info={INFO_DAS_HORAS} rotuloDoInfo={ROT} />
        <NaoCarregou medida="As primeiras 72 horas" />
        <p className="hv-fr hv-mut">{bloco.frase}</p>
        <Estado tipo={bloco.estado.tipo} texto={bloco.estado.texto} />
      </section>
    )
  }
  if (bloco.tipo === 'ainda_nao_existe') return <BlocoAindaNaoExiste titulo={TITULO_DAS_HORAS} linhas={[bloco.frase]} />
  if (bloco.tipo === 'nao_medido') {
    return (
      <BlocoNaoMedido id="hHoras" titulo={TITULO_DAS_HORAS} curta={bloco.classe === 'nao_carregou' ? 'não carregou' : 'não medido'} motivo={bloco.frase} extra={bloco.extra} info={INFO_DAS_HORAS} rotuloDoInfo={ROT}>
        <Estado tipo={bloco.estado.tipo} texto={bloco.estado.texto} />
      </BlocoNaoMedido>
    )
  }
  const b = bloco
  const totalTxt =
    b.total.tipo === 'medido' ? `Total das 72 horas: ${milhar(b.total.views)} views.` : b.total.frase
  return (
    <section className="hv-card" aria-labelledby="hHoras" data-bloco-estado="ok">
      <CabecaDoBloco id="hHoras" titulo={TITULO_DAS_HORAS} info={INFO_DAS_HORAS} rotuloDoInfo={ROT} />
      <p className="hv-fr hv-mut" data-publicacao>{b.publicacao}. {b.subtitulo}</p>
      <Estado tipo={b.estado.tipo} texto={b.estado.texto} />
      <p className="hv-fr" data-frase-das-horas>{b.frase}</p>
      <p className="hv-fr" data-total={b.total.tipo}>{totalTxt}</p>
      <GraficoLegivel
        titulo="Views ganhas em cada uma das primeiras 72 horas do vídeo"
        pontos={b.barras.map((x) => ({ rotulo: `${x.data}, ${x.intervalo}`, fala: x.fala }))}
        tabela={{ cabecalho: ['Hora', 'Views ganhas', 'Contador no fim da hora'], linhas: b.barras.map((x) => [`${x.data}, ${x.intervalo}`, x.ganho === null ? (x.tipo === 'ainda_nao_existe' ? 'ainda não existe' : 'não medido') : milhar(x.ganho), x.acumulado === null ? '' : milhar(x.acumulado)]) }}
        legenda={<ul className="ic-leg">{b.legenda.map((l, i) => <li key={l} className="hv-leg-a"><Amostra i={i} />{l}</li>)}</ul>}
      >
        <Grafico b={b} />
      </GraficoLegivel>
      <p className="hv-rola" data-rola>Role o gráfico para o lado para ver as 72 horas.</p>
      {b.antesDaPrimeira ? <p className="hv-mut" data-antes-texto>{b.antesDaPrimeira.texto}</p> : null}
      {b.frasesDasHoras.length > 0 ? <ul className="hv-lista-h" data-frases-das-horas>{b.frasesDasHoras.map((f) => <li key={f}>{f}</li>)}</ul> : null}
      <Regua72h regua={b.regua} />
    </section>
  )
}
