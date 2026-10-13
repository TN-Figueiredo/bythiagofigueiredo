/** O relógio do disparo. Todos os tempos em ms contados de `t0` (o começo da função), salvo onde dito. */
export const LIMITE_FUNCAO_MS = 300_000            // um teste confere com `maxDuration` da rota
export const ARRENDAMENTO_TTL_S = 290
export const HORARIA_ULTIMA_ONDA_MS = 22_000       // depois disto a leitura horária não começa onda nova
export const HORARIA_CHAMADA_MS = 8_000            // AbortSignal.timeout de cada videos.list
export const HORARIA_FIM_MS = 60_000               // fimAteMs da leitura horária; nenhuma ida ao banco dela começa depois de 55 s
export const BANCO_MS = 5_000                      // abortSignal de cada ida ao banco da agenda e da leitura horária
export const LEVE_COMECA_ATE_MS = 75_000
export const LEVE_FIM_MS = 90_000                  // teto do fimAteMs de toda tarefa `sempre` e `leve`
export const PESADA_FIM_MS = 285_000               // LIMITE_FUNCAO_MS − RECORD_RESERVE_MS: o `late` que a rota tem hoje
export const RODANDO_VENCE_MIN = 10

/**
 * Corrida contra um prazo: devolve o valor ou `{ estourou: true }`; limpa o timer; a promessa que perde ganha `.catch(() => undefined)`.
 * Nunca lança por causa do prazo. Prazo zero, negativo ou NaN já estourou: devolve na hora (a promessa segue por conta própria, sem erro solto).
 * Uma rejeição que chega ANTES do prazo é da promessa, não do prazo, e propaga.
 */
export function comPrazo<T>(p: Promise<T>, ms: number): Promise<{ valor: T } | { estourou: true }> {
  p.catch(() => undefined)
  if (!(ms > 0)) return Promise.resolve({ estourou: true })
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({ estourou: true }), ms)
    p.then(
      valor => { clearTimeout(timer); resolve({ valor }) },
      err => { clearTimeout(timer); reject(err) },
    )
  })
}
