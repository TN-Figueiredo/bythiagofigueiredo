// Banco em memória para os testes da coleta. Cobre só o que os passos usam do supabase-js:
// from().select/insert/upsert/update/delete com eq, neq, in, lt, lte, gt, gte, is, not, or, order,
// limit, maybeSingle, single, e rpc(). `or()` é ignorado (os testes semeiam só o que interessa).
// Datas são comparadas como texto: use sempre toISOString() ou 'YYYY-MM-DD' nas sementes.
// Fora de escopo: validação de nomes de coluna (coluna inexistente não dá 42703 aqui).
// Estrito como o PostgREST: or()/not() com operador não suportado lançam; single() exige 1 linha;
// escrita só devolve linhas com .select(); insert duplicado dá 23505; onConflict sem chave única dá 42P10;
// insert/upsert em lote de chaves heterogêneas: a chave ausente numa linha vira null nela (defaultToNull do supabase-js);
// ordenação padrão do Postgres (NULLs por último no asc, primeiro no desc); neq exclui nulos.
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
  /** Chaves únicas por tabela (PK). Usadas por insert (23505) e upsert onConflict (42P10). */
  uniqueKeys: Record<string, string[][]>
}

export const CHAVES_UNICAS_L1A: Record<string, string[][]> = {
  yt_reporting_jobs: [['channel_id', 'report_type_id']],
  yt_reporting_reports: [['report_id']],
  yt_reporting_report_blobs: [['report_id']],
  yt_own_video_meta_daily: [['youtube_video_id', 'day_pt']],
  yt_own_collection_attempts: [['scope_type', 'scope_id', 'kind', 'attempt_day']],
  yt_own_video_daily: [['youtube_video_id', 'day_pt']],
  yt_own_video_reach_daily: [['youtube_video_id', 'day_pt']],
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
  private ordens: Array<{ col: string; asc: boolean; nullsFirst: boolean }> = []
  private max: number | null = null
  private head = false
  private modo: 'lista' | 'um' | 'talvez' = 'lista'
  private retorna = false
  private colunas: string[] | null = null
  private promessa: Promise<Resposta> | null = null
  private erroBuilder: Error | null = null
  private querCount = false

  constructor(private db: FakeDb, private tabela: string) {}

  select(cols?: string, o?: { count?: string; head?: boolean }) {
    if (this.op !== 'select') this.retorna = true
    this.head = !!o?.head
    this.querCount = !!o?.count
    const c = (cols ?? '*').split(',').map(x => x.trim()).filter(Boolean)
    this.colunas = c.length && !c.includes('*') && c.every(x => /^\w+$/.test(x)) ? c : null
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
  neq(c: string, v: unknown) { this.filtros.push(r => r[c] != null && r[c] !== v); return this }
  in(c: string, vs: readonly unknown[]) { this.filtros.push(r => vs.includes(r[c])); return this }
  lt(c: string, v: unknown) { this.filtros.push(r => r[c] != null && cmp(r[c], v) < 0); return this }
  lte(c: string, v: unknown) { this.filtros.push(r => r[c] != null && cmp(r[c], v) <= 0); return this }
  gt(c: string, v: unknown) { this.filtros.push(r => r[c] != null && cmp(r[c], v) > 0); return this }
  gte(c: string, v: unknown) { this.filtros.push(r => r[c] != null && cmp(r[c], v) >= 0); return this }
  is(c: string, v: unknown) { this.filtros.push(r => (r[c] ?? null) === v); return this }
  not(c: string, op: string, v: unknown) {
    if (op === 'is') this.filtros.push(r => (r[c] ?? null) !== v)
    else if (op === 'eq') this.filtros.push(r => r[c] != null && r[c] !== v)
    else throw new Error(`not(${op}) não é suportado pelo banco em memória`)
    return this
  }
  or(_expr: string): never { throw new Error('or() não é suportado pelo banco em memória') }
  order(col: string, o?: { ascending?: boolean; nullsFirst?: boolean }) {
    const asc = o?.ascending !== false
    this.ordens.push({ col, asc, nullsFirst: o?.nullsFirst ?? !asc })
    return this
  }
  limit(n: number) { this.max = n; return this }
  maybeSingle() { this.modo = 'talvez'; return this }
  single() { this.modo = 'um'; return this }

  then<A = Resposta, B = never>(
    ok?: ((v: Resposta) => A | PromiseLike<A>) | null,
    falha?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    this.promessa ??= Promise.resolve().then(() => this.rodar())
    return this.promessa.then(ok, falha)
  }

  private rodar(): Resposta {
    const erro = this.db.errors[this.tabela] ?? (this.op === 'select' ? undefined : this.db.writeErrors[this.tabela])
    if (erro) return { data: null, error: erro, count: null }
    const linhas = (this.db.tables[this.tabela] ??= [])
    const casa = (r: Row) => this.filtros.every(f => f(r))

    if (this.op === 'select') {
      let out = linhas.filter(casa)
      for (const o of [...this.ordens].reverse()) {
        out = [...out].sort((a, b) => {
          const na = a[o.col] == null, nb = b[o.col] == null
          if (na || nb) return na === nb ? 0 : (na ? 1 : -1) * (o.nullsFirst ? -1 : 1)
          return cmp(a[o.col], b[o.col]) * (o.asc ? 1 : -1)
        })
      }
      const total = out.length
      if (this.max !== null) out = out.slice(0, this.max)
      if (this.head) return { data: null, error: null, count: total }
      const proj = out.map(r => this.projetar(r))
      const count = this.querCount ? total : null
      if (this.modo === 'lista') return { data: proj, error: null, count }
      if (proj.length === 1 || (proj.length === 0 && this.modo === 'talvez')) return { data: proj[0] ?? null, error: null, count }
      return { data: null, error: { code: 'PGRST116', message: `JSON object requested, multiple (or no) rows returned (${proj.length})` }, count }
    }

    this.db.writes.push({ table: this.tabela, op: this.op, payload: this.payload })
    const bruta = Array.isArray(this.payload) ? this.payload : this.payload ? [this.payload] : []
    // Como o supabase-js (defaultToNull): em lote, a chave que falta numa linha e existe em outra vira NULL nela.
    const uniao = bruta.length > 1 ? [...new Set(bruta.flatMap(r => Object.keys(r)))] : []
    const lista = uniao.length ? bruta.map(r => ({ ...Object.fromEntries(uniao.map(k => [k, null])), ...r })) : bruta

    const chaves = this.db.uniqueKeys[this.tabela] ?? []
    const saida = (rows: Row[]): Resposta => ({ data: this.retorna ? rows.map(r => this.projetar(r)) : null, error: null, count: null })

    if (this.op === 'insert') {
      for (const p of lista) {
        if (chaves.some(k => linhas.some(r => k.every(c => r[c] === p[c])))) {
          return { data: null, error: { code: '23505', message: `duplicate key value violates unique constraint on ${this.tabela}` }, count: null }
        }
        linhas.push({ ...p })
      }
      return saida(lista)
    }
    if (this.op === 'upsert') {
      if (this.conflito.length && !chaves.some(k => k.length === this.conflito.length && k.every(c => this.conflito.includes(c)))) {
        return { data: null, error: { code: '42P10', message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification' }, count: null }
      }
      for (const p of lista) {
        const i = this.conflito.length ? linhas.findIndex(r => this.conflito.every(k => r[k] === p[k])) : -1
        if (i === -1) linhas.push({ ...p })
        else if (!this.ignorarDuplicados) linhas[i] = { ...linhas[i], ...p }
      }
      return saida(lista)
    }
    const alvo = linhas.filter(casa)
    if (this.op === 'update') {
      for (const r of alvo) Object.assign(r, this.payload)
      return saida(alvo)
    }
    this.db.tables[this.tabela] = linhas.filter(r => !casa(r))
    return saida(alvo)
  }

  private projetar(r: Row): Row {
    const c = structuredClone(r)
    if (!this.colunas) return c
    return Object.fromEntries(this.colunas.map(k => [k, c[k]]))
  }
}

const SCOPES = ['video', 'canal', 'job']
const KINDS = ['sondagem', 'meta', 'thumbnail', 'relatorio', 'diario', 'retencao_vida']
const OUTCOMES_OK = ['ok', 'sem_dado_na_janela', 'video_novo', 'sem_conexao', 'sem_autorizacao', 'erro_http', 'nao_alcancado_orcamento', 'schema_ausente']

export function fakeSupabase(
  seed: Record<string, Row[]> = {},
  uniqueKeys: Record<string, string[][]> = CHAVES_UNICAS_L1A,
): FakeDb {
  const db = {
    tables: structuredClone(seed), errors: {}, writeErrors: {}, rpcCalls: [], rpcHandlers: {}, writes: [], uniqueKeys,
  } as unknown as FakeDb

  // Mesmo comportamento de public.yt_own_attempt_record: uma linha por escopo, kind e dia UTC; soma attempts.
  db.rpcHandlers.yt_own_attempt_record = (a) => {
    if (a.p_site_id == null) return { data: null, error: { code: '23502', message: 'null value in column "site_id"' } }
    if (!SCOPES.includes(a.p_scope_type as string) || !KINDS.includes(a.p_kind as string) || !OUTCOMES_OK.includes(a.p_outcome as string)) {
      return { data: null, error: { code: '23514', message: 'violates check constraint on yt_own_collection_attempts' } }
    }
    const t = (db.tables.yt_own_collection_attempts ??= [])
    const dia = new Date().toISOString().slice(0, 10)
    const linha = {
      scope_type: a.p_scope_type, scope_id: a.p_scope_id, kind: a.p_kind, attempt_day: dia,
      site_id: a.p_site_id, channel_id: a.p_channel_id ?? null, outcome: a.p_outcome,
      http_status: a.p_http_status ?? null, error: (typeof a.p_error === 'string' ? a.p_error.slice(0, 500) : null),
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
      return Promise.resolve(h ? h(args) : { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}` } })
    },
  } as unknown as SupabaseClient
  return db
}

/**
 * Mesmo comportamento de public.yt_own_reach_apply: insere; sobrescreve só quando o relatório é mais novo
 * (create_time maior, comparado como instante) ou é o mesmo relatório. Devolve quantas linhas mudaram.
 * Como o Postgres: o lote é atômico (erro = nada gravado), duas linhas com a mesma chave no lote dão 21000,
 * e jsonb_to_recordset lê a chave ausente como nula (a regra do video_id continua: nulo não apaga o gravado).
 */
export function comReachApply(db: FakeDb): FakeDb {
  db.rpcHandlers.yt_own_reach_apply = (a) => {
    const linhas = (a.p_rows ?? []) as Row[]
    const t = (db.tables.yt_own_video_reach_daily ??= [])
    const erro = (code: string, message: string) => ({ data: null, error: { code, message } })
    const vistas = new Set<string>()
    for (const l of linhas) {
      if (l.youtube_video_id == null || l.day_pt == null) {
        return erro('23502', 'null value in column of yt_own_video_reach_daily')
      }
      const chave = JSON.stringify([l.youtube_video_id, l.day_pt])
      if (vistas.has(chave)) return erro('21000', 'ON CONFLICT DO UPDATE command cannot affect row a second time')
      vistas.add(chave)
      if (l.site_id == null || l.channel_id == null || l.source_report_id == null || l.report_create_time == null || l.metric_version == null) {
        return erro('23502', 'null value in column of yt_own_video_reach_daily')
      }
    }
    let n = 0
    for (const l of linhas) {
      const i = t.findIndex(r => r.youtube_video_id === l.youtube_video_id && r.day_pt === l.day_pt)
      const nova = {
        ...l,
        thumbnail_impressions: l.thumbnail_impressions ?? null,
        thumbnail_ctr: l.thumbnail_ctr ?? null,
        video_id: l.video_id ?? null,
        source: 'reporting_api',
        collected_at: new Date().toISOString(),
      }
      if (i === -1) { t.push(nova); n++; continue }
      const atual = t[i]!
      const maisNovo = Date.parse(l.report_create_time as string) > Date.parse(atual.report_create_time as string)
      if (maisNovo || l.source_report_id === atual.source_report_id) {
        t[i] = { ...atual, ...nova, video_id: nova.video_id ?? atual.video_id ?? null }
        n++
      }
    }
    return { data: n, error: null }
  }
  return db
}
