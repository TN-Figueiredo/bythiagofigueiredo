// @vitest-environment node
/**
 * F3b: `niche_signals_adiar` e o sino contra Postgres de verdade. Banco: SÓ o `bythiago_int` (com a migration 20261024000001 aplicada):
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/f3b-adiar.test.ts --no-file-parallelism
 * Tudo dentro de begin/rollback; o "relógio" é simulado por `update` das datas.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarSite, criarUsuario, escalar } from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const ESTADO = { rule_version: 'sinais-v1+semente-1', motivo_vazio: null, contagens: { n: 1 } }
type R = { ok: boolean; motivo?: string; adiado_ate?: string; expira_em?: string }

describe.skipIf(skipIfNoLocalDb())('F3b: niche_signals_adiar', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { try { await pg.query('rollback') } catch { /* nada aberto */ } await pg.end() })

  async function tx<T>(fn: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    try { return await fn() } finally { await pg.query('rollback') }
  }
  async function criar(site: string, chave = 'pais:VN'): Promise<string> {
    const lote = [{ kind: 'destino', subject_key: chave, forca: 10, acao: 'video_novo', motivo: 'm',
      evidence: { outliers: [], outliers_total: 2, canais: 2, proprios: [] } }]
    await pg.query(`select public.niche_signals_gravar($1, $2::jsonb, $3::jsonb, false, '[]'::jsonb)`, [site, JSON.stringify(lote), JSON.stringify(ESTADO)])
    return await escalar<string>(pg, `select id from public.niche_signals where site_id = $1 and subject_key = $2`, [site, chave])
  }
  async function adiar(site: string, id: string, por = 'user:x'): Promise<R> {
    return (await pg.query(`select public.niche_signals_adiar($1, $2, $3) as r`, [site, id, por])).rows[0].r
  }
  async function notificar(site: string, user: string, dedup: string, payload: unknown = {}): Promise<void> {
    await pg.query(`insert into public.notifications (site_id, user_id, type, domain, priority, title, dedup_key, payload)
      values ($1, $2, 'youtube.niche_signal', 'youtube', 2, 't', $3, $4::jsonb)`, [site, user, dedup, JSON.stringify(payload)])
  }
  async function conta(site: string, user: string): Promise<number> {
    return await escalar<number>(pg, `select count(id)::int from public.notifications where site_id = $1 and user_id = $2
      and dismissed_at is null and expired_at is null and read_at is null`, [site, user])
  }

  it('função só para service_role', async () => {
    const f = 'niche_signals_adiar(uuid,uuid,text)'
    expect(await escalar<boolean>(pg, `select has_function_privilege('authenticated', 'public.${f}', 'execute')`)).toBe(false)
    expect(await escalar<boolean>(pg, `select has_function_privilege('anon', 'public.${f}', 'execute')`)).toBe(false)
    expect(await escalar<boolean>(pg, `select has_function_privilege('service_role', 'public.${f}', 'execute')`)).toBe(true)
  })

  it('adia 7 dias, grava quem adiou e mantém o status aberto', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const id = await criar(site)
      const r = await adiar(site, id, 'user:abc')
      expect(r.ok).toBe(true)
      const l = (await pg.query(`select status, adiado_por, (adiado_ate - now()) as d from public.niche_signals where id = $1`, [id])).rows[0]
      expect(l.status).toBe('aberto')
      expect(l.adiado_por).toBe('user:abc')
      expect(l.d.days).toBe(7) // now() é fixo dentro da transação
      expect(Date.parse(r.adiado_ate as string)).toBeGreaterThan(Date.now() + 6.9 * 86_400_000)
    })
  })

  it('recusas: id de outro site, já adiado (com a data), vence antes de 7 dias, vencida, já dispensada', async () => {
    await tx(async () => {
      const a = await criarSite(pg)
      const b = await criarSite(pg)
      const id = await criar(a.site)
      expect(await adiar(b.site, id)).toEqual({ ok: false, motivo: 'nao_encontrado' })
      expect((await adiar(a.site, randomUUID())).motivo).toBe('nao_encontrado')
      expect((await adiar(a.site, id)).ok).toBe(true)
      const dup = await adiar(a.site, id)
      expect(dup.ok).toBe(false)
      expect(dup.motivo).toBe('ja_adiado')
      expect(dup.adiado_ate).toBeTruthy()

      const id2 = await criar(a.site, 'pais:TH')
      await pg.query(`update public.niche_signals set expires_at = now() + interval '5 days' where id = $1`, [id2])
      const r2 = await adiar(a.site, id2)
      expect(r2.ok).toBe(false)
      expect(r2.motivo).toBe('expira_antes')
      expect(r2.expira_em).toBeTruthy()
      expect(await escalar<unknown>(pg, `select adiado_ate from public.niche_signals where id = $1`, [id2])).toBeNull()

      const id3 = await criar(a.site, 'pais:ID')
      await pg.query(`update public.niche_signals set expires_at = now() - interval '1 hour' where id = $1`, [id3])
      expect((await adiar(a.site, id3)).motivo).toBe('nao_aberto')

      const id4 = await criar(a.site, 'pais:PH')
      await pg.query(`update public.niche_signals set status = 'dispensado' where id = $1`, [id4])
      expect((await adiar(a.site, id4)).motivo).toBe('nao_aberto')
    })
  })

  it('adiado volta sozinho: depois de adiado_ate dá para adiar de novo', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const id = await criar(site)
      await adiar(site, id)
      await pg.query(`update public.niche_signals set adiado_ate = now() - interval '1 minute' where id = $1`, [id])
      expect((await adiar(site, id, 'user:y')).ok).toBe(true)
      expect(await escalar<string>(pg, `select adiado_por from public.niche_signals where id = $1`, [id])).toBe('user:y')
    })
  })

  it('o sino: adiar derruba a notificação (individual e resumo); vencido o adiamento, a sincronização não derruba', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const u = await criarUsuario(pg)
      const id = await criar(site)
      const outro = await criar(site, 'pais:TH')
      await notificar(site, u, `nicho:${id}`, { ids: [id] })
      await notificar(site, u, 'nicho-resumo:2026-10-24:a', { ids: [id] })
      await notificar(site, u, 'nicho-resumo:2026-10-24:b', { ids: [id, outro] })
      expect(await conta(site, u)).toBe(3)
      await adiar(site, id)
      expect(await conta(site, u)).toBe(1) // o resumo com um id que segue aberto fica
      // o adiamento vence: não há o que reabrir no sino, mas a sincronização não mata o que ainda vale
      await pg.query(`update public.niche_signals set adiado_ate = now() - interval '1 minute' where id = $1`, [id])
      await pg.query('select public.niche_signals_sincronizar_sino($1)', [site])
      expect(await conta(site, u)).toBe(1)
    })
  })

  it('o gravador não cria duplicata do adiado (a chave segue aberta) e dispensar um adiado funciona', async () => {
    await tx(async () => {
      const { site } = await criarSite(pg)
      const id = await criar(site)
      await adiar(site, id)
      await criar(site) // regrava a mesma chave
      expect(await escalar<number>(pg, `select count(*)::int from public.niche_signals where site_id = $1`, [site])).toBe(1)
      const r = (await pg.query(`select public.niche_signals_dispensar($1, $2, 'dispensado', 'ja_fiz', 'user:x') as r`, [site, id])).rows[0].r
      expect(r).toEqual({ ok: true })
    })
  })
})
