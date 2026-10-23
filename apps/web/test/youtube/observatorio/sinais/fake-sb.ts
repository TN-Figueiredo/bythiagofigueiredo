// Cliente Supabase sintético para os testes da leitura dos sinais (F2 T8): registra cada consulta e devolve o que o teste manda.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface Consulta {
  tabela: string
  colunas: string
  opcoes: { count?: string; head?: boolean } | undefined
  filtros: Array<{ op: string; col: string; val: unknown }>
  ordem: Array<{ col: string; asc: boolean }>
  limite: number | null
  faixa: [number, number] | null
  mutacao: string | null
}
export type Resposta = { data: unknown; error?: { code?: string; message: string } | null; count?: number | null }
export type Respondedor = (c: Consulta) => Resposta

export function fakeSb(responder: Respondedor): { sb: SupabaseClient; consultas: Consulta[]; rpc: Array<{ nome: string; args: unknown }> } {
  const consultas: Consulta[] = []
  const rpc: Array<{ nome: string; args: unknown }> = []
  const construir = (tabela: string): unknown => {
    const c: Consulta = { tabela, colunas: '', opcoes: undefined, filtros: [], ordem: [], limite: null, faixa: null, mutacao: null }
    const q: Record<string, unknown> = {}
    const filtro = (op: string) => (col: string, val: unknown) => { c.filtros.push({ op, col, val }); return q }
    for (const op of ['eq', 'in', 'gt', 'gte', 'lt', 'lte', 'overlaps', 'not', 'or', 'is']) q[op] = filtro(op)
    q.select = (colunas: string, opcoes?: Consulta['opcoes']) => { c.colunas = colunas; c.opcoes = opcoes; return q }
    for (const m of ['insert', 'update', 'upsert', 'delete']) q[m] = () => { c.mutacao = m; return q }
    q.order = (col: string, o?: { ascending?: boolean }) => { c.ordem.push({ col, asc: o?.ascending !== false }); return q }
    q.limit = (n: number) => { c.limite = n; return q }
    q.range = (a: number, b: number) => { c.faixa = [a, b]; return q }
    const resolver = (): Resposta => { consultas.push(c); return responder(c) }
    q.maybeSingle = () => { const r = resolver(); return Promise.resolve({ data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error ?? null }) }
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
      const r = resolver()
      return Promise.resolve({ data: r.data, error: r.error ?? null, count: r.count ?? null }).then(ok, ko)
    }
    return q
  }
  const sb = {
    from: construir,
    rpc: (nome: string, args: unknown) => { rpc.push({ nome, args }); const r = responder({ tabela: `rpc:${nome}`, colunas: '', opcoes: undefined, filtros: [], ordem: [], limite: null, faixa: null, mutacao: null }); return Promise.resolve({ data: r.data, error: r.error ?? null }) },
  }
  return { sb: sb as unknown as SupabaseClient, consultas, rpc }
}
