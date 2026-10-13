// A5 · E14: a seleção dos comentários de um lote lido. Pura: sem rede, sem banco, sem relógio.
// Três grupos nesta ordem, cada comentário em um só: criador, destaque, curtidos. O desempate é sempre `ordenar`.
import { COMMENT_RULES, SIZE_BANDS } from './regras'
import { ordenar } from './ordem'
import type { Conversa, Destaque, Escolhido } from './tipos'

/** Posição da faixa de tamanho: a maior faixa tem o maior número; faixa ausente ou desconhecida fica abaixo de todas. */
function pesoDaFaixa(faixa: string | null): number {
  if (faixa === null) return -1
  return SIZE_BANDS.findIndex(([nome]) => nome === faixa)
}

function ehDoCriador(c: Conversa): boolean {
  return c.doCriador || c.criadorRespondeu === true
}

/**
 * Escolhe até `r.target` comentários. `ordenada` já vem na ordem geral, então "empate pela ordem geral" é o `sort` estável.
 * Vaga de criador ou de destaque não usada passa para curtidos. Lote com menos de `target`: todos.
 */
export function selecionar(conversas: Conversa[], destaques: Map<string, Destaque>, r = COMMENT_RULES): Escolhido[] {
  const vistos = new Set<string>()
  const ordenada = ordenar(conversas).filter((c) => (vistos.has(c.id) ? false : (vistos.add(c.id), true)))
  const usados = new Set<string>()
  const saida: Escolhido[] = []

  const pegar = (c: Conversa, grupo: Escolhido['grupo']): void => {
    usados.add(c.id)
    saida.push({ conversa: c, grupo, destaque: destaques.get(c.id) ?? null })
  }

  for (const c of ordenada) {
    if (saida.length >= r.creatorMax) break
    if (ehDoCriador(c)) pegar(c, 'criador')
  }

  const candidatos = ordenada.filter((c) => !usados.has(c.id) && destaques.has(c.id))
  const acompanhados = candidatos.filter((c) => {
    const m = destaques.get(c.id)?.motivo
    return m === 'canal_acompanhado' || m === 'canal_proprio'
  })
  const grandes = candidatos
    .filter((c) => destaques.get(c.id)?.motivo === 'inscritos')
    .map((c, i) => ({ c, i, peso: pesoDaFaixa(destaques.get(c.id)?.faixaTamanho ?? null) }))
    .sort((a, b) => b.peso - a.peso || a.i - b.i)
    .map((x) => x.c)
  let nDestaque = 0
  for (const c of [...acompanhados, ...grandes]) {
    if (nDestaque >= r.featuredMax) break
    pegar(c, 'destaque')
    nDestaque++
  }

  for (const c of ordenada) {
    if (saida.length >= r.target) break
    if (!usados.has(c.id)) pegar(c, 'curtidos')
  }
  return saida
}
