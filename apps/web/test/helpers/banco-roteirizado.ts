import type { SupabaseClient } from '@supabase/supabase-js'

// Banco roteirizado para testes de unidade: cada `from(tabela)` / `rpc(nome)` consome o próximo resultado da fila do alvo; qualquer encadeamento serve.
export type Res = { data: unknown; error: { message: string; code?: string } | null }
/** Banco roteirizado: cada `from(tabela)` / `rpc(nome)` consome o próximo resultado da fila da tabela; qualquer encadeamento serve. */
export function roteiro(filas: Record<string, Res[]>) {
  const chamadas: Array<{ alvo: string; metodos: string[] }> = []
  const proximo = (alvo: string): Res => {
    const r = filas[alvo]?.shift()
    if (!r) throw new Error(`roteiro: sem resultado para ${alvo}`)
    return r
  }
  const cadeia = (alvo: string): unknown => {
    const reg = { alvo, metodos: [] as string[] }
    chamadas.push(reg)
    const q: Record<string, unknown> = new Proxy({}, {
      get: (_t, prop: string) => {
        if (prop === 'then') return (ok: (v: Res) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve().then(() => proximo(alvo)).then(ok, ko)
        if (prop === 'maybeSingle' || prop === 'single') return async () => { reg.metodos.push(prop); const r = proximo(alvo); return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error } }
        return (...a: unknown[]) => { reg.metodos.push(`${prop}(${a.map((x) => JSON.stringify(x)).join(',')})`); return q }
      },
    })
    return q
  }
  const sb = { from: (t: string) => cadeia(t), rpc: (n: string) => cadeia('rpc:' + n) } as unknown as SupabaseClient
  return { sb, chamadas, filas }
}
export const ok = (data: unknown): Res => ({ data, error: null })
