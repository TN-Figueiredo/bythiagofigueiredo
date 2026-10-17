/**
 * E5a Tarefa 18: a Linha do tempo do canal (views por dia, mais três raias de marcas). Componente de servidor; o desenho é SVG com os dias em barras.
 * Quatro estados que nunca trocam de aparência: dia com views (barra), zero medido (caixa vazada), sem registro (hachura, um retângulo por sequência),
 * depois que saiu (pontilhado). TEXTO-A-REVISAR nas frases novas.
 */
import { GraficoLegivel } from '../../_chrome/medidas/grafico-legivel'
import { NaoCarregou } from '../../_chrome/medidas/marcas'
import { RiInfo } from '../../_canais/ri-info'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { dm } from './formatos'
import type { LinhaDoTempo, MarcaDaLinha, RaiaDaLinha } from './linha-do-tempo-model'
import './canal-medidas.css'

const W = 760, LM = 46, RM = 12, TM = 10, PH = 120, RAIA = 22
const PW = W - LM - RM
const NOMES = { videos: 'Vídeos', campos: 'Campos', trocas: 'Trocas' } as const
const ORDEM = ['videos', 'campos', 'trocas'] as const

function Marca({ m, x, y }: { m: MarcaDaLinha; x: number; y: number }) {
  const p = { 'data-i': m.indice, className: `pc-mk ${m.forma}` }
  if (m.forma === 'longo') return <circle {...p} cx={x} cy={y} r={4.5} />
  if (m.forma === 'short') return <circle {...p} cx={x} cy={y} r={4.5} fill="none" strokeWidth={1.5} />
  if (m.forma === 'campo') return <rect {...p} x={x - 4} y={y - 4} width={8} height={8} fill="none" strokeWidth={1.5} />
  if (m.forma === 'titulo') return <path {...p} d={`M${x} ${y - 5}L${x + 5} ${y}L${x} ${y + 5}L${x - 5} ${y}Z`} />
  return <path {...p} d={`M${x} ${y - 5}L${x + 5} ${y + 4}L${x - 5} ${y + 4}Z`} />
}

function Raia({ raia }: { raia: RaiaDaLinha }) {
  return raia.tipo === 'nao_carregou' ? <NaoCarregou medida="esta raia" /> : null
}

const GLIFO = { sobe: '▲', estavel: '＝', desce: '▼' } as const
const ITENS = [
  'Barras: views que o canal inteiro ganhou em cada dia, pela diferença do contador público (a mesma conta da direção). Inclui Shorts e vídeos apagados.',
  'Janela: os últimos 90 dias; as marcas vêm das publicações, das mudanças de título, miniatura, descrição, tags, categoria e duração, registradas desde 03/10/2026.',
  `Corte de ${dm(MEASURE_RULES.countChange)}: o YouTube mudou a forma de contar views; antes dessa data os dias não se comparam com os de depois.`,
  'Sem playlists: esta fase não registra playlists, então não há raia delas.',
  'Coincidência, não causa: a tela lista o que mudou perto de uma subida; não afirma que uma coisa causou a outra.',
]

export function LinhaDoTempoBloco({ modelo }: { modelo: LinhaDoTempo }) {
  return (
    <section className="pc-sec" id="tempo" aria-labelledby="hTem">
      <div className="pc-sh">
        <h2 id="hTem">Linha do tempo: views por dia e o que mudou</h2>
        <RiInfo titulo="a linha do tempo" itens={ITENS} rotuloBotao="Como ler a linha do tempo" />
      </div>
      <Miolo modelo={modelo} />
    </section>
  )
}

function Miolo({ modelo }: { modelo: LinhaDoTempo }) {
  const b = modelo.barras
  const frase = <p className="pc-fr3" data-frase-da-linha>{modelo.frase.simbolo ? <span aria-hidden="true">{GLIFO[modelo.frase.simbolo]} </span> : null}<b>{modelo.frase.negrito}</b>{modelo.frase.resto}</p>
  if (b.tipo !== 'dias') {
    return (
      <>
        {frase}
        {b.tipo === 'nao_carregou' ? <NaoCarregou medida="Linha do tempo" /> : <p className="pc-pgl" data-sem-registro>{b.motivo}</p>}
        <div className="pc-raias">{ORDEM.map(r => <div key={r}><b>{NOMES[r]}</b> <Raia raia={modelo.raias[r]} /></div>)}</div>
      </>
    )
  }
  const n = b.dias.length
  const passo = PW / n
  const X = (k: number) => LM + passo * k
  const Y = (v: number) => TM + PH * (1 - v / b.ymax)
  const base = TM + PH
  const alturaTotal = base + 24 + RAIA * 3
  const pontos = b.dias.map(d => ({ rotulo: d.dia, fala: d.fala }))
  return (
    <>
      {frase}
      <GraficoLegivel
        titulo={`Views ganhas por dia nos últimos ${n} dias, com publicações, mudanças de campo e trocas.`}
        pontos={pontos}
        tabela={{ cabecalho: ['Dia', 'Views ganhas', 'Situação', 'O que aconteceu'], linhas: modelo.tabela.map(l => [...l]) }}
        legenda={<ul className="pc-leg">{modelo.legenda.map(l => <li key={l.chave} data-leg={l.chave}>{l.texto}</li>)}</ul>}
      >
        <svg className="pc-svg" viewBox={`0 0 ${W} ${alturaTotal}`} width="100%" aria-hidden="true">
          {[0, 0.5, 1].map((f, i) => (
            <g key={f}>
              <line className="gl-grade" x1={LM} x2={W - RM} y1={Y(b.ymax * f)} y2={Y(b.ymax * f)} />
              <text className="ic-ax" x={LM - 6} y={Y(b.ymax * f) + 4} textAnchor="end">{b.rotulos[i]}</text>
            </g>
          ))}
          <defs>
            <pattern id="pc-hach" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" className="gl-nm-fundo" /><line x1="0" y1="0" x2="0" y2="6" className="gl-nm-risco" /></pattern>
          </defs>
          {b.trechos.map(t => (
            <rect key={`${t.tipo}${t.de}`} className={t.tipo === 'fora' ? 'gl-pontilhado' : 'pc-trecho'} fill={t.tipo === 'fora' ? 'none' : 'url(#pc-hach)'} data-trecho={t.tipo} x={X(t.de)} y={TM} width={passo * (t.ate - t.de + 1)} height={PH} />
          ))}
          {b.dias.map((d, k) => d.situacao === 'com' && d.ganho !== null
            ? <rect key={d.dia} className="gl-barra" x={X(k) + 0.5} y={Y(d.ganho)} width={Math.max(1, passo - 1)} height={base - Y(d.ganho)} />
            : d.situacao === 'zero'
              ? <rect key={d.dia} className="gl-zero" data-zero x={X(k) + 0.5} y={base - 6} width={Math.max(1, passo - 1)} height={6} />
              : null)}
          {b.corte ? (
            <g data-corte>
              <line className="gl-corte" x1={X(b.corte.indice) + passo / 2} x2={X(b.corte.indice) + passo / 2} y1={TM} y2={base} />
            </g>
          ) : null}
          {b.dias.map((d, k) => <rect key={`a${d.dia}`} className="gl-alvo" data-i={k} x={X(k)} y={TM} width={passo} height={PH} />)}
          {ORDEM.map((r, ri) => {
            const raia = modelo.raias[r]
            const y = base + 24 + RAIA * ri + RAIA / 2
            return (
              <g key={r}>
                <text className="ic-ax" x={LM - 6} y={y + 4} textAnchor="end">{NOMES[r]}</text>
                {raia.tipo === 'marcas' ? raia.marcas.map((m, mi) => <Marca key={`${r}${mi}`} m={m} x={X(m.indice) + passo / 2} y={y} />) : <text className="ic-ax" x={LM + 4} y={y + 4}>não carregou</text>}
              </g>
            )
          })}
          <text className="ic-ax" x={LM} y={base + 14} textAnchor="start">{b.dias[0]!.dia.slice(8)}/{b.dias[0]!.dia.slice(5, 7)}</text>
          <text className="ic-ax" x={W - RM} y={base + 14} textAnchor="end">{b.dias[n - 1]!.dia.slice(8)}/{b.dias[n - 1]!.dia.slice(5, 7)}</text>
        </svg>
      </GraficoLegivel>
    </>
  )
}
