// @vitest-environment node
/**
 * C1 · F1 · T1: tabelas do login OAuth do conector, `check` de `origin`, RLS e privilégios, contra o banco local.
 * Banco: SÓ o `bythiago_int` (aplicar a MIG antes: `psql ...54422... -v ON_ERROR_STOP=1 -f <MIG>`):
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/c1-esquema.test.ts
 * Função sem EXECUTE nunca é CHAMADA como anon/authenticated (derruba este Postgres): privilégio por `has_*_privilege`.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, insertAuthUser, deleteAuthUser } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TABELAS = [
  'obs_ai_liberacoes', 'obs_ai_conexoes', 'obs_ai_oauth_clientes', 'obs_ai_oauth_pedidos',
  'obs_ai_oauth_tokens', 'obs_ai_rate_ip', 'obs_ai_rate_pessoa',
] as const
const INDICES = [
  'idx_obs_ai_tokens_familia', 'idx_obs_ai_tokens_conexao', 'idx_obs_ai_tokens_expires', 'idx_obs_ai_tokens_client',
  'idx_obs_ai_pedidos_expires', 'idx_obs_ai_clientes_created', 'idx_obs_ai_conexoes_liberacao',
] as const

function lerMig(): string {
  const dir = resolve(__dirname, '../../../../supabase/migrations')
  const f = readdirSync(dir).find(n => n.endsWith('_observatorio_c1_conexoes_oauth.sql'))
  if (!f) throw new Error('MIG observatorio_c1_conexoes_oauth não encontrada')
  return readFileSync(resolve(dir, f), 'utf8')
}

describe.skipIf(skipIfNoLocalDb())('C1 F1 T1: tabelas de liberação, conexão e OAuth (banco local)', () => {
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
      await pg.query(`delete from public.obs_ai_access_log where site_id = any($1::uuid[])`, [sites])
      await pg.query(`delete from public.obs_ai_liberacoes where site_id = any($1::uuid[])`, [sites])
      await pg.query(`delete from public.pipeline_api_keys where id = any($1::uuid[])`, [keys])
      if (sites.length > 0) await apagarSites(pg, 'id = any($1::uuid[])', [sites])
      for (const u of users) await deleteAuthUser(u)
    } finally {
      await pg.end()
    }
  })

  async function pessoa(): Promise<string> {
    const id = await insertAuthUser(`c1-${randomUUID()}@example.test`); users.push(id); return id
  }
  async function site(): Promise<string> { const s = (await seedSite(sb)).siteId; sites.push(s); return s }
  async function chave(siteId: string, userId: string): Promise<string> {
    const r = await pg.query(
      `insert into public.pipeline_api_keys (site_id, name, key_hash, permissions, user_id, expires_at)
       values ($1, 'c1 teste', $2, array['observatorio_leitura']::text[], $3, now() + interval '30 days') returning id`,
      [siteId, randomUUID(), userId])
    const id = String(r.rows[0].id); keys.push(id); return id
  }
  async function liberacao(siteId: string, userId: string): Promise<string> {
    const r = await pg.query(
      `insert into public.obs_ai_liberacoes (site_id, user_id, expires_at) values ($1, $2, now() + interval '30 days') returning id`,
      [siteId, userId])
    return String(r.rows[0].id)
  }
  async function conexao(siteId: string, userId: string, libId: string, cliente = 'claude'): Promise<{ id: string; keyId: string }> {
    const keyId = await chave(siteId, userId)
    const r = await pg.query(
      `insert into public.obs_ai_conexoes (site_id, user_id, liberacao_id, cliente, key_id) values ($1, $2, $3, $4, $5) returning id`,
      [siteId, userId, libId, cliente, keyId])
    return { id: String(r.rows[0].id), keyId }
  }
  async function codigoErro(p: Promise<unknown>): Promise<string | undefined> {
    try { await p } catch (e) { return (e as { code?: string }).code }
    return undefined
  }

  it('(a) as 7 tabelas existem, com RLS ligada', async () => {
    const r = await pg.query(`select relname, relrowsecurity from pg_class where oid = any($1::regclass[]) order by 1`,
      [TABELAS.map(t => 'public.' + t)])
    expect(r.rows.map(x => [x.relname, x.relrowsecurity])).toEqual([...TABELAS].sort().map(t => [t, true]))
  })

  it('(b) cliente fora de claude/chatgpt/gemini = 23514', async () => {
    const s = await site(), u = await pessoa(), l = await liberacao(s, u)
    expect(await codigoErro(conexao(s, u, l, 'outro'))).toBe('23514')
    await expect(conexao(s, u, l, 'gemini')).resolves.toBeTruthy()
  })

  it('(c) duas liberações abertas da mesma (site, pessoa) = 23505; a aberta de conexão por cliente também', async () => {
    const s = await site(), u = await pessoa(), l = await liberacao(s, u)
    expect(await codigoErro(liberacao(s, u))).toBe('23505')
    await conexao(s, u, l, 'claude')
    expect(await codigoErro(conexao(s, u, l, 'claude'))).toBe('23505')
    await expect(conexao(s, u, l, 'chatgpt')).resolves.toBeTruthy()
  })

  it('(d) revoked_at sem revogada_por = 23514, em liberações e em conexões', async () => {
    const s = await site(), u = await pessoa(), l = await liberacao(s, u)
    expect(await codigoErro(pg.query(`update public.obs_ai_liberacoes set revoked_at = now() where id = $1`, [l]))).toBe('23514')
    const c = await conexao(s, u, l)
    expect(await codigoErro(pg.query(`update public.obs_ai_conexoes set revoked_at = now() where id = $1`, [c.id]))).toBe('23514')
    await expect(pg.query(`update public.obs_ai_conexoes set revoked_at = now(), revogada_por = 'dono_cliente' where id = $1`, [c.id])).resolves.toBeTruthy()
    expect(await codigoErro(pg.query(`insert into public.obs_ai_liberacoes (site_id, user_id, expires_at) values ($1, $2, 'infinity')`, [s, await pessoa()]))).toBe('23514')
  })

  it('(e) apagar a chave que tem conexão = 23503 (restrict)', async () => {
    const s = await site(), u = await pessoa(), l = await liberacao(s, u)
    const c = await conexao(s, u, l)
    expect(await codigoErro(pg.query(`delete from public.pipeline_api_keys where id = $1`, [c.keyId]))).toBe('23503')
  })

  it("(f) origin 'oauth' aceito, 'x' recusado", async () => {
    const s = await site()
    const ins = (o: string) => pg.query(
      `insert into public.obs_ai_access_log (site_id, origin, action, included_private, result) values ($1, $2, 'teste', false, 'ok')`, [s, o])
    await expect(ins('oauth')).resolves.toBeTruthy()
    expect(await codigoErro(ins('x'))).toBe('23514')
  })

  it('(g) C1-29 tabelas: anon e authenticated sem privilégio, exceto select de authenticated em liberações e conexões', async () => {
    for (const t of TABELAS) {
      for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const r = await pg.query(`select has_table_privilege('anon', $1, $2) as a, has_table_privilege('authenticated', $1, $2) as u`, ['public.' + t, priv])
        const lê = priv === 'SELECT' && (t === 'obs_ai_liberacoes' || t === 'obs_ai_conexoes')
        expect(r.rows[0].a, `anon ${priv} em ${t}`).toBe(false)
        expect(r.rows[0].u, `authenticated ${priv} em ${t}`).toBe(lê)
      }
    }
    const pol = await pg.query(`select tablename, qual from pg_policies where schemaname = 'public' and tablename = any($1)`, [TABELAS])
    expect(pol.rows.map(r => r.tablename).sort()).toEqual(['obs_ai_conexoes', 'obs_ai_liberacoes'])
    for (const p of pol.rows) expect(String(p.qual)).toMatch(/can_admin_site_users\(site_id\)/)
  })

  it('(h) apagar a pessoa leva liberação, conexão, tokens e balde; a chave fica com user_id nulo', async () => {
    const s = await site(), u = await pessoa(), l = await liberacao(s, u)
    const c = await conexao(s, u, l)
    await pg.query(`insert into public.obs_ai_oauth_tokens (hash, tipo, conexao_id, client_id, familia, expires_at)
      values ($1, 'acesso', $2, 'cli', $3, now() + interval '1 hour')`, [randomUUID(), c.id, randomUUID()])
    await pg.query(`insert into public.obs_ai_rate_pessoa (user_id, bucket, n) values ($1, date_trunc('day', now()), 1)`, [u])
    await pg.query(`delete from auth.users where id = $1`, [u])
    for (const [t, col, v] of [['obs_ai_liberacoes', 'id', l], ['obs_ai_conexoes', 'id', c.id], ['obs_ai_oauth_tokens', 'conexao_id', c.id], ['obs_ai_rate_pessoa', 'user_id', u]]) {
      const r = await pg.query(`select count(*)::int as n from public.${t} where ${col} = $1`, [v])
      expect(r.rows[0].n, t).toBe(0)
    }
    const k = await pg.query(`select user_id from public.pipeline_api_keys where id = $1`, [c.keyId])
    expect(k.rows).toHaveLength(1)
    expect(k.rows[0].user_id).toBeNull()
  })

  it('(i) os 7 índices existem', async () => {
    const r = await pg.query(`select indexname from pg_indexes where schemaname = 'public' and indexname = any($1) order by 1`, [INDICES])
    expect(r.rows.map(x => x.indexname)).toEqual([...INDICES].sort())
  })

  it('(j) Phil I3: check de origin com nome estranho; reexecutar o bloco da seção 1 deixa exatamente 1', async () => {
    const mig = lerMig()
    const m = /-- >>> origin\n([\s\S]*?)-- <<< origin/.exec(mig)
    expect(m, 'marcadores >>> origin / <<< origin na MIG').not.toBeNull()
    const bloco = m![1]
    const conta = async () => Number((await pg.query(`select count(*)::int as n from pg_constraint
      where conrelid = 'public.obs_ai_access_log'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%origin%'`)).rows[0].n)
    await pg.query('begin')
    try {
      await pg.query(`alter table public.obs_ai_access_log add constraint "nome_estranho_xyz" check (origin in ('botao','mcp','oauth','extra'))`)
      expect(await conta()).toBe(2)
      await pg.query(bloco)
      expect(await conta()).toBe(1)
      const c = await pg.query(`select conname from pg_constraint where conrelid = 'public.obs_ai_access_log'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%origin%'`)
      expect(c.rows[0].conname).toBe('obs_ai_access_log_origin_check')
    } finally {
      await pg.query('rollback')
    }
  })

  it('(k) Phil N4: FK de tokens.client_id para clientes (registro, ação)', async () => {
    const r = await pg.query(`select conname, confdeltype from pg_constraint
      where conrelid = 'public.obs_ai_oauth_tokens'::regclass and contype = 'f' and confrelid = 'public.obs_ai_oauth_clientes'::regclass`)
    console.log('C1-T1 (k): FKs tokens.client_id -> clientes:', JSON.stringify(r.rows))
    expect(r.rows.length).toBeLessThanOrEqual(1)
  })
})
