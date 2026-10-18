// Um PostgREST de mentira para os leitores de comentários da E5a (C1): filtra por eq/in, ordena, limita, aceita abortSignal e REGISTRA
// cada pedido (tabela, colunas pedidas, filtros), para provar o que foi pedido e o que não foi.
import type { SupabaseClient } from '@supabase/supabase-js'

export type Linha = Record<string, unknown>
export interface Pedido { table: string; cols: string; eqs: Record<string, unknown>; ins: Record<string, readonly unknown[]> }
export interface FalsoComentarios { client: SupabaseClient; pedidos: Pedido[]; tabelas: Record<string, Linha[]> }
export interface OpcoesFalso {
  /** Toda leitura desta tabela devolve este erro do banco. */
  erroEm?: Record<string, { code: string; message?: string }>
  /** Toda leitura desta tabela devolve `data: null` sem erro. */
  dadoNuloEm?: string[]
  /** Toda leitura desta tabela LANÇA. */
  lancaEm?: string[]
}

const cmp = (a: unknown, b: unknown): number => (a === b ? 0 : (a as string | number) < (b as string | number) ? -1 : 1)

export function falsoComentarios(tabelas: Record<string, Linha[]>, opts: OpcoesFalso = {}): FalsoComentarios {
  const pedidos: Pedido[] = []
  const from = (table: string): unknown => {
    let rows = [...(tabelas[table] ?? [])]
    let cols: string[] = []
    let colsBruto = ''
    const eqs: Record<string, unknown> = {}
    const ins: Record<string, readonly unknown[]> = {}
    const orders: Array<{ col: string; asc: boolean }> = []
    let limite: number | null = null
    const executar = async (): Promise<{ data: unknown; error: unknown }> => {
      pedidos.push({ table, cols: colsBruto, eqs: { ...eqs }, ins: { ...ins } })
      if (opts.lancaEm?.includes(table)) throw new Error('lancou ' + table)
      const erro = opts.erroEm?.[table]
      if (erro) return { data: null, error: erro }
      if (opts.dadoNuloEm?.includes(table)) return { data: null, error: null }
      const ord = [...rows].sort((a, b) => { for (const o of orders) { const c = cmp(a[o.col], b[o.col]); if (c) return o.asc ? c : -c } return 0 })
      const fatia = limite === null ? ord : ord.slice(0, limite)
      return { data: fatia.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null]))), error: null }
    }
    const q = {
      select(s: string) { colsBruto = s; cols = s.split(',').map((x) => x.trim()).filter(Boolean); return q },
      eq(c: string, v: unknown) { eqs[c] = v; rows = rows.filter((r) => r[c] === v); return q },
      in(c: string, vs: readonly unknown[]) { ins[c] = vs; const set = new Set(vs.map(String)); rows = rows.filter((r) => set.has(String(r[c]))); return q },
      or(f: string) { eqs.or = f; return q },
      is(c: string, v: null) { eqs[c + ':is'] = v; rows = rows.filter((r) => (r[c] ?? null) === v); return q },
      gt(c: string, v: unknown) { eqs[c + ':gt'] = v; rows = rows.filter((r) => Number(r[c]) > Number(v)); return q },
      order(c: string, o?: { ascending?: boolean }) { orders.push({ col: c, asc: o?.ascending !== false }); return q },
      limit(n: number) { limite = n; return q },
      abortSignal() { return q },
      then: (ok: (r: { data: unknown; error: unknown }) => unknown, ko?: (e: unknown) => unknown) => executar().then(ok, ko),
    }
    return q
  }
  return { client: { from } as unknown as SupabaseClient, pedidos, tabelas }
}
