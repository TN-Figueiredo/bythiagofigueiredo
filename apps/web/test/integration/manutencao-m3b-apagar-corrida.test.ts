// @vitest-environment node
/**
 * M3b-apagar-sql, corrida gravação x remoção (Phil A1 = Yannis §2, 25/10): `obs_archive_record_core` toma `for key share` no canal ANTES do insert da
 * unidade e `competitor_channel_remove` toma `for update` no mesmo canal ANTES de contar as unidades. Os dois se excluem, nas duas ordens. Sem
 * lock novo: este teste só trava o invariante, para que a M9 (que recria funções por cópia) não tire o `for key share` sem perceber.
 * A prova vale em READ COMMITTED (a contagem da remoção é um comando novo, com snapshot novo, e vê a unidade confirmada pela gravação que esperou).
 *
 * Duas conexões e dado CONFIRMADO: roda só com M3B_CORRIDAS=1 e SUPABASE_DB_URL explícito (bythiago_int 54422), em série:
 *   M3B_CORRIDAS=1 HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/manutencao-m3b-apagar-corrida.test.ts --no-file-parallelism
 * Confirma a M3b + a 000004 no beforeAll e DESFAZ no afterAll. O bloco estático (sem corridas) roda sempre que há banco local.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { aplicarM3b, m3bNoBanco, corridasLigadas, confirmarM3bParaCorridas, desfazerM3bDasCorridas, escalar, semearCanal } from '../helpers/m3b'
import { criarUsuario } from '../helpers/mg6'
import { travarDdl } from '../helpers/ddl-testes'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const DIR = resolve(__dirname, '../../../../supabase/migrations')
const NOME = readdirSync(DIR).find(n => n.endsWith('_manutencao_m3b_apagar_com_arquivo.sql')) ?? 'ausente.sql'
const SQL_04 = (): string => readFileSync(resolve(DIR, NOME), 'utf8')
const DESFAZER_04 = resolve(__dirname, '../../../../supabase/rascunhos/m3b-apagar-desfazer.sql')
const CORE = 'public.obs_archive_record_core(uuid,text,jsonb,text)'
const REMOVE = 'public.competitor_channel_remove(uuid,uuid,text,text,uuid)'
const KEY_SHARE = 'for key share'
const MES = '2026-10-01'
const DAILY = 'competitor_video_daily'
const payload = (canal: string): string => JSON.stringify({ classe: 'serie', tabela: DAILY, canal, mes: MES, row_count: 0, control_sum: null,
  hash_conteudo: 'a'.repeat(64), schema_fp: 'b'.repeat(64), sha256_bytes: '', csv_sha256: '', file_bytes: 0, partes: 1, min_key: null, max_key: null })

/** O corpo do _core sem a linha do `for key share` (o mutante). */
const semKeyShare = (def: string): string => {
  const m = def.replace(/(perform 1 from public\.competitor_channels c where c\.id = v_channel and c\.site_id = p_site) for key share;/, '$1;')
  if (m === def) throw new Error('mutante: a linha do for key share não foi achada no _core')
  return m
}

describe.skipIf(skipIfNoLocalDb())('M3b-apagar-sql: o for key share do _core fica antes do insert e conflita com o for update da remoção', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  async function emTx(fn: () => Promise<void>): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      await travarDdl(pg)
      await pg.query(SQL_04())
      await fn()
    } finally { await pg.query('rollback') }
  }

  it('estático: o _core trava o canal (for key share) antes do insert da unidade; a remoção trava (for update) antes da guarda; o mutante cai', async () => {
    await emTx(async () => {
      const core = await escalar<string>(pg, `select pg_get_functiondef($1::regprocedure)`, [CORE])
      const iKey = core.indexOf(KEY_SHARE), iInsert = core.indexOf('insert into public.obs_archive_units')
      expect(iKey).toBeGreaterThan(0); expect(iInsert).toBeGreaterThan(iKey)
      expect(core).toMatch(/from public\.competitor_channels c where c\.id = v_channel and c\.site_id = p_site for key share/)
      const rem = await escalar<string>(pg, `select pg_get_functiondef($1::regprocedure)`, [REMOVE])
      const iUpd = rem.indexOf('where c.id = p_channel and c.site_id = p_site for update'), iGuarda = rem.indexOf("raise exception 'apagar_com_arquivo'")
      expect(iUpd).toBeGreaterThan(0); expect(iGuarda).toBeGreaterThan(iUpd)
      // mutante: sem o for key share a verificação de posição deixa de achar a trava e o teste cai
      const mut = semKeyShare(core)
      expect(mut.indexOf(KEY_SHARE)).toBe(-1)
      expect(() => { expect(mut).toMatch(/from public\.competitor_channels c where c\.id = v_channel and c\.site_id = p_site for key share/) }).toThrow()
    })
  })
})

describe.skipIf(skipIfNoLocalDb() || !corridasLigadas())('M3b-apagar-sql: corrida gravação x remoção, duas conexões, dado confirmado', () => {
  let c: Client
  const sites: string[] = []
  const usuarios: string[] = []
  beforeAll(async () => {
    await confirmarM3bParaCorridas(7)
    c = new Client({ connectionString: PG_URL }); await c.connect()
    await c.query(SQL_04())   // confirma a 000004 (desfeita no afterAll)
  })
  afterAll(async () => {
    try { await c.query(readFileSync(DESFAZER_04, 'utf8')) } catch { /* já desfeita */ }
    await desfazerM3bDasCorridas()
    for (const s of sites) {
      for (const sql of [`delete from public.obs_archive_units where site_id = $1`, `delete from public.obs_archive_months where site_id = $1`,
        `delete from public.obs_archive_channel_removals where site_id = $1`, `delete from public.audit_log where site_id = $1`, `delete from public.competitor_channels where site_id = $1`]) {
        try { await c.query(sql, [s]) } catch { /* melhor esforço */ }
      }
    }
    for (const u of usuarios) { try { await c.query(`delete from public.organization_members where user_id = $1`, [u]); await c.query(`delete from auth.users where id = $1`, [u]) } catch { /* idem */ } }
    await c.end()
  })

  async function cena(): Promise<{ site: string; canal: string; admin: string }> {
    const s = await semearCanal(c, { site: randomUUID(), videos: 1 })
    sites.push(s.site)
    const admin = await criarUsuario(c); usuarios.push(admin)
    const org = await escalar<string>(c, `select org_id from public.sites where id = $1`, [s.site])
    await c.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, admin])
    return { site: s.site, canal: s.canal, admin }
  }
  const nova = async (): Promise<Client> => { const x = new Client({ connectionString: PG_URL }); await x.connect(); await x.query(`select set_config('obs_archive.hoje', '2026-11-28', false)`); return x }
  const unidades = (site: string, canal: string): Promise<number> => escalar<number>(c, `select count(*)::int from public.obs_archive_units where site_id = $1 and channel_ref = $2`, [site, canal])
  const canais = (canal: string): Promise<number> => escalar<number>(c, `select count(*)::int from public.competitor_channels where id = $1`, [canal])
  const gravar = (x: Client, k: ReturnType<typeof cena> extends Promise<infer T> ? T : never) => x.query(`select public.obs_archive_record($1, 'unidade', $2::jsonb) as r`, [k.site, payload(k.canal)])
  const remover = (x: Client, k: { site: string; canal: string; admin: string }, decisao: string, via: string) =>
    x.query(`select public.competitor_channel_remove($1, $2, $3, $4, $5) as r`, [k.site, k.canal, decisao, via, k.admin])
  const lockTimeout = async (x: Client, fn: () => Promise<unknown>): Promise<string | null> => {
    await x.query(`set lock_timeout = '1200ms'`)
    try { await fn(); return null } catch (e) { return (e as { code?: string }).code ?? 'erro' } finally { await x.query(`set lock_timeout = 0`) }
  }

  /** Ordem 1: a gravação segura o canal; a remoção espera (55P03) e, depois do commit, recusa apagar_com_arquivo. */
  async function ordem1(): Promise<{ bloqueou: boolean; recusou: string | null; canais: number; unidades: number; gravou: string }> {
    const k = await cena(); const A = await nova(), B = await nova()
    try {
      await A.query('begin')
      const g = (await gravar(A, k)).rows[0].r as { status: string }
      const bloqueou = (await lockTimeout(B, () => remover(B, k, 'apagar', 'botao'))) === '55P03'
      await A.query('commit')
      let recusou: string | null = null
      try { await remover(B, k, 'apagar', 'botao') } catch (e) { recusou = (e as { message?: string }).message ?? 'erro' }
      return { bloqueou, recusou, canais: await canais(k.canal), unidades: await unidades(k.site, k.canal), gravou: g.status }
    } finally { await A.query('rollback').catch(() => undefined); await A.end(); await B.end() }
  }
  /** Ordem 2: a remoção segura o canal; a gravação espera (55P03) e, depois do commit, devolve canal_removido sem gravar unidade. */
  async function ordem2(): Promise<{ bloqueou: boolean; depois: string; canais: number; unidades: number }> {
    const k = await cena(); const A = await nova(), B = await nova()
    try {
      await B.query('begin'); await remover(B, k, 'guardar', 'e10_export')
      const bloqueou = (await lockTimeout(A, () => gravar(A, k))) === '55P03'
      await B.query('commit')
      const depois = ((await gravar(A, k)).rows[0].r as { status: string }).status
      return { bloqueou, depois, canais: await canais(k.canal), unidades: await unidades(k.site, k.canal) }
    } finally { await B.query('rollback').catch(() => undefined); await A.end(); await B.end() }
  }

  it('ordem 1 (gravar primeiro): a remoção espera, depois recusa apagar_com_arquivo; canal e unidade ficam', async () => {
    const r = await ordem1()
    expect(r.gravou).toBe('nova')
    expect(r).toMatchObject({ bloqueou: true, recusou: 'apagar_com_arquivo', canais: 1, unidades: 1 })
  }, 60_000)

  it('ordem 2 (remover primeiro): a gravação espera, depois canal_removido; nenhuma unidade órfã', async () => {
    expect(await ordem2()).toEqual({ bloqueou: true, depois: 'canal_removido', canais: 0, unidades: 0 })
  }, 60_000)

  it('mutante: sem o for key share no _core a gravação NÃO espera a remoção (a ordem 2 cai)', async () => {
    const original = await escalar<string>(c, `select pg_get_functiondef($1::regprocedure)`, [CORE])
    await c.query(semKeyShare(original))
    try {
      const r = await ordem2()
      expect(r.bloqueou).toBe(false)   // o teste real exige true: com o mutante ele cai
    } finally { await c.query(original) }
    expect((await ordem2()).bloqueou).toBe(true)   // restaurado
  }, 90_000)
})
