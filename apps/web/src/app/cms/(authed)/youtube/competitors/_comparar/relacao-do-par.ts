/**
 * A5 E5a T7: a relação entre os lados das linhas novas (primeiros dias, longos publicados, reação). Mesma regra do `par-model`: o maior
 * só a partir de 10% (`LIMITE_IGUAL`), "×" só a partir de 2×, abaixo disso "+N%"; zero e nulo nunca viram razão. Puro.
 */
import { LIMITE_IGUAL } from './par-model'
import { TOL, dec, emVezes, fx } from './formatos'

export type RelacaoNova =
  | { tipo: 'maior'; lado: 0 | 1; texto: string }
  | { tipo: 'igual'; texto: string }

export function relacaoDoPar(
  xa: number | null, xb: number | null, nomes: readonly [string, string],
  o: { art: string; noun: string; plural?: boolean; ate?: string | null },
): RelacaoNova | null {
  if (xa == null || xb == null || !Number.isFinite(xa) || !Number.isFinite(xb) || xa <= 0 || xb <= 0) return null
  const lado: 0 | 1 = xb > xa ? 1 : 0
  const q = lado === 1 ? xb / xa : xa / xb
  if (q < LIMITE_IGUAL - TOL) return { tipo: 'igual', texto: o.plural ? 'praticamente iguais' : 'praticamente igual' }
  const maior = nomes[lado], menor = nomes[lado === 0 ? 1 : 0]
  const ate = o.ate ? ` (até ${o.ate})` : ''
  const corpo = emVezes(q) ? `${fx(q)} ${o.art} ${o.noun} de ${menor}` : `+${dec(Math.round((q - 1) * 100), 0)}% de ${o.noun}`
  return { tipo: 'maior', lado, texto: `${maior}: ${corpo}${ate}` }
}
