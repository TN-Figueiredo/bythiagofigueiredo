// A5 · E7, Tarefa 11: a lista de termos que nenhuma frase de tela ou de resposta de concorrente pode ter. Uma só, em constante de
// teste: o teste das frases (E7) e o das frases das telas (E5a, Tarefa 1) a importam. Fonte: CONVENCOES.md do lote 2 dos mockups,
// regra 8 ("frases sem jargão interno") e o item 56 (a palavra "retenção" nunca aparece numa tela de concorrente).
export const TERMOS_PROIBIDOS = ['lido', 'gravou', 'CTR', 'diário', 'cron vermelho', 'série', 'snapshot', 'payload', 'pipeline', 'retenção'] as const

/** O primeiro termo proibido que aparece no texto como palavra inteira (sem diferenciar maiúscula), ou `null`. */
export function acharTermoProibido(texto: string): string | null {
  for (const termo of TERMOS_PROIBIDOS) {
    const re = new RegExp('(?<![\\p{L}\\p{N}])' + termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'iu')
    if (re.test(texto)) return termo
  }
  return null
}
