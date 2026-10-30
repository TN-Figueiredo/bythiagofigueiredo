// @vitest-environment node
/** M9 Tarefa 13: baixa dos blobs das remoções e retenção de 90 dias da prova de ausência encerrada (Phil I1). Tudo em begin … rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { m3bNoBanco, aplicarM3b, semearCanal, escalar } from '../helpers/m3b'
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
    /** Linha `canal:` encerrada; `concluida` cria a remoção do canal já concluída (a poda só apaga prova de remoção concluída). */
    async function linhaEncerrada(c: { site: string; canal: string }, dias: number | null, prefixo: string, concluida = true): Promise<number> {
      if (concluida) {
        await pg.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known, completed_at)
                        values ($1, $2, 'botao', 'apagar', now(), true, now()) on conflict (site_id, channel_ref) do update set completed_at = now()`, [c.site, c.canal])
      }
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

    it('canal: encerrada há 91 dias de remoção NÃO concluída fica', async () => {
      await emTx(async c => {
        const id = await linhaEncerrada(c, 91, 'serie/b', false)
        expect(await escalar<number>(pg, `select public.obs_archive_absence_prune()`)).toBe(0)
        expect(await existe(id)).toBe(true)
      })
    })

    /** Versão v1 de texto superada, v2 recebida há 150 dias e atestada; B2 ok. Devolve o id da v1. */
    async function antigaDeTexto(c: { site: string; canal: string }): Promise<string> {
      const col = `site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, parts, received_at, nas_attested_at, superseded_at`
      const ins = async (v: number, ha: string, sup: boolean): Promise<string> => (await pg.query(
        `insert into public.obs_archive_units (${col}) values ($1, 'texto', 'competitor_video_comments', $2, '2026-09-01', $3, 10, 100, $4, $5, $6, $7, 100, 1,
           now() - $8::interval, now() - interval '1 hour', case when $9 then now() - interval '1 hour' end) returning id`,
        [c.site, c.canal, v, 'a'.repeat(64), 'b'.repeat(64), String(v).repeat(64), 'c'.repeat(64), ha, sup])).rows[0].id as string
      const v1 = await ins(1, '200 days', true)
      const v2 = await ins(2, '150 days', false)
      await pg.query(`insert into public.obs_archive_b2_files (site_id, arquivo_id, class, month, last_ok_at) values ($1, $2, 'texto', '2026-09-01', now() - interval '1 day')`, [c.site, `u:${v2}`])
      return v1
    }
    const abertas = (c: { site: string }) => escalar<number>(pg, `select public.obs_archive_antigas_open($1)`, [c.site])
    const fechar = (v1: string, dias: number) => pg.query(
      `update public.obs_archive_absence set nas_absent_first_at = now() - interval '120 days', nas_absent_at = now() - interval '120 days', snap_absent_at = now() - interval '100 days',
              b2_absent_at = now() - interval '92 days', encerrada_at = now() - make_interval(days => $2::int) where alvo = $1`, [`antiga:${v1}`, dias])

    it('C1 (Yannis): depois da poda, antigas_open devolve 0 (a antiga encerrada não reabre)', async () => {
      await emTx(async c => {
        const v1 = await antigaDeTexto(c)
        expect(await abertas(c)).toBe(1)
        await fechar(v1, 91)
        expect(await abertas(c)).toBe(0)
        expect(await escalar<number>(pg, `select public.obs_archive_absence_prune()`)).toBe(0)
        expect(await abertas(c)).toBe(0)
      })
    })

    it('C1 (Phil): antiga em andamento com parte provada e encerrada há 91 dias não perde a linha', async () => {
      await emTx(async c => {
        const v1 = await antigaDeTexto(c)
        await abertas(c)
        await fechar(v1, 91)
        await pg.query(`insert into public.obs_archive_absence (site_id, alvo, unidade_id, filho, prefixo, e_prefixo, sha256, liberado_em) values ($1, $2, $3, 'texto', $4, false, $5, now())`,
          [c.site, `antiga:${v1}`, v1, `texto/${c.canal}/parte-2.csv.gz`, 'e'.repeat(64)])
        const antes = Number((await pg.query(`select count(*) n from public.obs_archive_absence where alvo = $1`, [`antiga:${v1}`])).rows[0].n)
        await escalar<number>(pg, `select public.obs_archive_absence_prune()`)
        const depois = Number((await pg.query(`select count(*) n from public.obs_archive_absence where alvo = $1`, [`antiga:${v1}`])).rows[0].n)
        expect(depois).toBe(antes)
      })
    })

    it('blobs_done recusa p_urls nulo', async () => {
      await emTx(async c => {
        await expect(pg.query(`select public.obs_archive_removal_blobs_done($1, $2, null)`, [c.site, c.canal])).rejects.toThrow(/urls_nulas/)
      })
    })

    it('retenção menor que 90 dias é recusada', async () => {
      await emTx(async () => {
        await expect(pg.query(`select public.obs_archive_absence_prune(30)`)).rejects.toThrow(/retencao_minima_90_dias/)
      })
    })
  })
})
