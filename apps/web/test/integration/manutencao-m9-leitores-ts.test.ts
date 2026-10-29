// @vitest-environment node
/**
 * M9 conserto do lote 2 (C1): a saída REAL do banco (plano do NAS, plano do B2 e pendências do dono) com o interruptor LIGADO passa pelos leitores Zod do TS.
 * O banco é a fonte do formato: alvo `alvo:<n>`, `canal:<uuid>` e `antiga:<uuid>`. begin ... rollback (54422).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { m3bNoBanco, aplicarM3b, semearCanal } from '../helpers/m3b'
import { criarUsuario } from '../helpers/mg6'
import { aplicarM9 } from '../helpers/m9'
import { travarDdl } from '../helpers/ddl-testes'
import { RespostaPlano, RespostaPlanoB2 } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'
import { lerPendencias } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'
import { lerPendencias as lerPendenciasV1 } from '../fixtures/pendencias-v1-staging'
import { CorpoExpurgo } from '@/lib/youtube/observatorio/arquivo-mensal/expurgo-contrato'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const H = (ch: string): string => ch.repeat(64)
const DAILY = 'competitor_video_daily'
const MES = '2026-09-01'
// O arquivo de emergência mora no ledger do repositório principal (ninguém o roda; só este teste).
const EMERGENCIA = join(homedir(), 'Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/comandos/m9-emergencia.sql')

describe.skipIf(skipIfNoLocalDb())('M9 leitores Zod do TS contra a saída real do banco (interruptor ligado)', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  async function emTx(fn: (c: { site: string; canal: string; item: number; antiga: string; alvoId: number }) => Promise<void>): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      await travarDdl(pg)
      await aplicarM9(pg, 6)
      const s = await semearCanal(pg, { videos: 1 })
      const admin = await criarUsuario(pg)
      const unid = async (v: number): Promise<string> => (await pg.query(
        `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, parts, received_at, nas_attested_at)
         values ($1, 'serie', $2, $3, $4::date, $5, 10, 100, $6, $7, $8, $9, 100, 1, now() - interval '1 day', now() - interval '1 day') returning id`,
        [s.site, DAILY, s.canal, MES, v, H('a'), H(String(v)), H('c'), H('d')])).rows[0].id as string
      const u1 = await unid(1); const u2 = await unid(2)
      // a remoção do canal fecha os alvos de item abertos: nasce antes deles
      await pg.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known) values ($1, $2, 'botao', 'apagar', now(), true)`, [s.site, s.canal])
      const item = Number((await pg.query(
        `insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_at, decided_by, rows_deleted)
         values ($1, 'video', 'yt1', $2, now(), $3, '{}'::jsonb) returning id`, [s.site, s.canal, admin])).rows[0].id)
      const alvoId = Number((await pg.query(
        `insert into public.obs_archive_item_targets (site_id, item_kind, item_refs, item_id, class, table_name, channel_ref, month, keys, esperadas, from_unit_id, from_version, estado, to_unit_id, to_version)
         values ($1, 'video', array['yt1'], $2, 'serie', $3, $4, $5::date, array[$6], 4, $7, 1, 'apagar_antigas', $8, 2) returning id`,
        [s.site, item, DAILY, s.canal, MES, s.videos[0], u1, u2])).rows[0].id)
      const linha = (alvo: string, prefixo: string, o: { alvoId?: number; unidadeId?: string; canalRef?: string }) => pg.query(
        `insert into public.obs_archive_absence (site_id, alvo, canal_ref, alvo_id, unidade_id, filho, prefixo, e_prefixo, sha256, liberado_em)
         values ($1, $2, $3, $4, $5, 'numerico', $6, false, $7, now())`, [s.site, alvo, o.canalRef ?? null, o.alvoId ?? null, o.unidadeId ?? null, prefixo, H('e')])
      await linha(`alvo:${alvoId}`, 'serie/canais/a.csv.gz', { alvoId })
      await linha(`antiga:${u1}`, 'serie/canais/b.csv.gz', { unidadeId: u1 })
      await linha(`canal:${s.canal}`, 'serie/canais/c.csv.gz', { canalRef: s.canal })
      expect((await pg.query(`select public.obs_archive_m9_ligar($1, true) as r`, [s.site])).rows[0].r).toBe(true)
      await fn({ site: s.site, canal: s.canal, item, antiga: u1, alvoId })
    } finally { await pg.query('rollback') }
  }
  const um = async (sql: string, p: unknown[]): Promise<unknown> => (await pg.query(sql, p)).rows[0].r

  it('plano do NAS: prefixos_ausentes com alvo:<n>, antiga:<uuid> e canal:<uuid> passam por RespostaPlano', async () => emTx(async c => {
    const r = await um(`select public.obs_archive_plan($1, false, null) as r`, [c.site]) as { prefixos_ausentes: Array<{ alvo: string }> }
    expect(r.prefixos_ausentes.map(p => p.alvo)).toEqual(expect.arrayContaining([`alvo:${c.alvoId}`, `antiga:${c.antiga}`, `canal:${c.canal}`]))
    const p = RespostaPlano.safeParse(r)
    expect(p.success, p.success ? '' : JSON.stringify(p.error.issues)).toBe(true)
  }))

  it('plano do B2: o mesmo, passando por RespostaPlanoB2', async () => emTx(async c => {
    await pg.query(`update public.obs_archive_absence set nas_absent_first_at = now(), nas_absent_at = now(), nas_last_absent_at = now(), snap_absent_at = now() where site_id = $1`, [c.site])
    const r = await um(`select public.obs_archive_b2_plan($1, false, null) as r`, [c.site]) as { prefixos_ausentes: Array<{ alvo: string }> }
    expect(r.prefixos_ausentes.map(p => p.alvo)).toEqual(expect.arrayContaining([`alvo:${c.alvoId}`, `antiga:${c.antiga}`, `canal:${c.canal}`]))
    const p = RespostaPlanoB2.safeParse(r)
    expect(p.success, p.success ? '' : JSON.stringify(p.error.issues)).toBe(true)
  }))

  it('pendências do dono: item:<n>, canal:<uuid> e antiga:<uuid> passam por lerPendencias; o item_id serve de passo do expurgo', async () => emTx(async c => {
    const r = await um(`select public.obs_archive_owner_pending($1) as r`, [c.site]) as { itens: Array<{ item_id: string }> }
    expect(r.itens.map(i => i.item_id)).toEqual(expect.arrayContaining([`antiga:${c.antiga}`, `canal:${c.canal}`, `item:${c.item}`]))
    const l = lerPendencias(r)
    expect(l.ok, JSON.stringify(l)).toBe(true)
    expect(CorpoExpurgo.safeParse({ passo: 'abrir', item_id: `item:${c.item}` }).success).toBe(true)
  }))
  it('I2 (Yannis): as subconsultas de owner_pending que varrem a ausência usam o índice (site_id, alvo, ...) com ~3.000 linhas encerradas', async () => emTx(async c => {
    await pg.query(`insert into public.obs_archive_absence (site_id, alvo, alvo_id, filho, prefixo, e_prefixo, encerrada_at)
                    select $1, 'alvo:' || (g + 1000000), g + 1000000, 'numerico', 'serie/x' || g, true, now() from generate_series(1, 3000) g`, [c.site])
    await pg.query(`analyze public.obs_archive_absence`)
    const plano = async (sql: string, p: unknown[]): Promise<string> => (await pg.query(`explain (analyze, costs off, timing off, summary off) ${sql}`, p)).rows.map(r => r['QUERY PLAN'] as string).join('\n')
    const alvoAntiga = `antiga:${c.antiga}`
    const casos: Array<[string, string, unknown[]]> = [
      ['lateral z (antiga)', `select count(*) from public.obs_archive_absence z where z.site_id = $1 and z.alvo = $2 and z.encerrada_at is null and z.liberado_em is not null and z.b2_absent_at is null`, [c.site, alvoAntiga]],
      ['a2 (antiga, b2_nomes)', `select a2.filho from public.obs_archive_absence a2 cross join lateral unnest(a2.b2_nomes) n where a2.site_id = $1 and a2.alvo = $2 and a2.encerrada_at is null and a2.b2_absent_at is null`, [c.site, alvoAntiga]],
      ['a (canal, b2_nomes)', `select a.filho from public.obs_archive_absence a cross join lateral unnest(a.b2_nomes) n where a.site_id = $1 and a.alvo = $2 and a.encerrada_at is null and a.b2_absent_at is null`, [c.site, `canal:${c.canal}`]],
      ['a (item, b2_nomes)', `select a.filho from public.obs_archive_absence a cross join lateral unnest(a.b2_nomes) n where a.site_id = $1 and a.alvo_id = $2 and a.encerrada_at is null and a.b2_absent_at is null`, [c.site, 1000001]],
      ['a (canal, prefixos)', `select a.prefixo from public.obs_archive_absence a where a.site_id = $1 and a.alvo = $2 and a.prefixo not like '\\_recebendo/%'`, [c.site, `canal:${c.canal}`]],
    ]
    for (const [nome, sql, p] of casos) {
      const t = await plano(sql, p)
      console.log(`EXPLAIN ${nome}\n${t}`)
      expect(t, nome).not.toMatch(/Seq Scan on obs_archive_absence/)
      expect(t, nome).toMatch(/Index (Only )?Scan using \w+ on obs_archive_absence/)
      expect(t, nome).toMatch(/Index Cond: .*site_id/)
    }
  }))
  it.skipIf(!existsSync(EMERGENCIA))('I3 (Yannis): a emergência devolve a versao 1; o leitor v1 do origin/staging aceita; o v2 recusa (antes) e o v1 recusava a v2', async () => emTx(async c => {
    const antes = await um(`select public.obs_archive_owner_pending($1) as r`, [c.site])
    expect((antes as { versao: number }).versao).toBe(2)
    const recusa = lerPendenciasV1(antes)
    expect(recusa.ok, 'o leitor v1 não aceita a v2: é por isso que a emergência existe').toBe(false)
    await pg.query(`select public.obs_archive_m9_ligar($1, false)`, [c.site])
    await pg.query(readFileSync(EMERGENCIA, 'utf8'))
    const depois = await um(`select public.obs_archive_owner_pending($1) as r`, [c.site])
    expect((depois as { versao: number }).versao).toBe(1)
    const v1 = lerPendenciasV1(depois)
    expect(v1.ok, JSON.stringify(v1)).toBe(true)
    expect((await pg.query(`select has_function_privilege('anon', 'public.obs_archive_owner_pending(uuid)', 'execute') as a, has_function_privilege('service_role', 'public.obs_archive_owner_pending(uuid)', 'execute') as s`)).rows[0]).toEqual({ a: false, s: true })
  }))
})
