// @vitest-environment node
/**
 * F2 T9: outbox do nicho contra Postgres de verdade, lendo o que o sino lê (a consulta de `/api/notifications/count`). Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/f2-avisos-sino.test.ts --no-file-parallelism
 * Grava de verdade (site e administradores próprios, criados e apagados aqui).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarCanal, criarSite, criarUsuario } from '../helpers/mg6'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn(), addBreadcrumb: vi.fn() }))

import { enviarAvisosDoNicho, type ResultadoNicho } from '@/lib/youtube/observatorio/sinais/avisos'
import { getSiteAdminUserIds } from '@/lib/notifications/get-site-admin-users'
import { rodarAvisos } from '@/lib/youtube/agenda/tarefas/avisos-pendentes'
import { roteiro, ok } from '../helpers/banco-roteirizado'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'
import { apagarCanais, apagarSites } from '../helpers/limpa-cena'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const EV = { outliers: [{ video_id: randomUUID(), canal_id: randomUUID(), published_at: '2026-10-01T00:00:00Z', mult_vpd7: 6, mult_tela: 3, vpd7: 900, formato: 'long' }], outliers_total: 2, canais: 2, proprios: [] }
const DIA = 86_400_000

describe.skipIf(skipIfNoLocalDb())('F2 T9: avisos do nicho no sino', () => {
  let pg: Client
  let site = ''
  let org = ''
  const usuarios: string[] = []
  const sb = (): SupabaseClient => getSupabaseServiceClient() as unknown as SupabaseClient

  async function sinal(extra: { forca?: number; como?: 'individual' | 'resumo'; kind?: string; status?: string; expira?: string; notificadoEm?: string | null; tentativas?: number } = {}): Promise<string> {
    const id = randomUUID()
    await pg.query(
      `insert into public.niche_signals (id, site_id, kind, subject_key, rule_version, evidence, forca, acao, status, first_seen_at, computed_at, expires_at, motivo, notificar_como, notificado_em, notificacao_tentativas)
       values ($1, $2, $3, $4, 'sinais-v1+semente-1', $5::jsonb, $6, 'video_novo', $7, now() - interval '2 days', now(), coalesce($8::timestamptz, now() + interval '20 days'), 'dois canais estouraram', $9, $10, $11)`,
      [id, site, extra.kind ?? 'destino', 'pais:' + id.slice(0, 8), JSON.stringify(EV), extra.forca ?? 10, extra.status ?? 'aberto', extra.expira ?? null, extra.como ?? 'individual', extra.notificadoEm ?? null, extra.tentativas ?? 0])
    return id
  }
  async function estado(baseline: boolean): Promise<void> {
    await pg.query(`insert into public.niche_signals_estado (site_id, computed_at, rule_version, contagens, baseline_em) values ($1, now(), 'sinais-v1+semente-1', '{}'::jsonb, $2)
      on conflict (site_id) do update set baseline_em = excluded.baseline_em`, [site, baseline ? new Date().toISOString() : null])
  }
  /** A consulta de `/api/notifications/count`, para um administrador. */
  async function sino(user: string): Promise<number> {
    return Number((await pg.query(`select count(*) from public.notifications where site_id = $1 and user_id = $2 and dismissed_at is null and expired_at is null and read_at is null`, [site, user])).rows[0].count)
  }
  async function notifs(prefixo: string): Promise<string[]> {
    return (await pg.query(`select dedup_key from public.notifications where site_id = $1 and dedup_key like $2 order by created_at`, [site, prefixo])).rows.map((r) => String(r.dedup_key))
  }
  async function linha(id: string): Promise<Record<string, unknown>> {
    return (await pg.query('select * from public.niche_signals where id = $1', [id])).rows[0]
  }
  async function limpar(): Promise<void> {
    await pg.query('delete from public.notifications where site_id = $1', [site])
    await pg.query('delete from public.niche_signals where site_id = $1', [site])
    await pg.query('delete from public.niche_signals_estado where site_id = $1', [site])
  }
  // Isolado no próprio site: o banco de integração é compartilhado e o outbox, por padrão, visita todos.
  const rodar = (): Promise<ResultadoNicho> => enviarAvisosDoNicho(sb(), new Date(), { sites: [site] })
  const nichoDoSite = (s: SupabaseClient, a: Date, semTempo: () => boolean): Promise<ResultadoNicho> => enviarAvisosDoNicho(s, a, { sites: [site], semTempo })

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    const s = await criarSite(pg)
    site = s.site; org = s.org
    for (let i = 0; i < 2; i++) {
      const u = await criarUsuario(pg); usuarios.push(u)
      await pg.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, u])
    }
  })
  afterAll(async () => {
    try {
      await limpar()
      await apagarCanais(pg, 'site_id = $1', [site])
      await pg.query('delete from public.organization_members where org_id = $1', [org])
      await apagarSites(pg, 'id = $1', [site])
      // os deletes acima gravam em audit_log (trigger): limpar por último, antes da organização
      await pg.query('delete from public.audit_log where org_id = $1', [org])
      await pg.query('delete from public.organizations where id = $1', [org])
      for (const u of usuarios) await pg.query('delete from auth.users where id = $1', [u])
    } finally { await pg.end() }
  })
  beforeEach(async () => { await limpar() })

  it('linha de base: 6 pendentes antigos (de qualquer notificar_como) viram 1 resumo "em aberto", baseline_em é gravado e apagar notifications não o reativa', async () => {
    await estado(false)
    const ids = [await sinal({ como: 'individual' }), await sinal({ como: 'resumo' }), await sinal({ kind: 'parecido', como: 'resumo' }), await sinal(), await sinal(), await sinal()]
    const r = await rodar()
    expect(r).toEqual({ enviados: 0, resumidos: 6, falhas: 0, sem_tempo: 0, envios_adiados: 0 })
    expect(await notifs('nicho:%')).toEqual([])
    const resumos = await notifs('nicho-resumo:%')
    expect(new Set(resumos).size).toBe(1)
    const t = await pg.query(`select title from public.notifications where site_id = $1 and dedup_key like 'nicho-resumo:%' limit 1`, [site])
    expect(t.rows[0].title).toBe('6 sugestões do nicho em aberto')
    for (const id of ids) expect((await linha(id)).notificado_em).not.toBeNull()
    for (const u of usuarios) expect(await sino(u)).toBe(1)
    expect((await pg.query('select baseline_em from public.niche_signals_estado where site_id = $1', [site])).rows[0].baseline_em).not.toBeNull()
    // o apagamento das notificações não reativa o baseline: uma linha nova sai como individual
    await pg.query('delete from public.notifications where site_id = $1', [site])
    await sinal({ forca: 50 })
    expect(await rodar()).toEqual({ enviados: 1, resumidos: 0, falhas: 0, sem_tempo: 0, envios_adiados: 0 })
    expect((await notifs('nicho:%')).length).toBe((await getSiteAdminUserIds(site)).length)
  })

  it('uma sugestão vira +1 no sino e dispensar pela função da T8 vira -1', async () => {
    await estado(true)
    const id = await sinal()
    await rodar()
    for (const u of usuarios) expect(await sino(u)).toBe(1)
    const d = (await pg.query(`select public.niche_signals_dispensar($1, $2, 'dispensado', 'nao_interessa', 'user:x') as r`, [site, id])).rows[0].r as { ok: boolean }
    expect(d.ok).toBe(true)
    for (const u of usuarios) expect(await sino(u)).toBe(0)
  })

  it('sinal dispensado antes da passada: nenhuma notificação', async () => {
    await estado(true)
    await sinal({ status: 'dispensado' })
    expect(await rodar()).toEqual({ enviados: 0, resumidos: 0, falhas: 0, sem_tempo: 0, envios_adiados: 0 })
    expect(await notifs('nicho%')).toEqual([])
  })

  it('duas passadas no mesmo dia com ids diferentes: duas notificações-resumo; a mesma passada repetida: uma', async () => {
    await estado(true)
    // teto já estourado hoje: tudo vai para o resumo
    for (let i = 0; i < 5; i++) await pg.query(`insert into public.notifications (site_id, user_id, domain, type, priority, title, dedup_key) values ($1, $2, 'youtube', 'youtube.niche_signal', 2, 'x', $3)`, [site, usuarios[0], 'nicho:fake-' + i])
    await sinal(); await sinal()
    await rodar()
    await sinal()
    await rodar()
    expect(new Set(await notifs('nicho-resumo:%')).size).toBe(2)
    await rodar() // nada novo pendente: nada novo enviado
    expect(new Set(await notifs('nicho-resumo:%')).size).toBe(2)
  })

  it('teto com 2 administradores: 3 individuais enviados contam 3 (distinct), restam 2', async () => {
    await estado(true)
    for (let i = 0; i < 3; i++) await sinal({ forca: 10 + i })
    expect(await rodar()).toMatchObject({ enviados: 3, resumidos: 0 })
    expect((await notifs('nicho:%')).length).toBe(3 * (await getSiteAdminUserIds(site)).length)
    for (let i = 0; i < 4; i++) await sinal({ forca: 20 + i })
    expect(await rodar()).toMatchObject({ enviados: 2, resumidos: 2 })
  })

  it('flag apagada, linha aberta já notificada com expires_at vencido e notificação viva: avisos_pendentes derruba o sino em 1', async () => {
    delete process.env.OBS_SINAIS_NICHO
    await estado(true)
    const id = await sinal({ notificadoEm: new Date().toISOString() })
    await pg.query(`insert into public.notifications (site_id, user_id, domain, type, priority, title, dedup_key) values ($1, $2, 'youtube', 'youtube.niche_signal', 2, 'x', $3)`, [site, usuarios[0], 'nicho:' + id])
    expect(await sino(usuarios[0]!)).toBe(1)
    await pg.query(`update public.niche_signals set expires_at = now() - interval '1 day' where id = $1`, [id])
    const c: ContextoTarefa = { t0: Date.now(), agora: () => Date.now(), apiKey: '', sb: sb(), linhas: null }
    const out = await rodarAvisos(c, { nicho: nichoDoSite })
    expect(out.detalhe).toMatchObject({ nicho_enviados: 0 })
    expect(await sino(usuarios[0]!)).toBe(0)
  })

  it('a mesma queda vale quando a linha ainda estava pendente (sem notificado_em)', async () => {
    await estado(true)
    const id = await sinal()
    await rodar()
    expect(await sino(usuarios[0]!)).toBe(1)
    await pg.query(`update public.niche_signals set expires_at = now() - interval '1 day' where id = $1`, [id])
    await rodar()
    expect(await sino(usuarios[0]!)).toBe(0)
  })

  it('tabela vazia de pendentes com a flag apagada: a parte do nicho roda e devolve nicho_enviados 0', async () => {
    delete process.env.OBS_SINAIS_NICHO
    const c: ContextoTarefa = { t0: Date.now(), agora: () => Date.now(), apiKey: '', sb: sb(), linhas: null }
    const out = await rodarAvisos(c, { nicho: nichoDoSite })
    expect(out.detalhe).toMatchObject({ nicho_enviados: 0, nicho_resumidos: 0, nicho_falhas: 0, nicho_sem_tempo: 0, nicho_adiados: 0 })
    expect(out.motivo).not.toBe('nicho_falhou')
  })

  it('site só com competitor_channels (sem sinal) também é visitado por niche_signals_expirar', async () => {
    await criarCanal(pg, site)
    const cliente = sb()
    const rpc = vi.spyOn(cliente, 'rpc')
    await enviarAvisosDoNicho(cliente, new Date())
    expect(rpc.mock.calls.some((c) => c[0] === 'niche_signals_expirar' && (c[1] as { p_site: string }).p_site === site)).toBe(true)
    rpc.mockRestore()
  })

  it('dono sem notification_preferences: nenhuma linha em notification_deliveries (só o sino)', async () => {
    await estado(true)
    await sinal(); await sinal({ como: 'resumo' })
    await rodar()
    const n = await pg.query(`select count(*) from public.notification_deliveries d join public.notifications n on n.id = d.notification_id where n.site_id = $1`, [site])
    expect(Number(n.rows[0].count)).toBe(0)
  })

  it('falha na 1ª e sucesso na 2ª: 1 notificação por administrador (dedup)', async () => {
    await estado(true)
    const id = await sinal()
    const falha = vi.fn().mockResolvedValue({ total: 0, sent: 0, suppressed: 0, errors: [] })
    expect(await enviarAvisosDoNicho(sb(), new Date(), { fanOut: falha, sites: [site] })).toMatchObject({ enviados: 0, falhas: 0, sem_tempo: 0, envios_adiados: 1 })
    expect((await linha(id)).notificacao_tentativas).toBe(1)
    expect((await linha(id)).notificado_em).toBeNull()
    expect(await rodar()).toMatchObject({ enviados: 1 })
    expect((await notifs('nicho:%')).length).toBe((await getSiteAdminUserIds(site)).length)
    expect((await linha(id)).notificado_em).not.toBeNull()
  })

  it('3 falhas: vermelho já na 1ª e na 2ª (nicho_adiado), na 3ª abandona (falhas 1, nicho_falhou), a 4ª não tenta; acao_do_dono por 7 dias e some no 8º', async () => {
    await estado(true)
    const id = await sinal()
    const falha = vi.fn().mockResolvedValue({ total: 0, sent: 0, suppressed: 0, errors: [] })
    // A parte nativa vem de um banco roteirizado vazio (o banco de integração tem linhas alheias): só o nicho é real.
    const task = (em: number) => {
      const nativo = roteiro({ ab_native_tests: [ok([]), ok([])] }).sb
      const real = sb()
      const misto = { from: (t: string) => (t === 'ab_native_tests' ? nativo.from(t) : real.from(t)), rpc: real.rpc.bind(real) } as unknown as SupabaseClient
      return rodarAvisos({ t0: em, agora: () => em, apiKey: '', sb: misto, linhas: null }, { nicho: (s, a, t) => enviarAvisosDoNicho(s, a, { fanOut: falha, sites: [site], semTempo: t }) })
    }
    const t0 = Date.now()
    const r1 = await task(t0); const r2 = await task(t0); expect(r1).toMatchObject({ estado: 'erro', motivo: 'nicho_adiado', detalhe: { nicho_adiados: 1 } }); expect(r2).toMatchObject({ estado: 'erro', motivo: 'nicho_adiado' })
    const r3 = await task(t0)
    expect(r3).toMatchObject({ estado: 'erro', motivo: 'nicho_falhou', detalhe: { nicho_falhas: 1 } })
    expect((await linha(id)).notificacao_falhou_em).not.toBeNull()
    const chamadas = falha.mock.calls.length
    const r4 = await task(t0)
    expect(falha.mock.calls.length).toBe(chamadas)
    expect(r4).toMatchObject({ estado: 'ok', extra: { acao: ['1 sugestão do nicho não chegou ao sino'] } })
    const r8 = await task(t0 + 8 * DIA)
    expect(r8).toMatchObject({ estado: 'ok' })
    expect(r8.extra).toBeUndefined()
  })
})
