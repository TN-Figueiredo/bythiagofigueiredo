// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { YouTubeFalso } from '../helpers/youtube-falso'
import { AGORA, BLOB, IMG, SITE, criarBanco } from '../helpers/banco-ab'
import type { Fila, OpcoesBanco } from '../helpers/banco-ab'

const { fanOut, ensureFreshToken, preflight, canal } = vi.hoisted(() => ({
  fanOut: vi.fn(), ensureFreshToken: vi.fn(), preflight: vi.fn(), canal: vi.fn(),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: fanOut }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: preflight }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/youtube/channel-account', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/channel-account')>()),
  channelAccountIdForVideo: canal,
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { throw new Error('serviço real não é para testes') } }))

import { phaseRotateActiveTests } from '@/lib/youtube/ab-rotate-phases'
import { reivindicarRotacao, aplicarRotacao } from '@/lib/youtube/ab-rotate-claim'
import { settleOnAir, ORIGINAL } from '@/lib/youtube/ab-settle'
import { getNextVariantIndex } from '@/lib/youtube/ab-rotation'

async function montar(o: OpcoesBanco = {}) {
  const banco = criarBanco(o)
  const yt = new YouTubeFalso({ titulo: 'Título A', thumb: IMG.A, blobs: { [BLOB('A')]: IMG.A, [BLOB('B')]: IMG.B } })
  vi.stubGlobal('fetch', yt.fetch)
  const portas = { supabase: banco.supabase, agora: () => AGORA, fetch: yt.fetch, token: async () => 'tok', autoImportWinner: vi.fn(async () => {}) }
  const args = {
    testId: 'teste-1', siteId: SITE, testName: 'Teste do Lab', seq: 1, youtubeVideoId: 'yt-1', accessToken: 'tok',
    testType: (o.testType ?? 'thumbnail') as 'thumbnail' | 'title' | 'combo', variante: banco.variantes()[1]!, originalTitle: 'Título A', cycleNumber: 1,
  }
  return { banco, yt, portas, args }
}

const avisos = { enviados: () => fanOut.mock.calls.map((c) => c[0] as { title: string; message: string; dedupKey: string }) }
const pausar = (c: Awaited<ReturnType<typeof montar>>) => settleOnAir('teste-1', { siteId: SITE, destino: ORIGINAL, motivo: 'pausa' }, c.portas)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
  preflight.mockResolvedValue({ ok: true, accessToken: 'tok' })
  canal.mockResolvedValue('UC1')
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('reivindicarRotacao', () => {
  it('reivindica: restore_seq +1, marcador = próxima, devolve o seq', async () => {
    const { banco } = await montar()
    const seq = await reivindicarRotacao(banco.supabase, 'teste-1', 0, 'B', null)
    expect(seq).toBe(1)
    expect(banco.teste()).toMatchObject({ restore_seq: 1, last_applied_variant_id: 'B' })
  })
  it('22: a rotação leu o teste, o dono pausa antes do reivindicarRotacao → não escreve nem abre ciclo', async () => {
    const c = await montar()
    const lido = { ...c.banco.teste() }                                     // retrato velho
    await pausar(c)
    const seq = await reivindicarRotacao(c.banco.supabase, 'teste-1', lido.restore_seq, 'B', null)
    expect(seq).toBeNull()
    expect(c.yt.escritas()).toEqual([])
    expect(c.banco.ciclosAbertos()).toHaveLength(0)
  })
  it('pausa e retomada depois da leitura (ativo de novo, marcador limpo): só o restore_seq barra a rotação com retrato velho', async () => {
    const { banco } = await montar()
    banco.setTeste({ restore_seq: 2 })
    expect(await reivindicarRotacao(banco.supabase, 'teste-1', 0, 'B', null)).toBeNull()
    expect(banco.teste()).toMatchObject({ restore_seq: 2, last_applied_variant_id: null })
  })
  it('marcador sujo sem o marcadorLido certo → zero linhas; com o marcador exato → reivindica (R2-7)', async () => {
    const { banco } = await montar({ marcador: 'B' })
    expect(await reivindicarRotacao(banco.supabase, 'teste-1', 0, 'A', null)).toBeNull()
    expect(await reivindicarRotacao(banco.supabase, 'teste-1', 0, 'A', 'X')).toBeNull()
    expect(await reivindicarRotacao(banco.supabase, 'teste-1', 0, 'A', 'B')).toBe(1)
  })
})

describe('aplicarRotacao', () => {
  it('(a) pausa entre a escrita da rotação e o fecho → nenhum ciclo aberto, Sentry e aviso', async () => {
    const c = await montar()
    await reivindicarRotacao(c.banco.supabase, 'teste-1', 0, 'B', null)
    let uma = false
    c.yt.depoisDeEscrever(async () => { if (uma) return; uma = true; await pausar(c) })
    const r = await aplicarRotacao(c.banco.supabase, c.args)
    expect(r).toMatchObject({ ok: false, motivo: 'cruzou_com_pausa' })
    expect(c.banco.ciclosAbertos()).toHaveLength(0)
    expect(Sentry.captureMessage).toHaveBeenCalledWith('ab-rotate: reivindicação perdida depois da escrita', expect.anything())
    expect(avisos.enviados()[0]!.message).toMatch(/a rotação e uma pausa se cruzaram/)
    expect(avisos.enviados()[0]!.message).toContain('yt-1')
  })
  it('o aviso falha (fan-out lança): o resultado continua cruzou_com_pausa e o erro vai ao Sentry', async () => {
    const c = await montar()
    await reivindicarRotacao(c.banco.supabase, 'teste-1', 0, 'B', null)
    let uma = false
    c.yt.depoisDeEscrever(async () => { if (uma) return; uma = true; await pausar(c) })
    fanOut.mockRejectedValueOnce(new Error('ntfy fora'))
    const r = await aplicarRotacao(c.banco.supabase, c.args)
    expect(r).toMatchObject({ ok: false, motivo: 'cruzou_com_pausa' })
    expect(Sentry.captureException).toHaveBeenCalled()
  })
  it('Y-D8: combo, pausa reivindica depois da thumbnail da rotação → o título da rotação não é escrito', async () => {
    const c = await montar({ testType: 'combo' })
    await reivindicarRotacao(c.banco.supabase, 'teste-1', 0, 'B', null)
    let uma = false
    c.yt.depoisDeEscrever(async (ch) => { if (uma || ch !== 'thumbnails.set') return; uma = true; await pausar(c) })
    const antes = c.yt.escritas().length
    const r = await aplicarRotacao(c.banco.supabase, { ...c.args, testType: 'combo' })
    expect(r).toMatchObject({ ok: false, motivo: 'perdeu_a_vez' })
    // a rotação escreveu só a thumbnail; as escritas seguintes são da própria pausa
    expect(c.yt.escritas().slice(antes, antes + 1)).toEqual(['thumbnails.set'])
    expect(c.yt.titulo).toBe('Título A')
    expect(c.banco.ciclosAbertos()).toHaveLength(0)
  })
  it('Y-D8: pausa ANTES da primeira escrita → nada é escrito pela rotação', async () => {
    const c = await montar({ testType: 'combo' })
    await reivindicarRotacao(c.banco.supabase, 'teste-1', 0, 'B', null)
    c.banco.setTeste({ restore_seq: 5 })
    const r = await aplicarRotacao(c.banco.supabase, c.args)
    expect(r).toMatchObject({ ok: false, motivo: 'perdeu_a_vez' })
    expect(c.yt.escritas()).toEqual([])
  })
  it('sucesso: fecha com rotacao, views e likes do último poll, abre o ciclo e devolve o id', async () => {
    const c = await montar()
    c.banco.setPoll({ views: 120, likes: 9 })
    await reivindicarRotacao(c.banco.supabase, 'teste-1', 0, 'B', null)
    const r = await aplicarRotacao(c.banco.supabase, c.args)
    expect(r).toMatchObject({ ok: true })
    expect(c.banco.cicloFechado(0)).toMatchObject({ end_reason: 'rotacao', views: 120, likes: 9 })
    expect(c.banco.cicloAberto()).toMatchObject({ cycle_number: 1, variant_id: 'B' })
  })
  it('YouTube recusa: devolve motivo youtube com o erro e o que foi escrito', async () => {
    const c = await montar()
    c.yt.recusar('thumbnails.set', 403, 'forbidden')
    await reivindicarRotacao(c.banco.supabase, 'teste-1', 0, 'B', null)
    const r = await aplicarRotacao(c.banco.supabase, c.args)
    expect(r).toMatchObject({ ok: false, motivo: 'youtube', appliedThumbnail: false, appliedMetadata: false })
    if (r.ok === false && r.motivo === 'youtube') expect(r.erro.message).toMatch(/403/)
    expect(c.banco.ciclosAbertos()).toHaveLength(1)
  })
})

describe('phaseRotateActiveTests', () => {
  it('(b) dois ab-rotate simultâneos → uma escrita no YouTube', async () => {
    const c = await montar()
    await Promise.all([phaseRotateActiveTests(c.banco.supabase), phaseRotateActiveTests(c.banco.supabase)])
    expect(c.yt.escritas()).toHaveLength(1)
    expect(c.banco.teste().restore_seq).toBe(1)
  })
  it('rotação feliz: reivindica, escreve e abre o ciclo 1 com a variante B', async () => {
    const c = await montar()
    const r = await phaseRotateActiveTests(c.banco.supabase)
    expect(r).toEqual({ processed: 1, errors: 0 })
    expect(c.banco.teste()).toMatchObject({ restore_seq: 1, last_applied_variant_id: null })
    expect(c.banco.cicloAberto()).toMatchObject({ variant_id: 'B', cycle_number: 1 })
  })
  it('Y-D9: 403 sem escrita → marcador nulo e restore_seq mantido', async () => {
    const c = await montar()
    c.yt.recusar('thumbnails.set', 403, 'forbidden')
    await phaseRotateActiveTests(c.banco.supabase)
    expect(c.banco.teste()).toMatchObject({ last_applied_variant_id: null, restore_seq: 1 })
    expect(Sentry.captureMessage).not.toHaveBeenCalledWith(expect.stringContaining('marker'), expect.anything())
  })
  it('Y-D9: escrita parcial (combo: thumbnail foi, título 403) → marcador mantido', async () => {
    const c = await montar({ testType: 'combo' })
    c.yt.recusar('videos.update', 403, 'forbidden')
    await phaseRotateActiveTests(c.banco.supabase)
    expect(c.yt.escritas()).toContain('thumbnails.set')
    expect(c.banco.teste()).toMatchObject({ last_applied_variant_id: 'B', restore_seq: 1 })
    expect(c.banco.ciclosAbertos()).toHaveLength(1)
    expect(c.banco.cicloAberto()).toMatchObject({ cycle_number: 0 })
  })
  it('P4a-I8: marcador velho (queda anterior) → reivindica por restore_seq e segue no mesmo dia', async () => {
    const c = await montar({ marcador: 'B', restoreSeq: 4 })
    await phaseRotateActiveTests(c.banco.supabase)
    expect(c.yt.escritas().length).toBeGreaterThan(0)
    expect(c.banco.teste()).toMatchObject({ restore_seq: 5, last_applied_variant_id: null })
    expect(c.banco.cicloAberto()).toMatchObject({ cycle_number: 1 })
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('write-ahead marker'), 'warning')
  })
  it('fecho com end_reason rotacao, views e likes do último poll; consecutive_failures zera', async () => {
    const c = await montar({ config: { rotation_pattern: 'abba', consecutive_failures: 2 } })
    c.banco.setPoll({ views: 120, likes: 9 })
    await phaseRotateActiveTests(c.banco.supabase)
    expect(c.banco.cicloFechado(0)).toMatchObject({ end_reason: 'rotacao', views: 120, likes: 9 })
    expect((c.banco.teste().config as Fila).consecutive_failures).toBe(0)
  })
  it('a pausa reivindica entre a leitura e o reivindicarRotacao → fase não escreve, não abre ciclo, sem erro', async () => {
    const c = await montar()
    canal.mockImplementationOnce(async () => { c.banco.setTeste({ status: 'paused', restore_seq: 3 }); return 'UC1' })
    const r = await phaseRotateActiveTests(c.banco.supabase)
    expect(r.errors).toBe(0)
    expect(c.yt.escritas()).toEqual([])
    expect(c.banco.ciclosAbertos()).toHaveLength(1)
  })
  it('ABBA com 2 variantes: depois do ciclo 0 (A), o ciclo 1 é B', async () => {
    expect(getNextVariantIndex('abba', 2, 1)).toBe(1)
    const c = await montar()
    await phaseRotateActiveTests(c.banco.supabase)
    expect(c.banco.cicloAberto()).toMatchObject({ variant_id: 'B' })
  })
})

// ---------------------------------------------------------------------------
// Rodada 1 da T9 (pareceres de Yannis e Phil)
// ---------------------------------------------------------------------------
describe('R1 Yannis DEVE-1: marcador só é velho com idade (MARCADOR_VELHO_MS = 360 s)', () => {
  it('(i) A reivindica; B roda DEPOIS, antes de A fechar → B não escreve, não alarma, nenhum ciclo novo', async () => {
    const c = await montar()
    await reivindicarRotacao(c.banco.supabase, 'teste-1', 0, 'B', null)          // A em voo: restore_seq 1, marcador B, updated_at = agora
    const r = await phaseRotateActiveTests(c.banco.supabase)
    expect(r).toEqual({ processed: 0, errors: 0 })
    expect(c.yt.escritas()).toEqual([])
    expect(fanOut).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(c.banco.ciclosAbertos()).toHaveLength(1)
    expect(c.banco.teste()).toMatchObject({ restore_seq: 1, last_applied_variant_id: 'B' })
  })
  it('(ii) marcador com 7 min de idade (> 360 s) → reivindica e rotaciona', async () => {
    const c = await montar({ marcador: 'B', restoreSeq: 4, atualizadoHaMs: 7 * 60_000 })
    await phaseRotateActiveTests(c.banco.supabase)
    expect(c.yt.escritas().length).toBeGreaterThan(0)
    expect(c.banco.teste()).toMatchObject({ restore_seq: 5, last_applied_variant_id: null })
  })
  it('marcador com 6 min cravados menos 1 s (359 s) ainda é de rotação viva; reivindicarRotacao direto devolve null', async () => {
    const c = await montar({ marcador: 'B', restoreSeq: 4, atualizadoHaMs: 359_000 })
    expect(await reivindicarRotacao(c.banco.supabase, 'teste-1', 4, 'B', 'B')).toBeNull()
    expect(c.banco.teste()).toMatchObject({ restore_seq: 4, last_applied_variant_id: 'B' })
  })
})

describe('R1 Phil I-1: variante da vez sem conteúdo não é reivindicada nem escrita', () => {
  function original(c: Awaited<ReturnType<typeof montar>>) { return c.banco.variantes()[0]! }
  const semEscrita = (c: Awaited<ReturnType<typeof montar>>) => {
    expect(c.yt.escritas()).toEqual([])
    expect(c.banco.ciclosAbertos()).toHaveLength(1)
    expect(c.banco.teste()).toMatchObject({ restore_seq: 0, last_applied_variant_id: null })
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('variante sem arquivo/título'), expect.anything())
    expect(avisos.enviados()).toHaveLength(1)
    expect(avisos.enviados()[0]!.message).toContain('Teste do Lab')
  }
  it('original cuja cópia é um i.ytimg (devolve a thumbnail CORRENTE) → pula com Sentry e aviso', async () => {
    // abba: com 1 ciclo fechado antes, a vez cai na original (índice 0)
    const vezDaOriginal = [0, 1, 2, 3].find((n) => getNextVariantIndex('abba', 2, n + 1) === 0)!
    const c = await montar({ ciclosFechados: vezDaOriginal, ajustar: (v) => { v[0]!.blob_url = 'https://i.ytimg.com/vi/yt-1/hqdefault.jpg' } })
    const r = await phaseRotateActiveTests(c.banco.supabase)
    expect(r.errors).toBe(1)
    expect(original(c).is_original).toBe(true)
    expect(c.yt.escritas()).toEqual([])
    expect(c.banco.teste()).toMatchObject({ restore_seq: 0, last_applied_variant_id: null })
    expect(avisos.enviados()).toHaveLength(1)
  })
  it('variante B sem blob_url, teste de thumbnail → pula', async () => {
    const c = await montar({ ajustar: (v) => { v[1]!.blob_url = null } })
    await phaseRotateActiveTests(c.banco.supabase)
    semEscrita(c)
  })
  it('variante B com title_text vazio, teste de título → pula (nunca escreve o título original no ciclo da B)', async () => {
    const c = await montar({ testType: 'title', ajustar: (v) => { v[1]!.title_text = '   ' } })
    await phaseRotateActiveTests(c.banco.supabase)
    semEscrita(c)
  })
})

describe('R1 Phil I-2: perdeu a vez DEPOIS de escrever avisa o dono', () => {
  it('combo: a pausa reivindica depois da thumbnail → perdeu_a_vez com aviso do cruzamento', async () => {
    const c = await montar({ testType: 'combo' })
    await reivindicarRotacao(c.banco.supabase, 'teste-1', 0, 'B', null)
    let uma = false
    c.yt.depoisDeEscrever(async (ch) => { if (uma || ch !== 'thumbnails.set') return; uma = true; await pausar(c) })
    const r = await aplicarRotacao(c.banco.supabase, { ...c.args, testType: 'combo' })
    expect(r).toMatchObject({ ok: false, motivo: 'perdeu_a_vez' })
    expect(avisos.enviados().map((a) => a.message).join('|')).toMatch(/a rotação e uma pausa se cruzaram/)
  })
})

describe('R1 Yannis PODE-1: os dois guardas que só um cenário próprio prova', () => {
  it('restore_seq é a ÚNICA guarda: A reivindica E fecha (marcador limpo), B reivindica com o retrato velho → null, zero escrita de B', async () => {
    const c = await montar()
    const seq = await reivindicarRotacao(c.banco.supabase, 'teste-1', 0, 'B', null)
    expect(await aplicarRotacao(c.banco.supabase, { ...c.args, seq: seq! })).toMatchObject({ ok: true })
    const escritasDeA = c.yt.escritas().length
    expect(c.banco.teste()).toMatchObject({ last_applied_variant_id: null, restore_seq: 1 })
    expect(await reivindicarRotacao(c.banco.supabase, 'teste-1', 0, 'B', null)).toBeNull()
    expect(c.yt.escritas()).toHaveLength(escritasDeA)
  })
  it('status é a guarda contra pausa que NÃO sobe o restore_seq (auto-pause do catch, tipo fora de uso)', async () => {
    const c = await montar()
    c.banco.setTeste({ status: 'paused' })
    expect(await reivindicarRotacao(c.banco.supabase, 'teste-1', 0, 'B', null)).toBeNull()
    expect(c.banco.teste()).toMatchObject({ restore_seq: 0, last_applied_variant_id: null })
  })
})

describe('R1 Yannis PODE-3: a releitura do restore_seq lança', () => {
  it('erro de banco na releitura → nada escrito, marcador liberado, conta como erro', async () => {
    const c = await montar()
    c.banco.antesDaReleitura(() => { throw new Error('banco fora') })
    const r = await phaseRotateActiveTests(c.banco.supabase)
    expect(r.errors).toBe(1)
    expect(c.yt.escritas()).toEqual([])
    expect(c.banco.teste()).toMatchObject({ last_applied_variant_id: null, restore_seq: 1 })
  })
})

describe('R1 Phil M-1: o corte do laço conta o tempo da fila', () => {
  it('a rota já gastou 200 s (fila) → faltam 40 s < 50 s: o teste fica para amanhã, com Sentry', async () => {
    const c = await montar()
    const r = await phaseRotateActiveTests(c.banco.supabase, AGORA.getTime() - 200_000)
    expect(r).toEqual({ processed: 0, errors: 0 })
    expect(c.yt.escritas()).toEqual([])
    expect(c.banco.teste().restore_seq).toBe(0)
    expect(Sentry.captureMessage).toHaveBeenCalledWith('ab-rotate: rotação adiada por tempo', expect.anything())
  })
  it('a rota gastou 100 s → rotaciona normalmente', async () => {
    const c = await montar()
    const r = await phaseRotateActiveTests(c.banco.supabase, AGORA.getTime() - 100_000)
    expect(r).toEqual({ processed: 1, errors: 0 })
  })
})

describe('R1 Phil M-2: poll mais velho que o ciclo aberto não vira "medido em zero"', () => {
  it('poll de antes de o ciclo aberto começar → o fecho leva views/likes nulos', async () => {
    const c = await montar()
    c.banco.setPoll({ views: 500, likes: 40, polled_at: '2026-10-09T00:00:00.000Z' }) // ciclo aberto começou em ONTEM (11/10)
    await reivindicarRotacao(c.banco.supabase, 'teste-1', 0, 'B', null)
    expect(await aplicarRotacao(c.banco.supabase, c.args)).toMatchObject({ ok: true })
    expect(c.banco.cicloFechado(0)).toMatchObject({ end_reason: 'rotacao', views: null, likes: null })
  })
})
