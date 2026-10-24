// apps/web/test/integration/manutencao-m3b-pendencias.test.ts
// @vitest-environment node
/**
 * Manutenção M3b, parte 7 do SQL (emenda de 14/10, peça 7; plano M3b-site, Tarefa E1): `obs_archive_owner_pending` (C12) (sem papel de banco: a leitura do Mac é por rota com chave). Banco: SÓ o `bythiago_int` (54422), tudo em `begin … rollback`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { aplicarM2 } from '../helpers/m2'
import { aplicarM3b, sqlM3bAte, M3B_SQL_CAMINHO, escalar, q1, semearCanal } from '../helpers/m3b'
import { M10A_SQL } from './video-antigo-m10a-caminho'
import { lerPendencias } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'
import { apagarCanais, apagarSites } from '../helpers/limpa-cena'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const DAILY = 'competitor_video_daily'

interface Item { item_id: string; kind: string; tempo: string; desde: string; mes: string | null; channel_ref: string | null; youtube_id: string | null; marcado_rodado_em: string | null; apagar: unknown[]; b2_nomes: unknown[] }
interface Pend { versao: number; lido_em: string; total: number; itens: Item[] }

describe('M3b parte 7 (texto, roda sem banco): sem papel de banco', () => {
  it('a parte 7 não tem create role, alter role nem obs_arquivo_leitor', () => {
    const sql = readFileSync(M3B_SQL_CAMINHO, 'utf8')
    const parte7 = sql.slice(sql.indexOf('-- M3B PARTE 7'))
    expect(parte7.length).toBeGreaterThan(100)
    expect(parte7).not.toMatch(/create\s+role/i)
    expect(parte7).not.toMatch(/alter\s+role/i)
    expect(parte7).not.toContain('obs_arquivo_leitor')
  })
})

// SKIP 23/10/2026 (envio E0): este teste monta o banco com o corpo antigo (fixture MG6/E10 de 14/10) e a M2/M3b novas guardam por md5 o corpo da 0007 (M2:/M3b:competitor_channel_remove_archived_divergente). Religar na onda da M2 (11c) e M3b (md5 recomputado, yannis.md 3.3): `.skip` -> o `describe.skipIf(skipIfNoLocalDb())` original.
describe.skip('M3b parte 7: pendências do dono (sem papel de leitura)', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c.end() })

  async function emTx<T>(fn: () => Promise<T>): Promise<T> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')   // TRAVA_DDL_TESTES na 1ª instrução (Yannis R3-1)
    try {
      await aplicarM2(c)
      await c.query(readFileSync(M10A_SQL, 'utf8'))
      await aplicarM3b(c, 7)
      return await fn()
    } finally { await c.query('rollback') }
  }
  async function falha(sql: string, params: unknown[] = []): Promise<{ code: string; message: string } | null> {
    await c.query('savepoint f_pd')
    try { await c.query(sql, params); await c.query('release savepoint f_pd'); return null } catch (e) {
      await c.query('rollback to savepoint f_pd')
      const o = e as { code?: string; message?: string }
      return { code: o.code ?? '', message: o.message ?? '' }
    }
  }
  const ler = async (site: string | null): Promise<Pend> => (await c.query(`select public.obs_archive_owner_pending($1) as r`, [site])).rows[0].r as Pend
  async function admin(site: string): Promise<string> {
    const id = randomUUID()
    const org = (await c.query(`select org_id from public.sites where id = $1`, [site])).rows[0].org_id as string
    await c.query(`insert into auth.users (id, instance_id, aud, role, email) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2)`, [id, `m3b-${id}@t.test`])
    await c.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, id])
    return id
  }
  /** Um canal com uma unidade, removido pelo botão com `apagar` (estado `pedido`). */
  async function canalPedido(site: string): Promise<{ canal: string; adminId: string }> {
    const a = await semearCanal(c, { site, videos: 0 })
    const adminId = await admin(site)
    await c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
      values ($1, 'serie', $2, $3, '2026-10-01', 1, 5, md5('a') || md5('a'), md5('s') || md5('s'), md5('b') || md5('b'), md5('c') || md5('c'), 100, now())`, [site, DAILY, a.canal])
    await c.query(`select public.competitor_channel_remove($1, $2, 'apagar', 'botao', $3)`, [site, a.canal, adminId])
    return { canal: a.canal, adminId }
  }
  const limparSites = async (manter: string | null): Promise<void> => {      // só dentro da transação desfeita; sem os gatilhos de chave estrangeira
    await c.query(`set local session_replication_role = replica`)
    await apagarCanais(c, '$1::uuid is null or site_id <> $1', [manter])    // sem o gatilho de chave estrangeira, os canais não saem com o site
    await apagarSites(c, '$1::uuid is null or id <> $1', [manter])
    await c.query(`set local session_replication_role = origin`)
  }

  it('zero medido: site sem remoção e sem item devolve total 0, lista vazia, versão 1 e lido_em', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 })
    const r = await ler(a.site)
    expect(r).toMatchObject({ versao: 1, total: 0, itens: [] })
    expect(r.lido_em).toBeTruthy()
    expect(lerPendencias(r).ok).toBe(true)                                              // e o leitor aceita a forma que o banco devolve
  }))

  it('canal removido com apagar vira pendência sem comando; reappeared_at posterior vira o desde', async () => emTx(async () => {
    const site = randomUUID()
    const { canal } = await canalPedido(site)
    const r = await ler(site)
    expect(r.total).toBe(1)
    expect(r.itens[0]).toMatchObject({ item_id: `canal:${canal}`, kind: 'canal', tempo: 'sem_comando', mes: null, channel_ref: canal, marcado_rodado_em: null, apagar: [], b2_nomes: [] })
    const decidido = await escalar<Date>(c, `select decided_at from public.obs_archive_channel_removals where site_id = $1 and channel_ref = $2`, [site, canal])
    expect(new Date(r.itens[0]!.desde).getTime()).toBe(decidido.getTime())
    await c.query(`update public.obs_archive_channel_removals set reappeared_at = decided_at + interval '3 days', reappeared_count = 1 where site_id = $1`, [site])
    const r2 = await ler(site)
    expect(new Date(r2.itens[0]!.desde).getTime()).toBe(decidido.getTime() + 3 * 86400_000)
    expect(lerPendencias(r2).ok).toBe(true)
  }))

  it('sem_destino, guardado e sem_arquivo não entram', async () => emTx(async () => {
    const site = randomUUID()
    const a = await semearCanal(c, { site, videos: 0 }); const adm = await admin(site)
    // sem_arquivo: remoção apagar de canal sem unidade
    await c.query(`select public.competitor_channel_remove($1, $2, 'apagar', 'botao', $3)`, [site, a.canal, adm])
    // guardado: remoção guardar (E10) com unidade
    const g = await semearCanal(c, { site, videos: 0 })
    await c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
      values ($1, 'serie', $2, $3, '2026-10-01', 1, 5, md5('a') || md5('a'), md5('s') || md5('s'), md5('b') || md5('b'), md5('c') || md5('c'), 100, now())`, [site, DAILY, g.canal])
    await c.query(`select public.competitor_channel_remove($1, $2, 'guardar', 'e10_export', $3)`, [site, g.canal, adm])
    // sem_destino: unidade de canal ausente sem remoção
    await c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
      values ($1, 'serie', $2, $3, '2026-10-01', 1, 5, md5('a') || md5('a'), md5('s') || md5('s'), md5('b') || md5('b'), md5('c') || md5('c'), 100, now())`, [site, DAILY, randomUUID()])
    const estados = (await c.query(`select e->>'estado' as estado from jsonb_array_elements(public.obs_archive_removed_channel_list($1)) e order by 1`, [site])).rows.map(x => x.estado)
    expect(estados).toEqual(['guardado', 'sem_arquivo', 'sem_destino'])
    expect((await ler(site)).total).toBe(0)
  }))

  it('item da E9 com archive_pending entra; sem, não; comentário também', async () => emTx(async () => {
    const site = randomUUID()
    const a = await semearCanal(c, { site, videos: 0 }); const adm = await admin(site)
    const item = async (kind: string, pendente: boolean): Promise<number> => Number((await q1(c, `insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_by, rows_deleted, archive_pending)
      values ($1, $2, 'yt' || substr(gen_random_uuid()::text, 1, 8), $3, $4, '{}'::jsonb, $5) returning id`, [site, kind, a.canal, adm, pendente])).id)
    const v = await item('video', true); await item('video', false); const cm = await item('comentario', true); await item('canal', true)
    const r = await ler(site)
    expect(r.itens.map(i => i.item_id).sort()).toEqual([`item:${v}`, `item:${cm}`].sort())
    expect(r.itens.every(i => i.tempo === 'sem_comando' && i.apagar.length === 0 && i.b2_nomes.length === 0 && i.channel_ref === a.canal)).toBe(true)
    expect(lerPendencias(r).ok).toBe(true)
  }))

  it('ordem estável: desde crescente, empate por item_id', async () => emTx(async () => {
    const site = randomUUID()
    const a = await semearCanal(c, { site, videos: 0 }); const adm = await admin(site)
    const em = async (dias: number, kind = 'video'): Promise<number> => Number((await q1(c, `insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_by, decided_at, rows_deleted, archive_pending)
      values ($1, $2, 'yt' || substr(gen_random_uuid()::text, 1, 8), $3, $4, now() - make_interval(days => $5::int), '{}'::jsonb, true) returning id`, [site, kind, a.canal, adm, dias])).id)
    const recente = await em(1), antigo = await em(30), meio1 = await em(10), meio2 = await em(10)
    await c.query(`update public.competitor_removed_items set decided_at = (select decided_at from public.competitor_removed_items where id = $2) where id = $1`, [meio2, meio1])
    const ids = (await ler(site)).itens.map(i => i.item_id)
    const empate = [meio1, meio2].map(n => `item:${n}`).sort()
    expect(ids).toEqual([`item:${antigo}`, ...empate, `item:${recente}`])
  }))

  it('erro sobe, nunca lista vazia', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 })
    await c.query(`create or replace function public.obs_archive_removed_channel_list(p_site uuid) returns jsonb language plpgsql as $$ begin raise exception 'quebrou' using errcode = 'P0001'; end $$`)
    expect((await falha(`select public.obs_archive_owner_pending($1)`, [a.site]))?.message).toBe('quebrou')
    await c.query(`create or replace function public.obs_archive_removed_channel_list(p_site uuid) returns jsonb language sql as $$ select null::jsonb $$`)
    expect((await falha(`select public.obs_archive_owner_pending($1)`, [a.site]))?.message).toBe('lista_de_remocao_ilegivel')
  }))

  it('site resolvido dentro: o único site com canal no observatório; zero ou dois com canal lançam site_ambiguo; linhas em sites não contam (Phil I2)', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 })
    await limparSites(a.site)
    expect(await ler(null)).toMatchObject({ versao: 1, total: 0 })
    // um segundo site SEM canal (o hub é multi-site): continua resolvendo pelo que tem canal
    const org = (await c.query(`select org_id from public.sites where id = $1`, [a.site])).rows[0].org_id as string
    const outro = randomUUID()
    await c.query(`insert into public.sites (id, org_id, name, slug, domains, primary_domain) values ($1::uuid, $2, 'sem canal', 'sem-canal-' || substr($1::text, 1, 8), array['sc-' || substr($1::text, 1, 8) || '.test'], 'sc-' || substr($1::text, 1, 8) || '.test')`, [outro, org])
    expect(await escalar(c, `select count(*)::int from public.sites`)).toBe(2)
    expect(await ler(null)).toMatchObject({ versao: 1, total: 0 })
    const b = await semearCanal(c, { site: outro, videos: 0 })
    expect((await falha(`select public.obs_archive_owner_pending(null)`))?.message).toBe('site_ambiguo')           // dois sites com canal
    expect(await falha(`select public.obs_archive_owner_pending($1)`, [b.site])).toBeNull()      // com o site dado, não precisa resolver
    await c.query(`set local session_replication_role = replica`)
    await c.query(`delete from public.competitor_channels`)
    await c.query(`set local session_replication_role = origin`)
    expect((await falha(`select public.obs_archive_owner_pending(null)`))?.message).toBe('site_ambiguo')           // nenhum canal, nenhuma remoção, nenhuma unidade
  }))

  it('sem nenhum canal mas com a remoção pendente: o site sai da remoção e o item aparece, não site_ambiguo (Phil N2)', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 })
    await limparSites(a.site)
    const p = await canalPedido(a.site)
    await c.query(`set local session_replication_role = replica`)
    await c.query(`delete from public.competitor_channels`)                       // o dono removeu todos os canais do site
    await c.query(`set local session_replication_role = origin`)
    expect(await escalar(c, `select count(*)::int from public.competitor_channels`)).toBe(0)
    const r = await ler(null)
    expect(r.total).toBe(1)
    expect(r.itens[0].item_id).toBe(`canal:${p.canal}`)
  }))

  it('concessões: anon e authenticated não; service_role e postgres sim; nenhum outro papel com execute explícito', async () => emTx(async () => {
    const f = 'public.obs_archive_owner_pending(uuid)'
    for (const q of ['anon', 'authenticated']) expect(await escalar(c, `select has_function_privilege($1, $2, 'execute')`, [q, f]), q).toBe(false)
    for (const q of ['service_role', 'postgres']) expect(await escalar(c, `select has_function_privilege($1, $2, 'execute')`, [q, f]), q).toBe(true)
    // ACL explícita: só service_role, postgres e o dono (emenda 14/10 noite: rota com chave)
    const diretos = (await c.query(`select distinct case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as g
      from pg_proc p, lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid = 'public.obs_archive_owner_pending(uuid)'::regprocedure and a.privilege_type = 'EXECUTE'`)).rows.map(x => x.g as string)
    expect(diretos.filter(g => !['service_role', 'postgres'].includes(g))).toEqual([])
  }))

  it('nenhuma função da M3b (obs_archive_*, competitor_channel_remove*) tem EXECUTE para anon, authenticated ou PUBLIC (Phil, conferência 2 da Tarefa 10)', async () => emTx(async () => {
    const r = await c.query(`select p.oid::regprocedure::text as f from pg_proc p
      where p.pronamespace = 'public'::regnamespace and (p.proname like 'obs\\_archive\\_%' or p.proname like 'competitor\\_channel\\_remove%')
        and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
             or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0))
      order by 1`)
    expect(r.rows.map(x => x.f as string)).toEqual([])
    expect(await escalar(c, `select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and proname like 'obs\\_archive\\_%'`)).toBeGreaterThan(40)   // a varredura olha algo
  }))

  it('a parte 7 não cria papel (rota com chave): o texto não tem create role, alter role nem obs_arquivo_leitor; o papel não existe; rodada duas vezes não falha', async () => emTx(async () => {
    const sql = sqlM3bAte(7)
    const parte7 = sql.slice(sql.indexOf('-- M3B PARTE 7'))
    expect(parte7.length).toBeGreaterThan(100)
    expect(parte7).not.toMatch(/create\s+role/i)
    expect(parte7).not.toMatch(/alter\s+role/i)
    expect(parte7).not.toContain('obs_arquivo_leitor')
    expect(await escalar(c, `select count(*)::int from pg_roles where rolname = 'obs_arquivo_leitor'`)).toBe(0)
    await c.query(parte7)
    await c.query(parte7)
  }))

  it('só lê: a chamada em transação read only não falha', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 })
    await c.query('savepoint ro')
    await c.query('set transaction read only')
    expect(await ler(a.site)).toMatchObject({ total: 0 })
    await c.query('rollback to savepoint ro')
  }))
})
