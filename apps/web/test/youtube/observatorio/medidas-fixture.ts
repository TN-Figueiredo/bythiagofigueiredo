// A5 E4, Tarefa 13: o falso de PostgREST dos leitores das medidas. Tabelas em memória; `select` (com projeção das colunas pedidas),
// `eq`, `neq`, `in`, `gte`, `order` e `range`; no máximo 1.000 linhas por pedido (como o PostgREST); contador de consultas e registro
// das colunas e dos filtros. A Tarefa 14 acrescenta a fixture cheia a este arquivo.
import type { SupabaseClient } from '@supabase/supabase-js'

export type Linha = Record<string, unknown>
export interface Consulta { tabela: string; colunas: string[]; filtros: Array<{ op: 'eq' | 'neq' | 'in' | 'gte'; coluna: string; valor: unknown }>; de: number | null; ate: number | null }
export interface FalsoOpcoes {
  /** Erro devolvido (no campo `error`) a toda consulta desta tabela. */
  erros?: Record<string, { code: string; message: string }>
  /** A consulta a esta tabela lança. */
  lancam?: string[]
  /** Colunas que "ainda não existem": pedir uma delas devolve 42703. */
  colunasAusentes?: Record<string, string[]>
}

const comparavel = (v: unknown): string | number | null => (typeof v === 'number' || typeof v === 'string' ? v : null)

export function falsoPostgrest(tabelas: Record<string, Linha[]>, op: FalsoOpcoes = {}) {
  const consultas: Consulta[] = []
  const sb = {
    from(tabela: string) {
      const c: Consulta = { tabela, colunas: [], filtros: [], de: null, ate: null }
      let ordem: string[] = []
      const b = {
        select(cols: string) { c.colunas = cols.split(',').map((x) => x.trim()).filter(Boolean); return b },
        eq(coluna: string, valor: unknown) { c.filtros.push({ op: 'eq', coluna, valor }); return b },
        neq(coluna: string, valor: unknown) { c.filtros.push({ op: 'neq', coluna, valor }); return b },
        in(coluna: string, valor: unknown[]) { c.filtros.push({ op: 'in', coluna, valor }); return b },
        gte(coluna: string, valor: unknown) { c.filtros.push({ op: 'gte', coluna, valor }); return b },
        order(coluna: string) { ordem = [...ordem, coluna]; return b },
        range(de: number, ate: number) { c.de = de; c.ate = ate; return b },
        then(ok: (r: { data: unknown; error: unknown }) => unknown, falha?: (e: unknown) => unknown) {
          return executar().then(ok, falha)
        },
      }
      async function executar(): Promise<{ data: unknown; error: unknown }> {
        consultas.push(c)
        if (op.lancam?.includes(tabela)) throw new Error('FRASE-SENTINELA-LANCADA')
        const erro = op.erros?.[tabela]
        if (erro) return { data: null, error: erro }
        const ausentes = op.colunasAusentes?.[tabela] ?? []
        if (c.colunas.some((x) => ausentes.includes(x))) return { data: null, error: { code: '42703', message: 'column does not exist' } }
        const base = tabelas[tabela]
        if (!base) return { data: null, error: { code: '42P01', message: 'relation does not exist' } }
        let linhas = base.filter((l) => c.filtros.every((f) => {
          const v = l[f.coluna]
          if (f.op === 'eq') return v === f.valor
          if (f.op === 'neq') return v !== f.valor
          if (f.op === 'in') return Array.isArray(f.valor) && f.valor.includes(v)
          const a = comparavel(v), z = comparavel(f.valor)
          return a !== null && z !== null && a >= z
        }))
        if (ordem.length) {
          linhas = [...linhas].sort((x, y) => {
            for (const k of ordem) {
              const a = comparavel(x[k]), z = comparavel(y[k])
              if (a === null || z === null || a === z) continue
              return a < z ? -1 : 1
            }
            return 0
          })
        }
        const de = c.de ?? 0
        const ate = c.ate === null ? de + 999 : Math.min(c.ate, de + 999)
        linhas = linhas.slice(de, ate + 1)
        const cols = c.colunas
        return { data: linhas.map((l) => Object.fromEntries(cols.map((k) => [k, l[k] ?? null]))), error: null }
      }
      return b
    },
  } as unknown as SupabaseClient
  return { sb, consultas }
}
