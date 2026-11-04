// A faithful next/cache for loader tests. The global stub (test/__stubs__/next-cache.ts) makes unstable_cache a
// pass-through: with it a hit, a tag invalidation and the 2 MB entry limit are never exercised. Use with
// vi.doMock('next/cache', () => cache.module) before importing the module under test.
export const NEXT_ENTRY_LIMIT = 2 * 1024 * 1024

export interface FakeNextCache {
  module: {
    unstable_cache: <A extends unknown[], R>(cb: (...args: A) => Promise<R>, keyParts?: string[], options?: { tags?: string[]; revalidate?: number | false }) => (...args: A) => Promise<R>
    revalidateTag: (tag: string, profile?: string | { expire?: number }) => void
    updateTag: (tag: string) => void
    revalidatePath: (path: string, type?: string) => void
  }
  /** key → stored body and tags. */
  entries: Map<string, { body: string; tags: string[]; revalidate?: number; idadeS?: number }>
  /** Keys whose callback ran. */
  misses: string[]
  /** Keys computed but NOT stored: over the limit, as Next does (incremental-cache/index.js, "items over 2MB"). */
  rejected: string[]
  invalidated: string[]
  /** As próximas `n` gravações são descartadas (o callback roda e devolve, mas nada é guardado), como o Next faz com a etiqueta pendente no mesmo request. */
  descartarProximas: (n: number) => void
  /** Daqui em diante cada gravação só termina quando o teste chamar a função devolvida (que também volta ao normal). */
  atrasarGravacoes: () => () => Promise<void>
  /** Marca a entrada (a chave inteira ou um pedaço dela, que deve achar uma só) com `s` segundos de idade: passando da validade, é servida velha e recalculada por trás. */
  envelhecer: (chave: string, s: number) => void
  /** Espera os recálculos por trás (entrada vencida) terminarem. */
  aguardarRecalculos: () => Promise<void>
}

export function createFakeNextCache(): FakeNextCache {
  const entries = new Map<string, { body: string; tags: string[] }>()
  const misses: string[] = [], rejected: string[] = [], invalidated: string[] = []
  let descartar = 0
  let atrasadas: Array<() => void> | null = null
  const porTras: Array<Promise<void>> = []
  const unstable_cache = <A extends unknown[], R>(cb: (...args: A) => Promise<R>, keyParts: string[] = [], options: { tags?: string[]; revalidate?: number | false } = {}) =>
    async (...args: A): Promise<R> => {
      // same recipe as next/dist/server/web/spec-extension/unstable-cache.js (fixedKey + JSON.stringify(args))
      const key = cb.toString() + '-' + keyParts.join(',') + '-' + JSON.stringify(args)
      const compute = async (): Promise<R> => {
        misses.push(key)
        // a throwing callback stores nothing: the error goes up
        const result = await cb(...args)
        const body = JSON.stringify(result)
        const size = JSON.stringify({ kind: 'FETCH', data: { headers: {}, body, status: 200, url: '' }, revalidate: options.revalidate ?? 31_536_000 }).length
        if (size > NEXT_ENTRY_LIMIT) rejected.push(key)
        else if (descartar > 0) descartar--
        else {
          const guardar = (): void => { entries.set(key, { body, tags: options.tags ?? [], revalidate: options.revalidate === false ? undefined : options.revalidate }) }
          if (atrasadas) await new Promise<void>(resolve => { atrasadas!.push(() => { guardar(); resolve() }) })
          else guardar()
        }
        return result
      }
      const hit = entries.get(key)
      if (hit) {
        // vencida: serve a velha e recalcula por trás (um recálculo que lança deixa a velha onde está)
        if (hit.revalidate !== undefined && hit.idadeS !== undefined && hit.idadeS > hit.revalidate) {
          hit.idadeS = undefined
          porTras.push(compute().then(() => undefined, () => undefined))
        }
        return JSON.parse(hit.body) as R
      }
      return compute()
    }
  const revalidateTag = (tag: string) => { invalidated.push(tag); for (const [k, e] of entries) if (e.tags.includes(tag)) entries.delete(k) }
  const descartarProximas = (n: number): void => { descartar = n }
  const atrasarGravacoes = (): (() => Promise<void>) => {
    const fila: Array<() => void> = []
    atrasadas = fila
    return async () => { atrasadas = null; for (const f of fila.splice(0)) f(); await Promise.resolve() }
  }
  const envelhecer = (chave: string, s: number): void => {
    const achadas = [...entries].filter(([k]) => k === chave || k.includes(chave))
    if (achadas.length !== 1) throw new Error('envelhecer: ' + achadas.length + ' entradas para "' + chave + '"')
    achadas[0]![1].idadeS = s
  }
  const aguardarRecalculos = async (): Promise<void> => { while (porTras.length) await porTras.shift() }
  return { entries, misses, rejected, invalidated, descartarProximas, atrasarGravacoes, envelhecer, aguardarRecalculos, module: { unstable_cache, revalidateTag, updateTag: revalidateTag, revalidatePath: () => {} } }
}
