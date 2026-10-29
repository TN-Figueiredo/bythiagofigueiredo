// apps/web/test/integration/manutencao-m6-rodizio.test.ts
// @vitest-environment node
/** M6, item 116 (plano M6, Tarefa 9): mês descartado continua sendo relido em rodízio; a falta e a diferença desarmam. begin … rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar } from '../helpers/m3b'
import { prepararM6, vinteQuatroDescartados } from '../helpers/m6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('M6 item 116: o rodízio dos meses descartados', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try { await prepararM6(c, 6); await f() } finally { await c.query('rollback') }
  }

  const reconferir = async (site: string): Promise<string[]> =>
    (await escalar<{ reconferir: Array<{ mes: string }> }>(c, `select public.obs_archive_plan($1, false, null)`, [site])).reconferir.map(r => r.mes)

  it('relido há 13 dias: nenhum mês descartado no plano; há 15: os 24 entram (o rodízio cobre todos em 14 dias)', async () => {
    await emTransacao(async () => {
      const { site } = await vinteQuatroDescartados(c, 13)
      // obs_archive_plan compara com o now() real (não com obs_archive_agora): o relógio falso da fixture (2027) deixaria a releitura no futuro e o caso passaria sem provar nada
      await c.query(`update public.obs_archive_units set nas_reported_at = now() - interval '13 days' where site_id = $1`, [site])
      expect((await reconferir(site)).filter(m => m < '2026-01')).toEqual([])
      await c.query(`update public.obs_archive_units set nas_reported_at = now() - interval '15 days' where site_id = $1`, [site])
      expect(new Set((await reconferir(site)).filter(m => m < '2026-01')).size).toBe(24)
    })
  })

  it('sem releitura: 21 dias não conta, 22 é amarelo; 45 não é vermelho, 46 é', async () => {
    await emTransacao(async () => {
      const { site } = await vinteQuatroDescartados(c, 21)
      expect(await escalar<number>(c, `select public.obs_archive_descartados_sem_releitura($1, 21)`, [site])).toBe(0)
      await c.query(`update public.obs_archive_units set nas_reported_at = public.obs_archive_agora() - interval '22 days' where site_id = $1`, [site])
      expect(await escalar<number>(c, `select public.obs_archive_descartados_sem_releitura($1, 21)`, [site])).toBe(24)
      await c.query(`update public.obs_archive_units set nas_reported_at = public.obs_archive_agora() - interval '45 days' + interval '1 hour' where site_id = $1`, [site])
      expect((await escalar<string[]>(c, `select public.obs_archive_vermelhos($1)`, [site])).some(v => v.startsWith('mês descartado sem releitura'))).toBe(false)
      await c.query(`update public.obs_archive_units set nas_reported_at = public.obs_archive_agora() - interval '46 days' where site_id = $1`, [site])
      expect((await escalar<string[]>(c, `select public.obs_archive_vermelhos($1)`, [site])).some(v => v.startsWith('mês descartado sem releitura'))).toBe(true)
    })
  })

  it('r2 I-2: o lado B2 sozinho: NAS relido ontem e B2 sem ler há 22 dias é amarelo; há 46 é vermelho', async () => {
    await emTransacao(async () => {
      const { site } = await vinteQuatroDescartados(c, 21)
      await c.query(`update public.obs_archive_units set nas_reported_at = public.obs_archive_agora() - interval '1 day' where site_id = $1`, [site])
      expect(await escalar<number>(c, `select public.obs_archive_descartados_sem_releitura($1, 21)`, [site])).toBe(0)
      await c.query(`update public.obs_archive_b2_files set last_ok_at = public.obs_archive_agora() - interval '22 days' where site_id = $1`, [site])
      expect(await escalar<number>(c, `select public.obs_archive_descartados_sem_releitura($1, 21)`, [site])).toBe(24)
      await c.query(`update public.obs_archive_b2_files set last_ok_at = public.obs_archive_agora() - interval '46 days' where site_id = $1`, [site])
      expect((await escalar<string[]>(c, `select public.obs_archive_vermelhos($1)`, [site])).some(v => v.startsWith('mês descartado sem releitura'))).toBe(true)
    })
  })
})
