// A5 · E14: a ordem única da etapa. É o desempate de toda seleção.
import type { Conversa } from './tipos'

/** Curtidas desc; respostasTotal desc; posicao asc; id em ordem alfabética. Não altera a entrada. */
export function ordenar(conversas: Conversa[]): Conversa[] {
  return [...conversas].sort((a, b) => {
    if (a.curtidas !== b.curtidas) return b.curtidas - a.curtidas
    if (a.respostasTotal !== b.respostasTotal) return b.respostasTotal - a.respostasTotal
    if (a.posicao !== b.posicao) return a.posicao - b.posicao
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}
