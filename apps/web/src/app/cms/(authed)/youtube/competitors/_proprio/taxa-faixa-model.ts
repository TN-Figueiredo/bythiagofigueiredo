// A faixa da taxa de clique (mockup de 12/10, A.faixaTaxa): o valor com o intervalo de 95% (Wilson) e, quando houver, o do canal por baixo.
// Puro: recebe as taxas já calculadas (`taxa.ts`) e devolve só o que o desenho precisa (frações do eixo e texto pronto). Quem usa a faixa
// (canal, vídeo, antes e depois) decide a frase de direção; a faixa em si não leva cor de direção (verde/âmbar), só a do dado (laranja do
// seu canal, cinza do canal de referência, tracejado quando a faixa é larga demais para concluir).
import { veredito, type TaxaComIntervalo } from '@/lib/youtube/observatorio/proprio/taxa'

/** Os topos possíveis do eixo (em %): o menor que cabe o maior limite com 12% de folga; o último é o teto. */
export const TOPOS_DO_EIXO = [5, 10, 20, 40, 100] as const
const FOLGA_DO_EIXO = 1.12
export const NOTA_INCONCLUSIVA = 'faixa tracejada: ainda não conclui'
export const ROTULO_CANAL_INTEIRO = 'O canal inteiro'

export type ClasseDaFaixa = 'ref' | 'proprio' | 'inc'

export interface TaxaFaixaLinha {
  /** "O canal inteiro" / "Este vídeo"; nulo quando a faixa está sozinha */
  rotulo: string | null
  /** "faixa tracejada: ainda não conclui" quando a faixa é larga demais; senão nulo */
  nota: string | null
  classe: ClasseDaFaixa
  inconclusiva: boolean
  /** a taxa em texto ("4,8%") */
  valor: string
  loTxt: string
  hiTxt: string
  /** posições no eixo, de 0 a 1 */
  lo: number
  p: number
  hi: number
}

export interface TaxaFaixaView {
  /** a leitura inteira em texto (nome acessível do desenho) */
  alt: string
  /** topo do eixo, em % */
  topo: number
  eixo: Array<{ pos: number; txt: string }>
  linhas: TaxaFaixaLinha[]
}

const um = (x: number): string => x.toFixed(1).replace('.', ',')
/** Uma fração como porcentagem com uma casa e vírgula: 0,048 vira "4,8%". */
export const pctUm = (frac: number): string => um(frac * 100) + '%'
const pct = pctUm
const dec = (n: number): string => (Number.isInteger(n) ? String(n) : um(n))
const entre01 = (x: number): number => Math.max(0, Math.min(1, x))

export interface EntradaTaxaFaixa {
  alvo: TaxaComIntervalo
  /** a taxa do canal inteiro, para a faixa de baixo; nula = faixa sozinha */
  canal: TaxaComIntervalo | null
  /** "Este vídeo" (padrão quando há referência); sem referência não há rótulo */
  rotuloAlvo?: string | null
  /** o veredito já calculado por quem usa a faixa; sem ele a conta é a de `veredito()` */
  inconclusivo?: boolean
  alt: string
}

export function buildTaxaFaixa(e: EntradaTaxaFaixa): TaxaFaixaView {
  const maior = Math.max(e.alvo.hi, e.canal ? e.canal.hi : 0) * 100 * FOLGA_DO_EIXO
  const topo: number = TOPOS_DO_EIXO.find(t => t >= maior) ?? 100
  const pos = (frac: number): number => entre01((frac * 100) / topo)
  const inconclusiva = e.inconclusivo ?? veredito(e.alvo, e.canal).inconclusivo
  const linha = (t: TaxaComIntervalo, rotulo: string | null, classe: ClasseDaFaixa): TaxaFaixaLinha => ({
    rotulo, nota: classe === 'inc' ? NOTA_INCONCLUSIVA : null, classe, inconclusiva: classe === 'inc',
    valor: pct(t.taxa), loTxt: pct(t.lo), hiTxt: pct(t.hi), lo: pos(t.lo), p: pos(t.taxa), hi: pos(t.hi),
  })
  const linhas: TaxaFaixaLinha[] = []
  if (e.canal) linhas.push(linha(e.canal, ROTULO_CANAL_INTEIRO, 'ref'))
  linhas.push(linha(e.alvo, e.canal ? (e.rotuloAlvo === undefined ? 'Este vídeo' : e.rotuloAlvo) : null, inconclusiva ? 'inc' : 'proprio'))
  return { alt: e.alt, topo, eixo: [0, topo / 2, topo].map((t, i) => ({ pos: i / 2, txt: dec(t) + '%' })), linhas }
}

/** O ⓘ "Como a taxa é calculada" da taxa do canal: texto estático (nada do dado do canal), por isso mora no módulo do desenho e não viaja na view. */
export const METODO_TAXA_CANAL: readonly string[] = [
  'Cliques estimados ÷ impressões, no período. Os cliques são estimados dia a dia (impressões × taxa que o YouTube informa para o dia), porque o YouTube não entrega a contagem de cliques.',
  'A faixa colorida é o intervalo de 95% de confiança (método de Wilson): com poucas impressões ela é larga, e a taxa de um período não diz muito. É a mesma regra que mantém a taxa de um vídeo sozinho fora desta tela: com 18 impressões o intervalo vai de 3% a 33%.',
]
