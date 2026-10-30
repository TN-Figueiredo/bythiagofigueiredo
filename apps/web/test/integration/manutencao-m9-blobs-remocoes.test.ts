// @vitest-environment node
/** M9 Tarefa 13: baixa dos blobs das remoções e retenção de 90 dias da prova de ausência encerrada (Phil I1). Tudo em begin … rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { m3bNoBanco, aplicarM3b, semearCanal } from '../helpers/m3b'
import { aplicarM9 } from '../helpers/m9'
import { travarDdl } from '../helpers/ddl-testes'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const DIR = resolve(__dirname, '../../../../supabase/migrations')
const SQL_T13 = (): string => readFileSync(resolve(DIR, readdirSync(DIR).find(n => n.includes('_manutencao_m9_blobs_remocoes'))!), 'utf8')
const U = (n: number): string => `https://x.public.blob.vercel-storage.com/observatorio/thumbs/v${n}/h.jpg`

describe.skipIf(skipIfNoLocalDb())('M9 T13: blobs das remoções e retenção da prova de ausência', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  async function emTx(fn: (c: { site: string; canal: string }) => Promise<void>): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      await travarDdl(pg)
      await aplicarM9(pg)
      await pg.query(SQL_T13())
      const s = await semearCanal(pg, { videos: 1 })
      await fn({ site: s.site, canal: s.canal })
    } finally { await pg.query('rollback') }
  }

  it('blobs_done tira só as URLs dadas; URL que não estava é ignorada', async () => {
    await emTx(async c => {
      await pg.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known, blobs_pending)
                      values ($1, $2, 'botao', 'apagar', now(), true, $3::text[])`, [c.site, c.canal, [U(1), U(2), U(3)]])
      const r = await pg.query(`select public.obs_archive_removal_blobs_done($1, $2, $3::text[]) as n`, [c.site, c.canal, [U(1), U(2), U(99)]])
      expect(r.rows[0].n).toBe(1)
      const p = await pg.query(`select blobs_pending from public.obs_archive_channel_removals where site_id = $1 and channel_ref = $2`, [c.site, c.canal])
      expect(p.rows[0].blobs_pending).toEqual([U(3)])
    })
  })

  it('sem EXECUTE para anon e authenticated; service_role executa', async () => {
    await emTx(async () => {
      for (const fn of ['public.obs_archive_removal_blobs_done(uuid,text,text[])', 'public.obs_archive_absence_prune(int)']) {
        const q = async (role: string): Promise<boolean> => (await pg.query(`select has_function_privilege($1, $2::regprocedure, 'execute') as p`, [role, fn])).rows[0].p as boolean
        expect([await q('anon'), await q('authenticated'), await q('service_role')]).toEqual([false, false, true])
      }
    })
  })

  describe('retenção de 90 dias da prova de ausência encerrada', () => {
    async function linhaEncerrada(c: { site: string; canal: string }, dias: number | null, prefixo: string): Promise<number> {
      const id = (await pg.query(
        `insert into public.obs_archive_absence (site_id, alvo, canal_ref, filho, prefixo, e_prefixo, liberado_em, encerrada_at)
         values ($1, $2, $3, 'numerico', $4, true, now(), case when $5::int is null then null else now() - make_interval(days => $5::int) end) returning id`,
        [c.site, `canal:${c.canal}`, c.canal, prefixo, dias])).rows[0].id as number
      return Number(id)
    }
    const existe = async (id: number): Promise<boolean> => (await pg.query(`select 1 from public.obs_archive_absence where id = $1`, [id])).rowCount === 1

    it('89 dias fica, 91 dias sai, aberta nunca sai', async () => {
      await emTx(async c => {
        const a89 = await linhaEncerrada(c, 89, 'serie/a'), a91 = await linhaEncerrada(c, 91, 'serie/b'), aberta = await linhaEncerrada(c, null, 'serie/c')
        const r = await pg.query(`select public.obs_archive_absence_prune() as n`)
        expect(r.rows[0].n).toBe(1)
        expect([await existe(a89), await existe(a91), await existe(aberta)]).toEqual([true, false, true])
      })
    })

    it('retenção menor que 90 dias é recusada', async () => {
      await emTx(async () => {
        await expect(pg.query(`select public.obs_archive_absence_prune(30)`)).rejects.toThrow(/retencao_minima_90_dias/)
      })
    })
  })
})
