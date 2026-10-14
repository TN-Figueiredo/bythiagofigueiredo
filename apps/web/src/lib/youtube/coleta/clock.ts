// Relógio global e tetos da coleta. Sem import de banco nem de rede: a rota importa daqui.

export const RELOGIO_GLOBAL_MS = 270_000
// Soma dos tetos: 240 s. Com os 30 s de reserva da parte antiga da rota fecha os 270 s do relógio (clock.test.ts).
export const TETOS_MS = { metadados: 30_000, jobs: 20_000, relatorios: 120_000, alcance: 20_000, diario: 50_000 } as const
// Passos que só gastam o que sobra dos 270 s: não entram na soma de `TETOS_MS`; `relogio.prazo` os corta no fim do relógio.
export const TETOS_DE_FIM_MS = { retencao: 20_000, dimensoes: 30_000, normalizadores: 20_000 } as const
// A função morre aos 300 s; 4 s ficam para a resposta da rota.
export const LIMITE_DA_FUNCAO_MS = 296_000
export const FETCH_TIMEOUT_MS = 15_000
export const PARALELO = 4

export interface Relogio {
  inicio: number
  fim: number
  decorrido(): number
  /** Instante (epoch ms) em que o passo tem de parar: min(agora + teto, fim do relógio global). */
  prazo(tetoMs: number): number
}

export function criarRelogio(inicio: number = Date.now(), totalMs: number = RELOGIO_GLOBAL_MS): Relogio {
  const fim = inicio + totalMs
  return {
    inicio,
    fim,
    decorrido: () => Date.now() - inicio,
    prazo: (tetoMs: number) => Math.min(Date.now() + tetoMs, fim),
  }
}

/**
 * Prazo dos critérios que rodam DEPOIS dos 270 s (cobertura, retenção, desligados): ao contrário de `relogio.prazo`,
 * não é cortado no fim do relógio global, e sim nos 296 s da função. Prazo que já passou: o critério não consulta.
 */
export function prazoDoCriterio(relogio: Relogio, proprioMs: number): number {
  return Math.min(Date.now() + proprioMs, relogio.inicio + LIMITE_DA_FUNCAO_MS)
}

/** Milissegundos que faltam até o prazo; nunca negativo. */
export function restante(deadline: number): number {
  return Math.max(0, deadline - Date.now())
}

export class SemTempoError extends Error {
  constructor() {
    super('sem tempo: o prazo do passo acabou')
    this.name = 'SemTempoError'
  }
}

/** Um `fetch` que aborta em min(15 s, o que resta ao passo). Sem tempo, lança sem tocar na rede. */
export function fetchComPrazo(deadline: number, f: typeof fetch = fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const ms = Math.min(FETCH_TIMEOUT_MS, restante(deadline))
    if (ms <= 0) throw new SemTempoError()
    const prazo = AbortSignal.timeout(ms)
    const signal = init?.signal ? AbortSignal.any([init.signal, prazo]) : prazo
    try {
      return await f(input, { ...init, signal })
    } catch (e) {
      // O prazo do passo acabou com a chamada no ar: não é erro de rede, é falta de tempo.
      // Se sobrou tempo (estourou só o limite de 15 s da chamada, ou outro erro), o erro original segue.
      if (restante(deadline) <= 0) throw new SemTempoError()
      throw e
    }
  }) as typeof fetch
}

/** Roda `fn` sobre os itens com no máximo `limite` em voo. `fn` não pode lançar: trate o erro dentro dela. */
export async function emParalelo<T, R>(
  itens: readonly T[],
  limite: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(itens.length)
  let proximo = 0
  const operario = async () => {
    while (proximo < itens.length) {
      const i = proximo++
      out[i] = await fn(itens[i]!, i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, operario))
  return out
}

/** `Promise.race` contra min(15 s, o que resta ao passo). Devolve null quando o tempo vence. */
export async function comPrazo<T>(p: Promise<T>, deadline: number): Promise<T | null> {
  const ms = Math.min(FETCH_TIMEOUT_MS, restante(deadline))
  if (ms <= 0) return null
  let timer: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms)
  })
  try {
    return await Promise.race([p, limite])
  } finally {
    clearTimeout(timer)
  }
}
