// @vitest-environment node
/**
 * F0 das sugestões (Tarefa 2): o SQL de `test/fixtures/sql/sugestoes-f0-coleta.sql` contra Postgres de verdade (`bythiago_int`).
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/sugestoes-f0-migration.test.ts --no-file-parallelism
 * Cada teste abre uma transação, aplica o SQL duas vezes (idempotência), semeia o que precisa e termina em `rollback`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarSite, criarUsuario, q1 } from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54422/postgres'
const SQL = readFileSync(fileURLToPath(new URL('../fixtures/sql/sugestoes-f0-coleta.sql', import.meta.url)), 'utf8')
const V = 'public.yt_own_search_terms'

describe.skipIf(skipIfNoLocalDb())('F0 sugestões: sem_videos, escopo da execução, termos de pesquisa (banco local)', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => {
    try { await pg.query('rollback') } catch { /* sem transação */ }
    await pg.end()
  })

  async function dentro<T>(fn: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    try {
      await pg.query(SQL)
      await pg.query(SQL)
      return await fn()
    } finally {
      await pg.query('rollback')
    }
  }
  /** Executa dentro de um savepoint e devolve o código SQLSTATE do erro (ou null). */
  async function codigo(sql: string, params: unknown[] = []): Promise<string | null> {
    await pg.query('savepoint s')
    try {
      await pg.query(sql, params)
      await pg.query('release savepoint s')
      return null
    } catch (e) {
      await pg.query('rollback to savepoint s')
      return (e as { code?: string }).code ?? 'desconhecido'
    }
  }

  async function canal(site: string): Promise<string> {
    const x = randomUUID().replace(/-/g, '')
    return String((await q1(pg, `insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [site, 'UC' + x.slice(0, 22), '@t' + x.slice(0, 8), 'UU' + x.slice(2, 24), 'teste-' + x.slice(0, 8)])).id)
  }

  it("outcome aceita 'sem_videos' e continua recusando outro valor (23514)", async () => {
    await dentro(async () => {
      const { site } = await criarSite(pg)
      const ch = await canal(site)
      const ins = (outcome: string) => codigo(
        `insert into public.yt_own_collection_attempts (scope_type, scope_id, kind, attempt_day, site_id, channel_id, outcome)
         values ('canal', $1, 'meta', current_date, $2, $3, $4)`, [ch, site, ch, outcome])
      expect(await ins('sem_videos')).toBeNull()
      expect(await ins('qualquer')).toBe('23514')
    })
  })

  it("escopo: sem valor vira 'completo'; 'parcial' passa; 'meio' falha (23514)", async () => {
    await dentro(async () => {
      const r = await q1(pg, `insert into public.yt_own_collection_runs (ms_total, ms_existente) values (1, 1) returning escopo`)
      expect(r.escopo).toBe('completo')
      expect(await codigo(`insert into public.yt_own_collection_runs (ms_total, ms_existente, escopo) values (1, 1, 'parcial')`)).toBeNull()
      expect(await codigo(`insert into public.yt_own_collection_runs (ms_total, ms_existente, escopo) values (1, 1, 'meio')`)).toBe('23514')
    })
  })

  async function semear(site: string, ch: string): Promise<void> {
    const linha = (src: string, detail: string, vid: string) => pg.query(
      `insert into public.yt_own_video_traffic_detail_daily
         (youtube_video_id, day_pt, source_type, detail, detail_hash, site_id, channel_id, views, source_report_id, report_create_time, metric_version)
       values ($1, current_date - 3, $2, $3::text, encode(sha256(convert_to($3::text, 'UTF8')), 'hex'), $4, $5, 10, 'r', now(), 'v1')`,
      [vid, src, detail, site, ch])
    await linha('5', 'viagem barata', 'vid00000001')
    await linha('5', '', 'vid00000002')
    await linha('RELATED_VIDEO', 'outro', 'vid00000003')
  }

  it('yt_own_search_terms: só pesquisa, termo e sem_termo (nunca RELATED_VIDEO)', async () => {
    await dentro(async () => {
      const { site } = await criarSite(pg)
      const ch = await canal(site)
      await semear(site, ch)
      const r = await pg.query(`select youtube_video_id, termo, sem_termo from ${V} where channel_id = $1 order by youtube_video_id`, [ch])
      expect(r.rows).toEqual([
        { youtube_video_id: 'vid00000001', termo: 'viagem barata', sem_termo: false },
        { youtube_video_id: 'vid00000002', termo: '', sem_termo: true },
      ])
    })
  })

  it('permissões: anon sem select; authenticated só select; sem can_view_private_site, 0 linhas (mesmo com GUC forjado)', async () => {
    await dentro(async () => {
      const { site } = await criarSite(pg)
      const ch = await canal(site)
      await semear(site, ch)
      const usuario = await criarUsuario(pg)
      const priv = async (quem: string, p: string) =>
        (await pg.query(`select has_table_privilege($1, $2, $3) as ok`, [quem, V, p])).rows[0].ok as boolean
      expect(await priv('anon', 'select')).toBe(false)
      expect(await priv('authenticated', 'select')).toBe(true)
      for (const p of ['insert', 'update', 'delete']) expect(await priv('authenticated', p), p).toBe(false)

      await pg.query('savepoint papel')
      await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [site])
      await pg.query('set local role authenticated')
      const n = (await pg.query(`select 1 from ${V} where channel_id = $1`, [ch])).rowCount
      await pg.query('rollback to savepoint papel')
      expect(n).toBe(0)
    })
  })
})
