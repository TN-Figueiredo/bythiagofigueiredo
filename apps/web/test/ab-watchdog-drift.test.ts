// @vitest-environment node
// P4a T11: o vigia (drift pela imagem e conversão do em_andamento interrompido).
// Banco falso único + YouTubeFalso (só `fetch`); o settleOnAir roda de verdade, salvo onde o teste só quer ver a chamada.
import * as Sentry from '@sentry/nextjs'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { AGORA, BLOB, IMG, ONTEM, SITE, criarBanco, servicoAtual } from './helpers/banco-ab'
import type { OpcoesBanco } from './helpers/banco-ab'
import { H, YouTubeFalso, imagemComDhash } from './helpers/youtube-falso'

const { fanOut, ensureFreshToken, createNotification, getOwners, recordCronFailure, recordCronSuccess, getCronHealth } = vi.hoisted(() => ({
  fanOut: vi.fn(), ensureFreshToken: vi.fn(), createNotification: vi.fn(), getOwners: vi.fn(),
  recordCronFailure: vi.fn(), recordCronSuccess: vi.fn(), getCronHealth: vi.fn(),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: fanOut }))
vi.mock('@/lib/notifications/create', () => ({ createNotification }))
vi.mock('@/lib/notifications/get-site-owners', async (orig) => ({ ...(await orig<typeof import('@/lib/notifications/get-site-owners')>()), getSiteOwners: getOwners }))
vi.mock('@/lib/cron-health', () => ({ getCronHealth, recordCronFailure, recordCronSuccess }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => servicoAtual.cliente }))

import { faseDriftEInterrompidos, FIM_DAS_LEITURAS_MS, NAO_INICIA_SETTLE_DEPOIS_MS, ORCAMENTO_VIGIA_MS } from '@/lib/youtube/ab-watchdog-drift'
import { emParalelo } from '@/lib/util/em-paralelo'
import { SEM_DESTINATARIO } from '@/lib/notifications/get-site-owners'
import { GET } from '@/app/api/cron/ab-watchdog/route'

const INICIO = AGORA.getTime()
const IMG_C = await imagemComDhash(H.C) // não é de nenhuma variante: troca manual no Studio
const iso = (msAtras: number) => new Date(AGORA.getTime() - msAtras).toISOString()
const MIN = 60_000
const andamento = (min: number, campo: Record<string, unknown> = {}) => ({
  estado: 'em_andamento', destino: 'original', em: iso(min * MIN), forcado: false, escreveu: null, erro: null, attempts: 0, ...campo,
})
const falhouAntigo = () => ({ estado: 'falhou', destino: 'original', em: ONTEM, forcado: false, escreveu: true, erro: { status: 403, reason: 'forbidden', chamada: 'thumbnails.set' }, attempts: 1 })

interface Opcoes extends OpcoesBanco {
  /** O que o YouTube mostra no ar (padrão: a imagem A, igual à variante do ciclo = sem drift). */
  noAr?: Buffer
  tituloNoAr?: string
  /** ms que o relógio do vigia anda a cada chamada ao YouTube. */
  avancaPorChamada?: number
  /** Total de testes ativos (o primeiro é o 'teste-1'); os demais copiam o modelo. */
  total?: number
}

function montar(o: Opcoes = {}) {
  const extras = [
    ...(o.extras ?? []),
    ...Array.from({ length: Math.max(0, (o.total ?? 1) - 1) }, (_, i) => ({ id: `t${i + 2}` })),
  ]
  const banco = criarBanco({ testType: 'thumbnail', ...o, extras })
  for (const e of extras) {
    if (typeof e.id === 'string' && !banco.ciclos().some((c) => c.test_id === e.id) && !('semCiclo' in e)) {
      banco.ciclos().push({ id: `c-${e.id}`, test_id: e.id, cycle_number: 0, variant_id: 'A', started_at: ONTEM, ended_at: null, end_reason: null })
    }
  }
  let deslocamento = 0
  const relogio = { agora: () => INICIO + deslocamento, inicio: INICIO }
  const yt = new YouTubeFalso({
    titulo: o.tituloNoAr ?? 'Título A', thumb: o.noAr ?? IMG.A, blobs: { [BLOB('A')]: IMG.A, [BLOB('B')]: IMG.B },
    relogio: { avancar: (ms) => { deslocamento += ms } }, avancaPorChamada: o.avancaPorChamada,
  })
  servicoAtual.cliente = banco.supabase
  return { banco, yt, relogio, avancar: (ms: number) => { deslocamento += ms } }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
  createNotification.mockResolvedValue({ success: true })
  ensureFreshToken.mockResolvedValue({ accessToken: 'tok' })
  getOwners.mockResolvedValue([{ userId: 'owner-1', email: 'dono@x.com' }])
  process.env.CRON_SECRET = 's'
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('emParalelo', () => {
  it('nunca passa de 4 em voo', async () => {
    let emVoo = 0, pico = 0
    const r = await emParalelo(Array.from({ length: 12 }, (_, i) => i), 4, async () => {
      emVoo++; pico = Math.max(pico, emVoo); await new Promise((res) => setTimeout(res, 5)); emVoo--
    })
    expect(pico).toBeLessThanOrEqual(4)
    expect(pico).toBeGreaterThan(1) // o limite não é 1 por acidente
    expect(r).toEqual({ feitos: expect.any(Array), adiados: 0 })
    expect(r.feitos).toHaveLength(12)
  })

  it('deveParar é consultado antes de CADA início: o que não começou conta em adiados e nada mais começa', async () => {
    let iniciados = 0
    const r = await emParalelo([1, 2, 3, 4, 5, 6], 1, async (n) => { iniciados++; return n }, () => iniciados >= 4)
    expect(r.feitos).toEqual([1, 2, 3, 4])
    expect(r.adiados).toBe(2)
  })

  it('lista vazia: nada feito, nada adiado', async () => {
    expect(await emParalelo([], 4, async () => 1)).toEqual({ feitos: [], adiados: 0 })
  })
})

describe('P4a-I18: orçamento do vigia', () => {
  it('relógio que anda 12 s por teste, 6 testes, um de cada vez → 2 verificados (início aos 0 e 12 s), 4 adiados (corte aos 15 s)', async () => {
    const { banco, yt, relogio } = montar({ total: 6, avancaPorChamada: 6_000 })
    const r = await faseDriftEInterrompidos(banco.supabase, relogio, yt.fetch, 1)
    expect(ORCAMENTO_VIGIA_MS).toBe(15_000)
    expect(r).toMatchObject({ verificados: 2, adiados: 4, pausados: 0, falhas: 0 })
  })

  it('Y-DEVE1: o segundo teste começa aos 14 s (ainda inicia) e não começa aos 16 s (adiados)', async () => {
    const aos14 = montar({ total: 2, avancaPorChamada: 7_000 })
    expect(await faseDriftEInterrompidos(aos14.banco.supabase, aos14.relogio, aos14.yt.fetch, 1)).toMatchObject({ verificados: 2, adiados: 0 })
    const aos16 = montar({ total: 2, avancaPorChamada: 8_000 })
    expect(await faseDriftEInterrompidos(aos16.banco.supabase, aos16.relogio, aos16.yt.fetch, 1)).toMatchObject({ verificados: 1, adiados: 1 })
  })

  it('Y-DEVE1: o fetch da sonda e o do Blob da variante levam um sinal que aborta em início + 50 s (o recordCron sempre roda)', async () => {
    expect(FIM_DAS_LEITURAS_MS).toBe(50_000)
    const m = montar({ avancaPorChamada: 40_000, ajustar: (vs) => { vs[0]!.thumbnail_dhash = null } })
    m.avancar(14_000)
    const sinais: Array<{ url: string; metodo: string; sinal: AbortSignal | undefined }> = []
    const espiao = ((u: RequestInfo | URL, i?: RequestInit) => { sinais.push({ url: String(u), metodo: i?.method ?? 'GET', sinal: i?.signal ?? undefined }); return m.yt.fetch(u, i) }) as typeof fetch
    await faseDriftEInterrompidos(m.banco.supabase, m.relogio, espiao)
    await new Promise((res) => setTimeout(res, 20)) // AbortSignal.timeout usa o relógio real
    const get = sinais.find((x) => x.url.includes('hqdefault') && x.metodo === 'GET')
    const blob = sinais.find((x) => x.url.includes('blob.vercel-storage'))
    expect(get && blob).toBeTruthy()
    // o relógio andou 40 s na primeira chamada: a sonda (GET) e o Blob nascem passados de início + 50 s, e o sinal ainda é o deles
    expect(get!.sinal!.aborted).toBe(true)
    expect(blob!.sinal!.aborted).toBe(true)
  })

  it('o limite padrão é 4 em voo: 6 testes de 20 s no mesmo relógio compartilhado deixam 4 para depois', async () => {
    const { banco, yt, relogio } = montar({ total: 6, avancaPorChamada: 10_000 })
    const r = await faseDriftEInterrompidos(banco.supabase, relogio, yt.fetch)
    expect(r).toMatchObject({ verificados: 2, adiados: 4 })
  })
})

describe('F-D3: o drift detectado só inicia a saída até 15 s da rota', () => {
  const pedirSaida = async (o: Opcoes, deslocamentoInicial = 0) => {
    const m = montar({ noAr: IMG.B, ...o })
    m.avancar(deslocamentoInicial)
    const settle = vi.fn().mockResolvedValue({ resultado: 'feito', campos: { thumbnail: { estado: 'pulado_drift' } } })
    const r = await faseDriftEInterrompidos(m.banco.supabase, m.relogio, m.yt.fetch, 4, { settle })
    return { ...m, settle, r }
  }

  it('antes de 15 s: settleOnAir é chamado com prazo = início + 55 s, seqEsperado lido, destino original e motivo drift', async () => {
    const { settle, r } = await pedirSaida({ restoreSeq: 3 })
    expect(NAO_INICIA_SETTLE_DEPOIS_MS).toBe(15_000)
    expect(settle).toHaveBeenCalledTimes(1)
    expect(settle.mock.calls[0]![0]).toBe('teste-1')
    expect(settle.mock.calls[0]![1]).toEqual({ siteId: SITE, destino: { tipo: 'original' }, motivo: 'drift', seqEsperado: 3, prazo: INICIO + 55_000 })
    expect(r).toMatchObject({ verificados: 1, pausados: 1, adiados: 0 })
  })

  it('exatamente 15 s: ainda inicia; 15 s e 1 ms: não inicia, adiados 1 e nenhuma escrita', async () => {
    const no_limite = await pedirSaida({ avancaPorChamada: 7_500 })
    expect(no_limite.settle).toHaveBeenCalledTimes(1)
    const passou = await pedirSaida({ avancaPorChamada: 7_500 }, 1)
    expect(passou.settle).not.toHaveBeenCalled()
    expect(passou.r).toMatchObject({ verificados: 1, pausados: 0, adiados: 1 })
    expect(passou.yt.escritas()).toEqual([])
    expect(passou.banco.teste().status).toBe('active')
  })
})

describe('23: drift pela imagem', () => {
  it('thumbnail: pausa, avisa, a thumbnail fica pulado_drift SEM escrever, ciclo fechado com end_reason drift', async () => {
    const { banco, yt, relogio } = montar({ noAr: IMG_C })
    const r = await faseDriftEInterrompidos(banco.supabase, relogio, yt.fetch)
    expect(r).toMatchObject({ verificados: 1, pausados: 1, falhas: 0, adiados: 0 })
    expect(banco.teste()).toMatchObject({ status: 'paused', status_note: 'Thumbnail alterado externamente', restore_seq: 1 })
    expect(banco.teste().restore_status).toMatchObject({ thumbnail: { estado: 'pulado_drift', destino: 'original', escreveu: false } })
    expect(yt.escritas()).toEqual([])
    expect(banco.cicloFechado(0)).toMatchObject({ end_reason: 'drift' })
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'youtube.drift_detected', user_id: 'owner-1', site_id: SITE, action_href: '/cms/youtube/ab-lab/teste-1' }))
  })

  it('desvio 4 (spec 3.3 linha 2): a imagem de OUTRA variante nossa no ar → pausa e o original é reescrito (escreve o destino), com aviso', async () => {
    const { banco, yt, relogio } = montar({ noAr: IMG.B })
    const r = await faseDriftEInterrompidos(banco.supabase, relogio, yt.fetch)
    expect(r).toMatchObject({ verificados: 1, pausados: 1, falhas: 0 })
    expect(banco.teste().status).toBe('paused')
    expect(banco.teste().restore_status).toMatchObject({ thumbnail: { estado: 'ok', destino: 'original', escreveu: true } })
    expect(yt.escritas()).toEqual(['thumbnails.set'])
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'youtube.drift_detected' }))
  })

  it('combo: o título volta ao original e a thumbnail fica pulado_drift', async () => {
    const { banco, yt, relogio } = montar({ testType: 'combo', noAr: IMG_C, tituloNoAr: 'Título B' })
    const r = await faseDriftEInterrompidos(banco.supabase, relogio, yt.fetch)
    expect(r.pausados).toBe(1)
    expect(yt.escritas()).toEqual(['videos.update'])
    expect(yt.titulo).toBe('Título A')
    expect(banco.teste().restore_status).toMatchObject({ title: { estado: 'ok' }, thumbnail: { estado: 'pulado_drift' } })
  })

  it('a decisão é pela imagem: distância 6 não é drift; 7 é (DHASH_MAX_SAME = 6)', async () => {
    const seis = await montar({ noAr: await imagemComDhash('f0f0f0f0f0f0f03f') }) // 6 bits de A
    expect((await faseDriftEInterrompidos(seis.banco.supabase, seis.relogio, seis.yt.fetch)).pausados).toBe(0)
    expect(seis.banco.teste().status).toBe('active')
    const sete = await montar({ noAr: await imagemComDhash('f0f0f0f0f0f0f13f') }) // 7 bits de A
    expect((await faseDriftEInterrompidos(sete.banco.supabase, sete.relogio, sete.yt.fetch)).pausados).toBe(1)
  })

  it('sem drift: o teste segue ativo e nada é escrito', async () => {
    const { banco, yt, relogio } = montar()
    expect(await faseDriftEInterrompidos(banco.supabase, relogio, yt.fetch)).toMatchObject({ verificados: 1, pausados: 0, falhas: 0 })
    expect(banco.teste()).toMatchObject({ status: 'active', restore_seq: 0 })
    expect(yt.escritas()).toEqual([])
  })

  it('título puro não entra no drift (só thumbnail e combo)', async () => {
    const { banco, yt, relogio } = montar({ testType: 'title', noAr: IMG.B })
    expect(await faseDriftEInterrompidos(banco.supabase, relogio, yt.fetch)).toMatchObject({ verificados: 0, pausados: 0 })
    expect(yt.chamadas).toEqual([])
  })

  it('Y-D13: marcador last_applied_variant_id não nulo (rotação em voo) não entra no drift', async () => {
    const { banco, yt, relogio } = montar({ noAr: IMG.B, marcador: 'B' })
    expect(await faseDriftEInterrompidos(banco.supabase, relogio, yt.fetch)).toMatchObject({ verificados: 0, pausados: 0 })
    expect(yt.chamadas).toEqual([])
    expect(banco.teste()).toMatchObject({ status: 'active', restore_seq: 0 })
  })

  it('Y-D13: o restore_seq mudou entre a detecção e o settle → não pausa e não conta falha', async () => {
    const { banco, yt, relogio } = montar({ noAr: IMG.B })
    const f = ((...a: Parameters<typeof fetch>) => { banco.setTeste({ restore_seq: 5 }); return yt.fetch(...a) }) as typeof fetch
    const r = await faseDriftEInterrompidos(banco.supabase, relogio, f)
    expect(r).toMatchObject({ verificados: 1, pausados: 0, falhas: 0 })
    expect(banco.teste()).toMatchObject({ status: 'active', restore_seq: 5 })
    expect(yt.escritas()).toEqual([])
    expect(createNotification).not.toHaveBeenCalled()
  })

  it('ciclo com menos de 3 h é pulado; com 3 h exatas é verificado', async () => {
    const novo = montar({ noAr: IMG.B })
    novo.banco.cicloAberto()!.started_at = iso(3 * 3_600_000 - 1)
    expect(await faseDriftEInterrompidos(novo.banco.supabase, novo.relogio, novo.yt.fetch)).toMatchObject({ verificados: 0, pausados: 0 })
    expect(novo.yt.chamadas).toEqual([])
    const exato = montar({ noAr: IMG.B })
    exato.banco.cicloAberto()!.started_at = iso(3 * 3_600_000)
    expect(await faseDriftEInterrompidos(exato.banco.supabase, exato.relogio, exato.yt.fetch)).toMatchObject({ verificados: 1, pausados: 1 })
  })

  it('a sonda da imagem que falha é falha do cron, nunca "sem drift"; sem base da variante também', async () => {
    const a = montar({ noAr: IMG.B })
    a.yt.atrasar('hqdefault', 10_000) // timeout da sonda
    expect(await faseDriftEInterrompidos(a.banco.supabase, a.relogio, a.yt.fetch)).toMatchObject({ verificados: 0, pausados: 0, falhas: 1 })
    expect(a.banco.teste().status).toBe('active')
    const b = montar({ noAr: IMG.B, ajustar: (vs) => { Object.assign(vs[0]!, { thumbnail_dhash: null, blob_url: 'https://abc.public.blob.vercel-storage.com/sumiu.jpg' }) } })
    expect(await faseDriftEInterrompidos(b.banco.supabase, b.relogio, b.yt.fetch)).toMatchObject({ verificados: 0, pausados: 0, falhas: 1 })
  })

  it('Y-DEVE2: o aviso de drift que não gravou ({ success: false }) é falha do cron e vai ao Sentry; o teste fica pausado', async () => {
    createNotification.mockResolvedValue({ success: false, error: 'x' })
    const { banco, yt, relogio } = montar({ noAr: IMG_C })
    const r = await faseDriftEInterrompidos(banco.supabase, relogio, yt.fetch)
    expect(r).toMatchObject({ pausados: 1, falhas: 1 })
    expect(Sentry.captureMessage).toHaveBeenCalledWith('ab-watchdog: aviso de drift não gravado', expect.anything())
    expect(banco.teste().status).toBe('paused')
  })

  it('Y-DEVE2: dedupe legítimo ({ success: true, suppressed }) não é falha', async () => {
    createNotification.mockResolvedValue({ success: true, suppressed: true })
    const { banco, yt, relogio } = montar({ noAr: IMG_C })
    expect(await faseDriftEInterrompidos(banco.supabase, relogio, yt.fetch)).toMatchObject({ pausados: 1, falhas: 0 })
  })

  it('Phil D-3: teste ativo sem ciclo aberto, ou sem vídeo, é falha (com Sentry), não "nada a verificar"', async () => {
    const a = montar({ semCiclos: true })
    expect(await faseDriftEInterrompidos(a.banco.supabase, a.relogio, a.yt.fetch)).toMatchObject({ verificados: 0, falhas: 1 })
    const b = montar()
    b.banco.setTeste({ youtube_video_id: 'sumiu' })
    expect(await faseDriftEInterrompidos(b.banco.supabase, b.relogio, b.yt.fetch)).toMatchObject({ verificados: 0, falhas: 1 })
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(2)
  })

  it('Yannis PODE 4: erro de leitura do drift não apaga o que a conversão já fez: interrompidos fica, falhas 1', async () => {
    const m = montar({ status: 'completed', restoreStatus: { thumbnail: andamento(16) }, extras: [{ id: 'T2', status: 'active' }] })
    const original = m.banco.supabase.from.bind(m.banco.supabase)
    const sb = { ...m.banco.supabase, rpc: m.banco.supabase.rpc.bind(m.banco.supabase), from: (t: string) => { if (t === 'ab_test_cycles') throw new Error('queda'); return original(t) } } as unknown as typeof m.banco.supabase
    expect(await faseDriftEInterrompidos(sb, m.relogio, m.yt.fetch)).toMatchObject({ interrompidos: 1, falhas: 1 })
  })

  it('sem YOUTUBE_API_KEY a fase roda (a regra não depende mais da chave)', async () => {
    delete process.env.YOUTUBE_API_KEY
    const { banco, yt, relogio } = montar()
    const r = await faseDriftEInterrompidos(banco.supabase, relogio, yt.fetch)
    expect(r.verificados).toBeGreaterThan(0)
  })

  it('P4a-I9: T1 completed (falhou, forçado) e T2 active no mesmo vídeo → o vigia não escreve no T1', async () => {
    const { banco, yt, relogio } = montar({
      status: 'completed', restoreStatus: { thumbnail: { ...falhouAntigo(), forcado: true } },
      extras: [{ id: 'T2', status: 'active', restore_status: null }],
    })
    banco.ciclos().push({ id: 'c-T2', test_id: 'T2', cycle_number: 0, variant_id: 'A', started_at: ONTEM, ended_at: null, end_reason: null })
    const r = await faseDriftEInterrompidos(banco.supabase, relogio, yt.fetch)
    expect(r).toMatchObject({ verificados: 1, pausados: 0 })
    expect(banco.teste().restore_seq).toBe(0)
    expect(banco.teste().restore_status).toMatchObject({ thumbnail: { estado: 'falhou', forcado: true } })
    expect(yt.escritas()).toEqual([])
  })
})

describe('interrompidos (32 D1)', () => {
  it('P4a-I4: 14 min e 15 min exatos não são tocados; 16 min vira falhou/interrompido, attempts 1, escreveu null, em igual, restore_seq + 1; um aviso', async () => {
    const velho = andamento(16)
    const m = montar({
      status: 'completed', restoreStatus: { thumbnail: velho },
      extras: [
        { id: 'quatorze', status: 'completed', restore_status: { thumbnail: andamento(14) } },
        { id: 'quinze', status: 'completed', restore_status: { thumbnail: andamento(15) } },
      ],
    })
    const antes14 = structuredClone(m.banco.outro('quatorze').restore_status)
    const antes15 = structuredClone(m.banco.outro('quinze').restore_status)
    const r = await faseDriftEInterrompidos(m.banco.supabase, m.relogio, m.yt.fetch)
    expect(r.interrompidos).toBe(1)
    expect(m.banco.outro('quatorze').restore_status).toEqual(antes14)
    expect(m.banco.outro('quatorze').restore_seq).toBe(0)
    expect(m.banco.outro('quinze').restore_status).toEqual(antes15)
    expect(m.banco.teste().restore_seq).toBe(1)
    expect(m.banco.teste().restore_status).toEqual({ thumbnail: { ...velho, estado: 'falhou', erro: 'interrompido', attempts: 1, escreveu: null } })
    expect(fanOut).toHaveBeenCalledTimes(1)
    expect(m.yt.chamadas).toEqual([]) // só banco
  })

  it('F-D2: T1 com em_andamento de 16 min e T2 draft no mesmo vídeo → T1 vira falhou/interrompido, uma linha em ab_test_restores, aviso', async () => {
    const m = montar({ status: 'completed', restoreStatus: { title: andamento(16) }, testType: 'title', extras: [{ id: 'T2', status: 'draft' }] })
    await faseDriftEInterrompidos(m.banco.supabase, m.relogio, m.yt.fetch)
    expect(m.banco.teste().restore_status).toMatchObject({ title: { estado: 'falhou', erro: 'interrompido' } })
    expect(m.banco.restores()).toHaveLength(1)
    expect(m.banco.restores()[0]).toMatchObject({ test_id: 'teste-1', campo: 'title', estado: 'falhou', seq: 1 })
    expect(fanOut).toHaveBeenCalledTimes(1)
    expect(m.banco.outro('T2')).toMatchObject({ status: 'draft', restore_seq: 0 })
  })

  it('só o campo convertido é avisado: um falhou antigo do outro campo não ganha aviso novo; o campo recente não é tocado', async () => {
    const recente = andamento(2)
    const m = montar({ testType: 'combo', status: 'paused', restoreStatus: { title: falhouAntigo(), thumbnail: andamento(20) } })
    await faseDriftEInterrompidos(m.banco.supabase, m.relogio, m.yt.fetch)
    expect(fanOut).toHaveBeenCalledTimes(1)
    expect(fanOut.mock.calls[0]![0].payload).toMatchObject({ campos: ['thumbnail'], restoreSeq: 1 })
    const m2 = montar({ testType: 'combo', status: 'paused', restoreStatus: { title: recente, thumbnail: andamento(20) } })
    await faseDriftEInterrompidos(m2.banco.supabase, m2.relogio, m2.yt.fetch)
    expect(m2.banco.teste().restore_status).toMatchObject({ title: recente, thumbnail: { estado: 'falhou' } })
  })

  it('reivindica por restore_seq: se outro escritor andou, não converte nem avisa', async () => {
    const m = montar({ status: 'completed', restoreStatus: { thumbnail: andamento(16) } })
    const f = m.banco.supabase
    const lida = f.from('ab_tests')
    void lida
    m.banco.antesDaReleitura(() => {}) // (a releitura de restore_seq não é usada aqui)
    const original = m.banco.supabase.from.bind(m.banco.supabase)
    let primeira = true
    const sb = { ...m.banco.supabase, rpc: m.banco.supabase.rpc.bind(m.banco.supabase), from: (t: string) => {
      const q = original(t)
      if (t === 'ab_tests' && primeira) { primeira = false; const then = q.then.bind(q); (q as unknown as { then: unknown }).then = (ok: never, ko: never) => then((v: { data: unknown }) => { m.banco.setTeste({ restore_seq: 9 }); return ok ? ok(v as never) : v }, ko) }
      return q
    } } as unknown as typeof m.banco.supabase
    const r = await faseDriftEInterrompidos(sb, m.relogio, m.yt.fetch)
    expect(r.interrompidos).toBe(0)
    expect(m.banco.teste().restore_seq).toBe(9)
    expect(fanOut).not.toHaveBeenCalled()
  })

  it('Phil D-2: restore_status ilegível com em_andamento é falha (com Sentry), a linha fica intocada', async () => {
    const m = montar({ status: 'completed', restoreStatus: { thumbnail: { estado: 'em_andamento', em: 'x' } } })
    const antes = structuredClone(m.banco.teste().restore_status)
    const r = await faseDriftEInterrompidos(m.banco.supabase, m.relogio, m.yt.fetch)
    expect(r).toMatchObject({ falhas: 1, interrompidos: 0 })
    expect(Sentry.captureMessage).toHaveBeenCalledWith('ab-watchdog: restore_status ilegível', expect.anything())
    expect(m.banco.teste().restore_status).toEqual(antes)
    expect(m.banco.teste().restore_seq).toBe(0)
  })

  it('D14: falhou de ontem NÃO gera aviso hoje, nem amanhã (sem lembrete diário)', async () => {
    const m = montar({ status: 'completed', restoreStatus: { thumbnail: falhouAntigo() } })
    await faseDriftEInterrompidos(m.banco.supabase, m.relogio, m.yt.fetch)
    m.avancar(86_400_000)
    vi.setSystemTime(new Date(AGORA.getTime() + 86_400_000))
    await faseDriftEInterrompidos(m.banco.supabase, m.relogio, m.yt.fetch)
    expect(fanOut).not.toHaveBeenCalled()
    expect(createNotification).not.toHaveBeenCalled()
    expect(m.banco.teste().restore_seq).toBe(0)
  })

  it('sem destinatário no aviso: semDestinatario true; envio que falhou com destinatários: falhas, não semDestinatario', async () => {
    fanOut.mockResolvedValue({ total: 0, sent: 0, suppressed: 0, errors: [] })
    const a = montar({ status: 'completed', restoreStatus: { thumbnail: andamento(16) } })
    expect(await faseDriftEInterrompidos(a.banco.supabase, a.relogio, a.yt.fetch)).toMatchObject({ interrompidos: 1, semDestinatario: true, falhas: 0 })
    fanOut.mockResolvedValue({ total: 2, sent: 0, suppressed: 0, errors: ['x'] })
    const b = montar({ status: 'completed', restoreStatus: { thumbnail: andamento(16) } })
    expect(await faseDriftEInterrompidos(b.banco.supabase, b.relogio, b.yt.fetch)).toMatchObject({ interrompidos: 1, semDestinatario: false, falhas: 1 })
  })
})

// ---- a rota inteira -------------------------------------------------------
const TABELAS_DO_BANCO = ['ab_tests', 'ab_test_variants', 'ab_test_cycles', 'youtube_videos', 'ab_test_restores', 'ops_alert_state']
function clienteDaRota(banco: ReturnType<typeof criarBanco>) {
  const apagados: string[] = []
  const stub = (tabela: string) => {
    const c: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'lt', 'gt', 'in', 'is', 'not', 'order', 'range', 'limit', 'update', 'insert', 'upsert', 'maybeSingle', 'single']) c[m] = () => c
    c.delete = () => { apagados.push(tabela); return c }
    c.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(r)
    return c
  }
  const cliente = {
    from: (t: string) => (TABELAS_DO_BANCO.includes(t) ? banco.supabase.from(t) : stub(t)),
    rpc: banco.supabase.rpc.bind(banco.supabase),
  }
  return { cliente, apagouPolls: () => apagados.includes('ab_test_polls') }
}
const pedido = () => new NextRequest('http://localhost/api/cron/ab-watchdog', { headers: { authorization: 'Bearer s' } })

describe('a rota', () => {
  beforeEach(() => { getCronHealth.mockResolvedValue({ last_success_at: AGORA.toISOString() }) })

  it('P4a-I17: a sonda da imagem falha → a poda de ab_test_polls roda, drift.falhas = 1, recordCronFailure chamado, 200 sem status "ok" mudo', async () => {
    const m = montar({ noAr: IMG.B })
    m.yt.atrasar('hqdefault', 10_000)
    vi.stubGlobal('fetch', m.yt.fetch)
    const { cliente, apagouPolls } = clienteDaRota(m.banco)
    servicoAtual.cliente = cliente
    const res = await GET(pedido())
    const j = await res.json()
    expect(res.status).toBe(200)
    expect(apagouPolls()).toBe(true)
    expect(j.drift).toEqual({ verificados: 0, pausados: 0, falhas: 1 })
    expect(recordCronFailure).toHaveBeenCalledWith('ab-watchdog', expect.any(String))
    expect(recordCronSuccess).not.toHaveBeenCalled()
    expect(j.status).not.toBe('ok')
    expect(m.banco.teste().status).toBe('active')
  })

  it('P4a-I18 (rota): 6 testes, o relógio da rota passa de 15 s → adiados 4 na resposta e recordCronFailure', async () => {
    const m = montar({ total: 6 })
    const yt = new YouTubeFalso({ titulo: 'Título A', thumb: IMG.A, blobs: {}, relogio: { avancar: (ms) => vi.setSystemTime(new Date(Date.now() + ms)) }, avancaPorChamada: 10_000 })
    vi.stubGlobal('fetch', yt.fetch)
    servicoAtual.cliente = clienteDaRota(m.banco).cliente
    const j = await (await GET(pedido())).json()
    expect(j.drift).toMatchObject({ verificados: 2 })
    expect(j.adiados).toBe(4)
    expect(recordCronFailure).toHaveBeenCalled()
    expect(j.status).not.toBe('ok')
  })

  it('tudo certo: status ok, drift em linha própria, recordCronSuccess e nada de recordCronFailure', async () => {
    const m = montar()
    vi.stubGlobal('fetch', m.yt.fetch)
    servicoAtual.cliente = clienteDaRota(m.banco).cliente
    const j = await (await GET(pedido())).json()
    expect(j).toMatchObject({ status: 'ok', drift: { verificados: 1, pausados: 0, falhas: 0 } })
    expect(j).not.toHaveProperty('adiados')
    expect(recordCronSuccess).toHaveBeenCalledWith('ab-watchdog', 'info')
    expect(recordCronFailure).not.toHaveBeenCalled()
  })

  it('a fase que lança vira falhas 1 (ResultadoDrift válido), nunca 500 nem "ok"', async () => {
    const m = montar()
    const { cliente } = clienteDaRota(m.banco)
    servicoAtual.cliente = { ...cliente, from: (t: string) => { if (t === 'ab_test_cycles') throw new Error('queda'); return cliente.from(t) } }
    vi.stubGlobal('fetch', m.yt.fetch)
    const res = await GET(pedido())
    expect(res.status).toBe(200)
    expect((await res.json()).drift).toEqual({ verificados: 0, pausados: 0, falhas: 1 })
    expect(recordCronFailure).toHaveBeenCalled()
  })

  it('P4a-I19: aviso sem destinatário (total 0) → SEM_DESTINATARIO na resposta e recordCronFailure; envio que falhou (sent 0, total > 0) é falha do cron, não "sem destinatário"', async () => {
    fanOut.mockResolvedValue({ total: 0, sent: 0, suppressed: 0, errors: [] })
    const a = montar({ status: 'completed', restoreStatus: { thumbnail: andamento(16) } })
    vi.stubGlobal('fetch', a.yt.fetch)
    servicoAtual.cliente = clienteDaRota(a.banco).cliente
    const ja = await (await GET(pedido())).json()
    expect(ja.avisos[SEM_DESTINATARIO]).toBe(1)
    expect(ja.status).not.toBe('ok')
    expect(recordCronFailure).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()
    getCronHealth.mockResolvedValue({ last_success_at: AGORA.toISOString() })
    fanOut.mockResolvedValue({ total: 2, sent: 0, suppressed: 0, errors: ['boom'] })
    const b = montar({ status: 'completed', restoreStatus: { thumbnail: andamento(16) } })
    vi.stubGlobal('fetch', b.yt.fetch)
    servicoAtual.cliente = clienteDaRota(b.banco).cliente
    const jb = await (await GET(pedido())).json()
    expect(jb.avisos).not.toHaveProperty(SEM_DESTINATARIO)
    expect(jb.drift.falhas).toBe(1)
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
  })

  it('interrompidos entram na resposta', async () => {
    const m = montar({ status: 'completed', restoreStatus: { thumbnail: andamento(16) } })
    vi.stubGlobal('fetch', m.yt.fetch)
    servicoAtual.cliente = clienteDaRota(m.banco).cliente
    const j = await (await GET(pedido())).json()
    expect(j.interrompidos).toBe(1)
    expect(j.status).toBe('ok')
  })
})
