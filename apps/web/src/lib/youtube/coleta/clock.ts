// Relógio global e tetos da coleta. Sem import de banco nem de rede: a rota importa daqui.

export const RELOGIO_GLOBAL_MS = 270_000
export const TETOS_MS = { metadados: 30_000, jobs: 20_000, relatorios: 60_000 } as const
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
    return f(input, { ...init, signal })
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
