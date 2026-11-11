// @vitest-environment node
/**
 * C1 · F1 · T3: propagação de revogação (4.7), resolvedor único de token e consulta de conferência, contra o banco local.
 * Banco: SÓ o `bythiago_int` (aplicar a MIG antes: `psql ...54422... -v ON_ERROR_STOP=1 -f <MIG>`):
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/c1-fonte-unica.test.ts
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

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
// o MESMO texto que o runbook cita (a consulta devolve zero linhas em banco são)
const CONSULTA = readFileSync(resolve(__dirname, '../../../../docs/ops/observatorio-c1-consulta-4-7.sql'), 'utf8')
const FUNCOES = [
  'obs_ai_tg_liberacao_propaga()', 'obs_ai_tg_conexao_propaga()',
  'obs_ai_resolver_token(text, text, timestamptz)',
] as const

interface Cena { siteId: string; userId: string; libId: string; conId: string; keyId: string; acesso: string; renov: string; hAcesso: string; hRenov: string }

describe.skipIf(skipIfNoLocalDb())('C1 F1 T3: fonte única do pode-ler (banco local)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  const users: string[] = []
  const keys: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
  })
  afterAll(async () => {
    try {
      await pg.query(`delete from public.obs_ai_liberacoes where site_id = any($1::uuid[])`, [sites])
      await pg.query(`delete from public.pipeline_api_keys where id = any($1::uuid[])`, [keys])
      await pg.query(`delete from public.site_memberships where site_id = any($1::uuid[])`, [sites])
      await pg.query(`delete from public.audit_log where site_id = any($1::uuid[])`, [sites])
      if (sites.length > 0) await apagarSites(pg, 'id = any($1::uuid[])', [sites])
      for (const u of users) await deleteAuthUser(u)
    } finally {
      await pg.end()
    }
  })

  /** Liberação + chave de conexão (campos de PL1) + conexão + um token de acesso e um de renovação. 1 site e 1 pessoa por cena. */
  async function cena(): Promise<Cena> {
    const siteId = (await seedSite(sb)).siteId; sites.push(siteId)
    const userId = await insertAuthUser(`c1t3-${randomUUID()}@example.test`); users.push(userId)
    const lib = await pg.query(
      `insert into public.obs_ai_liberacoes (site_id, user_id, expires_at) values ($1, $2, now() + interval '30 days') returning id`,
      [siteId, userId])
    const libId = String(lib.rows[0].id)
    const k = await pg.query(
      `insert into public.pipeline_api_keys (site_id, name, key_hash, permissions, user_id, expires_at, created_by)
       values ($1, 'observatorio-oauth-claude-' || $2::text, $3, array['observatorio_leitura']::text[], $4,
               (select expires_at from public.obs_ai_liberacoes where id = $5), null) returning id`,
      [siteId, randomUUID().slice(0, 8), randomUUID(), userId, libId])
    const keyId = String(k.rows[0].id); keys.push(keyId)
    const c = await pg.query(
      `insert into public.obs_ai_conexoes (site_id, user_id, liberacao_id, cliente, key_id) values ($1, $2, $3, 'claude', $4) returning id`,
      [siteId, userId, libId, keyId])
    const conId = String(c.rows[0].id)
    const hAcesso = randomUUID(), hRenov = randomUUID(), familia = randomUUID()
    const t1 = await pg.query(
      `insert into public.obs_ai_oauth_tokens (hash, tipo, conexao_id, client_id, familia, expires_at)
       values ($1, 'acesso', $2, 'cid', $3, now() + interval '1 hour') returning id`, [hAcesso, conId, familia])
    const t2 = await pg.query(
      `insert into public.obs_ai_oauth_tokens (hash, tipo, conexao_id, client_id, familia, expires_at)
       values ($1, 'renovacao', $2, 'cid', $3, now() + interval '20 days') returning id`, [hRenov, conId, familia])
    return { siteId, userId, libId, conId, keyId, acesso: String(t1.rows[0].id), renov: String(t2.rows[0].id), hAcesso, hRenov }
  }
  const resolver = async (h: string, tipo: string, agora: Date | string = new Date()) =>
    (await pg.query(`select * from public.obs_ai_resolver_token($1, $2, $3)`, [h, tipo, agora])).rows
  /** a consulta é global; o teste só olha as conexões que criou (outra suíte pode deixar sujeira) */
  const conferencia = async (c: Cena) =>
    (await pg.query(CONSULTA)).rows.filter(r => r.id === c.conId)
  const linha = async (tabela: string, id: string) =>
    (await pg.query(`select * from public.${tabela} where id = $1`, [id])).rows[0]

  it('(0) as 3 funções são só do service_role', async () => {
    for (const f of FUNCOES) {
      const r = await pg.query(
        `select has_function_privilege('anon', 'public.${f}', 'execute') as a,
                has_function_privilege('authenticated', 'public.${f}', 'execute') as u,
                has_function_privilege('service_role', 'public.${f}', 'execute') as s`)
      expect(r.rows[0], f).toEqual({ a: false, u: false, s: true })
    }
  })

  it('(1) estado são: resolve os dois tokens e a conferência é 0', async () => {
    const c = await cena()
    const r = await resolver(c.hAcesso, 'acesso')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ token_id: c.acesso, conexao_id: c.conId, key_id: c.keyId, user_id: c.userId, site_id: c.siteId, cliente: 'claude', client_id: 'cid', used_at: null })
    expect(r[0].familia).toBeTruthy()
    expect(r[0].liberacao_expira).toBeInstanceOf(Date)
    expect(await resolver(c.hRenov, 'renovacao')).toHaveLength(1)
    expect(await resolver(c.hRenov, 'acesso')).toHaveLength(0)  // tipo errado
    expect(await conferencia(c)).toHaveLength(0)
  })

  it('(2) ignora used_at: quem consome decide', async () => {
    const c = await cena()
    await pg.query(`update public.obs_ai_oauth_tokens set used_at = now() where id = $1`, [c.renov])
    const r = await resolver(c.hRenov, 'renovacao')
    expect(r).toHaveLength(1)
    expect(r[0].used_at).toBeInstanceOf(Date)
  })

  it('(3) revogar SÓ a liberação (dono): conexão, chave e tokens seguem; resolvedor 0; conferência 0', async () => {
    const c = await cena()
    await pg.query(`update public.obs_ai_liberacoes set revoked_at = now(), revogada_por = 'dono' where id = $1`, [c.libId])
    const con = await linha('obs_ai_conexoes', c.conId)
    expect(con.revoked_at).not.toBeNull(); expect(con.revogada_por).toBe('dono_pessoa')
    expect((await linha('pipeline_api_keys', c.keyId)).revoked_at).not.toBeNull()
    expect((await linha('obs_ai_oauth_tokens', c.acesso)).revoked_at).not.toBeNull()
    expect((await linha('obs_ai_oauth_tokens', c.renov)).revoked_at).not.toBeNull()
    expect(await resolver(c.hAcesso, 'acesso')).toHaveLength(0)
    expect(await resolver(c.hRenov, 'renovacao')).toHaveLength(0)
    expect(await conferencia(c)).toHaveLength(0)
  })

  it('(3b) mapa lgpd→lgpd e vencida→vencida', async () => {
    for (const [lib, esperado] of [['lgpd', 'lgpd'], ['vencida', 'vencida']] as const) {
      const c = await cena()
      await pg.query(`update public.obs_ai_liberacoes set revoked_at = now(), revogada_por = $2 where id = $1`, [c.libId, lib])
      expect((await linha('obs_ai_conexoes', c.conId)).revogada_por).toBe(esperado)
      expect(await conferencia(c)).toHaveLength(0)
    }
  })

  it('(4) revogar SÓ a conexão (dono_cliente): chave e tokens abertos caem; liberação segue aberta', async () => {
    const c = await cena()
    await pg.query(`update public.obs_ai_conexoes set revoked_at = now(), revogada_por = 'dono_cliente' where id = $1`, [c.conId])
    expect((await linha('pipeline_api_keys', c.keyId)).revoked_at).not.toBeNull()
    expect((await linha('obs_ai_oauth_tokens', c.acesso)).revoked_at).not.toBeNull()
    expect((await linha('obs_ai_oauth_tokens', c.renov)).revoked_at).not.toBeNull()
    expect((await linha('obs_ai_liberacoes', c.libId)).revoked_at).toBeNull()
    expect(await resolver(c.hAcesso, 'acesso')).toHaveLength(0)
    expect(await conferencia(c)).toHaveLength(0)
  })

  it('(5) revogar SÓ a linha da chave por UPDATE direto: resolvedor 0 (defesa em profundidade); a conferência ACUSA', async () => {
    const c = await cena()
    await pg.query(`update public.pipeline_api_keys set revoked_at = now() where id = $1`, [c.keyId])
    expect(await resolver(c.hAcesso, 'acesso')).toHaveLength(0)
    expect((await linha('obs_ai_conexoes', c.conId)).revoked_at).toBeNull()  // chave não propaga para cima
    expect((await conferencia(c)).length).toBeGreaterThanOrEqual(1)
  })

  it('(6) estender e encurtar a liberação: pipeline_api_keys.expires_at igual; conferência 0', async () => {
    const c = await cena()
    await pg.query(`update public.obs_ai_liberacoes set expires_at = now() + interval '90 days' where id = $1`, [c.libId])
    let eq = await pg.query(
      `select k.expires_at = b.expires_at as igual from public.pipeline_api_keys k, public.obs_ai_liberacoes b where k.id = $1 and b.id = $2`, [c.keyId, c.libId])
    expect(eq.rows[0].igual).toBe(true)
    expect(await conferencia(c)).toHaveLength(0)
    await pg.query(`update public.obs_ai_liberacoes set expires_at = now() + interval '10 days' where id = $1`, [c.libId])
    eq = await pg.query(
      `select k.expires_at = b.expires_at as igual from public.pipeline_api_keys k, public.obs_ai_liberacoes b where k.id = $1 and b.id = $2`, [c.keyId, c.libId])
    expect(eq.rows[0].igual).toBe(true)
    expect((await resolver(c.hAcesso, 'acesso'))[0].liberacao_expira.getTime())
      .toBeLessThan(Date.now() + 11 * 86_400_000)
    expect(await conferencia(c)).toHaveLength(0)
  })

  it('(7) a conferência acusa UPDATE direto de k.expires_at', async () => {
    const c = await cena()
    await pg.query(`update public.pipeline_api_keys set expires_at = expires_at + interval '1 day' where id = $1`, [c.keyId])
    expect((await conferencia(c)).length).toBeGreaterThanOrEqual(1)
  })

  it('(8) a conferência acusa chave revogada com conexão aberta e token aberto sob conexão cortada', async () => {
    const c = await cena()
    await pg.query(`update public.pipeline_api_keys set revoked_at = now() where id = $1`, [c.keyId])
    expect((await conferencia(c)).length).toBeGreaterThanOrEqual(1)
    const d = await cena()
    await pg.query(`alter table public.obs_ai_conexoes disable trigger obs_ai_conexao_propaga`)
    try {
      await pg.query(`update public.obs_ai_conexoes set revoked_at = now(), revogada_por = 'dono_cliente' where id = $1`, [d.conId])
    } finally {
      await pg.query(`alter table public.obs_ai_conexoes enable trigger obs_ai_conexao_propaga`)
    }
    expect((await conferencia(d)).length).toBeGreaterThanOrEqual(1)
  })

  it('(9) C1-11e: conexão cortada + reabrir a liberação NÃO reabre nada; datas originais intactas; conferência 0', async () => {
    const c = await cena()
    await pg.query(`update public.obs_ai_conexoes set revoked_at = now() - interval '1 hour', revogada_por = 'dono_cliente' where id = $1`, [c.conId])
    const antes = {
      con: await linha('obs_ai_conexoes', c.conId), key: await linha('pipeline_api_keys', c.keyId),
      t1: await linha('obs_ai_oauth_tokens', c.acesso), t2: await linha('obs_ai_oauth_tokens', c.renov),
    }
    await pg.query(`update public.obs_ai_liberacoes set revoked_at = now(), revogada_por = 'dono' where id = $1`, [c.libId])
    await pg.query(`update public.obs_ai_liberacoes set revoked_at = null, revogada_por = null where id = $1`, [c.libId])
    const depois = {
      con: await linha('obs_ai_conexoes', c.conId), key: await linha('pipeline_api_keys', c.keyId),
      t1: await linha('obs_ai_oauth_tokens', c.acesso), t2: await linha('obs_ai_oauth_tokens', c.renov),
    }
    expect(depois.con.revogada_por).toBe('dono_cliente')           // cortar a liberação depois não reescreve a conexão
    expect(depois.con.revoked_at).toEqual(antes.con.revoked_at)
    expect(depois.key.revoked_at).toEqual(antes.key.revoked_at)
    expect(depois.t1.revoked_at).toEqual(antes.t1.revoked_at)
    expect(depois.t2.revoked_at).toEqual(antes.t2.revoked_at)
    expect(await resolver(c.hAcesso, 'acesso')).toHaveLength(0)
    expect(await conferencia(c)).toHaveLength(0)
  })

  it('(10) Foco 2: p_agora = token.expires_at → 0 linhas; um instante antes → 1', async () => {
    const c = await cena()
    // exato no banco (o Date do JS perde microssegundos): p_agora vem da própria coluna
    const q = (agora: string) => pg.query(
      `select count(*)::int as n from public.obs_ai_oauth_tokens t, lateral public.obs_ai_resolver_token(t.hash, t.tipo, ${agora}) r where t.id = $1`, [c.acesso])
    expect((await q('t.expires_at')).rows[0].n).toBe(0)
    expect((await q(`t.expires_at - interval '1 microsecond'`)).rows[0].n).toBe(1)
  })

  it('(11) validade da liberação e da chave também vale: p_agora depois de liberacao_expira → 0', async () => {
    const c = await cena()
    // renovação vence em 20 d, liberação em 30 d: estica a renovação além da liberação; p_agora vem da coluna (exato, sem Date do JS)
    await pg.query(`update public.obs_ai_oauth_tokens set expires_at = now() + interval '40 days' where id = $1`, [c.renov])
    const q = (agora: string) => pg.query(
      `select count(*)::int as n from public.obs_ai_oauth_tokens t, public.obs_ai_liberacoes b,
         lateral public.obs_ai_resolver_token(t.hash, t.tipo, ${agora}) r where t.id = $1 and b.id = $2`, [c.renov, c.libId])
    expect((await q('b.expires_at')).rows[0].n).toBe(0)
    expect((await q(`b.expires_at - interval '1 microsecond'`)).rows[0].n).toBe(1)
  })

  it('(12) token revogado sozinho não resolve', async () => {
    const c = await cena()
    await pg.query(`update public.obs_ai_oauth_tokens set revoked_at = now() where id = $1`, [c.acesso])
    expect(await resolver(c.hAcesso, 'acesso')).toHaveLength(0)
    expect(await resolver(c.hRenov, 'renovacao')).toHaveLength(1)
  })
})
