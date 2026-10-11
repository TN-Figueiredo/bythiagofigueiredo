/**
 * A posição de um canal numa lista (spec 15.4 e emenda 45). Pura, sem motor: recebe só ids e números.
 * "1º = o maior": a posição é 1 + quantos têm valor MAIOR; empate divide a posição e a seguinte é pulada (1º, 1º, 3º).
 * Quem não tem o valor (null) fica fora do conjunto: não recebe posição e não conta no "de N".
 */
export interface Posicao { pos: number; de: number; empate: boolean }

/**
 * 1 + quantos têm valor MAIOR; `de` conta só quem tem valor; quem não tem valor não entra e recebe null.
 * `chave` é o valor como a tela o escreve ("0,2"): dois canais que se escrevem igual dividem a posição e levam "empate", mesmo que o número
 * cru difira (uma frase "9º ... com 0,2" ao lado de "(0,2)" do vizinho pareceria erro). Sem `chave`, vale o número.
 */
export function posicoes(vals: ReadonlyArray<{ id: string; x: number | null; chave?: string }>): Map<string, Posicao | null> {
  const com = vals.filter((v): v is { id: string; x: number; chave?: string } => v.x != null)
  const igual = (a: { x: number; chave?: string }, b: { x: number; chave?: string }) => (a.chave != null && b.chave != null ? a.chave === b.chave : a.x === b.x)
  const out = new Map<string, Posicao | null>()
  for (const v of vals) {
    if (v.x == null) { out.set(v.id, null); continue }
    const eu = { x: v.x, chave: v.chave }
    let maiores = 0, iguais = 0
    for (const o of com) { if (o.id === v.id) continue; if (igual(o, eu)) iguais++; else if (o.x > v.x) maiores++ }
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
