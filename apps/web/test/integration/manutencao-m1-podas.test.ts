// @vitest-environment node
/**
 * Fase de manutenção, M1: as podas de cron_runs e yt_own_collection_attempts (itens de aceite 3 e 4; desvio D-M1-1).
 * Banco: SÓ o bythiago_int. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/manutencao-m1-podas.test.ts --no-file-parallelism
 * As podas apagam no banco inteiro: todo teste roda dentro de begin … rollback, e só afirma sobre as linhas que semeou.
 * O SQL vem de supabase/migrations/ (o arquivo da M1), aplicado duas vezes dentro da transação.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, SUPABASE_URL, SERVICE_KEY } from '../helpers/db-seed'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))
const MARCA = 'manutencao_m1_podas_execucao'

function lerMigration(): string {
  const dir = `${RAIZ}supabase/migrations/`
  const achado = readdirSync(dir).find(f => f.includes(MARCA))
  if (!achado) throw new Error(`a migration da M1 (${MARCA}) não existe em supabase/migrations/`)
  return readFileSync(dir + achado, 'utf8')
}

interface LinhaTentativa { scope_id: string; kind: string; idade: number; outcome: string }

describe.skipIf(skipIfNoLocalDb())('M1: podas de estado de execução (bythiago_int)', () => {
  let pg: Client
  let siteId: string
  const job = `teste-m1-${randomUUID()}`
  const pre = `m1-${randomUUID().slice(0, 8)}-`
  const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    siteId = (await seedSite(service)).siteId
  })
  afterAll(async () => {
    await service.from('sites').delete().eq('id', siteId)
    await pg.end()
  })
  beforeEach(async () => {
    await pg.query('begin')
    const sql = lerMigration()
    await pg.query(sql)
    await pg.query(sql) // idempotente
  })
  afterEach(async () => { await pg.query('rollback') })

  const semearRuns = async (dias: number[]): Promise<void> => {
    await pg.query(
      `insert into public.cron_runs (job, ran_at, status) select $1, now() - make_interval(days => d), 'ok' from unnest($2::int[]) d`,
      [job, dias],
    )
  }
  const idadesRuns = async (): Promise<number[]> => {
    const r = await pg.query<{ idade: number }>(
      `select extract(day from now() - ran_at)::int as idade from public.cron_runs where job = $1 order by 1`, [job])
    return r.rows.map(x => x.idade)
  }
  const semearTentativa = async (scope: 'video' | 'canal', id: string, kind: string, idade: number, outcome: string): Promise<void> => {
    await pg.query(
      `insert into public.yt_own_collection_attempts (scope_type, scope_id, kind, attempt_day, site_id, outcome)
       values ($1, $2, $3, (now() at time zone 'utc')::date - $4::int, $5, $6)`,
      [scope, pre + id, kind, idade, siteId, outcome])
  }
  const tentativas = async (): Promise<LinhaTentativa[]> => {
    const r = await pg.query<LinhaTentativa>(
      `select substr(scope_id, length($1) + 1) as scope_id, kind, ((now() at time zone 'utc')::date - attempt_day) as idade, outcome
         from public.yt_own_collection_attempts where scope_id like $1 || '%' order by 1, 2, 3 desc`, [pre])
    return r.rows
  }
  const resumoPorChave = `select scope_type, scope_id, kind, min(attempt_day) as prim, max(attempt_day) as ult,
      max(attempt_day) filter (where outcome in ('ok', 'sem_dado_na_janela')) as resp
    from public.yt_own_collection_attempts where scope_id like $1 || '%' group by 1, 2, 3 order by 1, 2, 3`

  it('a migration aplica duas vezes sem pg_cron e não agenda nada', async () => {
    const r = await pg.query<{ n: number }>(`select count(*)::int as n from pg_extension where extname = 'pg_cron'`)
    expect(r.rows[0].n).toBe(0) // FM10: se um dia o bythiago_int ganhar pg_cron, este teste avisa
    const f = await pg.query<{ n: number }>(`select count(*)::int as n from pg_proc where pronamespace = 'public'::regnamespace and proname in
      ('purge_cron_runs', 'cron_purge_cron_runs', 'yt_own_collection_attempts_purge', 'cron_purge_yt_own_collection_attempts')`)
    expect(f.rows[0].n).toBe(4)
  })

  it('cron_runs: apaga só o que tem mais de 90 dias, e a segunda chamada não apaga nada', async () => {
    await semearRuns([91, 92, 120, 400, 89, 10])
    const n = (await pg.query<{ n: number }>(`select public.purge_cron_runs() as n`)).rows[0].n as number
    expect(n).toBeGreaterThanOrEqual(4) // o banco compartilhado pode ter linhas velhas de outros: afirma-se sobre as nossas
    expect(await idadesRuns()).toEqual([10, 89])
    expect((await pg.query<{ n: number }>(`select public.purge_cron_runs() as n`)).rows[0].n).toBe(0)
  })

  it('cron_runs: apaga em lotes e para no teto de lotes', async () => {
    await pg.query(`delete from public.cron_runs where ran_at < now() - interval '90 days'`) // isola a contagem (desfeito no rollback)
    await semearRuns([91, 92, 93, 94, 95])
    expect((await pg.query<{ n: number }>(`select public.purge_cron_runs(90, 2, 1) as n`)).rows[0].n).toBe(2)
    expect((await pg.query<{ n: number }>(`select public.purge_cron_runs(90, 2, 1) as n`)).rows[0].n).toBe(2)
    expect((await pg.query<{ n: number }>(`select public.purge_cron_runs(90, 2, 20) as n`)).rows[0].n).toBe(1)
    expect(await idadesRuns()).toEqual([])
  })

  it('cron_runs: a linha de 90 dias exatos fica', async () => {
    await semearRuns([90])
    await pg.query(`select public.purge_cron_runs()`)
    expect(await idadesRuns()).toEqual([90])
  })

  it('cron_runs: p_now no passado manda no corte', async () => {
    await semearRuns([100])
    await pg.query(`select public.purge_cron_runs(p_now => now() - interval '30 days')`)
    expect(await idadesRuns()).toEqual([100])
  })

  it('cron_runs: p_now no futuro não alarga a poda', async () => {
    await semearRuns([60])
    await pg.query(`select public.purge_cron_runs(p_now => now() + interval '60 days')`)
    expect(await idadesRuns()).toEqual([60])
  })

  it('tentativas: a primeira, a última tentativa e a última resposta de cada chave sobrevivem (D-M1-1)', async () => {
    await semearTentativa('video', 'vA', 'retencao_vida', 200, 'ok')
    await semearTentativa('video', 'vA', 'retencao_vida', 180, 'erro_http')
    await semearTentativa('video', 'vA', 'retencao_vida', 150, 'erro_http')
    await semearTentativa('video', 'vA', 'retencao_vida', 120, 'sem_dado_na_janela')
    await semearTentativa('video', 'vA', 'retencao_vida', 100, 'erro_http')
    await semearTentativa('video', 'vB', 'diario', 97, 'erro_http')
    await semearTentativa('video', 'vB', 'diario', 95, 'ok')
    await semearTentativa('video', 'vB', 'diario', 50, 'ok')
    await semearTentativa('canal', 'c', 'retencao_vida', 91, 'ok')
    await semearTentativa('canal', 'c', 'retencao_vida', 10, 'ok')
    await semearTentativa('video', 'vC', 'retencao_7d', 300, 'erro_http') // só uma linha, velha: é a última, fica
    const antes = (await pg.query(resumoPorChave, [pre])).rows

    await pg.query(`select public.yt_own_collection_attempts_purge()`)

    expect(await tentativas()).toEqual([
      { scope_id: 'c', kind: 'retencao_vida', idade: 91, outcome: 'ok' },
      { scope_id: 'c', kind: 'retencao_vida', idade: 10, outcome: 'ok' },
      { scope_id: 'vA', kind: 'retencao_vida', idade: 200, outcome: 'ok' },
      { scope_id: 'vA', kind: 'retencao_vida', idade: 120, outcome: 'sem_dado_na_janela' },
      { scope_id: 'vA', kind: 'retencao_vida', idade: 100, outcome: 'erro_http' },
      { scope_id: 'vB', kind: 'diario', idade: 97, outcome: 'erro_http' },
      { scope_id: 'vB', kind: 'diario', idade: 50, outcome: 'ok' },
      { scope_id: 'vC', kind: 'retencao_7d', idade: 300, outcome: 'erro_http' },
    ])
    expect((await pg.query(resumoPorChave, [pre])).rows).toEqual(antes)
    expect((await pg.query<{ n: number }>(`select public.yt_own_collection_attempts_purge() as n`)).rows[0].n).toBe(0)
  })

  it('tentativas: não toca linha dentro do prazo, nem a de 90 dias exatos', async () => {
    for (const idade of [90, 60, 1, 0]) await semearTentativa('video', 'vD', 'diario', idade, 'erro_http')
    await pg.query(`select public.yt_own_collection_attempts_purge()`)
    expect((await tentativas()).map(l => l.idade)).toEqual([90, 60, 1, 0])
  })

  it('tentativas: p_now no passado manda no corte', async () => {
    for (const idade of [100, 95, 1]) await semearTentativa('video', 'vG', 'diario', idade, 'erro_http')
    await pg.query(`select public.yt_own_collection_attempts_purge(p_now => now() - interval '30 days')`)
    expect((await tentativas()).filter(l => l.scope_id === 'vG').map(l => l.idade)).toEqual([100, 95, 1])
  })

  it('tentativas: p_now no futuro não alarga a poda', async () => {
    for (const idade of [100, 60, 1]) await semearTentativa('video', 'vH', 'diario', idade, 'erro_http')
    await pg.query(`select public.yt_own_collection_attempts_purge(p_now => now() + interval '60 days')`)
    expect((await tentativas()).filter(l => l.scope_id === 'vH').map(l => l.idade)).toEqual([100, 60, 1])
  })

  it('tentativas: apaga em lotes', async () => {
    await pg.query(`delete from public.yt_own_collection_attempts where attempt_day < (now() at time zone 'utc')::date - 90`)
    for (const idade of [10, 91, 92, 93, 94]) await semearTentativa('video', 'vE', 'diario', idade, 'erro_http')
    // a de 94 é a primeira e a de 10 é a última; não há resposta: 91, 92 e 93 saem, de 2 em 2
    expect((await pg.query<{ n: number }>(`select public.yt_own_collection_attempts_purge(90, 2, 1) as n`)).rows[0].n).toBe(2)
    expect((await pg.query<{ n: number }>(`select public.yt_own_collection_attempts_purge(90, 2, 1) as n`)).rows[0].n).toBe(1)
    expect((await tentativas()).map(l => l.idade)).toEqual([94, 10])
  })

  it.each([
    ['purge_cron_runs(30)'], ['purge_cron_runs(null)'], ['purge_cron_runs(90, 0)'], ['purge_cron_runs(90, 10, 0)'],
    ['yt_own_collection_attempts_purge(89)'], ['yt_own_collection_attempts_purge(90, 10, 1, null)'],
  ])('recusa prazo abaixo de 90 e argumento inválido: %s', async chamada => {
    await pg.query('savepoint s')
    await expect(pg.query(`select public.${chamada}`)).rejects.toMatchObject({ code: '22023' })
    await pg.query('rollback to savepoint s')
  })

  it('invólucro cron_purge_cron_runs: grava a linha do dia com job, status ok e items_processed = apagadas', async () => {
    await pg.query(`delete from public.cron_runs where ran_at < now() - interval '90 days'`) // isola: só as nossas serão velhas
    await semearRuns([91, 92, 120])
    await pg.query(`select public.cron_purge_cron_runs()`)
    const r = await pg.query<{ status: string; items_processed: number }>(
      `select status, items_processed from public.cron_runs where job = 'pg_cron:purge-cron-runs' order by ran_at desc limit 1`)
    expect(r.rows[0]).toEqual({ status: 'ok', items_processed: 3 })
  })

  it('invólucro cron_purge_yt_own_collection_attempts: grava a linha do dia com job, status ok e items_processed = apagadas', async () => {
    await pg.query(`delete from public.yt_own_collection_attempts where attempt_day < (now() at time zone 'utc')::date - 90`)
    // chave de 4 linhas: a mais velha (primeira) e a mais nova (última) ficam; as duas do meio, de 'erro_http', saem
    await semearTentativa('video', 'vI', 'retencao_vida', 200, 'ok')
    await semearTentativa('video', 'vI', 'retencao_vida', 150, 'erro_http')
    await semearTentativa('video', 'vI', 'retencao_vida', 120, 'erro_http')
    await semearTentativa('video', 'vI', 'retencao_vida', 5, 'ok')
    await pg.query(`select public.cron_purge_yt_own_collection_attempts()`)
    const r = await pg.query<{ status: string; items_processed: number }>(
      `select status, items_processed from public.cron_runs where job = 'pg_cron:purge-yt-own-collection-attempts' order by ran_at desc limit 1`)
    expect(r.rows[0]).toEqual({ status: 'ok', items_processed: 2 })
  })

  it('privilégio: só service_role executa; anon e authenticated não (conferido por catálogo, sem chamar)', async () => {
    const r = await pg.query<{ proname: string; definer: boolean; anon: boolean; auth: boolean; service: boolean }>(
      `select proname, prosecdef as definer, has_function_privilege('anon', oid, 'execute') as anon,
              has_function_privilege('authenticated', oid, 'execute') as auth,
              has_function_privilege('service_role', oid, 'execute') as service
         from pg_proc where pronamespace = 'public'::regnamespace and proname in
         ('purge_cron_runs', 'cron_purge_cron_runs', 'yt_own_collection_attempts_purge', 'cron_purge_yt_own_collection_attempts')`)
    expect(r.rows).toHaveLength(4)
    for (const f of r.rows) expect([f.proname, f.definer, f.anon, f.auth, f.service]).toEqual([f.proname, true, false, false, true])
  })
})
