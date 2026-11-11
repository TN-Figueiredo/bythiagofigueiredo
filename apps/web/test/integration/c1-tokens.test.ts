// @vitest-environment node
/**
 * C1 · F1 · T6: troca de código, giro de refresh, revogação pelo cliente e poda de clientes, contra o banco local.
 * Banco: SÓ o `bythiago_int` (aplicar a MIG antes: `psql ...54422... -v ON_ERROR_STOP=1 -f <MIG>`):
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/c1-tokens.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, insertAuthUser, deleteAuthUser } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 180_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const CONSULTA = readFileSync(resolve(__dirname, '../../../../docs/ops/observatorio-c1-consulta-4-7.sql'), 'utf8')
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback'
const VERIFIER = 'A'.repeat(43)

type Troca = { motivo: string | null; acesso_expira: Date | null; refresh_expira: Date | null }
type Cena = { s: string; u: string; cid: string; lib: string; codigo: string }

describe.skipIf(skipIfNoLocalDb())('C1 F1 T6: código, refresh, revogação e poda (banco local)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const extras: Client[] = []
  const sites: string[] = []
  const users: string[] = []
  const clientes: string[] = []
  const hex = () => randomBytes(16).toString('hex')

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
  })
  afterAll(async () => {
    try {
      for (const c of extras) await c.end().catch(() => undefined)
      await pg.query(`delete from public.obs_ai_liberacoes where site_id = any($1::uuid[])`, [sites])
      await pg.query(`delete from public.pipeline_api_keys where site_id = any($1::uuid[])`, [sites])
      await pg.query(`delete from public.site_memberships where site_id = any($1::uuid[])`, [sites])
      await pg.query(`delete from public.audit_log where site_id = any($1::uuid[])`, [sites])
      await pg.query(`delete from public.obs_ai_oauth_clientes where client_id = any($1::text[])`, [clientes])
      if (sites.length > 0) await apagarSites(pg, 'id = any($1::uuid[])', [sites])
      for (const u of users) await deleteAuthUser(u)
    } finally {
      await pg.end()
    }
  })

  const novoCliente = async () => { const c = new Client({ connectionString: PG_URL }); await c.connect(); extras.push(c); return c }
  const fechar = async (c: Client) => { await c.end().catch(() => undefined); extras.splice(extras.indexOf(c), 1) }
  const site = async () => { const s = (await seedSite(sb)).siteId; sites.push(s); return s }
  const pessoa = async (s?: string) => {
    const u = await insertAuthUser(`c1t6-${randomUUID()}@example.test`); users.push(u)
    if (s) await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [s, u])
    return u
  }
  const cadastro = async (cliente = 'claude') => {
    const id = `c1t6-${randomUUID()}`; clientes.push(id)
    await pg.query(`insert into public.obs_ai_oauth_clientes (client_id, redirect_uris, cliente) values ($1, array[$2]::text[], $3)`, [id, REDIRECT, cliente])
    return id
  }
  // cena completa: pessoa liberada, cliente, pedido aprovado => um código vivo (10 min a partir de now())
  const cena = async (dias = 30): Promise<Cena> => {
    const s = await site(); const u = await pessoa(s); const cid = await cadastro()
    const lib = String((await pg.query(`select * from public.obs_ai_liberar($1, $2, $3, now())`, [u, s, dias])).rows[0].liberacao_id)
    const ph = hex()
    await pg.query(
      `insert into public.obs_ai_oauth_pedidos (hash, client_id, redirect_uri, code_challenge, state, scope, resource, site_id, expires_at)
       values ($1, $2, $3, $4, 'st-1', 'observatorio:read', 'https://bythiagofigueiredo.com/api/mcp', $5, now() + interval '10 minutes')`,
      [ph, cid, REDIRECT, VERIFIER, s])
    const codigo = hex()
    const r = (await pg.query(`select * from public.obs_ai_aprovar_conexao($1, $2, $3, $4, now())`, [ph, u, s, codigo])).rows[0]
    expect(r.motivo).toBeNull()
    return { s, u, cid, lib, codigo }
  }
  const trocar = async (c: Client, k: Cena, o: { client?: string; redirect?: string; verifier?: string; agora?: string; acesso?: string; refresh?: string } = {}) =>
    (await c.query(`select * from public.obs_ai_trocar_codigo($1, $2, $3, $4, $5, $6, ${o.agora ?? 'now()'})`,
      [k.codigo, o.client ?? k.cid, o.redirect ?? REDIRECT, o.verifier ?? VERIFIER, o.acesso ?? hex(), o.refresh ?? hex()])).rows[0] as Troca
  const girar = async (c: Client, hash: string, client: string, agora = 'now()', novoA = hex(), novoR = hex()) =>
    (await c.query(`select * from public.obs_ai_girar_refresh($1, $2, $3, $4, ${agora})`, [hash, client, novoA, novoR])).rows[0] as Troca
  // troca válida e devolve os hashes
  const emitir = async (k: Cena) => {
    const acesso = hex(); const refresh = hex()
    const r = await trocar(pg, k, { acesso, refresh })
    expect(r.motivo).toBeNull()
    return { acesso, refresh }
  }
  const tok = async (hash: string) => (await pg.query(`select * from public.obs_ai_oauth_tokens where hash = $1`, [hash])).rows[0]
  const familia = async (u: string, c: Client = pg) =>
    (await c.query(`select t.* from public.obs_ai_oauth_tokens t join public.obs_ai_conexoes x on x.id = t.conexao_id where x.user_id = $1 order by t.created_at, t.tipo`, [u])).rows
  const vivos = async (u: string, c: Client = pg) => (await familia(u, c)).filter(t => t.revoked_at === null && t.tipo !== 'codigo')
  const conferencia = async () => {
    const meus = new Set((await pg.query(`select id from public.obs_ai_conexoes where site_id = any($1::uuid[])`, [sites])).rows.map(r => String(r.id)))
    return (await pg.query(CONSULTA)).rows.filter(r => meus.has(String(r.id))).map(r => String(r.id))
  }
  // Falha de infraestrutura SEM DDL (outros arquivos de teste correm em paralelo na mesma tabela): hash de refresh repetido = unique_violation no insert do par

  it('(a) C1-9: Promise.all de 2 trocas = uma emite; o par perdedor revoga os tokens emitidos, lido por outra conexão', async () => {
    const k = await cena()
    const c1 = await novoCliente(); const c2 = await novoCliente(); const c3 = await novoCliente()
    const r = await Promise.all([trocar(c1, k), trocar(c2, k)])
    await fechar(c1); await fechar(c2)
    expect(r.filter(x => x.motivo === null)).toHaveLength(1)
    expect(r.filter(x => x.motivo === 'invalid_grant')).toHaveLength(1)
    const fam = await familia(k.u, c3); await fechar(c3)
    expect(fam.filter(t => t.tipo !== 'codigo')).toHaveLength(2)
    expect(fam.every(t => t.revoked_at !== null)).toBe(true)
    expect(await conferencia()).toHaveLength(0)
  })

  it('(a) C1-9: emite com validade certa; código com 10 min + 1 s = invalid_grant; verifier/client/redirect errados deixam o código usável', async () => {
    const k = await cena()
    const agora = (await pg.query(`select now() as t`)).rows[0].t as Date
    expect((await trocar(pg, k, { agora: `now() + interval '10 minutes 1 second'` })).motivo).toBe('invalid_grant')
    expect((await trocar(pg, k, { verifier: 'B'.repeat(43) })).motivo).toBe('invalid_grant')
    expect((await trocar(pg, k, { client: 'outro' })).motivo).toBe('invalid_grant')
    expect((await trocar(pg, k, { redirect: 'https://claude.com/api/mcp/auth_callback' })).motivo).toBe('invalid_grant')
    const cod = await tok(k.codigo)
    expect(cod.used_at).toBeNull(); expect(cod.revoked_at).toBeNull()
    expect(await familia(k.u)).toHaveLength(1)
    const r = await trocar(pg, k)
    expect(r.motivo).toBeNull()
    expect(Math.abs(new Date(r.acesso_expira!).getTime() - (agora.getTime() + 3600_000))).toBeLessThan(5000)
    expect(Math.abs(new Date(r.refresh_expira!).getTime() - (agora.getTime() + 30 * 86400_000))).toBeLessThan(5000)
    expect((await tok(k.codigo)).used_at).not.toBeNull()
    // 2º uso: invalid_grant e a família sai
    expect((await trocar(pg, k)).motivo).toBe('invalid_grant')
    expect(await vivos(k.u)).toHaveLength(0)
  })

  it('(a) C1-9: liberação revogada = invalid_grant; pessoa banida = invalid_grant', async () => {
    const k = await cena()
    await pg.query(`select * from public.obs_ai_cortar($1, $2, null, now())`, [k.u, k.s])
    expect((await trocar(pg, k)).motivo).toBe('invalid_grant')
    const k2 = await cena()
    await pg.query(`update auth.users set banned_until = now() + interval '1 day' where id = $1`, [k2.u])
    expect((await trocar(pg, k2)).motivo).toBe('invalid_grant')
    expect((await tok(k2.codigo)).used_at).toBeNull()
  })

  it('(a) C1-9: falha forçada no insert do par = código não consumido; refaz depois', async () => {
    const k = await cena()
    await expect(trocar(pg, k, { refresh: k.codigo })).rejects.toThrow(/obs_ai_oauth_tokens_hash_unico/)
    expect((await tok(k.codigo)).used_at).toBeNull()
    expect(await familia(k.u)).toHaveLength(1)
    expect((await trocar(pg, k)).motivo).toBeNull()
  })

  it('(b) C1-10: gira; o par novo é da mesma família; refresh perto do fim da liberação vence junto', async () => {
    const k = await cena(); const p = await emitir(k)
    const antes = await tok(p.refresh)
    const n = await girar(pg, p.refresh, k.cid)
    expect(n.motivo).toBeNull()
    const fam = await familia(k.u)
    expect(new Set(fam.map(t => String(t.familia))).size).toBe(1)
    expect((await tok(p.refresh)).used_at).not.toBeNull()
    expect(await vivos(k.u)).toHaveLength(4) // acesso e refresh antigos (o refresh usado segue na tabela) + par novo
    expect(antes.tipo).toBe('renovacao')
    // liberação de 1 dia: o refresh novo não passa do fim dela
    const k2 = await cena(1); const p2 = await emitir(k2)
    const lib = (await pg.query(`select expires_at from public.obs_ai_liberacoes where id = $1`, [k2.lib])).rows[0].expires_at as Date
    const n2 = await girar(pg, p2.refresh, k2.cid)
    expect(n2.motivo).toBeNull()
    expect(new Date(n2.refresh_expira!).getTime()).toBe(lib.getTime())
    expect((await tok(p2.refresh)).expires_at.getTime()).toBe(lib.getTime())
  })

  it('(b) C1-10: Promise.all de 2 giros = um passa, a família segue viva', async () => {
    const k = await cena(); const p = await emitir(k)
    const c1 = await novoCliente(); const c2 = await novoCliente(); const c3 = await novoCliente()
    const r = await Promise.all([girar(c1, p.refresh, k.cid), girar(c2, p.refresh, k.cid)])
    await fechar(c1); await fechar(c2)
    expect(r.filter(x => x.motivo === null)).toHaveLength(1)
    expect(r.filter(x => x.motivo === 'reuso_carencia')).toHaveLength(1)
    const v = await vivos(k.u, c3); await fechar(c3)
    expect(v.filter(t => t.tipo === 'renovacao' && t.used_at === null)).toHaveLength(1)
    expect(v).toHaveLength(4)
  })

  it('(b) C1-10: reuso em used_at + 31 s revoga a família (lida por outra conexão); em +5 s é carência', async () => {
    const k = await cena(); const p = await emitir(k)
    expect((await girar(pg, p.refresh, k.cid)).motivo).toBeNull()
    const usado = (await tok(p.refresh)).used_at as Date
    expect(usado).not.toBeNull()
    const em = (s: number) => `(select used_at + interval '${s} seconds' from public.obs_ai_oauth_tokens where hash = '${p.refresh}')`
    expect((await girar(pg, p.refresh, k.cid, em(5))).motivo).toBe('reuso_carencia')
    expect((await vivos(k.u)).length).toBeGreaterThan(0)
    expect((await girar(pg, p.refresh, k.cid, em(30))).motivo).toBe('reuso_carencia')
    const c2 = await novoCliente()
    expect((await girar(pg, p.refresh, k.cid, em(31))).motivo).toBe('reuso_familia')
    expect(await vivos(k.u, c2)).toHaveLength(0); await fechar(c2)
    expect((await girar(pg, p.refresh, k.cid)).motivo).toBe('invalid_grant')
    expect(await conferencia()).toHaveLength(0)
  })

  it('(b) C1-10: falha forçada no insert = refresh segue válido; banida, apagamento e liberação vencida = invalid_grant', async () => {
    const k = await cena(); const p = await emitir(k)
    await expect(girar(pg, p.refresh, k.cid, 'now()', hex(), p.refresh)).rejects.toThrow(/obs_ai_oauth_tokens_hash_unico/)
    expect(await vivos(k.u)).toHaveLength(2)
    expect((await tok(p.refresh)).used_at).toBeNull()
    expect((await girar(pg, p.refresh, k.cid)).motivo).toBeNull()

    const b = await cena(); const pb = await emitir(b)
    await pg.query(`update auth.users set banned_until = now() + interval '1 day' where id = $1`, [b.u])
    expect((await girar(pg, pb.refresh, b.cid)).motivo).toBe('invalid_grant')
    expect((await tok(pb.refresh)).used_at).toBeNull()

    const a = await cena(); const pa = await emitir(a)
    await pg.query(`insert into public.lgpd_requests (user_id, type, status, phase_1_completed_at) values ($1, 'account_deletion', 'processing', now())`, [a.u])
    try {
      expect((await girar(pg, pa.refresh, a.cid)).motivo).toBe('invalid_grant')
    } finally { await pg.query(`delete from public.lgpd_requests where user_id = $1`, [a.u]) }

    const v = await cena(1); const pv = await emitir(v)
    expect((await girar(pg, pv.refresh, v.cid, `now() + interval '2 days'`)).motivo).toBe('invalid_grant')
    const m = await cena(); const pm = await emitir(m)
    await pg.query(`select * from public.obs_ai_cortar($1, $2, null, now())`, [m.u, m.s])
    expect((await girar(pg, pm.refresh, m.cid)).motivo).toBe('invalid_grant')
  })

  it('(c) Yannis M1/M2: girar com client_id diferente não consome nem revoga; código usado + verifier errado não revoga', async () => {
    const k = await cena(); const p = await emitir(k)
    expect((await girar(pg, p.refresh, 'outro-client')).motivo).toBe('invalid_grant')
    const t = await tok(p.refresh)
    expect(t.used_at).toBeNull(); expect(t.revoked_at).toBeNull()
    expect(await vivos(k.u)).toHaveLength(2)
    expect((await girar(pg, p.refresh, k.cid)).motivo).toBeNull()
    // código já usado, verifier errado: invalid_grant e nada é revogado
    const k2 = await cena(); await emitir(k2)
    expect((await trocar(pg, k2, { verifier: 'B'.repeat(43) })).motivo).toBe('invalid_grant')
    expect((await trocar(pg, k2, { client: 'outro' })).motivo).toBe('invalid_grant')
    expect(await vivos(k2.u)).toHaveLength(2)
  })

  it('(f) revogar_token: acesso ou refresh mata a família aberta; não toca na conexão; hash desconhecido não faz nada', async () => {
    const k = await cena(); const p = await emitir(k)
    await pg.query(`select public.obs_ai_revogar_token($1, now())`, [hex()])
    expect(await vivos(k.u)).toHaveLength(2)
    await pg.query(`select public.obs_ai_revogar_token($1, now())`, [p.refresh])
    expect(await vivos(k.u)).toHaveLength(0)
    expect((await pg.query(`select revoked_at from public.obs_ai_conexoes where user_id = $1`, [k.u])).rows[0].revoked_at).toBeNull()
    expect((await girar(pg, p.refresh, k.cid)).motivo).toBe('invalid_grant')
    const k2 = await cena(); const p2 = await emitir(k2)
    await pg.query(`select public.obs_ai_revogar_token($1, now())`, [p2.acesso])
    expect(await vivos(k2.u)).toHaveLength(0)
    expect(await conferencia()).toHaveLength(0)
  })

  it('(d) Phil I5/N4: poda de clientes, as duas cláusulas', async () => {
    const mk = async (aprovadoDias: number | null, criadoDias: number) => {
      const id = `c1t6-${randomUUID()}`; clientes.push(id)
      await pg.query(
        `insert into public.obs_ai_oauth_clientes (client_id, redirect_uris, cliente, created_at, aprovado_em)
         values ($1, array[$2]::text[], 'claude', now() - make_interval(days => $3), case when $4::int is null then null else now() - make_interval(days => $4::int) end)`,
        [id, REDIRECT, criadoDias, aprovadoDias])
      return id
    }
    const existe = async (id: string) => (await pg.query(`select 1 from public.obs_ai_oauth_clientes where client_id = $1`, [id])).rowCount === 1
    const token = (id: string, conexao: string, expiraDias: number) =>
      pg.query(`insert into public.obs_ai_oauth_tokens (hash, tipo, conexao_id, client_id, familia, expires_at)
                values ($1, 'renovacao', $2, $3, gen_random_uuid(), now() - make_interval(days => $4))`, [hex(), conexao, id, expiraDias])
    const k = await cena()
    const conexao = String((await pg.query(`select id from public.obs_ai_conexoes where user_id = $1`, [k.u])).rows[0].id)
    const velho = await mk(null, 8); const novo = await mk(null, 6)
    const comToken = await mk(null, 8); await token(comToken, conexao, 0)
    const morta = await cena()
    const conexaoMorta = String((await pg.query(`select id from public.obs_ai_conexoes where user_id = $1`, [morta.u])).rows[0].id)
    const apvVencido = await mk(60, 60); await token(apvVencido, conexaoMorta, 31)
    const apvRecente = await mk(60, 60); await token(apvRecente, conexaoMorta, 29)
    await pg.query(`select * from public.obs_ai_cortar($1, $2, null, now())`, [morta.u, morta.s])
    const apvSemToken31 = await mk(31, 40)
    const apvSemToken29 = await mk(29, 40)
    // conexão aberta com token do cliente: não sai mesmo com o último expires_at velho
    const apvComConexao = await mk(60, 60); await token(apvComConexao, conexao, 40)
    const n = (await pg.query(`select public.obs_ai_podar_clientes(now(), 1000) as n`)).rows[0].n as number
    expect(n).toBeGreaterThanOrEqual(3)
    expect(await existe(velho)).toBe(false)
    expect(await existe(novo)).toBe(true)
    expect(await existe(comToken)).toBe(true)
    expect(await existe(apvVencido)).toBe(false) // conexão do token encerrada
    expect(await existe(apvRecente)).toBe(true)
    expect(await existe(apvSemToken31)).toBe(false)
    expect(await existe(apvSemToken29)).toBe(true)
    expect(await existe(apvComConexao)).toBe(true)
  })

  it('(d2) Yannis N1: trocar × cortar(cliente) e girar × cortar(cliente), 20 vezes: sem 40P01 e conferência 4.7 = 0', async () => {
    for (const tipo of ['trocar', 'girar'] as const) {
      for (let i = 0; i < 20; i++) {
        const k = await cena(); const p = tipo === 'girar' ? await emitir(k) : null
        const c1 = await novoCliente(); const c2 = await novoCliente()
        const a = tipo === 'trocar' ? trocar(c1, k) : girar(c1, p!.refresh, k.cid)
        const r = await Promise.allSettled([a, c2.query(`select * from public.obs_ai_cortar($1, $2, 'claude', now())`, [k.u, k.s])])
        await fechar(c1); await fechar(c2)
        for (const x of r) {
          if (x.status === 'rejected') expect((x.reason as { code?: string }).code, `${tipo} #${i}`).not.toBe('40P01')
          expect(x.status, `${tipo} #${i}`).toBe('fulfilled')
        }
        expect(await conferencia(), `${tipo} #${i}`).toHaveLength(0)
        expect(await vivos(k.u), `${tipo} #${i}`).toHaveLength(0)
      }
    }
  })

  it('(e) C1-29: toda função obs_ai_% em public é só do service_role e tem search_path', async () => {
    const r = await pg.query(
      `select p.oid::regprocedure::text as f,
              has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as u,
              has_function_privilege('service_role', p.oid, 'execute') as s,
              coalesce(exists (select 1 from unnest(p.proconfig) x where x like 'search_path=%'), false) as sp
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'obs\\_ai\\_%'`)
    expect(r.rows.length).toBeGreaterThan(15)
    const ruins = r.rows.filter(x => x.a || x.u || !x.s || !x.sp).map(x => String(x.f))
    expect(ruins).toEqual([])
    for (const f of ['obs_ai_trocar_codigo', 'obs_ai_girar_refresh', 'obs_ai_revogar_token', 'obs_ai_podar_clientes'])
      expect(r.rows.some(x => String(x.f).startsWith(`${f}(`)), f).toBe(true)
  })
})
