/**
 * PostgREST em memória, só o bastante para os testes de leitura do pipeline: aplica de verdade
 * `eq`, `in`, `gte`, `not(col, 'in', '("a","b")')`, `order` (várias chaves), `limit` e `range`
 * sobre as linhas de cada tabela, e registra cada consulta.
 *
 * Existe porque um dublê que devolve respostas enfileiradas não enxerga um filtro que falta:
 * "o snapshot do canal A só traz notas dos vídeos de A" só é verificável se o dublê filtrar.
 *
 * Coluna pedida no `select` que não existe em NENHUMA linha da tabela nem em `columns` devolve o
 * erro 42703 do Postgres, como o banco faz. É o que pega um `select('total_views')`.
 */
export interface FakeQuery {
  table: string
  select: string
  filters: Array<{ op: string; col: string; value: unknown }>
  orders: Array<{ col: string; ascending: boolean }>
  limit: number | null
  range: [number, number] | null
  terminal: 'many' | 'single' | 'maybeSingle'
}

export interface FakeError { code?: string; message: string }
type Row = Record<string, unknown>

export interface FakePostgrestOptions {
  /** Linhas por tabela. Tabela ausente daqui = tabela que não existe (PGRST205). */
  tables: Record<string, Row[]>
  /** Colunas que existem mesmo sem aparecer em nenhuma linha (tabela vazia, coluna toda nula). */
  columns?: Record<string, string[]>
  /** Erro forçado: devolve o erro para a consulta, ou null para deixar passar. */
  fail?: (q: FakeQuery) => FakeError | null
}

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a < b ? -1 : 1
}

export function fakePostgrest(opts: FakePostgrestOptions) {
  const queries: FakeQuery[] = []

  function run(q: FakeQuery): { data: unknown; error: FakeError | null } {
    queries.push(q)
    const forced = opts.fail?.(q)
    if (forced) return { data: null, error: forced }

    const all = opts.tables[q.table]
    if (!all) return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${q.table}' in the schema cache` } }

    const cols = q.select.split(',').map(c => c.trim()).filter(Boolean)
    const star = cols.includes('*')
    if (!star) {
      const known = new Set<string>(opts.columns?.[q.table] ?? [])
      for (const r of all) for (const k of Object.keys(r)) known.add(k)
      const missing = cols.find(c => !known.has(c))
      if (missing) return { data: null, error: { code: '42703', message: `column ${q.table}.${missing} does not exist` } }
    }

    let rows = all.filter(r => q.filters.every(f => {
      const v = r[f.col]
      if (f.op === 'eq') return v === f.value
      if (f.op === 'in') return (f.value as unknown[]).includes(v)
      if (f.op === 'gte') return cmp(v, f.value) >= 0
      if (f.op === 'not.in') return !(f.value as unknown[]).includes(v)
      throw new Error(`fakePostgrest: filtro não suportado: ${f.op}`)
    }))
    if (q.orders.length) {
      rows = [...rows].sort((a, b) => {
        for (const o of q.orders) {
          const c = cmp(a[o.col], b[o.col])
          if (c !== 0) return o.ascending ? c : -c
        }
        return 0
      })
    }
    if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1)
    if (q.limit != null) rows = rows.slice(0, q.limit)
    const out = star ? rows.map(r => ({ ...r })) : rows.map(r => Object.fromEntries(cols.map(c => [c, r[c] ?? null])))

    if (q.terminal === 'many') return { data: out, error: null }
    if (out.length === 1) return { data: out[0], error: null }
    if (out.length === 0 && q.terminal === 'maybeSingle') return { data: null, error: null }
    return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
  }

  function from(table: string) {
    const q: FakeQuery = { table, select: '*', filters: [], orders: [], limit: null, range: null, terminal: 'many' }
    const b = {
      select(cols: string) { q.select = cols; return b },
      eq(col: string, value: unknown) { q.filters.push({ op: 'eq', col, value }); return b },
      in(col: string, value: unknown[]) { q.filters.push({ op: 'in', col, value }); return b },
      gte(col: string, value: unknown) { q.filters.push({ op: 'gte', col, value }); return b },
      not(col: string, op: string, value: string) {
        if (op !== 'in') throw new Error(`fakePostgrest: not(${op}) não suportado`)
        q.filters.push({ op: 'not.in', col, value: value.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')) })
        return b
      },
      order(col: string, o?: { ascending?: boolean }) { q.orders.push({ col, ascending: o?.ascending ?? true }); return b },
      limit(n: number) { q.limit = n; return b },
      range(a: number, z: number) { q.range = [a, z]; return b },
      single: async () => run({ ...q, terminal: 'single' }),
      maybeSingle: async () => run({ ...q, terminal: 'maybeSingle' }),
      then<T>(resolve: (v: { data: unknown; error: FakeError | null }) => T) { return Promise.resolve(run(q)).then(resolve) },
    }
    return b
  }

  return {
    client: { from },
    queries,
    /** As consultas feitas a uma tabela, na ordem. */
    on: (table: string) => queries.filter(q => q.table === table),
  }
}
