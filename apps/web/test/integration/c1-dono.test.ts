// @vitest-environment node
/**
 * C1 · F1 · T4: funções do dono (liberar, liberar_cliente, estender, cortar, revogar_lgpd), contra o banco local.
 * Banco: SÓ o `bythiago_int` (aplicar a MIG antes: `psql ...54422... -v ON_ERROR_STOP=1 -f <MIG>`):
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/c1-dono.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, insertAuthUser, deleteAuthUser } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 120_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const CONSULTA = readFileSync(resolve(__dirname, '../../../../docs/ops/observatorio-c1-consulta-4-7.sql'), 'utf8')
const FUNCOES = [
  'obs_ai_liberar(uuid, uuid, integer, timestamptz)', 'obs_ai_liberar_cliente(uuid, uuid, text)',
  'obs_ai_estender_liberacao(uuid, integer, timestamptz)', 'obs_ai_cortar(uuid, uuid, text, timestamptz)',
  'obs_ai_revogar_lgpd(uuid)',
] as const

describe.skipIf(skipIfNoLocalDb())('C1 F1 T4: funções do dono (banco local)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const extras: Client[] = []
  const sites: string[] = []
  const users: string[] = []
  const keys: string[] = []
  const conexoes: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
  })
  afterAll(async () => {
    try {
      for (const c of extras) await c.end().catch(() => undefined)
      await pg.query(`delete from public.obs_ai_liberacoes where site_id = any($1::uuid[])`, [sites])
      await pg.query(`delete from public.pipeline_api_keys where id = any($1::uuid[]) or site_id = any($2::uuid[])`, [keys, sites])
      await pg.query(`delete from public.site_memberships where site_id = any($1::uuid[])`, [sites])
      await pg.query(`delete from public.audit_log where site_id = any($1::uuid[])`, [sites])
      if (sites.length > 0) await apagarSites(pg, 'id = any($1::uuid[])', [sites])
      for (const u of users) await deleteAuthUser(u)
    } finally {
      await pg.end()
    }
  })

  const novoCliente = async () => { const c = new Client({ connectionString: PG_URL }); await c.connect(); extras.push(c); return c }
  const site = async () => { const s = (await seedSite(sb)).siteId; sites.push(s); return s }
  const pessoa = async (s?: string) => {
    const u = await insertAuthUser(`c1t4-${randomUUID()}@example.test`); users.push(u)
    if (s) await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [s, u])
    return u
  }
  /** pessoa vinculada a um site novo */
  const cena = async () => { const s = await site(); const u = await pessoa(s); return { s, u } }

  const liberar = async (c: Client, u: string, s: string, dias: number, agora = 'now()') =>
    (await c.query(`select * from public.obs_ai_liberar($1, $2, $3, ${agora})`, [u, s, dias])).rows[0] as
      { motivo: string | null; liberacao_id: string | null; expires_at: Date | null }
  const cortar = async (c: Client, u: string, s: string, cliente: string | null, agora = 'now()') =>
    (await c.query(`select * from public.obs_ai_cortar($1, $2, $3, ${agora})`, [u, s, cliente])).rows as
      { tabela: string | null; id: string | null; motivo: string | null }[]
  const lib = async (id: string) => (await pg.query(`select * from public.obs_ai_liberacoes where id = $1`, [id])).rows[0]
  const con = async (id: string) => (await pg.query(`select * from public.obs_ai_conexoes where id = $1`, [id])).rows[0]
  const key = async (id: string) => (await pg.query(`select * from public.pipeline_api_keys where id = $1`, [id])).rows[0]

  /** conexão aberta (chave de conexão + token de acesso) numa liberação */
  async function conecta(s: string, u: string, libId: string, cliente: string) {
    const k = await pg.query(
      `insert into public.pipeline_api_keys (site_id, name, key_hash, permissions, user_id, expires_at, created_by)
       values ($1, 'observatorio-oauth-' || $2::text, $3, array['observatorio_leitura']::text[], $4,
               (select expires_at from public.obs_ai_liberacoes where id = $5), null) returning id`,
      [s, randomUUID().slice(0, 8), randomUUID(), u, libId])
    const keyId = String(k.rows[0].id); keys.push(keyId)
    const c = await pg.query(
      `insert into public.obs_ai_conexoes (site_id, user_id, liberacao_id, cliente, key_id) values ($1, $2, $3, $4, $5) returning id`,
      [s, u, libId, cliente, keyId])
    const conId = String(c.rows[0].id); conexoes.push(conId)
    const t = await pg.query(
      `insert into public.obs_ai_oauth_tokens (hash, tipo, conexao_id, client_id, familia, expires_at)
       values ($1, 'acesso', $2, 'cid', $3, now() + interval '1 hour') returning id`, [randomUUID(), conId, randomUUID()])
    return { keyId, conId, tokenId: String(t.rows[0].id) }
  }
  /** chave Bearer obs_ do perfil, da pessoa (a que a C1-27 espera que falhe) */
  async function chaveBearer(s: string, u: string) {
    const k = await pg.query(
      `insert into public.pipeline_api_keys (site_id, name, key_hash, permissions, user_id, expires_at)
       values ($1, 'obs-bearer', $2, array['observatorio_leitura']::text[], $3, now() + interval '30 days') returning id`,
      [s, randomUUID(), u])
    keys.push(String(k.rows[0].id)); return String(k.rows[0].id)
  }
  const conferencia = async () => (await pg.query(CONSULTA)).rows.filter(r => conexoes.includes(String(r.id))).map(r => String(r.id))

  it('(0) as 5 funções são só do service_role', async () => {
    for (const f of FUNCOES) {
      const r = await pg.query(
        `select has_function_privilege('anon', 'public.${f}', 'execute') as a,
                has_function_privilege('authenticated', 'public.${f}', 'execute') as u,
                has_function_privilege('service_role', 'public.${f}', 'execute') as s`)
      expect(r.rows[0], f).toEqual({ a: false, u: false, s: true })
    }
  })

  it('liberar: cria, recusa dias, ja_liberada, inelegível', async () => {
    const { s, u } = await cena()
    for (const d of [0, 367, -1]) expect((await liberar(pg, u, s, d)).motivo).toBe('dias')
    const r = await liberar(pg, u, s, 180, `'2026-11-11T12:00:00.123456Z'`)
    expect(r.motivo).toBeNull()
    expect((await pg.query(`select expires_at = '2026-11-11T12:00:00.123456Z'::timestamptz + interval '180 days' as ok from public.obs_ai_liberacoes where id = $1`, [r.liberacao_id])).rows[0].ok).toBe(true)
    const r2 = await liberar(pg, u, s, 10, `'2026-11-12T00:00:00Z'`)
    expect(r2.motivo).toBe('ja_liberada'); expect(r2.liberacao_id).toBe(r.liberacao_id)
    const s2 = await site(); const u2 = await pessoa()
    expect((await liberar(pg, u2, s2, 10)).motivo).toBe('sem_vinculo')
    expect((await liberar(pg, randomUUID(), s2, 10)).motivo).toBe('apagamento')
  })

  it('(a) C1-21: vencida sem revogar → liberar encerra a velha (vencida) e cria outra', async () => {
    const { s, u } = await cena()
    const velha = await pg.query(`insert into public.obs_ai_liberacoes (site_id, user_id, expires_at) values ($1, $2, now() - interval '1 day') returning id`, [s, u])
    const oldId = String(velha.rows[0].id)
    const c = await conecta(s, u, oldId, 'claude')
    const r = await liberar(pg, u, s, 30)
    expect(r.motivo).toBeNull(); expect(r.liberacao_id).not.toBe(oldId)
    expect(await lib(oldId)).toMatchObject({ revogada_por: 'vencida' })
    expect((await lib(oldId)).revoked_at).not.toBeNull()
    expect(await con(c.conId)).toMatchObject({ revogada_por: 'vencida' })
    expect((await key(c.keyId)).revoked_at).not.toBeNull()
    expect(await conferencia()).toHaveLength(0)
  })

  it('liberar: teto devolve motivo e não deixa nada pela metade', async () => {
    const s = await site(); const u1 = await pessoa(s), u2 = await pessoa(s), u3 = await pessoa(s)
    expect((await liberar(pg, u1, s, 30)).motivo).toBeNull()
    expect((await liberar(pg, u2, s, 30)).motivo).toBeNull()
    expect((await liberar(pg, u3, s, 30)).motivo).toBe('teto')
    expect((await pg.query(`select count(*)::int as n from public.obs_ai_liberacoes where user_id = $1`, [u3])).rows[0].n).toBe(0)
  })

  it('recusa de liberar não encerra a vencida: teto e banida preservam bloqueios, e liberar depois herda', async () => {
    const s = await site(); const u1 = await pessoa(s), u2 = await pessoa(s), u3 = await pessoa(s)
    const l1 = (await liberar(pg, u1, s, 30)).liberacao_id!
    await cortar(pg, u1, s, 'chatgpt')
    await pg.query(`update public.obs_ai_liberacoes set expires_at = now() - interval '1 hour' where id = $1`, [l1])
    // 3 pessoas forçadas: u2 e u3 ativas + a vencida de u1 (não conta)
    const l2 = (await liberar(pg, u2, s, 30)).liberacao_id!
    await pg.query('begin')
    try {
      await pg.query(`set local session_replication_role = replica`)
      await pg.query(`insert into public.obs_ai_liberacoes (site_id, user_id, expires_at) values ($1, $2, now() + interval '30 days')`, [s, u3])
      await pg.query('commit')
    } catch (e) { await pg.query('rollback'); throw e }
    expect((await liberar(pg, u1, s, 30)).motivo).toBe('teto')
    expect(await lib(l1)).toMatchObject({ revoked_at: null, revogada_por: null, bloqueios: ['chatgpt'] })
    await pg.query(`update public.obs_ai_liberacoes set revoked_at = now(), revogada_por = 'dono' where id = $1`, [l2])
    const ok = await liberar(pg, u1, s, 30)
    expect(ok.motivo).toBeNull()
    expect((await lib(ok.liberacao_id!)).bloqueios).toEqual(['chatgpt'])
    expect(await lib(l1)).toMatchObject({ revogada_por: 'vencida' })
  })

  it('recusa por banida não encerra a vencida', async () => {
    const { s, u } = await cena()
    const l1 = (await liberar(pg, u, s, 30)).liberacao_id!
    await cortar(pg, u, s, 'chatgpt')
    await pg.query(`update public.obs_ai_liberacoes set expires_at = now() - interval '1 hour' where id = $1`, [l1])
    await pg.query(`update auth.users set banned_until = now() + interval '1 day' where id = $1`, [u])
    expect((await liberar(pg, u, s, 30)).motivo).toBe('banida')
    expect(await lib(l1)).toMatchObject({ revoked_at: null, revogada_por: null, bloqueios: ['chatgpt'] })
  })

  it('(b) C1-15: cortar com cliente, bloqueio herdado ao vencer, liberar_cliente, cortar sem cliente, nova começa limpa', async () => {
    const { s, u } = await cena()
    const l1 = (await liberar(pg, u, s, 30)).liberacao_id!
    const chat = await conecta(s, u, l1, 'chatgpt')
    const claude = await conecta(s, u, l1, 'claude')
    const bearer = await chaveBearer(s, u)
    const r = await cortar(pg, u, s, 'chatgpt')
    expect(r.map(x => x.tabela)).toEqual(['obs_ai_liberacoes', 'obs_ai_conexoes'])
    expect(await con(chat.conId)).toMatchObject({ revogada_por: 'dono_cliente' })
    expect((await con(claude.conId)).revoked_at).toBeNull()
    expect((await lib(l1)).bloqueios).toEqual(['chatgpt'])
    expect((await key(chat.keyId)).revoked_at).not.toBeNull()
    expect((await pg.query(`select revoked_at from public.obs_ai_oauth_tokens where id = $1`, [chat.tokenId])).rows[0].revoked_at).not.toBeNull()
    // vence (sem revogar) → liberar herda o bloqueio
    await pg.query(`update public.obs_ai_liberacoes set expires_at = now() - interval '1 hour' where id = $1`, [l1])
    const r2 = await liberar(pg, u, s, 30)
    expect(r2.motivo).toBeNull()
    expect((await lib(r2.liberacao_id!)).bloqueios).toEqual(['chatgpt'])
    // liberar_cliente tira o bloqueio
    const lc = (await pg.query(`select * from public.obs_ai_liberar_cliente($1, $2, 'chatgpt')`, [u, s])).rows[0]
    expect(lc).toMatchObject({ motivo: null, bloqueios: [] })
    expect((await lib(r2.liberacao_id!)).bloqueios).toEqual([])
    // cortar sem cliente
    const l2 = r2.liberacao_id!
    const nova = await conecta(s, u, l2, 'claude')
    const r3 = await cortar(pg, u, s, null)
    expect(r3.map(x => x.tabela)).toEqual(expect.arrayContaining(['obs_ai_liberacoes', 'obs_ai_conexoes', 'pipeline_api_keys']))
    expect(await lib(l2)).toMatchObject({ revogada_por: 'dono' })
    expect(await con(nova.conId)).toMatchObject({ revogada_por: 'dono_pessoa' })
    expect((await key(bearer)).revoked_at).not.toBeNull()
    expect((await key(nova.keyId)).revoked_at).not.toBeNull()
    expect(await conferencia()).toHaveLength(0)
    // nova liberação depois de 'dono' começa sem bloqueio
    await cortar(pg, u, s, null) // sem aberta: não quebra
    const l3 = await liberar(pg, u, s, 30)
    expect(l3.motivo).toBeNull(); expect((await lib(l3.liberacao_id!)).bloqueios).toEqual([])
  })

  it('(f) Phil M4: cortar --cliente com liberação vencida e aberta grava o bloqueio nela; sem aberta = sem_liberacao', async () => {
    const { s, u } = await cena()
    expect(await cortar(pg, u, s, 'claude')).toEqual([{ tabela: null, id: null, motivo: 'sem_liberacao' }])
    expect(await cortar(pg, u, s, null)).toEqual([{ tabela: null, id: null, motivo: 'sem_liberacao' }])
    const v = await pg.query(`insert into public.obs_ai_liberacoes (site_id, user_id, expires_at) values ($1, $2, now() - interval '1 day') returning id`, [s, u])
    const r = await cortar(pg, u, s, 'claude')
    expect(r[0]).toMatchObject({ tabela: 'obs_ai_liberacoes', id: v.rows[0].id, motivo: null })
    expect((await lib(String(v.rows[0].id))).bloqueios).toEqual(['claude'])
  })

  it('(c) C1-14: estender com 3 pessoas forçadas: menos passa, mais devolve teto', async () => {
    const s = await site(); const u1 = await pessoa(s), u2 = await pessoa(s), u3 = await pessoa(s)
    const ids: string[] = []
    await pg.query('begin')
    try {
      await pg.query(`set local session_replication_role = replica`)
      for (const u of [u1, u2, u3]) {
        ids.push(String((await pg.query(`insert into public.obs_ai_liberacoes (site_id, user_id, expires_at) values ($1, $2, now() + interval '30 days') returning id`, [s, u])).rows[0].id))
      }
      await pg.query('commit')
    } catch (e) { await pg.query('rollback'); throw e }
    const menos = (await pg.query(`select * from public.obs_ai_estender_liberacao($1, 10, now())`, [ids[0]])).rows[0]
    expect(menos.motivo).toBeNull()
    const mais = (await pg.query(`select * from public.obs_ai_estender_liberacao($1, 100, now())`, [ids[0]])).rows[0]
    expect(mais.motivo).toBe('teto')
    expect((await pg.query(`select expires_at <= now() + interval '10 days 1 minute' as ok from public.obs_ai_liberacoes where id = $1`, [ids[0]])).rows[0].ok).toBe(true)
    expect((await pg.query(`select * from public.obs_ai_estender_liberacao($1, 0, now())`, [ids[0]])).rows[0].motivo).toBe('dias')
    expect((await pg.query(`select * from public.obs_ai_estender_liberacao($1, 5, now())`, [randomUUID()])).rows[0].motivo).toBe('nao_encontrada')
  })

  it('estender: igualdade exata e propagação à chave; revogada recusa', async () => {
    const { s, u } = await cena()
    const l = (await liberar(pg, u, s, 30)).liberacao_id!
    const c = await conecta(s, u, l, 'claude')
    const r = (await pg.query(`select * from public.obs_ai_estender_liberacao($1, 90, '2026-11-11T12:00:00.123456Z')`, [l])).rows[0]
    expect(r.motivo).toBeNull()
    const ok = (await pg.query(
      `select b.expires_at = '2026-11-11T12:00:00.123456Z'::timestamptz + interval '90 days' as a, k.expires_at = b.expires_at as b
         from public.obs_ai_liberacoes b, public.pipeline_api_keys k where b.id = $1 and k.id = $2`, [l, c.keyId])).rows[0]
    expect(ok).toEqual({ a: true, b: true })
    expect(await conferencia()).toHaveLength(0)
    await cortar(pg, u, s, null)
    expect((await pg.query(`select * from public.obs_ai_estender_liberacao($1, 5, now())`, [l])).rows[0].motivo).toBe('revogada')
  })

  it('(d) revogar_lgpd duas vezes = mesma situação, conexões lgpd', async () => {
    const { s, u } = await cena()
    const l = (await liberar(pg, u, s, 30)).liberacao_id!
    const c = await conecta(s, u, l, 'claude')
    expect((await pg.query(`select public.obs_ai_revogar_lgpd($1) as n`, [u])).rows[0].n).toBe(1)
    const antes = await lib(l)
    expect((await pg.query(`select public.obs_ai_revogar_lgpd($1) as n`, [u])).rows[0].n).toBe(0)
    expect(await lib(l)).toEqual(antes)
    expect(antes.revogada_por).toBe('lgpd')
    expect(await con(c.conId)).toMatchObject({ revogada_por: 'lgpd' })
    expect((await key(c.keyId)).revoked_at).not.toBeNull()
    expect(await conferencia()).toHaveLength(0)
  })

  async function corrida(nome: string, a: (c: Client, u: string, s: string) => Promise<unknown>, b: (c: Client, u: string, s: string) => Promise<unknown>) {
    const [c1, c2] = [await novoCliente(), await novoCliente()]
    for (let i = 0; i < 20; i++) {
      const { s, u } = await cena()
      const l = (await liberar(pg, u, s, 30)).liberacao_id!
      await conecta(s, u, l, 'claude')
      const r = await Promise.allSettled([a(c1, u, s), b(c2, u, s)])
      for (const x of r) {
        if (x.status === 'rejected') expect((x.reason as { code?: string }).code, `${nome} #${i}`).not.toBe('40P01')
        expect(x.status, `${nome} #${i}`).toBe('fulfilled')
      }
      expect(await conferencia(), `${nome} #${i}`).toHaveLength(0)
    }
  }

  it('(e) Promise.all de liberar × cortar da mesma pessoa, 20 vezes: sem 40P01, conferência 0', async () => {
    await corrida('liberar×cortar', (c, u, s) => liberar(c, u, s, 30), (c, u, s) => cortar(c, u, s, null))
  })
  it('(g) Phil I2: revogar_lgpd × liberar, 20 vezes', async () => {
    await corrida('lgpd×liberar', (c, u) => c.query(`select public.obs_ai_revogar_lgpd($1)`, [u]), (c, u, s) => liberar(c, u, s, 30))
  })
  it('(g) Phil I2: revogar_lgpd × cortar, 20 vezes', async () => {
    await corrida('lgpd×cortar', (c, u) => c.query(`select public.obs_ai_revogar_lgpd($1)`, [u]), (c, u, s) => cortar(c, u, s, null))
  })
})
