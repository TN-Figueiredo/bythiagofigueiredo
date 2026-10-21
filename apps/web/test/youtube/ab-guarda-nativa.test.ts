// @vitest-environment node
// F1a-dado, Tarefa 6: a guarda do teste do YouTube nos pontos de escrita do nosso teste (start, retomar, rotação, fila),
// contra o banco falso único (helpers/banco-ab, com `ab_native_tests` e `audit_log`) e o YouTubeFalso. settleOnAir e novaTentativa:
// ab-settle-teste-youtube.test.ts. forçar rotação: ab-force-rotate.test.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { AGORA, BLOB, IMG, SITE, criarBanco, servicoAtual } from '../helpers/banco-ab'
import { YouTubeFalso } from '../helpers/youtube-falso'
import { montarRotacao } from '../helpers/montar-saida-automatica'
import { MOTIVO_GUARDA_FALHOU, MOTIVO_RECUSA_NATIVO } from '@/lib/youtube/teste-youtube/nativo/guarda'

const { fanOut, preflight, canal, ensureFreshToken, put } = vi.hoisted(() => ({ fanOut: vi.fn(), preflight: vi.fn(), canal: vi.fn(), ensureFreshToken: vi.fn(), put: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: fanOut }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: preflight }))
vi.mock('@vercel/blob', () => ({ put }))
vi.mock('@/lib/youtube/channel-account', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/channel-account')>()), channelAccountIdForVideo: canal }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => servicoAtual.cliente }))
vi.mock('@/lib/youtube/ab-settle', async (orig) => {
  const { settleOnAirFalso } = await import('../helpers/montar-saida-automatica')
  return { ...(await orig<typeof import('@/lib/youtube/ab-settle')>()), settleOnAir: settleOnAirFalso }
})

import { startAbTestInternal } from '@/lib/youtube/ab-start'
import { retomarTeste } from '@/lib/youtube/ab-resume'
import { phaseProcessQueue, phaseRotateActiveTests } from '@/lib/youtube/ab-rotate-phases'

const nativa = (o: Record<string, unknown> = {}) => ({ id: 'n1', site_id: SITE, video_id: 'video-interno', estado: 'em_andamento', confirmado_em: null, updated_at: AGORA.toISOString(), ...o })
const confirmada = () => nativa({ confirmado_em: AGORA.toISOString() })
const AUDIT = 'ab_pausa_detectado_log'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
  preflight.mockResolvedValue({ ok: true, accessToken: 'tok' })
  ensureFreshToken.mockResolvedValue({ accessToken: 'tok' })
  canal.mockResolvedValue('UC1')
  put.mockResolvedValue({ url: 'https://abc.public.blob.vercel-storage.com/ab-originals/novo.jpg' })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('rotação do cron', () => {
  const rodar = async (o: Parameters<typeof montarRotacao>[0] = {}) => {
    const m = montarRotacao(o)
    const r = await phaseRotateActiveTests(m.banco.supabase)
    return { ...m, r }
  }

  it('variável apagada: linha detectada não muda nada (escreve como hoje, sem anotação)', async () => {
    delete process.env.AB_PAUSA_POR_DETECTADO
    const { banco, yt, settle, r } = await rodar({ nativas: [nativa()] })
    expect(r.processed).toBe(1)
    expect(yt.escritas().length).toBeGreaterThan(0)
    expect(settle).not.toHaveBeenCalled()
    expect(banco.auditoria()).toEqual([])
    expect(banco.teste().status_note).toBeNull()
  })

  it("'true' = off", async () => {
    vi.stubEnv('AB_PAUSA_POR_DETECTADO', 'true')
    const { settle, banco, r } = await rodar({ nativas: [nativa()] })
    expect(r.processed).toBe(1); expect(settle).not.toHaveBeenCalled(); expect(banco.auditoria()).toEqual([])
  })

  it('log: escreve como hoje e anota exatamente uma linha ab_pausa_detectado_log; status_note intacta', async () => {
    vi.stubEnv('AB_PAUSA_POR_DETECTADO', 'log')
    const { banco, yt, settle, r } = await rodar({ nativas: [nativa()] })
    expect(r.processed).toBe(1)
    expect(yt.escritas().length).toBeGreaterThan(0)
    expect(settle).not.toHaveBeenCalled()
    expect(banco.auditoria()).toHaveLength(1)
    expect(banco.auditoria()[0]).toMatchObject({
      action: AUDIT, site_id: SITE, resource_type: 'ab_test', resource_id: 'teste-1', actor_user_id: null,
      after_data: { test_id: 'teste-1', video_id: 'video-interno', native_test_id: 'n1', ponto: 'rotacao', confirmado_em_nulo: true },
    })
    expect(banco.teste().status_note).toBeNull()
  })

  it('log: com um ciclo já aberto hoje (disparo duplicado do cron) não anota', async () => {
    vi.stubEnv('AB_PAUSA_POR_DETECTADO', 'log')
    const m = montarRotacao({ nativas: [nativa()] })
    m.banco.ciclos().push({ id: 'hoje', test_id: 'teste-1', cycle_number: 5, variant_id: 'B', started_at: AGORA.toISOString(), ended_at: null })
    await phaseRotateActiveTests(m.banco.supabase)
    expect(m.banco.auditoria()).toEqual([])
  })

  it('log: erro ao gravar o audit_log não derruba a rotação (a escrita segue)', async () => {
    vi.stubEnv('AB_PAUSA_POR_DETECTADO', 'log')
    const m = montarRotacao({ nativas: [nativa()] })
    const original = m.banco.supabase
    const sb = { ...original, rpc: original.rpc.bind(original), from: (t: string) => { if (t === 'audit_log') throw new Error('audit fora'); return original.from(t) } } as typeof original
    servicoAtual.cliente = sb
    const r = await phaseRotateActiveTests(sb)
    expect(r.processed).toBe(1)
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it('on: linha detectada pausa sem escrever (pede settleOnAir teste_youtube com o restore_seq lido)', async () => {
    vi.stubEnv('AB_PAUSA_POR_DETECTADO', 'on')
    const { yt, settle, r } = await rodar({ nativas: [nativa()] })
    expect(yt.escritas()).toEqual([])
    expect(r.processed).toBe(0)
    expect(settle).toHaveBeenCalledWith('teste-1', expect.objectContaining({ siteId: SITE, destino: { tipo: 'original' }, motivo: 'teste_youtube', seqEsperado: 0 }))
  })

  it.each(['off', 'log', 'on'] as const)('linha confirmada com a flag %s: pausa sem escrever', async (modo) => {
    vi.stubEnv('AB_PAUSA_POR_DETECTADO', modo)
    const { yt, settle, banco } = await rodar({ nativas: [confirmada()] })
    expect(yt.escritas()).toEqual([])
    expect(settle).toHaveBeenCalledWith('teste-1', expect.objectContaining({ motivo: 'teste_youtube' }))
    expect(banco.auditoria()).toEqual([])
  })

  it('sem linha: comportamento atual', async () => {
    vi.stubEnv('AB_PAUSA_POR_DETECTADO', 'on')
    const { yt, settle, r } = await rodar()
    expect(r.processed).toBe(1); expect(yt.escritas().length).toBeGreaterThan(0); expect(settle).not.toHaveBeenCalled()
  })

  it('dois sites, linha confirmada só no do B: o teste do A escreve, o do B não; duas idas ao banco da guarda', async () => {
    const vistas: string[] = []
    const m = montarRotacao({
      nativas: [nativa({ site_id: 'site-2', video_id: 'video-2', id: 'n2', confirmado_em: AGORA.toISOString() })],
      extras: [{ id: 'teste-2', site_id: 'site-2', youtube_video_id: 'video-2' }],
      videos: [{ id: 'video-2', site_id: 'site-2', youtube_video_id: 'yt-2', channel_id: 'ch-2', youtube_channels: { channel_id: 'UC2', name: 'Canal 2' } }],
    })
    const original = m.banco.supabase
    const sb = { ...original, rpc: original.rpc.bind(original), from: (t: string) => { vistas.push(t); return original.from(t) } } as typeof original
    servicoAtual.cliente = sb
    const r = await phaseRotateActiveTests(sb)
    expect(vistas.filter((t) => t === 'ab_native_tests')).toHaveLength(2)
    expect(m.settle).toHaveBeenCalledTimes(1)
    expect(m.settle).toHaveBeenCalledWith('teste-2', expect.objectContaining({ siteId: 'site-2', motivo: 'teste_youtube' }))
    expect(r.processed).toBe(1)
    expect(m.yt.escritas().length).toBeGreaterThan(0)
  })

  it('falha fechada: erro 4xx na consulta da guarda pula o teste sem escrever, soma em errors e manda Sentry; sem tentativa extra', async () => {
    const m = montarRotacao({ nativas: [nativa()] })
    let chamadas = 0
    const original = m.banco.supabase
    const sb = { ...original, rpc: original.rpc.bind(original), from: (t: string) => {
      if (t !== 'ab_native_tests') return original.from(t)
      chamadas++
      const q: Record<string, unknown> = {}; for (const k of ['select', 'eq', 'in', 'order']) q[k] = () => q
      q.range = async () => ({ data: null, error: { message: 'permissão', code: '42501' }, status: 403 })
      return q
    } } as typeof original
    servicoAtual.cliente = sb
    const r = await phaseRotateActiveTests(sb)
    expect(r.errors).toBe(1); expect(r.processed).toBe(0)
    expect(m.yt.escritas()).toEqual([]); expect(m.settle).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalled()
    expect(chamadas).toBe(1)
  })

  it('falha transitória (5xx) uma vez: a tentativa extra acerta, a rotação escreve e não há Sentry', async () => {
    const m = montarRotacao({ nativas: [] })
    let chamadas = 0
    const original = m.banco.supabase
    const sb = { ...original, rpc: original.rpc.bind(original), from: (t: string) => {
      if (t !== 'ab_native_tests') return original.from(t)
      chamadas++
      if (chamadas === 1) { const q: Record<string, unknown> = {}; for (const k of ['select', 'eq', 'in', 'order']) q[k] = () => q; q.range = async () => ({ data: null, error: { message: 'gateway', code: '' }, status: 503 }); return q }
      return original.from(t)
    } } as typeof original
    servicoAtual.cliente = sb
    const r = await phaseRotateActiveTests(sb)
    expect(chamadas).toBe(2)
    expect(r.processed).toBe(1); expect(r.errors).toBe(0)
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})

describe('startAbTestInternal e a fila', () => {
  const rascunho = (nativas: Record<string, unknown>[]) => {
    const banco = criarBanco({ status: 'draft', semCiclos: true, restoreSeq: 0, nativas })
    servicoAtual.cliente = banco.supabase
    const yt = new YouTubeFalso({ titulo: 'Título A', thumb: IMG.A, blobs: { [BLOB('A')]: IMG.A, [BLOB('B')]: IMG.B } })
    vi.stubGlobal('fetch', yt.fetch)
    return { banco, yt, iniciar: () => startAbTestInternal('teste-1', SITE, { supabase: banco.supabase }) }
  }

  it('linha confirmada, flag off: recusa com o motivo e o código, nada reivindicado nem escrito', async () => {
    const { banco, yt, iniciar } = rascunho([confirmada()])
    const r = await iniciar()
    expect(r).toMatchObject({ ok: false, error: MOTIVO_RECUSA_NATIVO, codigo: 'teste_youtube', nativeTestId: 'n1' })
    expect(banco.teste()).toMatchObject({ status: 'draft', restore_seq: 0 })
    expect(yt.escritas()).toEqual([])
  })

  it('detectada: off segue; log segue e anota ponto start; on recusa', async () => {
    delete process.env.AB_PAUSA_POR_DETECTADO
    const a = rascunho([nativa()]); expect((await a.iniciar()).ok).toBe(true); expect(a.banco.auditoria()).toEqual([])
    vi.stubEnv('AB_PAUSA_POR_DETECTADO', 'log')
    const b = rascunho([nativa()]); expect((await b.iniciar()).ok).toBe(true)
    expect(b.banco.auditoria()).toHaveLength(1)
    expect(b.banco.auditoria()[0]).toMatchObject({ action: AUDIT, after_data: { ponto: 'start', native_test_id: 'n1' } })
    expect(b.banco.teste().status_note).toBeNull()
    vi.stubEnv('AB_PAUSA_POR_DETECTADO', 'on')
    const c = rascunho([nativa()]); expect(await c.iniciar()).toMatchObject({ ok: false, codigo: 'teste_youtube' })
  })

  it('consulta da guarda falha: recusa fechada com "não foi possível conferir", sem escrever', async () => {
    const { banco, iniciar } = rascunho([])
    const original = banco.supabase
    const sb = { ...original, rpc: original.rpc.bind(original), from: (t: string) => {
      if (t !== 'ab_native_tests') return original.from(t)
      const q: Record<string, unknown> = {}; for (const k of ['select', 'eq', 'in', 'order']) q[k] = () => q
      q.range = async () => ({ data: null, error: { message: 'x', code: '42501' }, status: 403 })
      return q
    } } as typeof original
    const r = await startAbTestInternal('teste-1', SITE, { supabase: sb })
    expect(r).toMatchObject({ ok: false, error: MOTIVO_GUARDA_FALHOU, codigo: 'guarda_falhou' })
    expect(banco.teste().status).toBe('draft')
    void iniciar
  })

  const naFila = (nativas: Record<string, unknown>[], falhas = 2) => {
    const banco = criarBanco({ status: 'queued', semCiclos: true, config: { rotation_pattern: 'abba', queue_start_failures: falhas }, nativas })
    banco.setTeste({ queue_start_after: new Date(AGORA.getTime() - 3_600_000).toISOString() })
    servicoAtual.cliente = banco.supabase
    return banco
  }

  it('fila com linha confirmada: volta a queued para amanhã 00:00 UTC, queue_start_failures IGUAL, nota com o motivo, um aviso por par (teste, registro)', async () => {
    const banco = naFila([confirmada()])
    expect(await phaseProcessQueue(banco.supabase)).toBe(0)
    expect(banco.teste()).toMatchObject({ status: 'queued', queue_start_after: '2026-10-13T00:00:00.000Z', status_note: MOTIVO_RECUSA_NATIVO })
    expect((banco.teste().config as { queue_start_failures: number }).queue_start_failures).toBe(2)
    expect(fanOut).toHaveBeenCalledTimes(1)
    expect(fanOut.mock.calls[0]![0]).toMatchObject({ dedupKey: 'ab-queue-nativo:teste-1:n1' })
    // dia seguinte: mesmo par, sem novo aviso e ainda sem gastar tentativa
    banco.setTeste({ queue_start_after: new Date(AGORA.getTime() - 1000).toISOString() })
    await phaseProcessQueue(banco.supabase)
    expect(fanOut).toHaveBeenCalledTimes(1)
    expect((banco.teste().config as { queue_start_failures: number }).queue_start_failures).toBe(2)
  })

  it('fila com a guarda sem conferir: adia sem gastar tentativa e sem aviso ao dono', async () => {
    const banco = naFila([])
    const original = banco.supabase
    const sb = { ...original, rpc: original.rpc.bind(original), from: (t: string) => {
      if (t !== 'ab_native_tests') return original.from(t)
      const q: Record<string, unknown> = {}; for (const k of ['select', 'eq', 'in', 'order']) q[k] = () => q
      q.range = async () => ({ data: null, error: { message: 'x', code: '42501' }, status: 403 })
      return q
    } } as typeof original
    servicoAtual.cliente = sb
    await phaseProcessQueue(sb)
    expect(banco.teste()).toMatchObject({ status: 'queued' })
    expect((banco.teste().config as { queue_start_failures: number }).queue_start_failures).toBe(2)
    expect(fanOut).not.toHaveBeenCalled()
  })

  it('fila com falha por OUTRO motivo continua gastando tentativa (comportamento atual)', async () => {
    const banco = naFila([], 2)
    banco.setTeste({ original_title: 'x' })
    banco.variantes()[1]!.blob_url = null // variante sem imagem: recusa de start que não é a guarda
    banco.setTeste({ test_type: 'thumbnail' })
    await phaseProcessQueue(banco.supabase)
    expect((banco.teste().config as { queue_start_failures: number }).queue_start_failures).toBe(3)
  })
})

describe('retomarTeste', () => {
  const pausado = (nativas: Record<string, unknown>[]) => {
    const banco = criarBanco({ status: 'paused', restoreSeq: 3, nativas })
    banco.setTeste({ paused_at: AGORA.toISOString() })
    Object.assign(banco.ciclos()[0]!, { ended_at: AGORA.toISOString(), end_reason: 'pausa' })
    servicoAtual.cliente = banco.supabase
    const yt = new YouTubeFalso({ titulo: 'Título A', thumb: IMG.A, blobs: { [BLOB('A')]: IMG.A, [BLOB('B')]: IMG.B } })
    vi.stubGlobal('fetch', yt.fetch)
    return { banco, yt, retomar: () => retomarTeste('teste-1', SITE, { supabase: banco.supabase, agora: () => AGORA, token: async () => 'tok' }) }
  }

  it('confirmada: recusa com o motivo, sem reivindicar nem escrever', async () => {
    const { banco, yt, retomar } = pausado([confirmada()])
    expect(await retomar()).toMatchObject({ ok: false, resultado: 'erro', error: MOTIVO_RECUSA_NATIVO })
    expect(banco.teste()).toMatchObject({ status: 'paused', restore_seq: 3 })
    expect(yt.escritas()).toEqual([])
  })

  it('detectada: off segue; log segue e anota ponto retomar; on recusa', async () => {
    delete process.env.AB_PAUSA_POR_DETECTADO
    const a = pausado([nativa()]); expect((await a.retomar()).ok).toBe(true)
    vi.stubEnv('AB_PAUSA_POR_DETECTADO', 'log')
    const b = pausado([nativa()]); expect((await b.retomar()).ok).toBe(true)
    expect(b.banco.auditoria()).toHaveLength(1)
    expect(b.banco.auditoria()[0]).toMatchObject({ action: AUDIT, after_data: { ponto: 'retomar' } })
    vi.stubEnv('AB_PAUSA_POR_DETECTADO', 'on')
    const c = pausado([nativa()]); expect(await c.retomar()).toMatchObject({ ok: false, error: MOTIVO_RECUSA_NATIVO })
  })
})
