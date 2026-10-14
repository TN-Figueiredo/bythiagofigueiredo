// Banco em memória para os testes da coleta. Cobre só o que os passos usam do supabase-js:
// from().select/insert/upsert/update/delete com eq, neq, in, lt, lte, gt, gte, is, not, or, order,
// limit, range, maybeSingle, single, e rpc(). `or()` é ignorado (os testes semeiam só o que interessa).
// Toda resposta de select passa por MAX_LINHAS_RESPOSTA (1000), como o max-rows do PostgREST.
// Datas são comparadas como texto: use sempre toISOString() ou 'YYYY-MM-DD' nas sementes.
// Fora de escopo: validação de nomes de coluna (coluna inexistente não dá 42703 aqui).
// Estrito como o PostgREST: or()/not() com operador não suportado lançam; single() exige 1 linha;
// escrita só devolve linhas com .select(); insert duplicado dá 23505; onConflict sem chave única dá 42P10;
// insert/upsert em lote de chaves heterogêneas: a chave ausente numa linha vira null nela (defaultToNull do supabase-js);
// ordenação padrão do Postgres (NULLs por último no asc, primeiro no desc); neq exclui nulos.
import type { SupabaseClient } from '@supabase/supabase-js'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
import { ehKind } from '@/lib/youtube/coleta/kinds'
import { comDailyApply } from './fake-daily-apply'

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
  /** Pode devolver uma promessa (que nunca resolve, num teste de prazo). */
  rpcHandlers: Record<string, (args: Row) => { data: unknown; error: FakeErr | null } | Promise<{ data: unknown; error: FakeErr | null }>>
  writes: Array<{ table: string; op: string; payload: unknown }>
  client: SupabaseClient
  /** Chaves únicas por tabela (PK). Usadas por insert (23505) e upsert onConflict (42P10). */
  uniqueKeys: Record<string, string[][]>
  /** Quantos selects cada tabela já recebeu (1 = o primeiro). */
  leituras: Record<string, number>
  /** Devolve um erro para o select de número `n` (1-based) da tabela (`colunas` = o texto do select); undefined deixa passar. */
  erroNaLeitura?: (tabela: string, n: number, colunas: string) => FakeErr | undefined
  /** Tabelas cujos selects com count devolvem count nulo (o PostgREST pode omitir a contagem). */
  semContagem: Record<string, boolean>
  /** Como o Postgres: linhas EMPATADAS em todo o ORDER BY saem em ordem arbitrária, diferente a cada consulta. Ligado, cada
   *  select embaralha antes de ordenar (sementes diferentes por leitura); sem desempate total, a paginação repete e perde linhas.
   *  Desligado (padrão), o empate sai na ordem de inserção, estável, o que esconde a falta de desempate. */
  embaralharEmpates?: boolean
}

/** Embaralhamento determinístico (mulberry32): o mesmo n dá a mesma ordem, n diferentes dão ordens diferentes. */
function embaralhar<T>(linhas: readonly T[], semente: number): T[] {
  const out = [...linhas]
  let a = (semente * 0x9e3779b1) >>> 0
  const rnd = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** `max-rows` do PostgREST (padrão do Supabase): nenhuma resposta passa disto, com ou sem limit()/range(). */
export const MAX_LINHAS_RESPOSTA = 1000

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
  private desde = 0
  private head = false
  private modo: 'lista' | 'um' | 'talvez' = 'lista'
  private retorna = false
  private colunas: string[] | null = null
  private promessa: Promise<Resposta> | null = null
  private erroBuilder: Error | null = null
  private querCount = false
  private colunasTexto = ''

  constructor(private db: FakeDb, private tabela: string) {}

  select(cols?: string, o?: { count?: string; head?: boolean }) {
    if (this.op !== 'select') this.retorna = true
    this.head = !!o?.head
    this.querCount = !!o?.count
    this.colunasTexto = cols ?? '*'
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
  /** Como o PostgREST: intervalo fechado [de, ate], 0-based. */
  range(de: number, ate: number) { this.desde = de; this.max = ate - de + 1; return this }
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
    if (this.op === 'select') {
      const n = (this.db.leituras[this.tabela] = (this.db.leituras[this.tabela] ?? 0) + 1)
      const erroN = this.db.erroNaLeitura?.(this.tabela, n, this.colunasTexto)
      if (erroN) return { data: null, error: erroN, count: null }
    }
    const casa = (r: Row) => this.filtros.every(f => f(r))

    if (this.op === 'select') {
      let out = linhas.filter(casa)
      if (this.db.embaralharEmpates) out = embaralhar(out, this.db.leituras[this.tabela] ?? 0)
      for (const o of [...this.ordens].reverse()) {
        out = [...out].sort((a, b) => {
          const na = a[o.col] == null, nb = b[o.col] == null
          if (na || nb) return na === nb ? 0 : (na ? 1 : -1) * (o.nullsFirst ? -1 : 1)
          return cmp(a[o.col], b[o.col]) * (o.asc ? 1 : -1)
        })
      }
      const total = out.length
      out = out.slice(this.desde, this.desde + Math.min(this.max ?? MAX_LINHAS_RESPOSTA, MAX_LINHAS_RESPOSTA))
      if (this.head) return { data: null, error: null, count: total }
      const proj = out.map(r => this.projetar(r))
      const count = this.querCount && !this.db.semContagem[this.tabela] ? total : null
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
const OUTCOMES_OK = ['ok', 'sem_dado_na_janela', 'video_novo', 'sem_conexao', 'sem_autorizacao', 'erro_http', 'nao_alcancado_orcamento', 'schema_ausente']

export function fakeSupabase(
  seed: Record<string, Row[]> = {},
  uniqueKeys: Record<string, string[][]> = CHAVES_UNICAS_L1A,
): FakeDb {
  const db = {
    tables: structuredClone(seed), errors: {}, writeErrors: {}, rpcCalls: [], rpcHandlers: {}, writes: [], uniqueKeys,
    leituras: {}, semContagem: {},
  } as unknown as FakeDb

  // Mesmo comportamento de public.yt_own_attempt_record: uma linha por escopo, kind e dia UTC; soma attempts.
  db.rpcHandlers.yt_own_attempt_record = (a) => {
    if (a.p_site_id == null) return { data: null, error: { code: '23502', message: 'null value in column "site_id"' } }
    if (!SCOPES.includes(a.p_scope_type as string) || !ehKind(a.p_kind) || !OUTCOMES_OK.includes(a.p_outcome as string)) {
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

  // E20 (MG13): a anti-junção de yt_reporting_guarda_conferir() sobre as tabelas em memória. Teste que semeia relatório
  // com downloaded_at e sem bruto é acusado, como em produção: o conserto é semear o bruto, nunca tirar esta resposta.
  db.rpcHandlers.yt_reporting_guarda_conferir = () => {
    const rel = db.tables.yt_reporting_reports ?? []
    const comBruto = new Set((db.tables.yt_reporting_report_blobs ?? []).map(b => b.report_id))
    const baixados = rel.filter(r => r.downloaded_at != null)
    const idsBaixados = new Set(baixados.map(r => r.report_id))
    return {
      data: [{
        brutos: comBruto.size,
        baixados: baixados.length,
        baixados_sem_bruto: baixados.filter(r => r.blob_lost_at == null && !comBruto.has(r.report_id)).length,
        brutos_sem_baixado: [...comBruto].filter(id => !idsBaixados.has(id)).length,
        perdas_reconhecidas: rel.filter(r => r.blob_lost_at != null).length,
      }],
      error: null,
    }
  }

  // Tarefa 3 (E6): a gravação do diário pela função. `db.errors['rpc:yt_own_daily_apply']` tem precedência (função ausente).
  comDailyApply(db)

  // Tarefa 11a (E8): os fatos da retenção. `db.errors['rpc:yt_own_retention_facts']` tem precedência (função ausente).
  comRetencaoFatosPadrao(db)

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
 * A5 E8 (Tarefa 11a): `yt_own_retention_facts` do falso. Sem vídeo semeado devolve `[]` (nenhum vídeo, nenhuma nota). Com vídeos
 * em `youtube_videos` (com `published_at`, como a função de verdade lista), devolve um fato "em dia" por vídeo do canal: diário em
 * dia, curva da vida lida hoje, janelas de 7 e 30 dias já gravadas. Ou seja, nada a ler e nada vencido: o passo não toca a API e o
 * critério não acusa. Uma lista vazia COM vídeos é, corretamente, defeito da função para o critério (vermelho), então o falso
 * não pode devolver `[]` para um canal que tem vídeo. A lógica de verdade é testada contra o Postgres (Tarefa 9b). Teste que quer
 * fatos específicos troca `db.rpcHandlers.yt_own_retention_facts`; teste que quer a função ausente usa `db.errors['rpc:…']`.
 */
function comRetencaoFatosPadrao(db: FakeDb): FakeDb {
  db.rpcHandlers.yt_own_retention_facts = (a) => {
    const hoje = typeof a.p_hoje_utc === 'string' ? a.p_hoje_utc : new Date().toISOString().slice(0, 10)
    const videos = (db.tables.youtube_videos ?? []).filter(v => v.channel_id === a.p_channel_id && v.published_at != null)
    return {
      data: videos.map(v => ({
        youtube_video_id: v.youtube_video_id, video_id: v.id, site_id: v.site_id,
        duration_seconds: typeof v.duration_seconds === 'number' ? v.duration_seconds : null,
        publicado_dia_pt: String(v.published_at).slice(0, 10),
        fonte_ate: hoje, views_total: null, ultimo_dia_com_view: null, views_7d: null, views_30d: null,
        vida_window_end: hoje, vida_collected_at: `${hoje}T12:00:00.000Z`, vida_views_at_read: null,
        tem_7d: true, tem_30d: true, primeira_tent_dia: hoje, leva_ancora_dia: hoje,
        diario_tent_dia: hoje, diario_tent_resultado: 'ok', diario_falhas_4d: 0,
        vida_tent_dia: hoje, vida_tent_resultado: 'ok', vida_resposta_dia: hoje,
        d7_tent_dia: null, d7_tent_resultado: null, d7_resposta_dia: null,
        d30_tent_dia: null, d30_tent_resultado: null, d30_resposta_dia: null,
      })),
      error: null,
    }
  }
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

/**
 * A5 E11 (Tarefa 10): as funções da MG7 com a resposta de um banco sem nada a avisar. A lógica de verdade é testada contra o
 * Postgres (Tarefa 12). Opt-in, no molde de `comReachApply` (e NÃO instalado em `fakeSupabase`): os testes da E11 afirmam a
 * função AUSENTE (PGRST202) justamente por não terem manipulador. A prova padrão devolve as oito chaves em zero, com um vídeo
 * com `base` e `base_ate` = o dia pedido; a gravação aceita tudo; os normalizadores marcam `normalized_at`, como a função faz
 * na mesma transação. Teste que quer a função ausente depois disto usa `db.errors['rpc:<nome>']`.
 */
export function comE11Padrao(db: FakeDb): FakeDb {
  db.rpcHandlers.yt_own_dim_prova = (a) => ({
    data: {
      faltando_cobertura: 0, videos_com_base: 1, videos_base_antes_do_inicio: 0, videos_sem_base: 0,
      base_ate: typeof a.p_hoje === 'string' ? a.p_hoje : null,
      dias_dois_relatorios_detalhe: 0, dias_dois_relatorios_alcance: 0, pendentes_normalizar: 0,
    },
    error: null,
  })
  db.rpcHandlers.yt_own_dim_cover_idle = () => ({ data: { videos_com_base: 0, conjuntos_cobertos: 0, videos_com_view: 0 }, error: null })
  db.rpcHandlers.yt_own_dim_apply = (a) => ({
    data: { status: 'gravado', gravadas: Array.isArray(a.p_rows) ? a.p_rows.length : 0, apagadas: 0, fora_do_teto: 0, dias_mantidos: 0, dias_em_revisao: 0 },
    error: null,
  })
  const normalizar = (a: Row) => {
    for (const r of db.tables.yt_reporting_reports ?? []) if (r.report_id === a.p_report_id) r.normalized_at = new Date().toISOString()
    return { data: { status: 'gravado', gravadas: Array.isArray(a.p_rows) ? a.p_rows.length : 0 }, error: null }
  }
  db.rpcHandlers.yt_own_traffic_detail_apply = normalizar
  db.rpcHandlers.yt_own_reach_dim_apply = normalizar
  return db
}

/**
 * A5 E6 (Tarefa 11b): uma linha de cobertura `base` EM DIA por vídeo (do dia da publicação, no Pacífico, até `hoje`). Com o critério de
 * cobertura no cron, a tabela vazia e um vídeo antigo é, corretamente, "todos atrasados, vermelho": o teste que tem vídeo antigo e
 * afirma `falhas` vazia semeia a cobertura. Opt-in, como `comReachApply` e `comE11Padrao`. `hoje` é o dia do Pacífico ('AAAA-MM-DD');
 * vídeo sem data de publicação cobre só `hoje` (o começo nunca é inventado). Lista vazia não semeia nada.
 */
export function semearCobertura(db: FakeDb, videos: readonly Row[], hoje: string): FakeDb {
  if (videos.length === 0) return db
  const t = (db.tables.yt_own_video_coverage ??= [])
  for (const v of videos) {
    const pub = typeof v.published_at === 'string' && !Number.isNaN(Date.parse(v.published_at)) ? dayPt(new Date(v.published_at)) : hoje
    t.push({
      youtube_video_id: v.youtube_video_id, metric_set: 'base', covered_from: pub < hoje ? pub : hoje, covered_to: hoje,
      site_id: v.site_id, channel_id: v.channel_id, video_id: v.id ?? null, source: 'analytics_api', collected_at: new Date().toISOString(),
    })
  }
  return db
}
