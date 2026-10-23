// @vitest-environment node
/**
 * F1a-tela-1 T1: fechamento por silêncio (`avisos_pendentes`) e fan-out do lembrete contra o banco real. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-f1a-avisos-fechamento --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico, seedStaffUser, deleteAuthUser } from '../helpers/db-seed'

const emailsEnviados = vi.hoisted(() => [] as Array<{ html: string }>)
vi.mock('@/lib/email/service', () => ({ getEmailService: () => ({ send: async (m: { html: string }) => { emailsEnviados.push(m); return { messageId: 'x' } } }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

import { rodarAvisos } from '@/lib/youtube/agenda/tarefas/avisos-pendentes'
import { fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const DIA = 86_400_000

describe.skipIf(skipIfNoLocalDb())('F1a-tela-1 T1: fechamento por silêncio e fan-out (banco)', () => {
  let pg: Client
  let t: { testId: string; siteId: string }
  let videoId: string
  let ytId: string
  let orgId: string
  const usuarios: string[] = []
  const realFetch = globalThis.fetch
  let aoGravarFechamento: (() => Promise<void>) | null = null

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    // Gancho de CAS: antes do PATCH que fecha (estado sem_desfecho), roda a evidência concorrente uma única vez.
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      const metodo = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
      if (aoGravarFechamento && metodo === 'PATCH' && url.includes('/ab_native_tests') && String(init?.body ?? '').includes('sem_desfecho')) {
        const g = aoGravarFechamento; aoGravarFechamento = null
        await g()
      }
      return realFetch(input, init)
    })
  })
  afterAll(async () => {
    vi.unstubAllGlobals()
    try { for (const u of usuarios) await deleteAuthUser(u) } finally { await pg.end() }
  })
  beforeEach(async () => {
    aoGravarFechamento = null
    t = await semearTesteAb({ status: 'active', testType: 'title', cicloAberto: 0 })
    const db = clienteServico()
    videoId = (await db.from('ab_tests').select('youtube_video_id').eq('id', t.testId).single()).data!.youtube_video_id as string
    ytId = String((await pg.query('select youtube_video_id from public.youtube_videos where id = $1', [videoId])).rows[0].youtube_video_id)
    orgId = String((await pg.query('select org_id from public.sites where id = $1', [t.siteId])).rows[0].org_id)
  })

  // O banco de integração é compartilhado e tem centenas de linhas confirmadas de outras suítes (o teto de 500 da tarefa as vê primeiro):
  // a LEITURA é restrita ao site semeado; os UPDATEs (CAS) passam intactos.
  const noSite = (): SupabaseClient => {
    const real = clienteServico()
    return new Proxy(real, {
      get(alvo, p) {
        if (p !== 'from') { const v = Reflect.get(alvo, p); return typeof v === 'function' ? v.bind(alvo) : v }
        return (tabela: string) => {
          const q = alvo.from(tabela)
          if (tabela !== 'ab_native_tests') return q
          return new Proxy(q, {
            get(qa, qp) {
              if (qp === 'select') return (cols: string) => qa.select(cols).eq('site_id', t.siteId)
              const v = Reflect.get(qa, qp); return typeof v === 'function' ? v.bind(qa) : v
            },
          })
        }
      },
    })
  }
  const ctx = (agoraMs: number): ContextoTarefa => ({ t0: agoraMs, agora: () => agoraMs, apiKey: '', sb: noSite(), linhas: null })
  const confirmada = async (agoraMs: number, o: { inicioDias: number; lembreteDias: number | null }): Promise<{ id: string; updated_at: string }> => {
    const r = await clienteServico().from('ab_native_tests').insert({
      site_id: t.siteId, video_id: videoId, youtube_video_id: ytId.slice(0, 11).padEnd(11, 'x'), origem: 'detectado', campos: ['titulo'], estado: 'em_andamento',
      variantes_titulo: ['a', 'b'], versao_regra: 1,
      primeira_vista: new Date(agoraMs - o.inicioDias * DIA).toISOString(), confirmado_em: new Date(agoraMs - o.inicioDias * DIA).toISOString(),
      lembrete_notificado_em: o.lembreteDias === null ? null : new Date(agoraMs - o.lembreteDias * DIA).toISOString(),
    }).select('id, updated_at').single()
    expect(r.error).toBeNull()
    return r.data as { id: string; updated_at: string }
  }
  const linha = async (id: string) => (await clienteServico().from('ab_native_tests').select('*').eq('id', id).single()).data as Record<string, unknown>

  it('(a) início há 16 d e lembrete há 2 d: fecha sem_desfecho/sem_dado/sem_resposta, respondido_em nulo, CHECKs aceitam', async () => {
    const agora = Date.now()
    const { id } = await confirmada(agora, { inicioDias: 16, lembreteDias: 2 })
    const r = await rodarAvisos(ctx(agora))
    expect(r.detalhe).toMatchObject({ fechados: 1, cas_perdido: 0, fechamento_falhou: 0 })
    const l = await linha(id)
    expect(l).toMatchObject({ estado: 'sem_desfecho', desfecho_estado: 'sem_dado', desfecho_motivo: 'sem_resposta', resposta_dono: 'sem_resposta', respondido_em: null })
    expect(l.encerrado_em).not.toBeNull()
  })

  it('(b) evidência (updated_at novo) entre a leitura e o CAS: cas_perdido 1 e nada gravado', async () => {
    const agora = Date.now()
    const { id, updated_at } = await confirmada(agora, { inicioDias: 16, lembreteDias: 2 })
    let disparou = 0
    aoGravarFechamento = async () => {
      disparou++
      await pg.query(`update public.ab_native_tests set updated_at = now() + interval '5 seconds' where id = $1`, [id])
    }
    const r = await rodarAvisos(ctx(agora))
    expect(disparou).toBe(1)
    expect(r.detalhe).toMatchObject({ fechados: 0, cas_perdido: 1, fechamento_falhou: 0 })
    const l = await linha(id)
    expect(l.updated_at).not.toBe(updated_at)
    expect(l).toMatchObject({ estado: 'em_andamento', desfecho_estado: null, desfecho_motivo: null, resposta_dono: null, encerrado_em: null, desfecho_em: null })
  })

  it('(e) lembrete do dia 14 de ponta a ponta: texto novo no sino, 1 entrega email, html com link absoluto do vídeo', async () => {
    const agora = Date.now()
    const userId = (await seedStaffUser(clienteServico(), orgId, 'admin')).userId; usuarios.push(userId)
    const { id } = await confirmada(agora, { inicioDias: 14, lembreteDias: null })
    const titulo = String((await pg.query('select title from public.youtube_videos where id = $1', [videoId])).rows[0].title ?? '')
    emailsEnviados.length = 0
    const r = await rodarAvisos(ctx(agora))
    expect(r.detalhe).toMatchObject({ lembrados: 1 })
    const n = (await pg.query('select * from public.notifications where user_id = $1 and dedup_key = $2', [userId, `lembrete-nativo:${id}`])).rows
    expect(n).toHaveLength(1)
    expect(n[0].title).toBe('Teste do YouTube: os 14 dias acabaram')
    expect(String(n[0].message).endsWith('Qual versão venceu no Studio?')).toBe(true)
    if (titulo.trim() !== '' && titulo.trim().length <= 80) expect(String(n[0].message).startsWith(titulo.trim())).toBe(true)
    expect(Number((await pg.query(`select count(*) from public.notification_deliveries d join public.notifications x on x.id = d.notification_id where x.user_id = $1 and x.dedup_key = $2 and d.channel = 'email'`, [userId, `lembrete-nativo:${id}`])).rows[0].count)).toBe(1)
    // O envio do e-mail é de outro worker (create.ts só enfileira a entrega): passa a linha criada pelo adaptador real.
    const antes = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = 'https://teste.exemplo'
    try {
      const { EmailAdapter } = await import('@/lib/notifications/adapters/email')
      const env = await new EmailAdapter().send(n[0] as never, { email: 'dono@exemplo.test' } as never)
      expect(env).toEqual({ success: true })
    } finally { if (antes === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = antes }
    expect(emailsEnviados).toHaveLength(1)
    expect(emailsEnviados[0]!.html).toContain(`href="https://teste.exemplo/cms/youtube/ab-lab?video=${ytId.slice(0, 11).padEnd(11, 'x')}"`)
  })

  describe('fan-out do lembrete', () => {
    const base = () => ({
      siteId: t.siteId, domain: 'youtube' as const, type: 'youtube.native_lembrete', priority: 3, title: 'Faz 14 dias', message: 'm',
      dedupKey: `lembrete-nativo:${randomUUID()}`, defaultChannels: ['email'] as const,
    })
    const admin = async (): Promise<string> => {
      const { userId } = await seedStaffUser(clienteServico(), orgId, 'admin'); usuarios.push(userId); return userId
    }
    const linhasDe = async (userId: string, dedup: string): Promise<number> =>
      Number((await pg.query('select count(*) from public.notifications where user_id = $1 and dedup_key = $2', [userId, dedup])).rows[0].count)
    const entregas = async (userId: string, dedup: string, canal: string): Promise<number> =>
      Number((await pg.query(
        `select count(*) from public.notification_deliveries d join public.notifications n on n.id = d.notification_id
          where n.user_id = $1 and n.dedup_key = $2 and d.channel = $3`, [userId, dedup, canal])).rows[0].count)

    it('(c) 2 admins, um com falha: 2º disparo volta suppressed, sem 2ª linha', async () => {
      const a = await admin(); const b = await admin()
      // b falha: já tem 100 notificações na última hora (limite por hora)
      await pg.query(
        `insert into public.notifications (site_id, user_id, type, domain, priority, title) select $1, $2, 'x.enchimento', 'youtube', 3, 'enchimento' from generate_series(1, 100)`,
        [t.siteId, b])
      const o = base()
      const um = await fanOutToSiteAdminsDetailed(o)
      expect(um.errors.some((e) => /rate limit/.test(e))).toBe(true)
      expect(await linhasDe(a, o.dedupKey)).toBe(1)
      expect(await linhasDe(b, o.dedupKey)).toBe(0)
      const dois = await fanOutToSiteAdminsDetailed(o)
      expect(dois.suppressed).toBeGreaterThanOrEqual(1)
      expect(dois.sent).toBe(0)
      expect(await linhasDe(a, o.dedupKey)).toBe(1)
      // libera b: o 3º disparo entrega a b e continua sem 2ª linha para a
      await pg.query(`delete from public.notifications where user_id = $1 and type = 'x.enchimento'`, [b])
      const tres = await fanOutToSiteAdminsDetailed(o)
      expect(tres.sent).toBeGreaterThanOrEqual(1)
      expect(await linhasDe(a, o.dedupKey)).toBe(1)
      expect(await linhasDe(b, o.dedupKey)).toBe(1)
    })

    it('(d) sem preferência: 1 entrega email; com channel_email=false: nenhuma', async () => {
      const a = await admin(); const b = await admin()
      await pg.query(`insert into public.notification_preferences (user_id, site_id, category, channel_email, channel_push, channel_telegram) values ($1, $2, null, false, false, false)`, [b, t.siteId])
      const o = base()
      const r = await fanOutToSiteAdminsDetailed(o)
      expect(r.errors).toEqual([])
      expect(await entregas(a, o.dedupKey, 'email')).toBe(1)
      expect(await linhasDe(b, o.dedupKey)).toBe(1)
      expect(await entregas(b, o.dedupKey, 'email')).toBe(0)
    })
  })
})
