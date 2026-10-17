// A5 E5a, Tarefa 14b: o desempenho de um vídeo contra o normal do canal (Lançamentos e frase do topo). Puro.
import { MEASURE_RULES } from '../medidas/regras'
import { curvaDoCanal, type PontoDaCurva, type VideoComSerie } from '../medidas/curva'
import type { Formato, Medida } from '../medidas/tipos'

export type FaixaDeLancamento = 'muito_acima' | 'acima' | 'perto' | 'abaixo'

/** A faixa de uma razão (vídeo ÷ normal): 2 vezes ou mais; 1,5 a 2; no meio; menos de dois terços (dúvida 1 do NOTAS 15, aceita). */
export function faixaDeLancamento(razao: number): FaixaDeLancamento {
  if (razao >= 2) return 'muito_acima'
  if (razao >= 1.5) return 'acima'
  if (razao >= 2 / 3) return 'perto'
  return 'abaixo'
}

const um = (x: number): string => x.toFixed(1).replace('.', ',')

/**
 * "2,8 vezes o normal", "0,9 vez o normal, abaixo", "＝ perto do normal" (dentro do limiar de "igual" da E4, importado).
 * Até 2 o plural é "vez" (0,9 vez; 1,5 vez). Normal zero ou não finito não tem razão: nunca "∞ vezes".
 */
export function razaoEscrita(valor: number, normal: number): { texto: string; igual: boolean } {
  if (!(normal > 0) || !Number.isFinite(valor) || !Number.isFinite(normal)) return { texto: 'sem normal para comparar', igual: false }
  const razao = valor / normal
  // toFixed tira o resíduo de ponto flutuante (1,1 − 1 = 0,10000000000000009)
  const igual = Number(Math.abs(razao - 1).toFixed(9)) <= MEASURE_RULES.equalPct
  if (igual) return { texto: '＝ perto do normal', igual: true }
  const n = um(razao)
  const palavra = Number(n.replace(',', '.')) >= 2 ? 'vezes' : 'vez'
  return { texto: `${n} ${palavra} o normal${razao < 1 ? ', abaixo' : ''}`, igual: false }
}

/** O normal do canal sem o vídeo `semId`: um vídeo não pode ser o próprio termo de comparação (pergunta 21). */
export function normalSem(videos: ReadonlyArray<VideoComSerie & { id: string }>, semId: string, o: { formato: Formato; agoraMs: number }): Medida<PontoDaCurva[]> {
  return curvaDoCanal(videos.filter((v) => v.id !== semId), o)
}
