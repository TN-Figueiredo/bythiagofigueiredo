// @vitest-environment node
/**
 * F0-d (Tarefa 8): bruto da Reporting sem prazo (D17) e o apagamento só depois do NAS. Banco: só o `bythiago_int`.
 * Cada teste termina em `rollback`. Os testes de A5 E10 cobrem a purga a 400 dias; aqui fica o caso de 200 dias e a trava do NAS.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarSite, escalar, tenta } from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54422/postgres'

describe.skipIf(skipIfNoLocalDb())('F0-d: bruto sem prazo e lote só apaga depois do NAS', () => {
  let pg: Client
  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })
  afterAll(async () => {
    try { await pg.query('rollback') } catch { /* sem transação aberta */ }
    await pg.end()
  })

  it('marcar deleted_at sem nas_confirmed_at é recusado (23514)', async () => {
    await pg.query('begin')
    try {
      const { site } = await criarSite(pg)
      await pg.query(
        `insert into public.obs_archive_batches (site_id, batch, table_name, channel_ref, period_start, period_end, row_count, file_sha256, csv_sha256, exported_at, verified_at)
         values ($1, 'lote-f0d', 'yt_x', 'canal-f0d', current_date, current_date, 1, repeat('a', 64), repeat('b', 64), now(), now())`, [site])
      const r = await tenta(pg, `update public.obs_archive_batches set deleted_at = now() where site_id = $1 and nas_confirmed_at is null`, [site])
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('23514')
    } finally {
      await pg.query('rollback')
    }
  })

  it('yt_reporting_blobs_purge devolve 0 com bruto baixado há 200 dias, e o bruto continua lá', async () => {
    await pg.query('begin')
    try {
      const { site } = await criarSite(pg)
      const n = randomUUID().replace(/-/g, '')
      const canal = (await pg.query(
        `insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
         values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`,
        [site, 'UC' + n.slice(0, 20), '@t' + n.slice(0, 8), 'UU' + n.slice(0, 20), 'teste-' + n.slice(0, 8)])).rows[0].id
      const id = 'f0d-' + randomUUID()
      await pg.query(
        `insert into public.yt_reporting_reports (report_id, site_id, job_id, channel_id, report_type_id, start_time, end_time, create_time, download_url, status, downloaded_at)
         values ($1, $2, 'job', $3, 'tipo', now() - interval '201 days', now() - interval '200 days', now() - interval '200 days', 'https://example.test/x', 'baixado', now() - interval '200 days')`,
        [id, site, canal])
      await pg.query(`insert into public.yt_reporting_report_blobs (report_id, site_id, csv_gz) values ($1, $2, '\\x00')`, [id, site])
      expect(await escalar<number>(pg, `select public.yt_reporting_blobs_purge(array['tipo'])`)).toBe(0)
      expect(await escalar<number>(pg, `select count(*)::int from public.yt_reporting_report_blobs where report_id = $1`, [id])).toBe(1)
    } finally {
      await pg.query('rollback')
    }
  })
})
