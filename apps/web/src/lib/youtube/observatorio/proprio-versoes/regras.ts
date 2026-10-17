// Regras das versões do vídeo próprio (E18). Os números moram aqui e só aqui; `RULES.proprio` aponta para este objeto.
// Objeto mutável de propósito (sem `as const`): o teste do item 193 troca o valor e restaura.

export const PROPRIO_RULES = {
  /** Impressões mínimas em cada lado da troca para o antes e depois ter taxa e faixa. */
  trocaMinImpressoesPorLado: 100,
  /** Quantos dias cada lado do antes e depois olha. */
  trocaJanelaDias: 7,
  /** Retoque (bytes mudaram, imagem quase igual) conta como troca para cortar o lado da vizinha? */
  retoqueContaComoTroca: false,
  /** Folga (em pontos de taxa, 0,004 = 0,4 ponto) abaixo da qual as faixas de um "subiu" ou "caiu" "quase se tocam" na frase. */
  trocaFaixasQuaseSeTocam: 0.004,
}

export type RegrasTroca = typeof PROPRIO_RULES
