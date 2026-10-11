/**
 * A posição de um canal numa lista (spec 15.4 e emenda 45). Pura, sem motor: recebe só ids e números.
 * "1º = o maior": a posição é 1 + quantos têm valor MAIOR; empate divide a posição e a seguinte é pulada (1º, 1º, 3º).
 * Quem não tem o valor (null) fica fora do conjunto: não recebe posição e não conta no "de N".
 */
export interface Posicao { pos: number; de: number; empate: boolean }

/** 1 + quantos têm valor MAIOR; `de` conta só quem tem valor; quem não tem valor não entra e recebe null. */
export function posicoes(vals: ReadonlyArray<{ id: string; x: number | null }>): Map<string, Posicao | null> {
  const com = vals.filter((v): v is { id: string; x: number } => v.x != null)
  const out = new Map<string, Posicao | null>()
  for (const v of vals) {
    if (v.x == null) { out.set(v.id, null); continue }
    let maiores = 0, iguais = 0
    for (const o of com) { if (o.x > v.x) maiores++; else if (o.x === v.x && o.id !== v.id) iguais++ }
    out.set(v.id, { pos: 1 + maiores, de: com.length, empate: iguais > 0 })
  }
  return out
}

/** O conjunto de uma posição (emenda 45): os canais de um nicho, ou todos os canais do site ("no geral"). */
export type Conjunto = { tipo: 'nicho'; niche: string; label: string } | { tipo: 'geral' }

/** "em Viagem" | "no geral". Switch exaustivo: um tipo novo não compila sem a sua frase. */
export const conjuntoTexto = (c: Conjunto): string => {
  switch (c.tipo) {
    case 'nicho': return `em ${c.label}`
    case 'geral': return 'no geral'
    default: { const nunca: never = c; return nunca }
  }
}
