// A5 · E5a: troca de menções por marcador. Módulo puro (sem server-only), para o empacotador do pacote da IA importar valor sem puxar os validadores dos tokens.
/** O marcador que ocupa o lugar de uma menção. */
export const MARCADOR_DE_MENCAO = '@…'

/**
 * Troca toda menção (`@` seguido de caracteres até o primeiro espaço) pelo marcador fixo. Limites conhecidos: nome por extenso, sem `@`,
 * não é reconhecido; nome de exibição de duas palavras perde só a primeira ("@João Silva" vira "@… Silva").
 */
export function semMencoes(texto: string): { texto: string; trocadas: number } {
  let trocadas = 0
  const saida = texto.replace(/@\S*/g, () => { trocadas += 1; return MARCADOR_DE_MENCAO })
  return { texto: saida, trocadas }
}
