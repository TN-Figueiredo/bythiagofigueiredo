export const MAX_OBSERVADOS_POR_DISPARO = 50
export const MIN_SOBRA_MS = 10_000

export interface AlvoObs {
  siteId: string
  ytId: string
  rodadas: number
  ultimaRodadaEm: string | null
  saiuEm: string | null
  saiuPor: string | null
}
export interface CursorObs { siteId: string; ytId: string; avaliadoAteRodada: number; avaliadoEm: string }

export const chaveAlvo = (siteId: string, ytId: string): string => `${siteId}|${ytId}`

/**
 * Quais alvos avaliar neste disparo (§5.8, incremental). Devido: sem cursor, ou `rodadas <> avaliado_ate_rodada` (`<>`, não `>`: o alvo
 * recriado pela poda volta com `rodadas` zerado e o cursor guarda um valor maior), ou `ultima_rodada_em > avaliado_em`.
 * Ordem: sem cursor primeiro, depois o cursor mais antigo (sem starvation). Corta em `teto`.
 */
export function selecionarAlvos(alvos: readonly AlvoObs[], cursores: readonly CursorObs[], teto: number = MAX_OBSERVADOS_POR_DISPARO): { escolhidos: AlvoObs[]; devidos: number } {
  const porChave = new Map(cursores.map(c => [chaveAlvo(c.siteId, c.ytId), c]))
  const devidos = alvos.filter(a => {
    const c = porChave.get(chaveAlvo(a.siteId, a.ytId))
    if (!c) return true
    if (a.rodadas !== c.avaliadoAteRodada) return true
    return a.ultimaRodadaEm !== null && Date.parse(a.ultimaRodadaEm) > Date.parse(c.avaliadoEm)
  })
  const ordem = (a: AlvoObs): number => {
    const c = porChave.get(chaveAlvo(a.siteId, a.ytId))
    return c ? Date.parse(c.avaliadoEm) : -Infinity
  }
  const ordenados = [...devidos].sort((a, b) => {
    const d = ordem(a) - ordem(b)
    return Number.isNaN(d) || d === 0 ? (a.ytId < b.ytId ? -1 : a.ytId > b.ytId ? 1 : 0) : d
  })
  return { escolhidos: ordenados.slice(0, teto), devidos: devidos.length }
}
