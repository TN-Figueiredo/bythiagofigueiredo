// @vitest-environment node
/**
 * A5 · E6 (P3), MG15: apagar as linhas vazias do diário do canal próprio. O SQL do Apêndice A do plano, contra Postgres de verdade.
 * Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-e6-p3-dieta.test.ts --no-file-parallelism
 *
 * O SQL vem do arquivo de migration `*observatorio_a5_e6_p3_apagar_linhas_vazias*` quando existe e, senão, da fixture versionada
 * `test/fixtures/sql/a5-e6-p3-mg15.sql` (helper `test/helpers/mg15.ts`); com os dois, um teste exige que sejam idênticos. Os trechos entre as marcas `-- >>> MG15 backup` e `-- >>> MG15 funções`
 * são criados DENTRO de cada transação desfeita; o bloco final (que chama com `now()` e apaga as funções) nunca é executado aqui.
 * Diário, cobertura, vídeos, execuções, backup e funções vivem só dentro de `begin; … rollback;`. Só os sites são persistentes
 * (apagados no `afterAll`). Função sem EXECUTE nunca é CHAMADA como anon/authenticated: privilégio se confere por catálogo.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { createHash, randomUUID } from 'node:crypto'

import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { lerSqlMg15, lerFixtureMg15, lerMigrationMg15, lerEnsaioMg15 } from '../helpers/mg15'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { metricVersion } from '@/lib/youtube/coleta/metric-version'
import type { DiarioResumo } from '@/lib/youtube/coleta/diario-step'
import { readFileSync } from 'node:fs'
import { OUTCOMES } from '@/lib/youtube/coleta/types'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))

type Linha = Record<string, unknown>

const lerSql = lerSqlMg15

/** Do começo da marca `-- >>> MG15 <nome> (início)` ao fim da linha da marca `-- <<< MG15 <nome> (fim)`. */
function trecho(sql: string, nome: string): { de: number; ate: number } {
  const de = sql.indexOf(`-- >>> MG15 ${nome} (início)`)
  const fim = sql.indexOf(`-- <<< MG15 ${nome} (fim)`)
  if (de < 0 || fim < 0 || fim < de) throw new Error(`marca MG15 ${nome} não achada no SQL`)
  const ate = sql.indexOf('\n', fim)
  return { de, ate: ate < 0 ? sql.length : ate }
}
function extrair(sql: string, nome: string): string {
  const { de, ate } = trecho(sql, nome)
  return sql.slice(de, ate)
}

const VARIANTE_Z = `-- >>> MG15 regra 2 (início)  (variante Z: média ou taxa nula OU ZERO sai; diferente de zero fica)
           (coalesce(d.avg_view_duration_seconds, 0) <> 0 or coalesce(d.avg_view_percentage, 0) <> 0
            or coalesce(d.card_click_rate, 0) <> 0) as com_media,
           -- <<< MG15 regra 2 (fim)`
function comVarianteZ(funcoes: string): string {
  const { de, ate } = trecho(funcoes, 'regra 2')
  return funcoes.slice(0, de) + VARIANTE_Z + funcoes.slice(ate)
}

const AGORA = '2026-03-10T15:00:00Z'
const HOJE = '2026-03-10'
const DIA0 = '2026-01-01'
const COBERTO_ATE = '2026-03-09'
const mais = (dia: string, n: number): string => new Date(Date.parse(dia + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
const h = (n: number): string => new Date(Date.parse(AGORA) - n * 3_600_000).toISOString()
const md5 = (s: string): string => createHash('md5').update(s).digest('hex')

/** A execução boa do coletor novo. Tipada: se o tipo mudar, o teste deixa de compilar. Cada caso de recusa difere dela em UM campo. */
const BOM: DiarioResumo = {
  gravados: 12, tentativas: { ok: 36 }, pendentes: 0, ate: HOJE, estendidas_recusadas: 0,
  apagadas: 0, intervalos: 35, estendidas_ausentes: 0, atrasados_antigos: 0, com_buraco: 0,
}
type Exec = { ran: string; falhas: string[]; resumo: Record<string, unknown> }
const boaExec = (ran: string): Exec => ({ ran, falhas: [], resumo: { diario: { ...BOM } } })
/** Três dias seguidos; a última 3 horas antes de AGORA. Índice 2 = a mais recente. */
const tres = (): Exec[] => [boaExec(h(51)), boaExec(h(27)), boaExec(h(3))]
const comDiario = (e: Exec, mudanca: Record<string, unknown>): Exec => ({ ...e, resumo: { diario: { ...BOM, ...mudanca } } })
const comFalha = (e: Exec, f: string): Exec => ({ ...e, falhas: [f] })

const VAZIA = { views: 0, watch_time_minutes: 0, likes: 0, comments: 0, shares: 0, subscribers_gained: 0, subscribers_lost: 0 }

describe.skipIf(skipIfNoLocalDb())('A5 E6 P3, MG15: apagar linhas vazias do diário (bythiago_int)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  let S1 = ''
  let S2 = ''
  let SQL = ''
  let BACKUP = ''
  let FUNCOES = ''

  beforeAll(async () => {
    SQL = lerSql()
    BACKUP = extrair(SQL, 'backup')
    FUNCOES = extrair(SQL, 'funções')
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    S1 = (await seedSite(sb)).siteId; sites.push(S1)
    S2 = (await seedSite(sb)).siteId; sites.push(S2)
  })
  afterAll(async () => {
    try {
      if (pg && sites.length > 0) await apagarSites(pg, 'id = any($1::uuid[])', [sites])
    } finally {
      if (pg) await pg.end()
    }
  })

  // ───────────────────────── infraestrutura ─────────────────────────
  const q = async (sql: string, params: unknown[] = []): Promise<Linha[]> => (await pg.query(sql, params)).rows as Linha[]
  const n = async (sql: string, params: unknown[] = []): Promise<number> => Number(Object.values((await q(sql, params))[0]!)[0])

  /** Tudo dentro de uma transação desfeita, com o backup e as funções criados nela. */
  async function tx(fn: () => Promise<void>, o: { funcoes?: string } = {}): Promise<void> {
    await pg.query('begin')
    try {
      await pg.query("set local lock_timeout = '5s'")
      await pg.query(BACKUP)
      await pg.query(o.funcoes ?? FUNCOES)
      await fn()
    } finally {
      await pg.query('rollback')
    }
  }
  /** Chama dentro de um savepoint: devolve o erro em vez de abortar a transação. */
  async function tenta(sql: string, params: unknown[] = []): Promise<{ ok: true; rows: Linha[] } | { ok: false; msg: string }> {
    await pg.query('savepoint s_tenta')
    try {
      const r = await pg.query(sql, params)
      await pg.query('release savepoint s_tenta')
      return { ok: true, rows: r.rows as Linha[] }
    } catch (e) {
      await pg.query('rollback to savepoint s_tenta')
      return { ok: false, msg: e instanceof Error ? e.message : String(e) }
    }
  }
  const chamar = (site: string, agora = AGORA) => tenta('select public.yt_own_daily_diet_p3($1::uuid, $2::timestamptz) as r', [site, agora])
  async function aceita(site: string, agora = AGORA): Promise<Linha> {
    const r = await chamar(site, agora)
    if (!r.ok) throw new Error('esperava aceitar, recusou: ' + r.msg)
    return r.rows[0]!.r as Linha
  }
  async function recusa(site: string, trecho: string, agora = AGORA): Promise<void> {
    const r = await chamar(site, agora)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain(trecho)
  }

  interface Cena { site: string; canal: string; v: Array<{ id: string; yt: string }> }
  async function cena(site: string, nVideos = 1): Promise<Cena> {
    const slug = 'teste-' + randomUUID().replace(/-/g, '').slice(0, 8)
    const c = await q(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`,
      [site, 'UC' + randomUUID().replace(/-/g, '').slice(0, 22), '@' + slug, 'UU' + randomUUID().replace(/-/g, '').slice(0, 22), slug])
    const canal = String(c[0]!.id)
    const v: Cena['v'] = []
    for (let i = 0; i < nVideos; i++) {
      const yt = 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
      const r = await q(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
        values ($1, $2, $3, 'Teste', '2025-01-01T12:00:00Z') returning id`, [site, canal, yt])
      v.push({ id: String(r[0]!.id), yt })
    }
    return { site, canal, v }
  }
  async function cob(c: Cena, i: number, set: 'base' | 'estendidas', de: string, ate: string, coletada = h(3)): Promise<void> {
    await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, collected_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8)`, [c.v[i]!.yt, set, de, ate, c.site, c.v[i]!.id, c.canal, coletada])
  }
  async function linha(c: Cena, i: number, dia: string, vals: Record<string, number | string | null>): Promise<void> {
    const cols = ['youtube_video_id', 'day_pt', 'site_id', 'video_id', 'channel_id', 'metric_version', ...Object.keys(vals)]
    const params: unknown[] = [c.v[i]!.yt, dia, c.site, c.v[i]!.id, c.canal, metricVersion(dia), ...Object.values(vals)]
    await pg.query(`insert into public.yt_own_video_daily (${cols.join(', ')}) values (${params.map((_, k) => '$' + (k + 1)).join(', ')})`, params)
  }
  async function execucoes(es: Exec[]): Promise<void> {
    await pg.query('delete from public.yt_own_collection_runs where ran_at > $1::timestamptz - interval \'10 days\' and ran_at <= $1::timestamptz', [AGORA])
    for (const e of es) {
      await pg.query(`insert into public.yt_own_collection_runs (ran_at, ms_total, ms_existente, falhas, resumo) values ($1, 1, 1, $2::text[], $3::jsonb)`,
        [e.ran, e.falhas, JSON.stringify(e.resumo)])
    }
  }
  const marca = (dia = HOJE) => pg.query(`comment on table public.yt_own_video_daily is 'P3 armada em ${dia}'`)
  const semMarca = () => pg.query('comment on table public.yt_own_video_daily is null')
  const diarioN = (site: string) => n('select count(*) from public.yt_own_video_daily where site_id = $1', [site])
  const backupN = (site?: string) => site
    ? n('select count(*) from public.yt_own_video_daily_zeros_bkp where site_id = $1', [site])
    : n('select count(*) from public.yt_own_video_daily_zeros_bkp')

  /** 40 dias de um vídeo: 30 vazias, 6 com view, 4 com views 0 e uma curtida. Cobertura base até COBERTO_ATE. Guardas prontas. */
  async function cenario40(site = S1, o: { preparar?: boolean } = {}): Promise<Cena> {
    const c = await cena(site)
    await cob(c, 0, 'base', DIA0, COBERTO_ATE)
    for (let i = 0; i < 40; i++) {
      const dia = mais(DIA0, i)
      const extra = { source: i % 2 === 0 ? 'analytics_api' : 'reporting_api', collected_at: `2026-02-20T10:${String(i).padStart(2, '0')}:00Z` }
      if (i < 30) await linha(c, 0, dia, { ...VAZIA, ...extra })
      else if (i < 36) await linha(c, 0, dia, { ...VAZIA, views: i - 29, avg_view_duration_seconds: 30, avg_view_percentage: 50, ...extra })
      else await linha(c, 0, dia, { ...VAZIA, likes: 1, ...extra })
    }
    if (o.preparar !== false) { await execucoes(tres()); await marca() }
    return c
  }
  const retratoSql = `select count(*) as pares, count(*) filter (where x.medido) as medidos, coalesce(sum(x.views),0) as soma,
      md5(string_agg(x.youtube_video_id || '|' || x.dia || '|' || x.medido || '|' || coalesce(x.views::text, '-'), ',' order by x.youtube_video_id, x.dia)) as retrato
    from (select v.youtube_video_id, g::date as dia,
            case when d.youtube_video_id is not null then d.views is not null else cb.ok end as medido,
            case when d.youtube_video_id is not null then d.views when cb.ok then 0 end as views
          from public.youtube_videos v
          cross join generate_series($2::date, $3::date, interval '1 day') g
          left join public.yt_own_video_daily d on d.youtube_video_id = v.youtube_video_id and d.day_pt = g::date
          cross join lateral (select exists (select 1 from public.yt_own_video_coverage c where c.site_id = v.site_id
              and c.youtube_video_id = v.youtube_video_id and c.metric_set = 'base' and g::date between c.covered_from and c.covered_to) as ok) cb
          where v.site_id = $1) x`
  const retrato = async (site: string): Promise<Linha> => (await q(retratoSql, [site, DIA0, COBERTO_ATE]))[0]!
  /** V5m: as duas médias só valem em dia com view. */
  const retratoMedias = async (site: string): Promise<string> => String((await q(
    `select md5(string_agg(d.youtube_video_id || '|' || d.day_pt || '|' || coalesce(d.avg_view_percentage::text, '-') || '|' || coalesce(d.avg_view_duration_seconds::text, '-'), ',' order by d.youtube_video_id, d.day_pt)) as m
       from public.yt_own_video_daily d where d.site_id = $1 and d.views > 0`, [site]))[0]!.m)
  const todasAsLinhas = async (site: string): Promise<string> => String((await q(
    `select md5(coalesce(string_agg(to_jsonb(d)::text, ',' order by d.youtube_video_id, d.day_pt), '')) as m from public.yt_own_video_daily d where d.site_id = $1`, [site]))[0]!.m)

  // ───────────────────────── entrada e saída trivial ─────────────────────────
  it('parâmetro nulo lança', async () => {
    await tx(async () => {
      expect((await tenta('select public.yt_own_daily_diet_p3(null::uuid, $1::timestamptz)', [AGORA])).ok).toBe(false)
      expect((await tenta('select public.yt_own_daily_diet_p3($1::uuid, null::timestamptz)', [S1])).ok).toBe(false)
    })
  })

  it('site sem diário: nada a apagar, sem exigir execuções', async () => {
    await tx(async () => {
      const c = await cena(S1); await cob(c, 0, 'base', DIA0, COBERTO_ATE)
      await execucoes([])
      const r = await aceita(S1)
      expect(r.estado).toBe('nada_a_apagar'); expect(r.apagadas).toBe(0)
    })
  })

  it('site só com linhas de atividade: nada a apagar, sem exigir execuções nem marca', async () => {
    await tx(async () => {
      const c = await cena(S1); await cob(c, 0, 'base', DIA0, COBERTO_ATE)
      const outras = ['watch_time_minutes', 'likes', 'comments', 'shares', 'subscribers_gained', 'subscribers_lost', 'card_impressions', 'engaged_views']
      for (let i = 0; i < outras.length; i++) await linha(c, 0, mais(DIA0, i), { ...VAZIA, [outras[i]!]: i === 1 ? -1 : 1 })
      await linha(c, 0, mais(DIA0, 9), { ...VAZIA, views: 3 })
      await execucoes([]); await semMarca()
      const r = await aceita(S1)
      expect(r.estado).toBe('nada_a_apagar'); expect(await diarioN(S1)).toBe(9)
    })
  })

  // ───────────────────────── as três execuções limpas ─────────────────────────
  it('tabela de execuções vazia: recusa; duas limpas recusa, três aceita', async () => {
    await tx(async () => {
      await cenario40(S1, { preparar: false }); await marca()
      await execucoes([]); await recusa(S1, '3 execuções limpas')
      expect(await diarioN(S1)).toBe(40)
      await execucoes(tres().slice(1)); await recusa(S1, '3 execuções limpas')
      await execucoes(tres()); expect((await aceita(S1)).apagadas).toBe(30)
    })
  })

  it('nota do diário em uma das três recusa (seis casos); nota de outro passo não recusa', async () => {
    const notas = [
      'diário: X: 2 de 35 vídeos com erro', 'diario: timeout', 'schema_ausente: yt_own_video_coverage',
      'erro de banco ao gravar yt_own_daily_apply', 'critérios: não foi possível avaliar cobertura de X (sem tempo)',
      'diário: X: estendidas ausentes na resposta de 1 vídeo(s)',
    ]
    await tx(async () => {
      await cenario40()
      for (const nota of notas) {
        const es = tres(); es[1] = comFalha(es[1]!, nota)
        await execucoes(es); await recusa(S1, '3 execuções limpas')
      }
      const es = tres(); es[1] = comFalha(es[1]!, 'relatórios: guarda do bruto não conferida')
      await execucoes(es); expect((await aceita(S1)).apagadas).toBe(30)
    })
  })

  it('nota de falha ao ler youtube_videos recusa', async () => {
    await tx(async () => {
      await cenario40()
      const es = tres(); es[0] = comFalha(es[0]!, 'erro de banco ao ler youtube_videos')
      await execucoes(es); await recusa(S1, '3 execuções limpas')
    })
  })

  it('execução sem resumo.diario, sem apagadas, ou com apagadas em texto não conta', async () => {
    await tx(async () => {
      await cenario40()
      const sem: Exec[] = tres(); sem[1] = { ...sem[1]!, resumo: {} }
      await execucoes(sem); await recusa(S1, '3 execuções limpas')
      const { apagadas: _a, ...resto } = BOM
      const semApagadas = tres(); semApagadas[1] = { ...semApagadas[1]!, resumo: { diario: resto } }
      await execucoes(semApagadas); await recusa(S1, '3 execuções limpas')
      const texto = tres(); texto[1] = comDiario(texto[1]!, { apagadas: '0' })
      await execucoes(texto); await recusa(S1, '3 execuções limpas')
    })
  })

  it('execução que rodou e não coletou não conta (doze casos, todos com apagadas presente)', async () => {
    const casos: Array<Record<string, unknown>> = [
      { tentativas: { sem_autorizacao: 1 } },
      { tentativas: { ok: 0 } },
      { tentativas: { ok: 36, sem_autorizacao: 1 } },
      { tentativas: { ok: 36, schema_ausente: 1 } },
      { tentativas: { ok: 36, sem_conexao: 1 } },
      { pendentes: 35 },
      { tentativas: { ok: 20, nao_alcancado_orcamento: 15 } },
      { tentativas: { ok: 1, sem_dado_na_janela: 35 }, intervalos: 0 },
      { tentativas: {} },
      { tentativas: { ok: 35, erro_http: 1 } },
      { atrasados_antigos: 2 },
      { estendidas_recusadas: 1 },
    ]
    await tx(async () => {
      await cenario40()
      for (const caso of casos) {
        const es = tres(); es[1] = comDiario(es[1]!, caso)
        await execucoes(es); await recusa(S1, '3 execuções limpas')
      }
      expect(await diarioN(S1)).toBe(40)
    })
  })

  it('campos de resumo em formato estranho não derrubam a função: recusa com a mensagem das três execuções', async () => {
    const casos: Array<Record<string, unknown>> = [{ pendentes: '0' }, { intervalos: '35' }, { tentativas: [] }, { tentativas: null }]
    await tx(async () => {
      await cenario40()
      for (const caso of casos) {
        const es = tres(); es[1] = comDiario(es[1]!, caso)
        await execucoes(es); await recusa(S1, '3 execuções limpas')
      }
    })
  })

  it('permissão fechada (portão 15/10, M-1): cada resultado de OUTCOMES fora das três toleradas recusa; os toleráveis e a ausência de tentativas', async () => {
    const TOLERADOS = ['ok', 'sem_dado_na_janela', 'video_novo']
    const proibidos = OUTCOMES.filter(o => !TOLERADOS.includes(o))
    expect(proibidos.length).toBeGreaterThanOrEqual(5)
    await tx(async () => {
      await cenario40()
      for (const o of proibidos) {
        const es = tres()
        es[1] = comDiario(es[1]!, { tentativas: { ok: 36, [o]: 1 } })
        await execucoes(es); await recusa(S1, '3 execuções limpas')
      }
      // chave desconhecida (um resultado novo que entre em OUTCOMES amanhã) também recusa
      const nova = tres(); nova[2] = comDiario(nova[2]!, { tentativas: { ok: 36, cota_esgotada: 1 } })
      await execucoes(nova); await recusa(S1, '3 execuções limpas')
      // tentativas ausente ou fora de objeto recusa
      for (const t of [null, 'ok', [1], 7]) {
        const r = tres(); r[1] = { ...r[1]!, resumo: { diario: { ...BOM, tentativas: t } } }
        await execucoes(r); await recusa(S1, '3 execuções limpas')
      }
      // os três toleráveis juntos aceitam
      const boa = tres(); boa[0] = comDiario(boa[0]!, { tentativas: { ok: 30, sem_dado_na_janela: 3, video_novo: 3 } })
      await execucoes(boa); expect((await aceita(S1)).apagadas).toBe(30)
    })
  })

  it('execução real de produção é reconhecida como limpa', async () => {
    const real = JSON.parse(readFileSync(fileURLToPath(new URL('../youtube/coleta/fixtures/e6-p3-execucao-real.json', import.meta.url)), 'utf8')) as { falhas: string[]; resumo: Record<string, unknown> }
    const copia = (ran: string): Exec => ({ ran, falhas: [...real.falhas], resumo: structuredClone(real.resumo) })
    await tx(async () => {
      await cenario40()
      await execucoes([copia(h(51)), copia(h(27)), copia(h(3))])
      expect((await aceita(S1)).apagadas).toBe(30)
    })
  })

  it('duas execuções no mesmo dia: vale a última', async () => {
    await tx(async () => {
      await cenario40()
      // suja às 12:00 e limpa às 14:00 do mesmo dia (o dia de AGORA); e o contrário
      const sujaDepoisLimpa = [boaExec(h(51)), boaExec(h(27)), comDiario(boaExec('2026-03-10T12:00:00Z'), { pendentes: 5 }), boaExec('2026-03-10T14:00:00Z')]
      await execucoes(sujaDepoisLimpa); expect((await aceita(S1)).apagadas).toBe(30)
    })
    await tx(async () => {
      await cenario40()
      const limpaDepoisSuja = [boaExec(h(51)), boaExec(h(27)), boaExec('2026-03-10T12:00:00Z'), comDiario(boaExec('2026-03-10T14:00:00Z'), { pendentes: 5 })]
      await execucoes(limpaDepoisSuja); await recusa(S1, '3 execuções limpas')
    })
  })

  it('dias não seguidos recusa', async () => {
    await tx(async () => {
      await cenario40()
      await execucoes([boaExec(h(3)), boaExec(h(27)), boaExec(h(75))])
      await recusa(S1, '3 execuções limpas')
    })
  })

  it('a mais recente com 36 horas recusa; com 35 aceita', async () => {
    await tx(async () => {
      await cenario40()
      await execucoes([boaExec(h(36 + 48)), boaExec(h(36 + 24)), boaExec(h(36))]); await recusa(S1, '3 execuções limpas')
      await execucoes([boaExec(h(35 + 48)), boaExec(h(35 + 24)), boaExec(h(35))])
      // com a cobertura gravada há 3h a guarda (4) passa
      expect((await aceita(S1)).apagadas).toBe(30)
    })
  })

  // ───────────────────────── janela, marca e cobertura em dia ─────────────────────────
  it('janela do cron: 11:29:59 aceita, 11:30:00 e 12:59:59 recusam, 13:00:00 aceita', async () => {
    const casos: Array<[string, boolean]> = [
      ['2026-03-10T11:29:59Z', true], ['2026-03-10T11:30:00Z', false], ['2026-03-10T12:59:59Z', false], ['2026-03-10T13:00:00Z', true],
    ]
    for (const [agora, aceitar] of casos) {
      await tx(async () => {
        await cenario40()
        // as execuções ficam relativas a AGORA (cenário), então para a hora testada ajusta-se só a hora, no mesmo dia
        const dt = Date.parse(agora)
        const rel = (k: number): string => new Date(dt - k * 3_600_000).toISOString()
        await execucoes([boaExec(rel(51)), boaExec(rel(27)), boaExec(rel(3))])
        await pg.query('update public.yt_own_video_coverage set collected_at = $1::timestamptz where site_id = $2', [rel(3), S1])
        if (aceitar) expect((await aceita(S1, agora)).apagadas).toBe(30)
        else await recusa(S1, 'entre 11:30 e 13:00 UTC', agora)
      })
    }
  })

  it('sem a marca do dia recusa (nulo, véspera, dia seguinte); a marca dentro de texto antigo aceita', async () => {
    await tx(async () => {
      await cenario40()
      await semMarca(); await recusa(S1, 'o ritual do CSV não foi feito hoje')
      await marca('2026-03-09'); await recusa(S1, 'o ritual do CSV não foi feito hoje')
      await marca('2026-03-11'); await recusa(S1, 'o ritual do CSV não foi feito hoje')
      await pg.query(`comment on table public.yt_own_video_daily is 'texto antigo. P3 armada em ${HOJE}'`)
      expect((await aceita(S1)).apagadas).toBe(30)
    })
  })

  it('cobertura em dia mas gravada há muito recusa; com 35 horas aceita', async () => {
    await tx(async () => {
      await cenario40()
      await pg.query('update public.yt_own_video_coverage set collected_at = $1::timestamptz where site_id = $2', [h(37), S1])
      await recusa(S1, 'cobertura em dia')
      await pg.query('update public.yt_own_video_coverage set collected_at = $1::timestamptz where site_id = $2', [h(35), S1])
      expect((await aceita(S1)).apagadas).toBe(30)
    })
  })

  it('nenhum vídeo em dia recusa (até hoje − 6); aceita com hoje − 5', async () => {
    await tx(async () => {
      const c = await cenario40()
      await pg.query('update public.yt_own_video_coverage set covered_to = $1 where site_id = $2', [mais(HOJE, -6), S1])
      await recusa(S1, 'cobertura em dia')
      await pg.query('update public.yt_own_video_coverage set covered_to = $1 where site_id = $2', [mais(HOJE, -5), S1])
      expect(c.v.length).toBe(1)
      expect((await aceita(S1)).apagadas).toBe(30)
    })
  })

  it('cobertura em dia de OUTRO site para o MESMO youtube_video_id não libera', async () => {
    await tx(async () => {
      const c = await cenario40(S1)
      const o = await cena(S2)
      await pg.query('update public.yt_own_video_coverage set covered_to = $1 where site_id = $2', [mais(HOJE, -6), S1])
      await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, channel_id, collected_at)
        values ($1, 'base', $2, $3, $4, $5, $6)`, [c.v[0]!.yt, '2026-03-01', COBERTO_ATE, S2, o.canal, h(3)])
      await recusa(S1, 'cobertura em dia')
    })
  })

  it('vídeo em dia de OUTRO site não libera', async () => {
    await tx(async () => {
      await cenario40(S1)
      await pg.query('update public.yt_own_video_coverage set covered_to = $1 where site_id = $2', [mais(HOJE, -6), S1])
      const o = await cena(S2); await cob(o, 0, 'base', DIA0, COBERTO_ATE)
      await recusa(S1, 'cobertura em dia')
    })
  })

  // ───────────────────────── o critério de uma linha ─────────────────────────
  it('apaga só a linha vazia e coberta; as 10 que ficam, iguais coluna por coluna', async () => {
    await tx(async () => {
      await cenario40()
      const ficam = await q(`select to_jsonb(d)::text as j from public.yt_own_video_daily d where d.site_id = $1 and d.day_pt >= $2 order by d.day_pt`, [S1, mais(DIA0, 30)])
      const r = await aceita(S1)
      expect(r.estado).toBe('apagado'); expect(r.apagadas).toBe(30)
      expect(await diarioN(S1)).toBe(10)
      const depois = await q(`select to_jsonb(d)::text as j from public.yt_own_video_daily d where d.site_id = $1 order by d.day_pt`, [S1])
      expect(depois).toEqual(ficam)
    })
  })

  it('views nulo fica', async () => {
    await tx(async () => {
      await cenario40()
      const c = (await q('select youtube_video_id from public.yt_own_video_daily where site_id = $1 limit 1', [S1]))[0]!
      await pg.query(`update public.yt_own_video_daily set views = null where youtube_video_id = $1 and day_pt = $2`, [c.youtube_video_id, DIA0])
      const r = await aceita(S1)
      expect(r.apagadas).toBe(29)
      expect(await n('select count(*) from public.yt_own_video_daily where site_id = $1 and views is null', [S1])).toBe(1)
    })
  })

  it('linha vazia com média ou taxa preenchida fica (três casos, texto padrão)', async () => {
    await tx(async () => {
      const c = await cena(S1); await cob(c, 0, 'base', DIA0, COBERTO_ATE)
      await linha(c, 0, mais(DIA0, 0), { ...VAZIA })
      await linha(c, 0, mais(DIA0, 1), { ...VAZIA, avg_view_percentage: 0 })
      await linha(c, 0, mais(DIA0, 2), { ...VAZIA, avg_view_duration_seconds: 12.5 })
      await linha(c, 0, mais(DIA0, 3), { ...VAZIA, card_click_rate: 0 })
      await execucoes(tres()); await marca()
      const r = await aceita(S1)
      expect(r.apagadas).toBe(1); expect(r.ficaram_com_media).toBe(3)
      expect(await diarioN(S1)).toBe(3)
    })
  })

  it('variante Z: média ou taxa zero sai, diferente de zero fica; V5m igual antes e depois, retrato cru diferente', async () => {
    await tx(async () => {
      const c = await cena(S1); await cob(c, 0, 'base', DIA0, COBERTO_ATE)
      await linha(c, 0, mais(DIA0, 0), { ...VAZIA })
      await linha(c, 0, mais(DIA0, 1), { ...VAZIA, avg_view_percentage: 0 })
      await linha(c, 0, mais(DIA0, 2), { ...VAZIA, avg_view_duration_seconds: 12.5 })
      await linha(c, 0, mais(DIA0, 3), { ...VAZIA, card_click_rate: 0 })
      await linha(c, 0, mais(DIA0, 4), { ...VAZIA, views: 5, avg_view_percentage: 40, avg_view_duration_seconds: 20 })
      await execucoes(tres()); await marca()
      const medias = await retratoMedias(S1)
      const crua = String((await q(`select md5(string_agg(coalesce(d.avg_view_percentage::text, '-'), ',' order by d.day_pt)) as m from public.yt_own_video_daily d where d.site_id = $1 and d.day_pt in ($2, $3)`,
        [S1, mais(DIA0, 1), mais(DIA0, 3)]))[0]!.m)
      await pg.query(comVarianteZ(FUNCOES))
      const r = await aceita(S1)
      expect(r.apagadas).toBe(3); expect(r.ficaram_com_media).toBe(1)
      expect(await retratoMedias(S1)).toBe(medias)
      expect(await backupN(S1)).toBe(3)
      // as de zero estão no backup com o zero original
      expect(await n(`select count(*) from public.yt_own_video_daily_zeros_bkp where site_id = $1 and (avg_view_percentage = 0 or card_click_rate = 0)`, [S1])).toBe(2)
      // a diferença visível: a média 0 daqueles dias virou "sem linha" (nula para o leitor)
      const depois = await q(`select count(*) as k from public.yt_own_video_daily d where d.site_id = $1 and d.day_pt in ($2, $3)`, [S1, mais(DIA0, 1), mais(DIA0, 3)])
      expect(Number(depois[0]!.k)).toBe(0)
      expect(crua).not.toBe(md5(''))
    }, {})
  })

  it('linha vazia fora da base: a função lança e nada é apagado', async () => {
    await tx(async () => {
      const c = await cenario40()
      await linha(c, 0, mais(COBERTO_ATE, 1), { ...VAZIA })
      await recusa(S1, 'fora da cobertura base')
      expect(await diarioN(S1)).toBe(41); expect(await backupN()).toBe(0)
    })
  })

  it('fronteira do intervalo: vazias em covered_from e em covered_to saem', async () => {
    await tx(async () => {
      const c = await cena(S1); await cob(c, 0, 'base', DIA0, COBERTO_ATE)
      await linha(c, 0, DIA0, { ...VAZIA }); await linha(c, 0, COBERTO_ATE, { ...VAZIA })
      await execucoes(tres()); await marca()
      expect((await aceita(S1)).apagadas).toBe(2)
    })
  })

  it('buraco de cobertura: a vazia do buraco faz lançar', async () => {
    await tx(async () => {
      const c = await cena(S1)
      await cob(c, 0, 'base', DIA0, mais(DIA0, 9)); await cob(c, 0, 'base', mais(DIA0, 11), COBERTO_ATE)
      await linha(c, 0, mais(DIA0, 2), { ...VAZIA }); await linha(c, 0, mais(DIA0, 10), { ...VAZIA })
      await execucoes(tres()); await marca()
      await recusa(S1, 'fora da cobertura base')
      expect(await diarioN(S1)).toBe(2)
    })
  })

  it('estendidas medidas em dia sem cobertura estendidas: fica; nunca medidas: sai', async () => {
    await tx(async () => {
      const c = await cena(S1); await cob(c, 0, 'base', DIA0, COBERTO_ATE)
      await linha(c, 0, mais(DIA0, 0), { ...VAZIA, engaged_views: 0 })
      await linha(c, 0, mais(DIA0, 1), { ...VAZIA, engaged_views: null, card_impressions: null })
      await execucoes(tres()); await marca()
      const r = await aceita(S1)
      expect(r.apagadas).toBe(1); expect(r.ficaram_fora_das_estendidas).toBe(1)
      expect(await diarioN(S1)).toBe(1)
    })
  })

  it('estendidas medidas e cobertas pelo conjunto estendidas: sai', async () => {
    await tx(async () => {
      const c = await cena(S1); await cob(c, 0, 'base', DIA0, COBERTO_ATE); await cob(c, 0, 'estendidas', DIA0, mais(DIA0, 5))
      await linha(c, 0, mais(DIA0, 0), { ...VAZIA, engaged_views: 0, card_impressions: 0 })
      await execucoes(tres()); await marca()
      expect((await aceita(S1)).apagadas).toBe(1)
    })
  })

  it('outro site não é tocado', async () => {
    await tx(async () => {
      await cenario40(S1)
      const b = await cena(S2); await cob(b, 0, 'base', DIA0, COBERTO_ATE)
      for (let i = 0; i < 5; i++) await linha(b, 0, mais(DIA0, i), { ...VAZIA })
      const antes = await todasAsLinhas(S2)
      await aceita(S1)
      expect(await diarioN(S2)).toBe(5); expect(await backupN(S2)).toBe(0)
      expect(await todasAsLinhas(S2)).toBe(antes)
    })
  })

  it('cobertura de outro site para o mesmo vídeo não libera a linha', async () => {
    await tx(async () => {
      const c = await cena(S1)
      const o = await cena(S2)
      // a cobertura do outro site traz o MESMO youtube_video_id
      await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, channel_id, collected_at)
        values ($1, 'base', $2, $3, $4, $5, $6)`, [c.v[0]!.yt, DIA0, COBERTO_ATE, S2, o.canal, h(3)])
      await cob(c, 0, 'base', mais(DIA0, 30), COBERTO_ATE)
      await linha(c, 0, mais(DIA0, 2), { ...VAZIA })
      await execucoes(tres()); await marca()
      await recusa(S1, 'fora da cobertura base')
    })
  })

  it('toda linha apagada está no backup, coluna por coluna', async () => {
    await tx(async () => {
      await cenario40()
      const antes = await q(`select to_jsonb(d)::text as j from public.yt_own_video_daily d where d.site_id = $1 and d.day_pt < $2 order by d.day_pt`, [S1, mais(DIA0, 30)])
      await aceita(S1)
      const bkp = await q(`select to_jsonb(b)::text as j from public.yt_own_video_daily_zeros_bkp b where b.site_id = $1 order by b.day_pt`, [S1])
      expect(bkp).toEqual(antes)
      expect(bkp.length).toBe(30)
    })
  })

  it('rodar duas vezes: a segunda dá nada_a_apagar e o backup tem as mesmas 30', async () => {
    await tx(async () => {
      await cenario40()
      await aceita(S1)
      const r = await aceita(S1)
      expect(r.estado).toBe('nada_a_apagar'); expect(await backupN(S1)).toBe(30)
    })
  })

  it('segunda chamada com linha que ficou exige as guardas de novo', async () => {
    await tx(async () => {
      const c = await cenario40()
      await linha(c, 0, mais(DIA0, 45), { ...VAZIA, avg_view_duration_seconds: 12.5 })
      expect((await aceita(S1)).apagadas).toBe(30)
      await execucoes([])
      await recusa(S1, '3 execuções limpas')
      await execucoes(tres())
      const r = await aceita(S1)
      expect(r.estado).toBe('nada_apagado'); expect(r.apagadas).toBe(0)
    })
  })

  it('chave que já estava no backup é atualizada, não duplicada', async () => {
    await tx(async () => {
      const c = await cenario40()
      const dia = mais(DIA0, 3)
      await pg.query(`insert into public.yt_own_video_daily_zeros_bkp select * from public.yt_own_video_daily where youtube_video_id = $1 and day_pt = $2`, [c.v[0]!.yt, dia])
      await pg.query(`update public.yt_own_video_daily_zeros_bkp set collected_at = '2026-01-01T00:00:00Z' where youtube_video_id = $1 and day_pt = $2`, [c.v[0]!.yt, dia])
      await aceita(S1)
      expect(await backupN(S1)).toBe(30)
      expect(String((await q(`select collected_at::text as t from public.yt_own_video_daily_zeros_bkp where youtube_video_id = $1 and day_pt = $2`, [c.v[0]!.yt, dia]))[0]!.t)).toContain('2026-02-20')
    })
  })

  it('as contas fecham e o retorno bate com a contagem do teste', async () => {
    await tx(async () => {
      await cenario40()
      const r = await aceita(S1)
      const antes = r.antes as Linha; const depois = r.depois as Linha
      expect(antes.t).toBe(40); expect(depois.t).toBe(10); expect(antes.a).toBe(10); expect(depois.a).toBe(10)
      expect(antes.somas).toEqual(depois.somas); expect(antes.c_base).toBe(depois.c_base)
      expect(antes.dentro_da_base).toBe(40); expect(depois.dentro_da_base).toBe(10)
      expect(r.vazias).toBe(30); expect(r.videos).toBe(1); expect(r.videos_em_dia).toBe(1)
    })
  })

  it('retrato da vida inteira igual antes e depois (dia fora da cobertura e dia com views nulo)', async () => {
    await tx(async () => {
      const c = await cenario40()
      // um dia fora da cobertura (com linha de atividade) e um com views nulo
      await linha(c, 0, '2025-12-20', { ...VAZIA, views: 2 })
      await linha(c, 0, mais(DIA0, 50), { ...VAZIA, views: null })
      const antes = await q(retratoSql, [S1, '2025-12-15', COBERTO_ATE])
      await aceita(S1)
      const depois = await q(retratoSql, [S1, '2025-12-15', COBERTO_ATE])
      expect(depois).toEqual(antes)
      expect(Number(antes[0]!.pares)).toBeGreaterThan(0)
      // o dia fora da cobertura sem linha seria "não medido": 2025-12-16 (sem linha, fora da base) não conta como medido nos dois
      expect(Number(antes[0]!.medidos)).toBeLessThan(Number(antes[0]!.pares))
    })
  })

  // ───────────────────────── catálogo ─────────────────────────
  it('backup: RLS ligada, sem policy, sem privilégio, sem chave estrangeira', async () => {
    await tx(async () => {
      expect((await q(`select relrowsecurity from pg_class where oid = 'public.yt_own_video_daily_zeros_bkp'::regclass`))[0]!.relrowsecurity).toBe(true)
      expect(await n(`select count(*) from pg_policies where schemaname = 'public' and tablename = 'yt_own_video_daily_zeros_bkp'`)).toBe(0)
      for (const papel of ['anon', 'authenticated', 'service_role']) {
        for (const priv of ['select', 'insert', 'update', 'delete']) {
          expect((await q(`select has_table_privilege($1, 'public.yt_own_video_daily_zeros_bkp', $2) as p`, [papel, priv]))[0]!.p).toBe(false)
        }
      }
      expect(await n(`select count(*) from pg_constraint where conrelid = 'public.yt_own_video_daily_zeros_bkp'::regclass and contype = 'f'`)).toBe(0)
    })
  })

  it('as três funções: sem execute para anon, authenticated e service_role', async () => {
    await tx(async () => {
      const fns = ['public.yt_own_daily_linha_vazia(public.yt_own_video_daily)', 'public.yt_own_daily_diet_p3_contas(uuid)', 'public.yt_own_daily_diet_p3(uuid, timestamptz)']
      for (const f of fns) for (const papel of ['anon', 'authenticated', 'service_role']) {
        expect((await q(`select has_function_privilege($1, $2, 'execute') as p`, [papel, f]))[0]!.p).toBe(false)
      }
    })
  })

  it('serie_coletada não conta o backup', async () => {
    await tx(async () => {
      const c = await cenario40()
      await aceita(S1)
      expect(await backupN(S1)).toBe(30)
      const chamarImpacto = async (): Promise<number> => {
        const r = await tenta('select public.youtube_channel_removal_impact($1::uuid, $2::uuid) as r', [S1, c.canal])
        if (!r.ok) throw new Error('youtube_channel_removal_impact falhou: ' + r.msg)
        return Number((r.rows[0]!.r as { serie_coletada?: number | string }).serie_coletada)
      }
      const comBackup = await chamarImpacto()
      await pg.query('delete from public.yt_own_video_daily_zeros_bkp where site_id = $1', [S1])
      const semBackup = await chamarImpacto()
      expect(comBackup).toBe(semBackup)
      expect(comBackup).toBeGreaterThan(0)
    })
  })

  it('o arquivo inteiro: sem diário não faz nada, não recusa e não deixa função (texto)', async () => {
    expect(SQL).toContain('drop function if exists public.yt_own_daily_diet_p3(uuid, timestamptz)')
    expect(SQL).toContain('diário sem linhas, nada a fazer')
  })

  it('sem begin/commit e com set local no topo (D1 retirado); nenhum set de sessão', () => {
    expect(SQL).not.toMatch(/^\s*(begin|commit)\s*;/im)
    expect(SQL).toMatch(/^set local lock_timeout = '5s';$/m)
    expect(SQL).toMatch(/^set local statement_timeout = '120s';$/m)
    expect(SQL).not.toMatch(/^set (lock_timeout|statement_timeout)/m)
  })

  it('o SQL testado é o da migration: migration = fixture (e fixture = ensaio, se o ensaio existir)', () => {
    const fx = lerFixtureMg15()
    const m = lerMigrationMg15()
    if (m !== null) expect(m).toBe(fx)
    const e = lerEnsaioMg15()
    if (e !== null) expect(e).toBe(fx)
    expect(SQL).toBe(m ?? fx)
  })

  it('o arquivo inteiro roda (relativo a now()): fora da janela apaga, anota o backup e não deixa função; dentro dela recusa', async () => {
    const dia = (k: number): string => new Date(Date.now() + k * 86_400_000).toISOString().slice(0, 10)
    const hoje = dia(0)
    const agoraH = new Date()
    const min = agoraH.getUTCHours() * 60 + agoraH.getUTCMinutes()
    // margem de 2 minutos nas bordas da janela para o relógio não mudar de lado entre a decisão do teste e a do arquivo
    if ([11 * 60 + 30, 13 * 60].some(b => Math.abs(min - b) <= 2)) return
    const dentro = min >= 11 * 60 + 30 && min < 13 * 60
    await pg.query('begin')
    try {
      await pg.query('delete from public.yt_own_video_daily where site_id <> $1', [S1])
      await pg.query('delete from public.yt_own_collection_runs where ran_at > now() - interval \'10 days\'')
      const c = await cena(S1)
      await cob(c, 0, 'base', dia(-45), dia(-1), new Date(Date.now() - 3 * 3_600_000).toISOString())
      for (let i = 0; i < 40; i++) {
        const d = dia(-45 + i)
        if (i < 30) await linha(c, 0, d, { ...VAZIA })
        else await linha(c, 0, d, { ...VAZIA, views: i - 29, avg_view_duration_seconds: 30, avg_view_percentage: 50 })
      }
      for (const horas of [51, 27, 3]) {
        const ran = new Date(Date.now() - horas * 3_600_000).toISOString()
        await pg.query(`insert into public.yt_own_collection_runs (ran_at, ms_total, ms_existente, falhas, resumo) values ($1, 1, 1, '{}'::text[], $2::jsonb)`,
          [ran, JSON.stringify({ diario: { ...BOM, ate: hoje } })])
      }
      await pg.query(`comment on table public.yt_own_video_daily is 'P3 armada em ${hoje}'`)
      await pg.query('savepoint s_arq')
      const r = await tenta(SQL)
      if (dentro) {
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.msg).toContain('entre 11:30 e 13:00 UTC')
        expect(await diarioN(S1)).toBe(40)
      } else {
        if (!r.ok) throw new Error('o arquivo inteiro recusou fora da janela: ' + r.msg)
        expect(await diarioN(S1)).toBe(10)
        expect(await backupN(S1)).toBe(30)
        const com = String((await q("select obj_description('public.yt_own_video_daily_zeros_bkp'::regclass, 'pg_class') as c"))[0]!.c)
        expect(com.startsWith('MG15 ')).toBe(true)
        expect(await n(`select count(*) from pg_proc where proname in ('yt_own_daily_diet_p3','yt_own_daily_diet_p3_contas','yt_own_daily_linha_vazia')`)).toBe(0)
        // rodar de novo na mesma transação: nada a apagar, sem erro
        const de_novo = await tenta(SQL)
        expect(de_novo.ok).toBe(true)
        expect(await backupN(S1)).toBe(30)
      }
    } finally {
      await pg.query('rollback')
    }
  })
})
