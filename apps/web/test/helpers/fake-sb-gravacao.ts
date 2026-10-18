// Cliente Supabase falso das rotas de gravação do A/B Lab (S8-F1): tabelas em memória, filtros eq/in/is/gte/lt,
// `or` (só marca a consulta: linhas com `_soNaSegunda: true` ficam fora dela), order/range (paginação de 1.000),
// erro injetável por tabela e rpc registrada. `lidas` guarda cada página pedida (tabela + início do intervalo).
import type { SupabaseClient } from '@supabase/supabase-js'

export type Linha = Record<string, unknown>

export interface FakeSb {
  sb: SupabaseClient
  tabelas: Record<string, Linha[]>
  erros: Record<string, string>
  lidas: Array<{ tabela: string; de: number }>
  rpcs: Array<{ nome: string; args: Record<string, unknown> }>
  rpcRetorno: Record<string, unknown>
  /** consultas lógicas = primeira página de cada leitura */
  consultasLogicas: () => number
}

export function criarFakeSb(tabelas: Record<string, Linha[]> = {}): FakeSb {
  const f: FakeSb = {
    sb: null as unknown as SupabaseClient,
    tabelas,
    erros: {},
    lidas: [],
    rpcs: [],
    rpcRetorno: {},
    consultasLogicas: () => f.lidas.filter((l) => l.de === 0).length,
  }
  const from = (tabela: string) => {
    const filtros: Array<(l: Linha) => boolean> = []
    let faixa: [number, number] | null = null
    let usouOr = false
    const q: Record<string, unknown> = {}
    q.select = () => q
    q.eq = (c: string, v: unknown) => { filtros.push((l) => l[c] === v); return q }
    q.is = (c: string, v: unknown) => { filtros.push((l) => (l[c] ?? null) === v); return q }
    q.in = (c: string, vs: unknown[]) => { filtros.push((l) => vs.includes(l[c])); return q }
    q.gte = (c: string, v: string) => { filtros.push((l) => String(l[c]) >= v); return q }
    q.lt = (c: string, v: string) => { filtros.push((l) => String(l[c]) < v); return q }
    q.or = () => { usouOr = true; return q }
    q.order = () => q
    q.range = (a: number, b: number) => { faixa = [a, b]; return q }
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
      f.lidas.push({ tabela, de: faixa ? faixa[0] : 0 })
      if (f.erros[tabela]) return Promise.resolve({ data: null, error: { message: f.erros[tabela] } }).then(ok, ko)
      let hit = (f.tabelas[tabela] ?? []).filter((l) => filtros.every((g) => g(l)))
      if (usouOr) hit = hit.filter((l) => l._soNaSegunda !== true)
      if (faixa) hit = hit.slice(faixa[0], faixa[1] + 1)
      return Promise.resolve({ data: hit.map((l) => ({ ...l })), error: null }).then(ok, ko)
    }
    return q
  }
  f.sb = {
    from,
    rpc: (nome: string, args: Record<string, unknown>) => {
      f.rpcs.push({ nome, args })
      if (f.erros[`rpc:${nome}`]) return Promise.resolve({ data: null, error: { message: f.erros[`rpc:${nome}`] } })
      return Promise.resolve({ data: f.rpcRetorno[nome] ?? 0, error: null })
    },
  } as unknown as SupabaseClient
  return f
}
