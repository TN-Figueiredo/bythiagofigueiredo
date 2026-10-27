/** Manutenção M5, Tarefa 9: todo texto de ⓘ da página Arquivo passa por `INFO('...')`. Função identidade: serve para o teste de vocabulário (Tarefa 12) enxergar a exceção
 *  no código. Fica fora de `app/` para os módulos puros poderem importá-la. */
export const INFO = (texto: string): string => texto
