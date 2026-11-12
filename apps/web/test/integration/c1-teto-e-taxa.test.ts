// @vitest-environment node
/**
 * C1 · F1 · T2: elegibilidade, teto de 2 pessoas e taxas (por chave, por pessoa, por IP) em SQL, contra o banco local.
 * Banco: SÓ o `bythiago_int` (aplicar a MIG antes: `psql ...54422... -v ON_ERROR_STOP=1 -f <MIG>`):
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/c1-teto-e-taxa.test.ts
 * Função sem EXECUTE nunca é CHAMADA como anon/authenticated (derruba este Postgres): privilégio por `has_function_privilege`.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, insertAuthUser, deleteAuthUser } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FUNCOES = [
  'obs_ai_motivo_inelegivel(uuid, uuid, timestamptz)', 'obs_ai_conferir_teto(uuid, uuid)', 'obs_ai_tg_teto()',
  'obs_ai_rate_hit_v2(uuid, uuid, timestamptz)', 'obs_ai_rate_ip_hit(text, text, timestamptz, integer, integer)',
] as const

describe.skipIf(skipIfNoLocalDb())('C1 F1 T2: teto, elegibilidade e taxas (banco local)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  const users: string[] = []
  const keys: string[] = []
  const ipGrains: string[] = []   // grains/hashes de teste ficam em dias de 2031+, limpos pelo bucket
  // dia exclusivo por execução (2031-2090), para não colidir com nada nem entre execuções
  const base = Date.UTC(2031 + Math.floor(Math.random() * 59), 0, 1) + Math.floor(Math.random() * 300) * 86_400_000
  const dia = (k: number) => new Date(base + k * 86_400_000)
  const diaDe = (d: Date) => new Date(Math.floor(d.getTime() / 86_400_000) * 86_400_000)

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
  })
  afterAll(async () => {
    try {
      await pg.query(`delete from public.obs_ai_liberacoes where site_id = any($1::uuid[])`, [sites])
      await pg.query(`delete from public.pipeline_api_keys where id = any($1::uuid[])`, [keys])
      await pg.query(`delete from public.lgpd_requests where user_id = any($1::uuid[])`, [users])
      await pg.query(`delete from public.obs_ai_rate_pessoa where user_id = any($1::uuid[])`, [users])
      await pg.query(`delete from public.obs_ai_rate_ip where bucket >= $1`, [new Date(Date.UTC(2031, 0, 1))])
      await pg.query(`delete from public.site_memberships where site_id = any($1::uuid[])`, [sites])
      await pg.query(`delete from public.audit_log where site_id = any($1::uuid[])`, [sites])
      if (sites.length > 0) await apagarSites(pg, 'id = any($1::uuid[])', [sites])
      for (const u of users) await deleteAuthUser(u)
    } finally {
      await pg.end()
    }
  })

  async function pessoa(): Promise<string> {
    const id = await insertAuthUser(`c1t2-${randomUUID()}@example.test`); users.push(id); return id
  }
  async function site(): Promise<string> { const s = (await seedSite(sb)).siteId; sites.push(s); return s }
  async function chave(c: Pick<Client, 'query'>, siteId: string, userId: string): Promise<string> {
    const r = await c.query(
      `insert into public.pipeline_api_keys (site_id, name, key_hash, permissions, user_id, expires_at)
       values ($1, 'c1t2 teste', $2, array['observatorio_leitura']::text[], $3, now() + interval '30 days') returning id`,
      [siteId, randomUUID(), userId])
    const id = String(r.rows[0].id); keys.push(id); return id
  }
  async function liberacao(c: Pick<Client, 'query'>, siteId: string, userId: string): Promise<string> {
    const r = await c.query(
      `insert into public.obs_ai_liberacoes (site_id, user_id, expires_at) values ($1, $2, now() + interval '30 days') returning id`,
      [siteId, userId])
    return String(r.rows[0].id)
  }
  async function erro(p: Promise<unknown>): Promise<{ code?: string; message?: string } | undefined> {
    try { await p } catch (e) { return e as { code?: string; message?: string } }
    return undefined
  }

  it('(0) as 5 funções são só do service_role', async () => {
    for (const f of FUNCOES) {
      const r = await pg.query(
        `select has_function_privilege('anon', $1, 'execute') as a, has_function_privilege('authenticated', $1, 'execute') as u,
                has_function_privilege('service_role', $1, 'execute') as s`, ['public.' + f])
      expect(r.rows[0], f).toEqual({ a: false, u: false, s: true })
    }
  })

  describe('C1-14 teto de 2 pessoas', () => {
    it('3ª pessoa por insert de liberação (1 chave + 1 liberação já ativas) = obs_ai_teto; reabrir também', async () => {
      const s = await site(), u1 = await pessoa(), u2 = await pessoa(), u3 = await pessoa()
      await chave(pg, s, u1)
      const l2 = await liberacao(pg, s, u2)
      const e = await erro(liberacao(pg, s, u3))
      expect(e?.code).toBe('P0001')
      expect(e?.message).toBe('obs_ai_teto')
      expect((await erro(chave(pg, s, u3)))?.message).toBe('obs_ai_teto')
      // revoga a 2ª, entra a 3ª, reabrir a 2ª passa a ser a terceira pessoa
      await pg.query(`update public.obs_ai_liberacoes set revoked_at = now(), revogada_por = 'dono' where id = $1`, [l2])
      await liberacao(pg, s, u3)
      const e2 = await erro(pg.query(`update public.obs_ai_liberacoes set revoked_at = null, revogada_por = null where id = $1`, [l2]))
      expect(e2?.message).toBe('obs_ai_teto')
    })

    it('dois inserts paralelos em duas conexões: um passa, outro recusa', async () => {
      const s = await site(), u1 = await pessoa(), u2 = await pessoa(), u3 = await pessoa()
      await liberacao(pg, s, u1)
      const a = new Client({ connectionString: PG_URL }), b = new Client({ connectionString: PG_URL })
      await Promise.all([a.connect(), b.connect()])
      try {
        const r = await Promise.allSettled([liberacao(a, s, u2), liberacao(b, s, u3)])
        expect(r.filter(x => x.status === 'fulfilled')).toHaveLength(1)
        const rej = r.find(x => x.status === 'rejected') as PromiseRejectedResult
        expect((rej.reason as Error).message).toBe('obs_ai_teto')
      } finally { await Promise.all([a.end(), b.end()]) }
    })

    it('com 3 pessoas forçadas: encurtar passa, aumentar levanta, revogar passa', async () => {
      const s = await site(), u1 = await pessoa(), u2 = await pessoa(), u3 = await pessoa()
      await pg.query('begin')
      let ids: string[] = []
      try {
        await pg.query(`set local session_replication_role = replica`)
        ids = [await liberacao(pg, s, u1), await liberacao(pg, s, u2), await liberacao(pg, s, u3)]
        await pg.query('commit')
      } catch (e) { await pg.query('rollback'); throw e }
      await expect(pg.query(`update public.obs_ai_liberacoes set expires_at = now() + interval '10 days' where id = $1`, [ids[0]])).resolves.toBeTruthy()
      const e = await erro(pg.query(`update public.obs_ai_liberacoes set expires_at = now() + interval '60 days' where id = $1`, [ids[0]]))
      expect(e?.message).toBe('obs_ai_teto')
      await expect(pg.query(`update public.obs_ai_liberacoes set revoked_at = now(), revogada_por = 'dono' where id = $1`, [ids[1]])).resolves.toBeTruthy()
    })
  })

  describe('obs_ai_motivo_inelegivel', () => {
    const agora = () => new Date()
    const motivo = async (u: string, s: string) =>
      (await pg.query(`select public.obs_ai_motivo_inelegivel($1, $2, $3) as m`, [u, s, agora()])).rows[0].m as string | null
    const vincula = (s: string, u: string) =>
      pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [s, u])

    it('(b) null no caso bom; banida; apagamento; sem_vinculo', async () => {
      const s = await site(), u = await pessoa()
      expect(await motivo(u, s)).toBe('sem_vinculo')
      await vincula(s, u)
      expect(await motivo(u, s)).toBeNull()
      await pg.query(`update auth.users set banned_until = now() + interval '1 day' where id = $1`, [u])
      expect(await motivo(u, s)).toBe('banida')
      await pg.query(`update auth.users set banned_until = now() - interval '1 day' where id = $1`, [u])
      expect(await motivo(u, s)).toBeNull()
      const r = await pg.query(`insert into public.lgpd_requests (user_id, type, phase_1_completed_at) values ($1, 'account_deletion', now()) returning id`, [u])
      expect(await motivo(u, s)).toBe('apagamento')
      await pg.query(`update public.lgpd_requests set cancelled_at = now() where id = $1`, [r.rows[0].id])
      expect(await motivo(u, s)).toBeNull()
      await pg.query(`update public.lgpd_requests set cancelled_at = null, phase_1_completed_at = null where id = $1`, [r.rows[0].id])
      expect(await motivo(u, s)).toBeNull()
    })

    it('(e) pessoa ausente = apagamento', async () => {
      const s = await site()
      expect(await motivo(randomUUID(), s)).toBe('apagamento')
    })
  })

  describe('obs_ai_rate_hit_v2', () => {
    const hit = async (k: string, u: string | null, now: Date) =>
      (await pg.query(`select * from public.obs_ai_rate_hit_v2($1, $2, $3)`, [k, u, now])).rows[0] as
        { no_minuto: number; no_dia: number; no_dia_pessoa: number }

    it('(c) C1-18: 500 chamadas em duas chaves da mesma pessoa = 500; a 501ª = 501; minuto é por chave; v1 responde', async () => {
      const s = await site(), u = await pessoa()
      const k1 = await chave(pg, s, u), k2 = await chave(pg, s, u)
      const t = new Date(diaDe(dia(1)).getTime() + 12 * 3_600_000)
      let ultimo
      for (let i = 0; i < 500; i++) ultimo = await hit(i % 2 === 0 ? k1 : k2, u, t)
      expect(ultimo!.no_dia_pessoa).toBe(500)
      const r = await hit(k1, u, t)
      expect(r.no_dia_pessoa).toBe(501)
      expect(r.no_minuto).toBe(251)
      expect(r.no_dia).toBe(251)
      const v1 = await pg.query(`select * from public.obs_ai_rate_hit($1, $2)`, [k2, t]).catch(e => e as Error)
      // a v1 é security invoker: o postgres local (superuser) a executa
      expect(v1).toHaveProperty('rows')
    })

    it('p_user nulo levanta', async () => {
      const s = await site(), u = await pessoa(), k = await chave(pg, s, u)
      await expect(hit(k, null, dia(2))).rejects.toThrow()
    })

    it('(f) dia UTC: 23:59 e 00:01 do dia seguinte = dois baldes', async () => {
      const s = await site(), u = await pessoa(), k = await chave(pg, s, u)
      const d = diaDe(dia(3))
      const a = await hit(k, u, new Date(d.getTime() + 23 * 3_600_000 + 59 * 60_000))
      const b = await hit(k, u, new Date(d.getTime() + 24 * 3_600_000 + 60_000))
      expect(a.no_dia_pessoa).toBe(1)
      expect(b.no_dia_pessoa).toBe(1)
      const r = await pg.query(`select count(*)::int as n from public.obs_ai_rate_pessoa where user_id = $1`, [u])
      expect(r.rows[0].n).toBe(2)
    })
  })

  describe('obs_ai_rate_ip_hit', () => {
    const hit = async (g: string, h: string, now: Date, limite: number, tetoDia: number) =>
      (await pg.query(`select * from public.obs_ai_rate_ip_hit($1, $2, $3, $4, $5)`, [g, h, now, limite, tetoDia])).rows[0] as
        { n: number; n_dia: number; estourou: boolean }
    const glob = async (grain: string, d: Date) =>
      (await pg.query(`select n from public.obs_ai_rate_ip where grain = $1 and ip_hash = 'global' and bucket = $2`, [grain, diaDe(d)])).rows[0]?.n as number | undefined
    const linhasDoDia = async (d: Date) =>
      Number((await pg.query(`select count(*)::int as n from public.obs_ai_rate_ip where bucket >= $1 and bucket < $2`,
        [diaDe(d), new Date(diaDe(d).getTime() + 86_400_000)])).rows[0].n)

    it('(d) C1-30: 31ª da hora devolve 31 e para em 31', async () => {
      const t = new Date(diaDe(dia(10)).getTime() + 3_600_000)
      const h = randomUUID()
      let r
      for (let i = 0; i < 31; i++) r = await hit('register', h, t, 30, 200)
      expect(r!.n).toBe(31)
      expect(r!.estourou).toBe(false)
      expect((await hit('register', h, t, 30, 200)).n).toBe(31)
    })

    it('(d) Phil I1: 100 chamadas do mesmo hash com limite 30 deixam register_dia = 30', async () => {
      const t = new Date(diaDe(dia(11)).getTime() + 3_600_000)
      const h = randomUUID()
      let r
      for (let i = 0; i < 100; i++) r = await hit('register', h, t, 30, 200)
      expect(await glob('register_dia', t)).toBe(30)
      expect(r!.n_dia).toBe(30)
    })

    it('(d) 201ª do dia na global de register devolve n_dia = 201 (e para em 201)', async () => {
      const t = new Date(diaDe(dia(12)).getTime() + 3_600_000)
      let r
      for (let i = 0; i < 201; i++) r = await hit('register', randomUUID(), t, 30, 200)
      expect(r!.n_dia).toBe(201)
      expect((await hit('register', randomUUID(), t, 30, 200)).n_dia).toBe(201)
      expect(await glob('baldes_dia', t)).toBe(202)
    })

    it('(d) authorize usa a própria global; grain inválido levanta', async () => {
      const t = new Date(diaDe(dia(13)).getTime() + 3_600_000)
      await hit('authorize', randomUUID(), t, 60, 2000)
      expect(await glob('authorize_dia', t)).toBe(1)
      expect(await glob('register_dia', t)).toBeUndefined()
      await expect(hit('outro', randomUUID(), t, 60, 2000)).rejects.toThrow()
    })

    it('(d) com baldes_dia em 5.000, hash novo devolve estourou e não cresce; hash já existente segue', async () => {
      const t = new Date(diaDe(dia(14)).getTime() + 3_600_000)
      const velho = randomUUID()
      await hit('register', velho, t, 30, 200)
      await pg.query(`update public.obs_ai_rate_ip set n = 5000 where grain = 'baldes_dia' and ip_hash = 'global' and bucket = $1`, [diaDe(t)])
      const antes = await linhasDoDia(t)
      const r = await hit('register', randomUUID(), t, 30, 200)
      expect(r.estourou).toBe(true)
      expect(await linhasDoDia(t)).toBe(antes)
      const v = await hit('register', velho, t, 30, 200)
      expect(v.estourou).toBe(false)
      expect(v.n).toBe(2)
    })
  })
})
