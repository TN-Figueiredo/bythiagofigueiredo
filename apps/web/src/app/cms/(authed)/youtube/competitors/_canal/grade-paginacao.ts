/**
 * A paginação da grade de Capas a 390 px (decisão do dono, 13/10, sobre a recomendação do revisor de UX: "mostrar mais" de 24 em 24 no celular,
 * tudo de uma vez em tela larga). Função pura: dado o total de cartões da grade e quantos lotes de 24 a pessoa já pediu, diz quantos aparecem, quantos
 * ficam escondidos e o que o botão e a frase dizem. Quem esconde é o CSS (a 480 px ou menos, a mesma largura em que a grade vira uma coluna); aqui só
 * se conta. O mesmo número serve ao status lido em voz alta e ao `aria-valuenow` da barra.
 */
export const TAMANHO_PAGINA = 24

export interface PaginaGrade {
  /** O teto de cartões nesta página (lotes × 24). */
  limite: number
  mostrando: number
  ocultos: number
  /** Quantos vêm no próximo clique (0 = não há próximo). */
  proximo: number
  /** Texto do botão; `null` quando nada está escondido. */
  botao: string | null
  /** A frase miúda sob a contagem; `null` quando nada está escondido. */
  frase: string | null
}

export function paginarGrade(total: number, lotes: number): PaginaGrade {
  const t = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0))
  const l = Math.max(1, Math.floor(Number.isFinite(lotes) ? lotes : 1))
  const limite = l * TAMANHO_PAGINA
  const mostrando = Math.min(t, limite)
  const ocultos = t - mostrando
  if (ocultos === 0) return { limite, mostrando, ocultos: 0, proximo: 0, botao: null, frase: null }
  const proximo = Math.min(TAMANHO_PAGINA, ocultos), depois = ocultos - proximo
  const botao = depois > 0 ? `Mostrar mais ${proximo} vídeos` : proximo === 1 ? 'Mostrar o último vídeo' : `Mostrar os últimos ${proximo} vídeos`
  const faltam = ocultos === 1 ? 'Falta 1 vídeo.' : `Faltam ${ocultos} vídeos.`
  const frase = `${faltam} ${depois === 0 ? (ocultos === 1 ? 'Depois dele não falta nenhum.' : 'Depois deles não falta nenhum.') : depois === 1 ? `Depois dos próximos ${proximo} falta 1.` : `Depois dos próximos ${proximo} faltam ${depois}.`}`
  return { limite, mostrando, ocultos, proximo, botao, frase }
}

/**
 * Quantos lotes de 24 a grade precisa mostrar para incluir o cartão de índice `indice` (0 = o primeiro) numa lista de `total` cartões: `ceil((indice + 1) / 24)`.
 * `null` quando o cartão não existe na lista (índice negativo, fracionário, NaN, ou além do fim): quem chama não inventa lote. É o que o Voltar do Histórico
 * usa a 480 px ou menos, quando o último vídeo visto está além da página que a grade recém-montada mostra (B1 da revisão de UX dos ajustes finais).
 */
export function lotesParaMostrar(indice: number, total: number): number | null {
  if (!Number.isInteger(indice) || !Number.isInteger(total) || indice < 0 || indice >= total) return null
  return Math.ceil((indice + 1) / TAMANHO_PAGINA)
}
