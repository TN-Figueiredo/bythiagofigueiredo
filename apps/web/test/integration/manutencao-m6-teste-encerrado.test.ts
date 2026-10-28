// apps/web/test/integration/manutencao-m6-teste-encerrado.test.ts
// @vitest-environment node
/** M6 parte 6 [M6a] (plano M6, Tarefa 13b; item 121): encerrar o dado de teste. begin … rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar, semearCanal } from '../helpers/m3b'
import { prepararM6, novoAdmin } from '../helpers/m6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const T = 'obs_archive_rehearsal'

describe.skipIf(skipIfNoLocalDb())('M6 parte 6 [M6a]: encerrar o dado de teste', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try { await prepararM6(c, 6); await f() } finally { await c.query('rollback') }
  }
  const fechar = (site: string, admin: string | null): Promise<Record<string, unknown>> =>
    escalar<Record<string, unknown>>(c, `select public.obs_archive_test_close($1, $2)`, [site, admin])
  const mesEnsaio = (site: string): Promise<unknown> =>
    c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'ensaio', $2, '2026-05-01', now(), 9)`, [site, T])
  const restore = (site: string, diff: number, linhas: number): Promise<unknown> =>
    c.query(`insert into public.obs_archive_restores (site_id, class, table_name, schema_fp, origem, chave, units_checked, rows_restored, diff_rows, done_by)
             values ($1, 'ensaio', $2, 'fp', 'b2', 'cofre', 1, $3, $4, 'dono@t.test')`, [site, T, linhas, diff])

  it('sem mês ensaio descartado: descarte_de_teste_nao_feito; com descarte e sem restore: recuperacao_nao_testada; com os dois: ok, idempotente (closed_at não muda)', async () => {
    await emTransacao(async () => {
      const { site } = await semearCanal(c, { videos: 1 })
      const admin = await novoAdmin(c, site)
      expect(await fechar(site, admin)).toMatchObject({ status: 'recusado', codigo: 'descarte_de_teste_nao_feito' })
      await mesEnsaio(site)
      expect(await fechar(site, admin)).toMatchObject({ status: 'recusado', codigo: 'recuperacao_nao_testada' })
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_months where site_id = $1 and class = 'ensaio' and closed_at is not null`, [site])).toBe(0)
      await restore(site, 0, 9)
      expect(await fechar(site, admin)).toMatchObject({ status: 'ok', encerrados: 1 })
      const antes = await escalar<string>(c, `select closed_at::text from public.obs_archive_months where site_id = $1 and class = 'ensaio'`, [site])
      expect(await escalar<string>(c, `select closed_by::text from public.obs_archive_months where site_id = $1 and class = 'ensaio'`, [site])).toBe(admin)
      await c.query(`select set_config('obs_archive.agora', '2030-01-01 00:00:00+00', true)`)
      expect(await fechar(site, admin)).toMatchObject({ status: 'ok' })
      expect(await escalar<string>(c, `select closed_at::text from public.obs_archive_months where site_id = $1 and class = 'ensaio'`, [site])).toBe(antes)
    })
  })
  it('quem não administra (ou ninguém) recebe sem_direito e nada é gravado', async () => {
    await emTransacao(async () => {
      const { site } = await semearCanal(c, { videos: 1 })
      await mesEnsaio(site); await restore(site, 0, 9)
      expect(await fechar(site, '00000000-0000-0000-0000-00000000dead')).toMatchObject({ status: 'recusado', codigo: 'sem_direito' })
      expect(await fechar(site, null)).toMatchObject({ status: 'recusado', codigo: 'sem_direito' })
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_months where site_id = $1 and class = 'ensaio' and closed_at is not null`, [site])).toBe(0)
    })
  })
  it('restore com diff_rows > 0 ou rows_restored = 0 não vale: recuperacao_nao_testada; de outra classe também não', async () => {
    await emTransacao(async () => {
      const { site } = await semearCanal(c, { videos: 1 })
      const admin = await novoAdmin(c, site)
      await mesEnsaio(site)
      await restore(site, 1, 9); await restore(site, 0, 0)
      await c.query(`insert into public.obs_archive_restores (site_id, class, table_name, schema_fp, origem, chave, units_checked, rows_restored, diff_rows, done_by)
                     values ($1, 'serie', 'competitor_video_daily', 'fp', 'b2', 'cofre', 1, 5, 0, 'dono@t.test')`, [site])
      expect(await fechar(site, admin)).toMatchObject({ status: 'recusado', codigo: 'recuperacao_nao_testada' })
    })
  })
  it('só service_role executa', async () => {
    // a função só existe depois de aplicada a PARTE 6: aplica numa transação e confere
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try {
      await prepararM6(c, 6)
      const x = (await c.query(`select has_function_privilege('anon', 'public.obs_archive_test_close(uuid,uuid)', 'execute') a,
                                       has_function_privilege('authenticated', 'public.obs_archive_test_close(uuid,uuid)', 'execute') u,
                                       has_function_privilege('service_role', 'public.obs_archive_test_close(uuid,uuid)', 'execute') s`)).rows[0]
      expect(x).toEqual({ a: false, u: false, s: true })
    } finally { await c.query('rollback') }
  })
})
