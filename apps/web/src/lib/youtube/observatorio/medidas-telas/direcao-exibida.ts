// A5 · E5a, Tarefa 1: a direção exibida, uma regra para as três telas (plano 4.3). Classifica sobre o inteiro que a tela escreve.
import { MEASURE_RULES } from '../medidas/regras'

export type SimboloDeDirecao = 'sobe' | 'estavel' | 'desce'

/** Limite do "sem mudança", em pontos percentuais inteiros (10 = `equalPct` da E4). */
const LIMITE_PCT = Math.round(MEASURE_RULES.equalPct * 100)
const MENOS = '−'

/** "Metade se afasta do zero". O `toFixed(6)` tira o resíduo de representação (0,095 × 100 pode sair 9,4999…). */
function arredonda(variacao: number): number {
  const pct = Math.sign(variacao) * Math.round(Number((Math.abs(variacao) * 100).toFixed(6)))
  return pct === 0 ? 0 : pct // Math.sign(−0,001) × 0 é −0
}

export function direcaoExibida(variacao: number): { pct: number; simbolo: SimboloDeDirecao; texto: string } {
  const pct = arredonda(variacao)
  const simbolo: SimboloDeDirecao = pct >= LIMITE_PCT ? 'sobe' : pct <= -LIMITE_PCT ? 'desce' : 'estavel'
  const texto = pct > 0 ? `+${pct}%` : pct < 0 ? `${MENOS}${Math.abs(pct)}%` : '0%'
  return { pct, simbolo, texto }
}

/** O mesmo percentual a partir dos dois ganhos inteiros de M3(a). Base zero não tem percentual: quem chama não chama. */
export function pctDosGanhos(ganhoRecente: number, ganhoAnterior: number): number {
  if (!(ganhoAnterior > 0)) throw new RangeError('base_zero')
  return arredonda((ganhoRecente - ganhoAnterior) / ganhoAnterior)
}

/** A régua vai de −limite a +limite, desenhada de 5% a 95% da largura; fora disso a ponta encosta e o valor verdadeiro segue no texto. */
export function posicaoNaRegua(pct: number, limite: 50 | 60, exato?: number): { fracao: number; foraDaEscala: 'acima' | 'abaixo' | null } {
  const valor = exato !== undefined ? exato * 100 : pct
  const foraDaEscala = valor > limite ? 'acima' : valor < -limite ? 'abaixo' : null
  const f = 0.05 + 0.9 * ((Math.min(Math.max(valor, -limite), limite) + limite) / (2 * limite))
  return { fracao: Number(f.toFixed(10)), foraDaEscala }
}

/** Posição de competição (1, 2, 2, 2, 5) de cada valor, do maior para o menor, na ordem de entrada. */
export function posicoesDeCompeticao(pcts: number[]): number[] {
  return pcts.map(p => 1 + pcts.filter(q => q > p).length)
}
