/**
 * PostgREST em memória, só o bastante para os testes de leitura do pipeline: aplica de verdade
 * `eq`, `in`, `gte`, `not(col, 'in', '("a","b")')`, `order` (várias chaves), `limit` e `range`
 * sobre as linhas de cada tabela, e registra cada consulta.
 *
 * Existe porque um dublê que devolve respostas enfileiradas não enxerga um filtro que falta:
 * "o snapshot do canal A só traz notas dos vídeos de A" só é verificável se o dublê filtrar.
 *
 * Escrita: `insert`/`update`/`delete` mutam as linhas da tabela. Coluna no payload que não existe
 * em `columns` (nem em linha alguma) devolve PGRST204, como o PostgREST; `gen_random_uuid()` e
 * `created_at` não são simulados (o `id` vem de `idFor`, se dado, ou `<tabela>-<n>`).
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
  /** `select(cols, { count, head })`. */
  count: 'exact' | null
  head: boolean
  /** `select` por padrão; `insert`/`update`/`delete` gravam nas linhas da tabela. */
  op?: 'select' | 'insert' | 'update' | 'delete'
  payload?: Row | Row[]
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
  /**
   * Teto de linhas por resposta, como o `max_rows` do PostgREST (1000 no Supabase): `limit` e
   * `range` maiores que o teto NÃO devolvem mais linhas, e não há erro. Sem a opção, sem teto.
   */
  maxRows?: number
  /** Gera o `id` das linhas inseridas (default `<tabela>-<n>`). */
  idFor?: (table: string, n: number) => string
  /** FK ON DELETE CASCADE: `delete` em `<tabela>` apaga as linhas filhas (`filha.coluna = id`). */
  cascade?: Record<string, Array<{ table: string; column: string }>>
}

function splitTopLevel(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out
}

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a < b ? -1 : 1
}

export function fakePostgrest(opts: FakePostgrestOptions) {
  const queries: FakeQuery[] = []
  let inserts = 0

  function run(q: FakeQuery): { data: unknown; error: FakeError | null; count?: number | null } {
    queries.push(q)
    const forced = opts.fail?.(q)
    if (forced) return { data: null, error: forced }

    const all = opts.tables[q.table]
    if (!all) return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${q.table}' in the schema cache` } }

    if (q.op === 'insert') {
      const known = new Set<string>(opts.columns?.[q.table] ?? [])
      for (const r of all) for (const k of Object.keys(r)) known.add(k)
      const inserted: Row[] = []
      for (const p of Array.isArray(q.payload) ? q.payload : [q.payload ?? {}]) {
        const bad = Object.keys(p).find(k => !known.has(k))
        if (bad) return { data: null, error: { code: 'PGRST204', message: `Could not find the '${bad}' column of '${q.table}' in the schema cache` } }
        const row: Row = { ...p }
        if (row.id === undefined && known.has('id')) { inserts += 1; row.id = opts.idFor?.(q.table, inserts) ?? `${q.table}-${inserts}` }
        all.push(row)
        inserted.push(row)
      }
      if (q.terminal === 'many') return { data: inserted.map(r => ({ ...r })), error: null }
      return { data: { ...inserted[0]! }, error: null }
    }

    // Itens do select no nível de cima. `rel(...)`, `alias:rel!inner(...)` são embeds: não são
    // validados (o dublê não conhece o esquema da outra tabela); a linha de teste traz o objeto
    // embutido sob a chave `alias ?? rel`.
    const items = splitTopLevel(q.select).map(c => c.trim()).filter(Boolean)
    const embeds = items.filter(c => c.includes('(')).map(c => {
      const head = c.slice(0, c.indexOf('('))
      const key = head.includes(':') ? head.split(':')[0]!.trim() : head.split('!')[0]!.trim()
      return { key, inner: head.includes('!inner') }
    })
    const cols = items.filter(c => !c.includes('('))
    const star = cols.includes('*')
    if (!star) {
      const known = new Set<string>(opts.columns?.[q.table] ?? [])
      for (const r of all) for (const k of Object.keys(r)) known.add(k)
      const missing = cols.find(c => !known.has(c))
      if (missing) return { data: null, error: { code: '42703', message: `column ${q.table}.${missing} does not exist` } }
    }

    // Coluna de filtro: `col` da linha, ou `rel.col` de um embed.
    const read = (r: Row, col: string): unknown => {
      if (col.includes('.')) {
        const [rel, c] = col.split('.') as [string, string]
        const o = r[rel]
        return o && typeof o === 'object' ? (o as Row)[c] : undefined
      }
      return r[col]
    }
    const like = (v: unknown, pat: unknown) => {
      const needle = String(pat).replace(/%/g, '').toLowerCase()
      return typeof v === 'string' && v.toLowerCase().includes(needle)
    }
    let rows = all.filter(r => embeds.every(e => !e.inner || r[e.key] != null)).filter(r => q.filters.every(f => {
      const v = read(r, f.col)
      if (f.op === 'eq') return v === f.value
      if (f.op === 'neq') return v !== f.value
      if (f.op === 'is') return (f.value === null ? v == null : v === f.value)
      if (f.op === 'in') return (f.value as unknown[]).includes(v)
      if (f.op === 'gte') return cmp(v, f.value) >= 0
      if (f.op === 'lte') return cmp(v, f.value) <= 0
      if (f.op === 'ilike') return like(v, f.value)
      if (f.op === 'contains') return Array.isArray(v) && (f.value as unknown[]).every(x => v.includes(x))
      if (f.op === 'textSearch') return true
      if (f.op === 'or') {
        return String(f.value).split(',').some(cond => {
          const [c, op, ...rest] = cond.split('.')
          const val = rest.join('.')
          const cv = read(r, c!)
          if (op === 'ilike') return like(cv, val)
          if (op === 'eq') return String(cv) === val
          throw new Error(`fakePostgrest: or(${op}) não suportado`)
        })
      }
      if (f.op === 'not.in') return !(f.value as unknown[]).includes(v)
      if (f.op === 'not.like') return !(typeof v === 'string' && v.startsWith(String(f.value).replace(/%/g, '')))
      if (f.op === 'not.is') return !(f.value === null ? v == null : v === f.value)
      throw new Error(`fakePostgrest: filtro não suportado: ${f.op}`)
    }))
    if (q.op === 'update' || q.op === 'delete') {
      if (q.op === 'update') {
        const known = new Set<string>(opts.columns?.[q.table] ?? [])
        for (const r of all) for (const k of Object.keys(r)) known.add(k)
        const bad = Object.keys(q.payload ?? {}).find(k => !known.has(k))
        if (bad) return { data: null, error: { code: 'PGRST204', message: `Could not find the '${bad}' column of '${q.table}' in the schema cache` } }
        for (const r of rows) Object.assign(r, q.payload)
      } else {
        for (const r of rows) {
          all.splice(all.indexOf(r), 1)
          for (const c of opts.cascade?.[q.table] ?? []) {
            const child = opts.tables[c.table]
            if (child) opts.tables[c.table] = child.filter(x => x[c.column] !== r.id)
          }
        }
      }
      const out = rows.map(r => ({ ...r }))
      if (q.terminal === 'many') return { data: out, error: null }
      if (out.length === 1) return { data: out[0], error: null }
      return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
    }
    if (q.orders.length) {
      rows = [...rows].sort((a, b) => {
        for (const o of q.orders) {
          const c = cmp(a[o.col], b[o.col])
          if (c !== 0) return o.ascending ? c : -c
        }
        return 0
      })
    }
    const total = rows.length
    if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1)
    if (q.limit != null) rows = rows.slice(0, q.limit)
    if (opts.maxRows != null) rows = rows.slice(0, opts.maxRows)
    if (q.head) return { data: null, error: null, count: q.count ? total : null }
    const out = rows.map(r => {
      const base: Row = star ? { ...r } : Object.fromEntries(cols.map(c => [c, r[c] ?? null]))
      for (const e of embeds) base[e.key] = r[e.key] ?? null
      return base
    })

    if (q.terminal === 'many') return { data: out, error: null, count: q.count ? total : null }
    if (out.length === 1) return { data: out[0], error: null }
    if (out.length === 0 && q.terminal === 'maybeSingle') return { data: null, error: null }
    return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
  }

  function from(table: string) {
    const q: FakeQuery = { table, select: '*', filters: [], orders: [], limit: null, range: null, terminal: 'many', count: null, head: false }
    const b = {
      insert(payload: Row | Row[]) { q.op = 'insert'; q.payload = payload; return b },
      update(payload: Row) { q.op = 'update'; q.payload = payload; return b },
      delete() { q.op = 'delete'; return b },
      select(cols: string, o?: { count?: 'exact'; head?: boolean }) {
        q.select = cols
        if (o?.count) q.count = o.count
        if (o?.head) q.head = true
        return b
      },
      eq(col: string, value: unknown) { q.filters.push({ op: 'eq', col, value }); return b },
      in(col: string, value: unknown[]) { q.filters.push({ op: 'in', col, value }); return b },
      gte(col: string, value: unknown) { q.filters.push({ op: 'gte', col, value }); return b },
      lte(col: string, value: unknown) { q.filters.push({ op: 'lte', col, value }); return b },
      neq(col: string, value: unknown) { q.filters.push({ op: 'neq', col, value }); return b },
      is(col: string, value: unknown) { q.filters.push({ op: 'is', col, value }); return b },
      ilike(col: string, value: string) { q.filters.push({ op: 'ilike', col, value }); return b },
      or(value: string) { q.filters.push({ op: 'or', col: '', value }); return b },
      contains(col: string, value: unknown[]) { q.filters.push({ op: 'contains', col, value }); return b },
      textSearch(col: string, value: string) { q.filters.push({ op: 'textSearch', col, value }); return b },
      not(col: string, op: string, value: string) {
        if (op === 'like') { q.filters.push({ op: 'not.like', col, value }); return b }
        if (op === 'is') { q.filters.push({ op: 'not.is', col, value: value === 'null' ? null : value }); return b }
        if (op !== 'in') throw new Error(`fakePostgrest: not(${op}) não suportado`)
        q.filters.push({ op: 'not.in', col, value: value.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')) })
        return b
      },
      order(col: string, o?: { ascending?: boolean }) { q.orders.push({ col, ascending: o?.ascending ?? true }); return b },
      limit(n: number) { q.limit = n; return b },
      range(a: number, z: number) { q.range = [a, z]; return b },
      single: async () => run({ ...q, terminal: 'single' }),
      maybeSingle: async () => run({ ...q, terminal: 'maybeSingle' }),
      then<T>(resolve: (v: { data: unknown; error: FakeError | null; count?: number | null }) => T) { return Promise.resolve(run(q)).then(resolve) },
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
