// Banco em memória para os testes da coleta. Cobre só o que os passos usam do supabase-js:
// from().select/insert/upsert/update/delete com eq, neq, in, lt, lte, gt, gte, is, not, or, order,
// limit, maybeSingle, single, e rpc(). `or()` é ignorado (os testes semeiam só o que interessa).
// Datas são comparadas como texto: use sempre toISOString() ou 'YYYY-MM-DD' nas sementes.
import type { SupabaseClient } from '@supabase/supabase-js'

export type Row = Record<string, unknown>
export interface FakeErr { code: string; message: string }
interface Resposta { data: unknown; error: FakeErr | null; count: number | null }

export interface FakeDb {
  tables: Record<string, Row[]>
  /** Toda operação na tabela (ou em `rpc:<nome>`) devolve este erro. */
  errors: Record<string, FakeErr | undefined>
  /** Só as escritas na tabela devolvem este erro. */
  writeErrors: Record<string, FakeErr | undefined>
  rpcCalls: Array<{ name: string; args: Row }>
  rpcHandlers: Record<string, (args: Row) => { data: unknown; error: FakeErr | null }>
  writes: Array<{ table: string; op: string; payload: unknown }>
  client: SupabaseClient
}

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a == null) return -1
  if (b == null) return 1
  return (a as string | number) < (b as string | number) ? -1 : 1
}

class Consulta implements PromiseLike<Resposta> {
  private filtros: Array<(r: Row) => boolean> = []
  private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'
  private payload: Row | Row[] | null = null
  private conflito: string[] = []
  private ignorarDuplicados = false
  private ordens: Array<{ col: string; asc: boolean }> = []
  private max: number | null = null
  private um = false
  private head = false
  private querCount = false

  constructor(private db: FakeDb, private tabela: string) {}

  select(_cols?: string, o?: { count?: string; head?: boolean }) {
    if (this.op === 'select') { this.head = !!o?.head; this.querCount = !!o?.count }
    return this
  }
  insert(p: Row | Row[]) { this.op = 'insert'; this.payload = p; return this }
  upsert(p: Row | Row[], o?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.op = 'upsert'
    this.payload = p
    this.conflito = (o?.onConflict ?? '').split(',').map(s => s.trim()).filter(Boolean)
    this.ignorarDuplicados = !!o?.ignoreDuplicates
    return this
  }
  update(p: Row) { this.op = 'update'; this.payload = p; return this }
  delete() { this.op = 'delete'; return this }

  eq(c: string, v: unknown) { this.filtros.push(r => r[c] === v); return this }
  neq(c: string, v: unknown) { this.filtros.push(r => r[c] !== v); return this }
  in(c: string, vs: readonly unknown[]) { this.filtros.push(r => vs.includes(r[c])); return this }
  lt(c: string, v: unknown) { this.filtros.push(r => r[c] != null && cmp(r[c], v) < 0); return this }
  lte(c: string, v: unknown) { this.filtros.push(r => r[c] != null && cmp(r[c], v) <= 0); return this }
  gt(c: string, v: unknown) { this.filtros.push(r => r[c] != null && cmp(r[c], v) > 0); return this }
  gte(c: string, v: unknown) { this.filtros.push(r => r[c] != null && cmp(r[c], v) >= 0); return this }
  is(c: string, v: unknown) { this.filtros.push(r => (r[c] ?? null) === v); return this }
  not(c: string, _op: string, v: unknown) { this.filtros.push(r => (r[c] ?? null) !== v); return this }
  or(_expr: string) { return this }
  order(col: string, o?: { ascending?: boolean }) { this.ordens.push({ col, asc: o?.ascending !== false }); return this }
  limit(n: number) { this.max = n; return this }
  maybeSingle() { this.um = true; return this }
  single() { this.um = true; return this }

  then<A = Resposta, B = never>(
    ok?: ((v: Resposta) => A | PromiseLike<A>) | null,
    falha?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.rodar()).then(ok, falha)
  }

  private rodar(): Resposta {
    const erro = this.db.errors[this.tabela] ?? (this.op === 'select' ? undefined : this.db.writeErrors[this.tabela])
    if (erro) return { data: null, error: erro, count: null }
    const linhas = (this.db.tables[this.tabela] ??= [])
    const casa = (r: Row) => this.filtros.every(f => f(r))

    if (this.op === 'select') {
      let out = linhas.filter(casa)
      for (const o of [...this.ordens].reverse()) out = [...out].sort((a, b) => cmp(a[o.col], b[o.col]) * (o.asc ? 1 : -1))
      const total = out.length
      if (this.max !== null) out = out.slice(0, this.max)
      if (this.head) return { data: null, error: null, count: total }
      return { data: this.um ? (out[0] ?? null) : out, error: null, count: this.querCount ? total : null }
    }

    this.db.writes.push({ table: this.tabela, op: this.op, payload: this.payload })
    const lista = Array.isArray(this.payload) ? this.payload : this.payload ? [this.payload] : []

    if (this.op === 'insert') {
      linhas.push(...lista.map(p => ({ ...p })))
      return { data: lista, error: null, count: null }
    }
    if (this.op === 'upsert') {
      for (const p of lista) {
        const i = this.conflito.length ? linhas.findIndex(r => this.conflito.every(k => r[k] === p[k])) : -1
        if (i === -1) linhas.push({ ...p })
        else if (!this.ignorarDuplicados) linhas[i] = { ...linhas[i], ...p }
      }
      return { data: lista, error: null, count: null }
    }
    const alvo = linhas.filter(casa)
    if (this.op === 'update') {
      for (const r of alvo) Object.assign(r, this.payload)
      return { data: alvo, error: null, count: null }
    }
    this.db.tables[this.tabela] = linhas.filter(r => !casa(r))
    return { data: alvo, error: null, count: null }
  }
}

export function fakeSupabase(seed: Record<string, Row[]> = {}): FakeDb {
  const db = {
    tables: structuredClone(seed), errors: {}, writeErrors: {}, rpcCalls: [], rpcHandlers: {}, writes: [],
  } as unknown as FakeDb

  // Mesmo comportamento de public.yt_own_attempt_record: uma linha por escopo, kind e dia UTC; soma attempts.
  db.rpcHandlers.yt_own_attempt_record = (a) => {
    const t = (db.tables.yt_own_collection_attempts ??= [])
    const dia = new Date().toISOString().slice(0, 10)
    const linha = {
      scope_type: a.p_scope_type, scope_id: a.p_scope_id, kind: a.p_kind, attempt_day: dia,
      site_id: a.p_site_id, channel_id: a.p_channel_id ?? null, outcome: a.p_outcome,
      http_status: a.p_http_status ?? null, error: a.p_error ?? null,
    }
    const i = t.findIndex(r => r.scope_type === linha.scope_type && r.scope_id === linha.scope_id && r.kind === linha.kind && r.attempt_day === dia)
    if (i === -1) { t.push({ ...linha, attempts: 1 }); return { data: 1, error: null } }
    const n = (t[i]!.attempts as number) + 1
    t[i] = { ...linha, attempts: n }
    return { data: n, error: null }
  }

  db.client = {
    from: (tabela: string) => new Consulta(db, tabela),
    rpc: (name: string, args: Row = {}) => {
      db.rpcCalls.push({ name, args })
      const erro = db.errors[`rpc:${name}`]
      if (erro) return Promise.resolve({ data: null, error: erro })
      const h = db.rpcHandlers[name]
      return Promise.resolve(h ? h(args) : { data: null, error: null })
    },
  } as unknown as SupabaseClient
  return db
}
