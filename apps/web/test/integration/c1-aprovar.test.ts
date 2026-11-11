// @vitest-environment node
/**
 * C1 · F1 · T5: aprovar e negar o pedido (obs_ai_aprovar_conexao, obs_ai_negar_pedido), contra o banco local.
 * Banco: SÓ o `bythiago_int` (aplicar a MIG antes: `psql ...54422... -v ON_ERROR_STOP=1 -f <MIG>`):
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/c1-aprovar.test.ts
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

type Aprov = { motivo: string | null; conexao_id: string | null; redirect_uri: string | null; state: string | null; cliente: string | null }

describe.skipIf(skipIfNoLocalDb())('C1 F1 T5: aprovar e negar o pedido (banco local)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const extras: Client[] = []
  const sites: string[] = []
  const users: string[] = []
  const clientes: string[] = []

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
  const site = async () => { const s = (await seedSite(sb)).siteId; sites.push(s); return s }
  const pessoa = async (s?: string) => {
    const u = await insertAuthUser(`c1t5-${randomUUID()}@example.test`); users.push(u)
    if (s) await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [s, u])
    return u
  }
  const cena = async () => { const s = await site(); const u = await pessoa(s); return { s, u } }
  const liberar = async (u: string, s: string, dias = 30) =>
    String((await pg.query(`select * from public.obs_ai_liberar($1, $2, $3, now())`, [u, s, dias])).rows[0].liberacao_id)
  const cadastro = async (cliente = 'claude') => {
    const id = `c1t5-${randomUUID()}`; clientes.push(id)
    await pg.query(`insert into public.obs_ai_oauth_clientes (client_id, redirect_uris, cliente) values ($1, array[$2]::text[], $3)`, [id, REDIRECT, cliente])
    return id
  }
  const pedido = async (s: string, clientId: string, expira = `now() + interval '10 minutes'`) => {
    const hash = randomBytes(16).toString('hex')
    await pg.query(
      `insert into public.obs_ai_oauth_pedidos (hash, client_id, redirect_uri, code_challenge, state, scope, resource, site_id, expires_at)
       values ($1, $2, $3, $4, 'st-1', 'observatorio:read', 'https://bythiagofigueiredo.com/api/mcp', $5, ${expira})`,
      [hash, clientId, REDIRECT, 'A'.repeat(43), s])
    return hash
  }
  const aprovar = async (c: Client, h: string, u: string | null, s: string, agora = 'now()') =>
    (await c.query(`select * from public.obs_ai_aprovar_conexao($1, $2, $3, $4, ${agora})`, [h, u, s, randomBytes(16).toString('hex')])).rows[0] as Aprov
  const negar = async (c: Client, h: string, u: string, s: string) =>
    (await c.query(`select * from public.obs_ai_negar_pedido($1, $2, $3)`, [h, u, s])).rows[0] as { motivo: string | null; redirect_uri: string | null; state: string | null }
  const ped = async (h: string) => (await pg.query(`select * from public.obs_ai_oauth_pedidos where hash = $1`, [h])).rows[0]
  const conexoesDe = async (u: string) => (await pg.query(`select * from public.obs_ai_conexoes where user_id = $1 order by created_at`, [u])).rows
  const chavesDe = async (u: string) => (await pg.query(`select * from public.pipeline_api_keys where user_id = $1`, [u])).rows
  const codigosDe = async (u: string) =>
    (await pg.query(`select t.* from public.obs_ai_oauth_tokens t join public.obs_ai_conexoes c on c.id = t.conexao_id where c.user_id = $1 and t.tipo = 'codigo'`, [u])).rows
  const logs = async (u: string, c: Client = pg) =>
    (await c.query(`select * from public.obs_ai_access_log where user_id = $1 and action = 'consentimento' order by id`, [u])).rows
  const conferencia = async () => {
    const meus = new Set((await pg.query(`select id from public.obs_ai_conexoes where site_id = any($1::uuid[])`, [sites])).rows.map(r => String(r.id)))
    return (await pg.query(CONSULTA)).rows.filter(r => meus.has(String(r.id))).map(r => String(r.id))
  }
  const abertaComLiberacaoMorta = async (u: string) =>
    (await pg.query(
      `select count(*)::int as n from public.obs_ai_conexoes c join public.obs_ai_liberacoes b on b.id = c.liberacao_id
        where c.user_id = $1 and c.revoked_at is null and b.revoked_at is not null`, [u])).rows[0].n as number
  const forcaLiberacoes = async (s: string, us: string[]) => {
    await pg.query('begin')
    try {
      await pg.query(`set local session_replication_role = replica`)
      for (const u of us) await pg.query(`insert into public.obs_ai_liberacoes (site_id, user_id, expires_at) values ($1, $2, now() + interval '30 days')`, [s, u])
      await pg.query('commit')
    } catch (e) { await pg.query('rollback'); throw e }
  }

  it('(0) as funções novas são só do service_role', async () => {
    for (const f of ['obs_ai_aprovar_conexao(text, uuid, uuid, text, timestamptz)', 'obs_ai_negar_pedido(text, uuid, uuid)',
                     'obs_ai_log_recusa_consentimento(uuid, uuid, text, text, text, timestamptz)']) {
      const r = await pg.query(
        `select has_function_privilege('anon', 'public.${f}', 'execute') as a, has_function_privilege('authenticated', 'public.${f}', 'execute') as u,
                has_function_privilege('service_role', 'public.${f}', 'execute') as s`)
      expect(r.rows[0], f).toEqual({ a: false, u: false, s: true })
    }
  })

  it('(a) C1-7: sem login, inválido, vencido, consumido; duas aprovações = 1 conexão e 1 código; recusa de regra deixa o pedido; negar consome', async () => {
    const { s, u } = await cena(); const cid = await cadastro()
    expect((await aprovar(pg, 'x', null, s)).motivo).toBe('sem_login')
    expect(await logs(u)).toHaveLength(0)
    await liberar(u, s)
    expect((await aprovar(pg, 'inventado', u, s)).motivo).toBe('pedido_invalido')
    const venc = await pedido(s, cid, `now() - interval '1 minute'`)
    expect((await aprovar(pg, venc, u, s)).motivo).toBe('pedido_invalido')
    expect((await ped(venc)).consumido_em).toBeNull()
    expect(await conexoesDe(u)).toHaveLength(0)
    const h = await pedido(s, cid)
    const ok = await aprovar(pg, h, u, s)
    expect(ok).toMatchObject({ motivo: null, redirect_uri: REDIRECT, state: 'st-1', cliente: 'claude' })
    expect((await ped(h)).consumido_em).not.toBeNull()
    expect((await aprovar(pg, h, u, s)).motivo).toBe('pedido_invalido')
    expect(await conexoesDe(u)).toHaveLength(1); expect(await codigosDe(u)).toHaveLength(1); expect(await chavesDe(u)).toHaveLength(1)
    const cod = (await codigosDe(u))[0]
    expect(cod).toMatchObject({ client_id: cid, redirect_uri: REDIRECT, revoked_at: null, used_at: null })
    expect((await pg.query(`select (expires_at - created_at) between interval '9 minutes 59 seconds' and interval '10 minutes 1 second' as ok from public.obs_ai_oauth_tokens where id = $1`, [cod.id])).rows[0].ok).toBe(true)
    const k = (await chavesDe(u))[0]
    expect(k.name).toMatch(/^observatorio-oauth-claude-\d{8}-[0-9a-f]{4}$/)
    expect(k).toMatchObject({ permissions: ['observatorio_leitura'], created_by: null, site_id: s })
    expect((await pg.query(`select aprovado_em is not null as ok from public.obs_ai_oauth_clientes where client_id = $1`, [cid])).rows[0].ok).toBe(true)
    const ap = (await logs(u)).find(l => l.params.desfecho === 'aprovado')
    expect(ap).toMatchObject({ origin: 'oauth', result: 'ok', key_id: k.id, site_id: s, included_private: false, output_chars: null })
    expect(ap.params).toEqual({ desfecho: 'aprovado', cliente: 'claude' })
    // recusa de regra (pessoa sem liberação) deixa o pedido clicável
    const { s: s2, u: u2 } = await cena(); const cid2 = await cadastro()
    const h2 = await pedido(s2, cid2)
    expect(await aprovar(pg, h2, u2, s2)).toMatchObject({ motivo: 'nao_liberada', conexao_id: null })
    expect((await ped(h2)).consumido_em).toBeNull()
    // negar consome
    const h3 = await pedido(s2, cid2)
    expect(await negar(pg, h3, u2, s2)).toEqual({ motivo: null, redirect_uri: REDIRECT, state: 'st-1' })
    expect((await ped(h3)).consumido_em).not.toBeNull()
    expect((await negar(pg, h3, u2, s2)).motivo).toBe('pedido_invalido')
    expect((await logs(u2)).find(l => l.params.desfecho === 'negado')).toMatchObject({ result: 'recusado', origin: 'oauth', site_id: s2 })
    expect(await negar(pg, 'inventado', u2, s2)).toMatchObject({ motivo: 'pedido_invalido' })
    expect(await conferencia()).toHaveLength(0)
  })

  it('(b) C1-13: duas aprovações em Promise.all = 1 chave, 1 conexão, 2 códigos', async () => {
    const { s, u } = await cena(); const cid = await cadastro(); await liberar(u, s)
    const [c1, c2] = [await novoCliente(), await novoCliente()]
    const [h1, h2] = [await pedido(s, cid), await pedido(s, cid)]
    const r = await Promise.all([aprovar(c1, h1, u, s), aprovar(c2, h2, u, s)])
    expect(r.map(x => x.motivo)).toEqual([null, null])
    expect(r[0].conexao_id).toBe(r[1].conexao_id)
    expect(await chavesDe(u)).toHaveLength(1); expect(await conexoesDe(u)).toHaveLength(1); expect(await codigosDe(u)).toHaveLength(2)
    expect(await conferencia()).toHaveLength(0)
  })

  it('(b) C1-13: falha forçada no insert do código = nenhuma linha órfã e pedido reutilizável', async () => {
    const { s, u } = await cena(); const cid = await cadastro(); await liberar(u, s)
    const h = await pedido(s, cid)
    // falha de infraestrutura sem DDL (c1-tokens corre em paralelo na mesma tabela): hash de código já existente = unique_violation
    const outra = await cena(); const cid2 = await cadastro(); await liberar(outra.u, outra.s)
    const h2 = await pedido(outra.s, cid2)
    const usado = randomBytes(16).toString('hex')
    expect((await pg.query(`select * from public.obs_ai_aprovar_conexao($1, $2, $3, $4, now())`, [h2, outra.u, outra.s, usado])).rows[0].motivo).toBeNull()
    await expect(pg.query(`select * from public.obs_ai_aprovar_conexao($1, $2, $3, $4, now())`, [h, u, s, usado])).rejects.toThrow(/obs_ai_oauth_tokens_hash_unico/)
    expect(await conexoesDe(u)).toHaveLength(0); expect(await chavesDe(u)).toHaveLength(0)
    expect((await ped(h)).consumido_em).toBeNull()
    expect((await aprovar(pg, h, u, s)).motivo).toBeNull()
  })

  it('(b) recusa por liberação morta = motivo, e a linha recusado é lida por OUTRA conexão', async () => {
    const { s, u } = await cena(); const cid = await cadastro(); const l = await liberar(u, s)
    await pg.query(`update public.obs_ai_liberacoes set revoked_at = now(), revogada_por = 'vencida' where id = $1`, [l])
    const h = await pedido(s, cid)
    const r = await aprovar(pg, h, u, s)
    expect(r.motivo).toBe('nao_liberada')
    const outra = await novoCliente()
    const ls = await logs(u, outra)
    expect(ls).toHaveLength(1)
    expect(ls[0]).toMatchObject({ result: 'recusado', origin: 'oauth', key_id: null })
    expect(ls[0].params).toEqual({ desfecho: 'sem_direito', cliente: 'claude', motivo: 'nao_liberada' })
    expect((await ped(h)).consumido_em).toBeNull()
  })

  it('(c) C1-17: erro forçado no insert do log = pedido reutilizável e nenhuma conexão', async () => {
    const { s, u } = await cena(); const cid = await cadastro(); await liberar(u, s)
    const h = await pedido(s, cid)
    await pg.query(`create or replace function public.c1t5_falha() returns trigger language plpgsql as $$ begin raise exception 'c1t5_falha'; end $$`)
    await pg.query(`create trigger c1t5_falha_log before insert on public.obs_ai_access_log for each row when (new.user_id = '${u}') execute function public.c1t5_falha()`)
    try {
      await expect(aprovar(pg, h, u, s)).rejects.toThrow(/c1t5_falha/)
    } finally {
      await pg.query(`drop trigger if exists c1t5_falha_log on public.obs_ai_access_log`)
    }
    expect(await conexoesDe(u)).toHaveLength(0); expect(await chavesDe(u)).toHaveLength(0); expect(await codigosDe(u)).toHaveLength(0)
    expect((await ped(h)).consumido_em).toBeNull()
    expect((await aprovar(pg, h, u, s)).motivo).toBeNull()
  })

  it('(c) C1-17: dois cliques de recusa em Promise.all = 1 linha; 3 recusas de banida = 1 linha sem_direito', async () => {
    const { s, u } = await cena(); const cid = await cadastro()
    const [c1, c2] = [await novoCliente(), await novoCliente()]
    const [h1, h2] = [await pedido(s, cid), await pedido(s, cid)]
    const r = await Promise.all([aprovar(c1, h1, u, s), aprovar(c2, h2, u, s)])
    expect(r.map(x => x.motivo)).toEqual(['nao_liberada', 'nao_liberada'])
    expect(await logs(u)).toHaveLength(1)
    // banida: 3 recusas = 1 linha
    const { s: s2, u: u2 } = await cena(); const cid2 = await cadastro(); await liberar(u2, s2)
    await pg.query(`update auth.users set banned_until = now() + interval '1 day' where id = $1`, [u2])
    for (let i = 0; i < 3; i++) expect((await aprovar(pg, await pedido(s2, cid2), u2, s2)).motivo).toBe('banida')
    const ls = await logs(u2)
    expect(ls).toHaveLength(1); expect(ls[0].params).toEqual({ desfecho: 'sem_direito', cliente: 'claude', motivo: 'banida' })
  })

  it('(c) cortado e nao_liberada na mesma hora = 1 linha cada; recusa passada de 1 h grava outra', async () => {
    const { s, u } = await cena(); const cid = await cadastro(); await liberar(u, s)
    await pg.query(`select * from public.obs_ai_cortar($1, $2, 'claude', now())`, [u, s])
    for (let i = 0; i < 2; i++) expect((await aprovar(pg, await pedido(s, cid), u, s)).motivo).toBe('cortado')
    await pg.query(`select * from public.obs_ai_cortar($1, $2, null, now())`, [u, s])
    for (let i = 0; i < 2; i++) expect((await aprovar(pg, await pedido(s, cid), u, s)).motivo).toBe('cortado') // dono revogou a liberação
    const { s: s2, u: u2 } = await cena(); const cid2 = await cadastro()
    for (let i = 0; i < 2; i++) expect((await aprovar(pg, await pedido(s2, cid2), u2, s2)).motivo).toBe('nao_liberada')
    expect((await logs(u)).map(l => l.params.desfecho)).toEqual(['cortado'])
    expect((await logs(u2)).map(l => l.params.desfecho)).toEqual(['sem_direito'])
    // mesma pessoa: nao_liberada (sem direito) e cortado são desfechos distintos = 1 linha cada
    const { s: s3, u: u3 } = await cena(); const cid3 = await cadastro(); const l3 = await liberar(u3, s3)
    await pg.query(`select * from public.obs_ai_cortar($1, $2, 'claude', now())`, [u3, s3])
    expect((await aprovar(pg, await pedido(s3, cid3), u3, s3)).motivo).toBe('cortado')
    await pg.query(`update public.obs_ai_liberacoes set expires_at = now() - interval '1 hour' where id = $1`, [l3])
    expect((await aprovar(pg, await pedido(s3, cid3), u3, s3)).motivo).toBe('nao_liberada')
    expect((await logs(u3)).map(l => l.params.desfecho)).toEqual(['cortado', 'sem_direito'])
    // 1 h depois, outra linha
    expect((await aprovar(pg, await pedido(s3, cid3, `now() + interval '2 hours'`), u3, s3, `now() + interval '61 minutes'`)).motivo).toBe('nao_liberada')
    expect(await logs(u3)).toHaveLength(3)
  })

  it('teto: 3 pessoas forçadas devolvem teto e não deixam chave nem conexão nem consumo', async () => {
    const s = await site(); const u = await pessoa(s), u2 = await pessoa(s), u3 = await pessoa(s)
    await forcaLiberacoes(s, [u, u2, u3])
    const cid = await cadastro(); const h = await pedido(s, cid)
    expect((await aprovar(pg, h, u, s)).motivo).toBe('teto')
    expect(await chavesDe(u)).toHaveLength(0); expect(await conexoesDe(u)).toHaveLength(0)
    expect((await ped(h)).consumido_em).toBeNull()
    expect((await logs(u))[0].params).toEqual({ desfecho: 'sem_direito', cliente: 'claude', motivo: 'teto' })
  })

  it('(c) C1-17: Promise.all([aprovar, negar]) no mesmo id, 20 vezes: sem 40P01, exatamente um consome', async () => {
    const [c1, c2] = [await novoCliente(), await novoCliente()]
    for (let i = 0; i < 20; i++) {
      const { s, u } = await cena(); const cid = await cadastro(); await liberar(u, s)
      const h = await pedido(s, cid)
      const r = await Promise.allSettled([aprovar(c1, h, u, s), negar(c2, h, u, s)])
      for (const x of r) {
        if (x.status === 'rejected') expect((x.reason as { code?: string }).code, `#${i}`).not.toBe('40P01')
        expect(x.status, `#${i}`).toBe('fulfilled')
      }
      const [a, n] = r.map(x => (x as PromiseFulfilledResult<{ motivo: string | null }>).value.motivo)
      expect([a, n].filter(m => m === null), `#${i}`).toHaveLength(1)
      expect([a, n].filter(m => m === 'pedido_invalido'), `#${i}`).toHaveLength(1)
      expect((await ped(h)).consumido_em).not.toBeNull()
    }
  })

  it('(d) C1-19: aprovação com client_id novo para o mesmo par revoga os tokens do antigo', async () => {
    const { s, u } = await cena(); const cid1 = await cadastro(), cid2 = await cadastro(); await liberar(u, s)
    const a1 = await aprovar(pg, await pedido(s, cid1), u, s)
    const [acesso] = (await pg.query(
      `insert into public.obs_ai_oauth_tokens (hash, tipo, conexao_id, client_id, familia, expires_at)
       values ($1, 'acesso', $2, $3, $4, now() + interval '1 hour') returning id`, [randomUUID(), a1.conexao_id, cid1, randomUUID()])).rows
    const a2 = await aprovar(pg, await pedido(s, cid2), u, s)
    expect(a2.conexao_id).toBe(a1.conexao_id)
    expect(await conexoesDe(u)).toHaveLength(1)
    const t = (await pg.query(`select client_id, tipo, revoked_at is not null as rev from public.obs_ai_oauth_tokens where conexao_id = $1`, [a1.conexao_id])).rows
    expect(t.filter(x => x.client_id === cid1).every(x => x.rev)).toBe(true)
    expect(t.filter(x => x.client_id === cid2)).toEqual([{ client_id: cid2, tipo: 'codigo', rev: false }])
    expect((await pg.query(`select revoked_at from public.obs_ai_oauth_tokens where id = $1`, [acesso.id])).rows[0].revoked_at).not.toBeNull()
    expect(await conferencia()).toHaveLength(0)
  })

  it('(e) conexão aberta com chave revogada por UPDATE direto: aprovar encerra e cria outra', async () => {
    const { s, u } = await cena(); const cid = await cadastro(); await liberar(u, s)
    const a1 = await aprovar(pg, await pedido(s, cid), u, s)
    const k1 = (await chavesDe(u))[0]
    await pg.query(`update public.pipeline_api_keys set revoked_at = now() where id = $1`, [k1.id])
    const a2 = await aprovar(pg, await pedido(s, cid), u, s)
    expect(a2.motivo).toBeNull(); expect(a2.conexao_id).not.toBe(a1.conexao_id)
    const cs = await conexoesDe(u)
    expect(cs).toHaveLength(2)
    expect(cs[0]).toMatchObject({ id: a1.conexao_id, revogada_por: 'dono_pessoa' })
    expect(cs[1]).toMatchObject({ id: a2.conexao_id, revoked_at: null })
    expect((await chavesDe(u)).filter(k => k.revoked_at === null)).toHaveLength(1)
    expect(await conferencia()).toHaveLength(0)
  })

  it('conexão com chave vencida: encerra como vencida e cria outra', async () => {
    const { s, u } = await cena(); const cid = await cadastro(); await liberar(u, s)
    const a1 = await aprovar(pg, await pedido(s, cid), u, s)
    const a2 = await aprovar(pg, await pedido(s, cid, `now() + interval '41 days'`), u, s, `now() + interval '40 days'`)
    // a liberação (30 d) venceu em p_agora: recusa de regra, nada encerrado
    expect(a2.motivo).toBe('nao_liberada')
    expect((await conexoesDe(u))[0]).toMatchObject({ id: a1.conexao_id, revoked_at: null })
    await pg.query(`update public.pipeline_api_keys set expires_at = now() - interval '1 minute' where user_id = $1`, [u])
    const a3 = await aprovar(pg, await pedido(s, cid), u, s)
    expect(a3.motivo).toBeNull(); expect(a3.conexao_id).not.toBe(a1.conexao_id)
    expect((await conexoesDe(u))[0]).toMatchObject({ revogada_por: 'vencida' })
  })

  it('(f) pedido do site A aprovado com p_site B = site, pedido intacto', async () => {
    const { s, u } = await cena(); const cid = await cadastro(); await liberar(u, s)
    const sB = await site()
    const h = await pedido(s, cid)
    const r = await aprovar(pg, h, u, sB)
    expect(r).toMatchObject({ motivo: 'site', conexao_id: null, redirect_uri: null })
    expect((await ped(h)).consumido_em).toBeNull()
    expect(await conexoesDe(u)).toHaveLength(0)
    expect((await logs(u))[0]).toMatchObject({ site_id: sB, result: 'recusado' })
    expect((await logs(u))[0].params.desfecho).toBe('invalido')
    expect((await negar(pg, h, u, sB)).motivo).toBe('site')
    expect((await ped(h)).consumido_em).toBeNull()
    expect((await aprovar(pg, h, u, s)).motivo).toBeNull()
  })

  async function corrida(nome: string, b: (c: Client, u: string, s: string) => Promise<unknown>) {
    const [c1, c2] = [await novoCliente(), await novoCliente()]
    for (let i = 0; i < 20; i++) {
      const { s, u } = await cena(); const cid = await cadastro(); await liberar(u, s)
      const h = await pedido(s, cid)
      const r = await Promise.allSettled([aprovar(c1, h, u, s), b(c2, u, s)])
      for (const x of r) {
        if (x.status === 'rejected') expect((x.reason as { code?: string }).code, `${nome} #${i}`).not.toBe('40P01')
        expect(x.status, `${nome} #${i}`).toBe('fulfilled')
      }
      expect(await conferencia(), `${nome} #${i}`).toHaveLength(0)
      expect(await abertaComLiberacaoMorta(u), `${nome} #${i}`).toBe(0)
    }
  }
  it('(h) Phil I2: aprovar × revogar_lgpd, 20 vezes', async () => {
    await corrida('aprovar×lgpd', (c, u) => c.query(`select public.obs_ai_revogar_lgpd($1)`, [u]))
  })
  it('(h) Yannis I3: aprovar × UPDATE direto de revoked_at na liberação, 20 vezes', async () => {
    await corrida('aprovar×update', (c, u, s) =>
      c.query(`update public.obs_ai_liberacoes set revoked_at = now(), revogada_por = 'dono' where user_id = $1 and site_id = $2 and revoked_at is null`, [u, s]))
  })
  it('(g) C1-15: aprovar × cortar, 20 vezes', async () => {
    await corrida('aprovar×cortar', (c, u, s) => c.query(`select * from public.obs_ai_cortar($1, $2, null, now())`, [u, s]))
  })
})
