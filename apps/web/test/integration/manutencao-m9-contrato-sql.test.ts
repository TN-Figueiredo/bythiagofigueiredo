// @vitest-environment node
/** M9 Tarefa 6: o contrato Zod (expurgo-contrato.ts) contra o que as funções SQL da Tarefa 3 devolvem de fato (rascunho m9.sql vigente). begin ... rollback (54422). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { m3bNoBanco, aplicarM3b, semearCanal } from '../helpers/m3b'
import { aplicarM9 } from '../helpers/m9'
import { travarDdl } from '../helpers/ddl-testes'
import { CorpoRegistrar, CorpoBloquear, RespostaAbrir, RespostaRegistrar, RespostaBloquear } from '@/lib/youtube/observatorio/arquivo-mensal/expurgo-contrato'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const H = (ch: string): string => ch.repeat(64)
const DAILY = 'competitor_video_daily'
const MES = '2026-09-01'

describe.skipIf(skipIfNoLocalDb())('M9 contrato Zod contra o SQL da Tarefa 3', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  async function cena(fn: (c: { site: string; canal: string; video: string; alvo: number }) => Promise<void>, o: { soma?: string } = {}): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      await travarDdl(pg)
      await aplicarM9(pg, 3)
      const s = await semearCanal(pg, { videos: 1 })
      const u = (await pg.query(
        `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, parts, received_at)
         values ($1, 'serie', $2, $3, $4::date, 1, 10, $5::numeric, $6, $7, $8, $9, 100, 1, now()) returning id`,
        [s.site, DAILY, s.canal, MES, o.soma ?? '100', H('a'), H('b'), H('c'), H('d')])).rows[0].id as string
      const a = Number((await pg.query(
        `insert into public.obs_archive_item_targets (site_id, item_kind, item_refs, item_id, class, table_name, channel_ref, month, keys, esperadas, from_unit_id, from_version, estado)
         values ($1, 'video', array['yt1'], 1, 'serie', $2, $3, $4::date, array[$5], 4, $6, 1, 'copiar') returning id`, [s.site, DAILY, s.canal, MES, s.videos[0], u])).rows[0].id)
      await pg.query(`insert into public.obs_archive_summaries (site_id, class, channel_ref, month, version, empty, canal_sha256, canal_bytes, canal_rows, video_sha256, video_bytes, video_rows, unit_hashes, received_at)
        values ($1, 'serie', $2, $3::date, 1, false, $4, 10, 5, $5, 10, 5, '{}'::jsonb, now())`, [s.site, s.canal, MES, H('7'), H('8')])
      await pg.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, sealed_version, sealed_kind) values ($1, 'serie', $2, $3::date, now(), 1, 'com_dado')`, [s.site, DAILY, MES])
      await fn({ site: s.site, canal: s.canal, video: s.videos[0]!, alvo: a })
    } finally { await pg.query('rollback') }
  }
  const chamar = async (sql: string, p: unknown[]): Promise<unknown> => (await pg.query(sql, p)).rows[0].r

  const corpo = (c: { canal: string; alvo: number }, removidas: number, nova: number) => ({
    passo: 'registrar', item_id: 'item:1', classe: 'serie', canal: c.canal, mes: '2026-09',
    alvos: [{ alvo_id: c.alvo, removidas, unidade: removidas === 0 ? null : {
      row_count: nova, control_sum: '90', hash_conteudo: H('e'), schema_fp: H('b'), sha256_bytes: nova === 0 ? null : H('f'), csv_sha256: nova === 0 ? null : H('1'), file_bytes: 50, partes: 1, min_key: null, max_key: null, parts: [] } }],
    resumo: { versao: 2, vazio: false, canal_sha256: H('2'), canal_bytes: 10, canal_rows: 6, video_sha256: H('3'), video_bytes: 10, video_rows: 6, tabelas_lidas: [DAILY] },
  })

  it('abrir: a resposta do SQL passa por RespostaAbrir (soma, esperadas, arquivos, resumo)', async () => cena(async c => {
    const r = await chamar(`select public.obs_archive_expurgo_open($1, 1) as r`, [c.site])
    const p = RespostaAbrir.safeParse(r)
    expect(p.success, JSON.stringify(p.success ? '' : p.error.issues)).toBe(true)
    if (p.success) { expect(p.data.grupos).toHaveLength(1); expect(p.data.grupos[0]!.alvos[0]!.soma).toEqual(expect.anything()) }
  }))

  it('registrar: o corpo do contrato é aceito pelo SQL e a resposta passa por RespostaRegistrar', async () => cena(async c => {
    const b = CorpoRegistrar.parse(corpo(c, 4, 6))
    const { passo: _p, item_id: _i, ...grupo } = b
    const r = await chamar(`select public.obs_archive_expurgo_record($1, 1, $2::jsonb) as r`, [c.site, JSON.stringify(grupo)])
    const p = RespostaRegistrar.safeParse(r)
    expect(p.success, JSON.stringify(r)).toBe(true)
    expect(p.success && p.data.status === 'ok' && p.data.alvos[0]!.estado).toBe('aguardando_nova')
    expect(p.success && p.data.status === 'ok' && p.data.resumo?.arquivo_id).toMatch(/^s:/)
  }))

  it('registrar: sem remoção (sem_linhas) e recusa (contagem divergente) passam por RespostaRegistrar', async () => cena(async c => {
    const b0 = CorpoRegistrar.parse(corpo(c, 0, 0))
    const { passo: _p, item_id: _i, ...g0 } = b0
    const recusa = await chamar(`select public.obs_archive_expurgo_record($1, 1, $2::jsonb) as r`, [c.site, JSON.stringify(g0)])   // esperadas = 4, removidas 0
    const pr = RespostaRegistrar.parse(recusa)
    expect(pr).toMatchObject({ status: 'recusado', motivo: 'contagem_divergente', alvo_id: c.alvo })
  }))

  it('bloquear: corpo do contrato e respostas ok e recusa passam por RespostaBloquear', async () => cena(async c => {
    const b = CorpoBloquear.parse({ passo: 'bloquear', item_id: 'item:1', alvo_id: c.alvo, motivo: 'antiga_ausente' })
    const ok = await chamar(`select public.obs_archive_expurgo_block($1, 1, $2, $3) as r`, [c.site, b.alvo_id, b.motivo])
    expect(RespostaBloquear.parse(ok)).toMatchObject({ status: 'ok' })
    const de_novo = await chamar(`select public.obs_archive_expurgo_block($1, 1, $2, $3) as r`, [c.site, b.alvo_id, b.motivo])
    expect(RespostaBloquear.parse(de_novo)).toMatchObject({ status: 'recusado', motivo: 'alvo_fora_de_copiar', alvo_id: c.alvo })
  }))
})
