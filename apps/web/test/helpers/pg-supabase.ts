/**
 * Um `SupabaseClient` mínimo em cima de UMA conexão `pg`, para os testes de integração que precisam rodar um passo da coleta de
 * verdade DENTRO de uma transação desfeita (o cliente HTTP do Supabase abre outra conexão e não enxerga o que ainda não foi gravado).
 * Cobre só o que `passoVersoes` usa: `select` com `eq`/`in`/`gte`/`lte`/`lt`/`not(..., 'is', null)`/`order`/`range`/`limit`/`maybeSingle`,
 * contagem com `head`, e `rpc` por argumentos nomeados. Linhas voltam como JSON (data como `AAAA-MM-DD`), como o PostgREST devolve.
 * Erro de banco vira `{ data: null, error: { code, message } }` e a transação continua viva (savepoint por chamada).
 */
import type { Client } from 'pg'
import type { SupabaseClient } from '@supabase/supabase-js'

type Resposta = { data: unknown; error: { code?: string; message?: string } | null; count?: number | null }
const IDENT = /^[a-z_][a-z0-9_]*$/

function ident(x: string): string {
  if (!IDENT.test(x)) throw new Error(`identificador inválido no pg-supabase: ${x}`)
  return x
}

let seq = 0
async function comSavepoint(pg: Client, fn: () => Promise<Resposta>): Promise<Resposta> {
  const nome = `sp_pgsb_${++seq}`
  await pg.query(`savepoint ${nome}`)
  try {
    const r = await fn()
    await pg.query(`release savepoint ${nome}`)
    return r
  } catch (e) {
    await pg.query(`rollback to savepoint ${nome}`)
    const err = e as { code?: string; message?: string }
    return { data: null, error: { code: err.code, message: err.message } }
  }
}

class Consulta implements PromiseLike<Resposta> {
  private colunas = '*'
  private contar = false
  private head = false
  private filtros: string[] = []
  private params: unknown[] = []
  private ordens: string[] = []
  private de: number | null = null
  private qtd: number | null = null
  private um = false

  constructor(private readonly pg: Client, private readonly tabela: string) { ident(tabela) }

  select(colunas = '*', opc: { count?: string; head?: boolean } = {}): this {
    this.colunas = colunas === '*' ? '*' : colunas.split(',').map(c => ident(c.trim())).join(', ')
    this.contar = opc.count !== undefined
    this.head = opc.head === true
    return this
  }
  private cmp(col: string, op: string, v: unknown): this { this.params.push(v); this.filtros.push(`${ident(col)} ${op} $${this.params.length}`); return this }
  eq(col: string, v: unknown): this { return this.cmp(col, '=', v) }
  gte(col: string, v: unknown): this { return this.cmp(col, '>=', v) }
  lte(col: string, v: unknown): this { return this.cmp(col, '<=', v) }
  lt(col: string, v: unknown): this { return this.cmp(col, '<', v) }
  in(col: string, vs: readonly unknown[]): this { this.params.push(vs); this.filtros.push(`${ident(col)} = any($${this.params.length})`); return this }
  not(col: string, op: string, v: unknown): this {
    if (op !== 'is' || v !== null) throw new Error('pg-supabase: só not(col, "is", null)')
    this.filtros.push(`${ident(col)} is not null`)
    return this
  }
  order(col: string, o: { ascending?: boolean; nullsFirst?: boolean } = {}): this {
    this.ordens.push(`${ident(col)} ${o.ascending === false ? 'desc' : 'asc'}${o.nullsFirst === undefined ? '' : o.nullsFirst ? ' nulls first' : ' nulls last'}`)
    return this
  }
  range(a: number, b: number): this { this.de = a; this.qtd = b - a + 1; return this }
  limit(n: number): this { this.qtd = n; return this }
  maybeSingle(): this { this.um = true; this.qtd = 2; return this }

  then<A = Resposta, B = never>(ok?: ((v: Resposta) => A | PromiseLike<A>) | null, falha?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return this.rodar().then(ok, falha)
  }

  private rodar(): Promise<Resposta> {
    return comSavepoint(this.pg, async () => {
      const onde = this.filtros.length > 0 ? ` where ${this.filtros.join(' and ')}` : ''
      if (this.contar && this.head) {
        const r = await this.pg.query(`select count(*)::int as n from public.${this.tabela}${onde}`, this.params)
        return { data: null, error: null, count: (r.rows[0] as { n: number }).n }
      }
      const ord = this.ordens.length > 0 ? ` order by ${this.ordens.join(', ')}` : ''
      const lim = this.qtd !== null ? ` limit ${this.qtd}` : ''
      const off = this.de !== null && this.de > 0 ? ` offset ${this.de}` : ''
      const r = await this.pg.query(`select row_to_json(x) as j from (select ${this.colunas} from public.${this.tabela}${onde}${ord}${lim}${off}) x`, this.params)
      const linhas = r.rows.map(l => (l as { j: unknown }).j)
      if (this.um) return { data: linhas[0] ?? null, error: null }
      return { data: linhas, error: null }
    })
  }
}

export function pgSupabase(pg: Client): SupabaseClient {
  return {
    from: (tabela: string) => new Consulta(pg, tabela),
    rpc: (nome: string, args: Record<string, unknown> = {}): PromiseLike<Resposta> => {
      const chaves = Object.keys(args).map(ident)
      const params = chaves.map(k => { const v = args[k]; return v !== null && typeof v === 'object' ? JSON.stringify(v) : v })
      const lista = chaves.map((k, i) => `${k} => $${i + 1}`).join(', ')
      return comSavepoint(pg, async () => {
        const r = await pg.query(`select to_jsonb(public.${ident(nome)}(${lista})) as r`, params)
        return { data: (r.rows[0] as { r: unknown }).r, error: null }
      }) as unknown as PromiseLike<Resposta>
    },
  } as unknown as SupabaseClient
}
