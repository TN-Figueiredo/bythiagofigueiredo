// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { settleOnAir, novaTentativa, ORIGINAL, NOTA_TESTE_YOUTUBE, TEXTO_SEM_LEITURA } from '@/lib/youtube/ab-settle'
import type { Retrato, PortasSaida } from '@/lib/youtube/ab-settle'
import type { RestoreStatus } from '@/lib/youtube/ab-restore'
import { camposPendentes } from '@/lib/youtube/ab-restore'
import { fakeSupabase } from '../helpers/fake-supabase'
import type { Row } from '../helpers/fake-supabase'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
const { lerSnippetMock } = vi.hoisted(() => ({ lerSnippetMock: vi.fn() }))
vi.mock('@/lib/youtube/ab-metadata', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/ab-metadata')>()), lerSnippet: lerSnippetMock }))
vi.mock('@/lib/youtube/ab-video-context', () => ({
  resolveVideoChannel: async () => ({ ok: true, channelAccountId: 'canal-1' }),
  resolveYouTubeVideoId: async () => 'yt-1',
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { throw new Error('serviço real não é para testes') } }))

const T0 = new Date('2026-10-21T12:00:00.000Z')
const SITE = 'site-1'
const campo = (estado: string, extra: Record<string, unknown> = {}) => ({
  estado, destino: 'original', forcado: false, escreveu: true, erro: null, attempts: 0,
  em: new Date(T0.getTime() - 86_400_000).toISOString(), ...extra,
})

function retrato(o: Partial<Retrato> = {}): Retrato {
  return {
    id: 't1', site_id: SITE, name: 'T', test_type: 'combo', status: 'active', status_note: null, restore_seq: 3, restore_status: null,
    original_title: 'Original', original_thumbnail_url: null, last_applied_variant_id: 'vB', winner_applied_at: null, revert_expires_at: null,
    youtube_video_id: 'v-int',
    variantes: [
      { id: 'vA', is_original: true, blob_url: null, title_text: 'Original', thumbnail_dhash: null },
      { id: 'vB', is_original: false, blob_url: null, title_text: 'Título B', thumbnail_dhash: null },
    ],
    inicioUltimoCiclo: null, ...o,
  }
}

function montar(r: Retrato, opts: { claimVazio?: boolean; statusDepois?: string; nativas?: Row[]; falhaNativas?: boolean } = {}) {
  const nativas = fakeSupabase({ ab_native_tests: opts.nativas ?? [] }, opts.falhaNativas ? { failOn: 'ab_native_tests' } : {})
  const rpc = vi.fn(async (_n: string, a: Record<string, unknown>) => (opts.claimVazio ? { data: [], error: null } : { data: [{ claimed_seq: Number(a.p_seq) + 1 }], error: null }))
  const from = vi.fn((tabela: string) => tabela === 'ab_native_tests' ? nativas.client.from(tabela) : ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: opts.statusDepois ?? 'completed' }, error: null }), eq: () => ({ neq: () => ({ in: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }) }) }))
  const proibida = (nome: string) => vi.fn(() => { throw new Error(`porta proibida: ${nome}`) })
  const token = proibida('token')
  const fetchFn = proibida('fetch')
  const autoImportWinner = proibida('autoImportWinner')
  const portas = {
    supabase: { rpc, from } as unknown as SupabaseClient, agora: () => T0,
    fetch: fetchFn as unknown as typeof fetch, token: token as unknown as PortasSaida['token'],
    autoImportWinner: autoImportWinner as unknown as PortasSaida['autoImportWinner'],
    lerRetrato: async () => r,
  } satisfies Partial<PortasSaida>
  const op = { siteId: SITE, destino: ORIGINAL, motivo: 'teste_youtube' as const }
  return { rpc, from, token, fetchFn, portas, op, nativas }
}

describe('settleOnAir motivo teste_youtube', () => {
  it('(a) active: pausa definitiva, todos os campos pulados, zero porta externa', async () => {
    const m = montar(retrato())
    const res = await settleOnAir('t1', m.op, m.portas)
    expect(res.resultado).toBe('feito')
    expect(m.rpc).toHaveBeenCalledTimes(1)
    const [nome, a] = m.rpc.mock.calls[0]!
    expect(nome).toBe('ab_settle_claim')
    expect(a).toMatchObject({ p_para: 'paused', p_end_reason: 'teste_youtube', p_de: ['active', 'paused'], p_seq: 3, p_extra: { status_note: NOTA_TESTE_YOUTUBE } })
    const rs = a.p_restore_status as RestoreStatus
    for (const c of ['title', 'thumbnail'] as const) expect(rs[c]).toMatchObject({ estado: 'pulado_teste_youtube', escreveu: false, attempts: 0 })
    expect(m.token).not.toHaveBeenCalled(); expect(m.fetchFn).not.toHaveBeenCalled()
  })

  it('(b) paused com restore falhou pendente vira pulado; (g) vigia não tem mais pendente', async () => {
    const rs = { title: campo('falhou', { escreveu: false, attempts: 1 }), thumbnail: campo('falhou', { escreveu: false, attempts: 1 }) } as unknown as RestoreStatus
    const m = montar(retrato({ status: 'paused', restore_status: rs }))
    const res = await settleOnAir('t1', m.op, m.portas)
    expect(res.resultado).toBe('feito')
    if (res.resultado !== 'feito') return
    expect(res.campos.title?.estado).toBe('pulado_teste_youtube')
    expect(camposPendentes(res.campos, 'vigia')).toEqual([])
    expect(camposPendentes(res.campos, 'humano')).toEqual([])
  })

  it('(c) seqEsperado velho: humano = mudou, cron = em_andamento; nada gravado', async () => {
    const m = montar(retrato())
    expect((await settleOnAir('t1', { ...m.op, seqEsperado: 1, humano: true }, m.portas)).resultado).toBe('mudou')
    expect((await settleOnAir('t1', { ...m.op, seqEsperado: 1 }, m.portas)).resultado).toBe('em_andamento')
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it('(d) restore em_andamento recente: em_andamento, nada gravado', async () => {
    const rs = { title: campo('em_andamento', { escreveu: null, em: new Date(T0.getTime() - 30_000).toISOString() }) } as unknown as RestoreStatus
    const m = montar(retrato({ restore_status: rs }))
    expect((await settleOnAir('t1', m.op, m.portas)).resultado).toBe('em_andamento')
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it('(e) com B no ar: mesmo resultado, zero escrita', async () => {
    const m = montar(retrato({ last_applied_variant_id: 'vB' }))
    expect((await settleOnAir('t1', m.op, m.portas)).resultado).toBe('feito')
    expect(m.token).not.toHaveBeenCalled(); expect(m.fetchFn).not.toHaveBeenCalled()
  })

  it('(h) token que lançaria: ainda feito (curto-circuito antes de resolverAcesso)', async () => {
    const m = montar(retrato())
    const res = await settleOnAir('t1', m.op, m.portas)
    expect(res.resultado).toBe('feito')
    expect(m.token).not.toHaveBeenCalled()
  })

  it('(i) CAS perdido: em_andamento ou ja_encerrado, nada devolvido como feito', async () => {
    const a = montar(retrato(), { claimVazio: true, statusDepois: 'active' })
    expect((await settleOnAir('t1', a.op, a.portas)).resultado).toBe('em_andamento')
    const b = montar(retrato(), { claimVazio: true, statusDepois: 'completed' })
    expect((await settleOnAir('t1', b.op, b.portas)).resultado).toBe('ja_encerrado')
  })

  it('(j) title ok/escreveu:true + thumbnail falhou: title fica, thumbnail vira pulado', async () => {
    const rs = { title: campo('ok'), thumbnail: campo('falhou', { escreveu: false, attempts: 1 }) } as unknown as RestoreStatus
    const m = montar(retrato({ status: 'paused', restore_status: rs }))
    const res = await settleOnAir('t1', m.op, m.portas)
    if (res.resultado !== 'feito') throw new Error('esperava feito')
    expect(res.campos.title).toMatchObject({ estado: 'ok', escreveu: true })
    expect(res.campos.thumbnail).toMatchObject({ estado: 'pulado_teste_youtube', escreveu: false })
  })

  it('status fora de active/paused (completed): ja_encerrado', async () => {
    const m = montar(retrato({ status: 'completed' }))
    expect((await settleOnAir('t1', m.op, m.portas)).resultado).toBe('ja_encerrado')
    expect(m.rpc).not.toHaveBeenCalled()
  })
})

describe('encerrado depois de teste_youtube', () => {
  it('(l) a nota de guarda é limpa no encerramento; outra nota fica intacta', async () => {
    const rs = { title: campo('pulado_teste_youtube', { escreveu: false }), thumbnail: campo('pulado_teste_youtube', { escreveu: false }) } as unknown as RestoreStatus
    const m = montar(retrato({ status: 'paused', status_note: NOTA_TESTE_YOUTUBE, restore_status: rs }))
    // o claim vazio encerra o caminho logo depois de montar o extra (a leitura do YouTube não é alvo deste teste)
    await settleOnAir('t1', { siteId: SITE, destino: ORIGINAL, motivo: 'encerrado' }, { ...m.portas, token: async () => { throw new Error('sem YouTube') } }).catch(() => undefined)
    const claim = m.rpc.mock.calls.find(([n]) => n === 'ab_settle_claim')
    expect(claim?.[1].p_extra).toMatchObject({ status_note: null, completed_reason: 'manual_archive' })
    const m2 = montar(retrato({ status: 'paused', status_note: 'outra nota', restore_status: rs }))
    await settleOnAir('t1', { siteId: SITE, destino: ORIGINAL, motivo: 'encerrado' }, { ...m2.portas, token: async () => { throw new Error('sem YouTube') } }).catch(() => undefined)
    const claim2 = m2.rpc.mock.calls.find(([n]) => n === 'ab_settle_claim')
    expect(claim2?.[1].p_extra).not.toHaveProperty('status_note')
  })
})

describe('(k) passo 0b depois de pulado_teste_youtube (Yannis C3)', () => {
  const pulado = { title: campo('pulado_teste_youtube', { escreveu: false }) } as unknown as RestoreStatus
  const comToken = (m: ReturnType<typeof montar>) => ({ ...m.portas, token: (async () => 'tok') as PortasSaida['token'], fetch: (async () => new Response('{}')) as unknown as typeof fetch })
  const op = { siteId: SITE, destino: ORIGINAL, motivo: 'encerrado' as const, humano: true }
  // o título no YouTube hoje é o da variante B (a ficha reaproveitou o título B): a decisão seria escrever o original
  const noAr = (titulo: string) => lerSnippetMock.mockResolvedValue({ title: titulo, description: '', categoryId: '22', tags: [] })

  it('título atual = título de variante nossa: pergunta antes de escrever', async () => {
    noAr('Título B')
    const m = montar(retrato({ test_type: 'title', status: 'paused', restore_status: pulado }))
    const res = await settleOnAir('t1', op, comToken(m))
    expect(res).toEqual({ resultado: 'precisa_confirmar', campos: [{ campo: 'title', valor_atual: 'Título B' }] })
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it('leitura do passo 0b falha: não escreve o original; pergunta, sem reivindicar (Yannis M4)', async () => {
    lerSnippetMock.mockRejectedValue(new Error('5xx passageiro'))
    const m = montar(retrato({ test_type: 'title', status: 'paused', restore_status: pulado }))
    const res = await settleOnAir('t1', op, comToken(m))
    expect(res).toEqual({ resultado: 'precisa_confirmar', campos: [{ campo: 'title', valor_atual: TEXTO_SEM_LEITURA }] })
    expect(TEXTO_SEM_LEITURA.length).toBeGreaterThan(0)
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it('com forcar: não pergunta (segue para a reivindicação)', async () => {
    noAr('Título B')
    const m = montar(retrato({ test_type: 'title', status: 'paused', restore_status: pulado }))
    await settleOnAir('t1', { ...op, forcar: true }, comToken(m)).catch(() => undefined)
    expect(m.rpc).toHaveBeenCalled()
  })

  it('sem pulado_teste_youtube: comportamento atual (destino original não pergunta)', async () => {
    noAr('Título B')
    const m = montar(retrato({ test_type: 'title', status: 'paused', restore_status: { title: campo('ok') } as unknown as RestoreStatus }))
    await settleOnAir('t1', op, comToken(m)).catch(() => undefined)
    expect(m.rpc).toHaveBeenCalled()
  })
})

describe('guarda de linha confirmada dentro de settleOnAir e novaTentativa (T6, Yannis C2; sem flag)', () => {
  const confirmada = [{ id: 'n1', site_id: SITE, video_id: 'v-int', estado: 'em_andamento', confirmado_em: '2026-10-20T00:00:00Z', updated_at: '2026-10-20T00:00:00Z' }]
  const detectada = [{ ...confirmada[0]!, confirmado_em: null }]
  const op = (motivo: 'pausa' | 'falha_api' | 'drift' | 'duracao_maxima' | 'regra_v2' | 'encerrado' | 'reverter') => ({ siteId: SITE, destino: ORIGINAL, motivo })

  it.each(['pausa', 'falha_api', 'drift', 'duracao_maxima', 'regra_v2'] as const)('%s com linha confirmada: zero escrita, teste fica paused/pulado_teste_youtube', async (motivo) => {
    const m = montar(retrato(), { nativas: confirmada })
    const res = await settleOnAir('t1', op(motivo), m.portas)
    expect(res).toMatchObject({ resultado: 'feito', pausadoPorTesteYoutube: true }) // Phil C1: o chamador distingue a pausa convertida
    expect(m.rpc.mock.calls[0]![1]).toMatchObject({ p_para: 'paused', p_end_reason: 'teste_youtube' })
    expect(m.token).not.toHaveBeenCalled(); expect(m.fetchFn).not.toHaveBeenCalled()
  })

  it.each(['encerrado', 'reverter'] as const)('%s com linha confirmada: recusa com o motivo, sem reivindicar', async (motivo) => {
    const m = montar(retrato({ winner_applied_at: T0.toISOString(), revert_expires_at: new Date(T0.getTime() + 86_400_000).toISOString(), status: motivo === 'reverter' ? 'completed' : 'active' }), { nativas: confirmada })
    const res = await settleOnAir('t1', op(motivo), m.portas)
    expect(res).toMatchObject({ resultado: 'teste_youtube', motivo: expect.stringContaining('teste do YouTube') })
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it('linha só detectada, nos modos off/log/on: a guarda de settle é só de confirmada (sem recusa)', async () => {
    const m = montar(retrato(), { nativas: detectada })
    const res = await settleOnAir('t1', op('pausa'), { ...m.portas, token: (async () => { throw new Error('sem YouTube') }) as PortasSaida['token'] }).catch(() => ({ resultado: 'lancou' }))
    expect(res.resultado).not.toBe('teste_youtube')
    expect(m.rpc.mock.calls[0]![1]).toMatchObject({ p_end_reason: 'pausa' }) // seguiu o caminho de sempre
  })

  it('sem linha: comportamento atual (reivindica o caminho pedido)', async () => {
    const m = montar(retrato())
    await settleOnAir('t1', op('encerrado'), { ...m.portas, token: (async () => { throw new Error('sem YouTube') }) as PortasSaida['token'] }).catch(() => undefined)
    expect(m.rpc.mock.calls[0]![1]).toMatchObject({ p_end_reason: 'encerrado' })
  })

  it('erro na leitura: settleOnAir lança (falha fechada), nada gravado', async () => {
    const m = montar(retrato(), { falhaNativas: true })
    await expect(settleOnAir('t1', op('pausa'), m.portas)).rejects.toThrow(/guarda do teste do YouTube/)
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it('a leitura é dispensada quando o motivo já é teste_youtube', async () => {
    const m = montar(retrato(), { falhaNativas: true })
    expect((await settleOnAir('t1', { siteId: SITE, destino: ORIGINAL, motivo: 'teste_youtube' }, m.portas)).resultado).toBe('feito')
    expect(m.nativas.trips).toEqual([])
  })

  it('erro transitório (rede) na leitura: uma tentativa extra; 4xx não repete', async () => {
    let chamadas = 0
    const base = montar(retrato())
    const falho = (status: number) => ({ from: () => { chamadas++; const q: Record<string, unknown> = {}; for (const k of ['select', 'eq', 'in', 'order']) q[k] = () => q; q.range = async () => ({ data: null, error: { message: 'x', code: 'X' }, status }); return q } })
    const p5 = { ...base.portas, supabase: { ...(base.portas.supabase as object), ...falho(503) } as unknown as SupabaseClient }
    await expect(settleOnAir('t1', op('pausa'), p5)).rejects.toThrow()
    expect(chamadas).toBe(2)
    chamadas = 0
    const p4 = { ...base.portas, supabase: { ...(base.portas.supabase as object), ...falho(400) } as unknown as SupabaseClient }
    await expect(settleOnAir('t1', op('pausa'), p4)).rejects.toThrow()
    expect(chamadas).toBe(1)
  })

  it('novaTentativa (vigia) com linha confirmada: recusa, nada reivindicado; sem linha segue adiante', async () => {
    const rs = { title: campo('falhou', { escreveu: false, attempts: 1 }) } as unknown as RestoreStatus
    const m = montar(retrato({ status: 'paused', restore_status: rs, test_type: 'title' }), { nativas: confirmada })
    const res = await novaTentativa('t1', { siteId: SITE, origem: 'vigia' }, m.portas)
    expect(res).toMatchObject({ resultado: 'teste_youtube', motivo: expect.stringContaining('teste do YouTube') })
    expect(m.rpc).not.toHaveBeenCalled()
    const livre = montar(retrato({ status: 'paused', restore_status: rs, test_type: 'title' }))
    const r2 = await novaTentativa('t1', { siteId: SITE, origem: 'vigia' }, livre.portas).catch(() => ({ resultado: 'seguiu' }))
    expect(r2.resultado).not.toBe('teste_youtube')
  })
})
