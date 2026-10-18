// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const saude = vi.hoisted(() => ({ recordCronFailure: vi.fn(), recordCronSuccess: vi.fn() }))
vi.mock('@/lib/cron-health', () => saude)

import { rodarSonda } from '@/lib/youtube/ab-gravacao/sonda-step'
import { dhashDosBytes } from '@/lib/youtube/ab-variant-dhash'
import { hqdefaultLike } from '@/lib/youtube/thumb-fingerprint'
import { criarFakeSb, type Linha } from '../../helpers/fake-sb-gravacao'
import { H, imagemComDhash } from '../../helpers/youtube-falso'

const ETAG_UTIL = '"1760774400"'
const BLOB = 'https://abc.public.blob.vercel-storage.com/x.jpg'

function teste(id: string, vid = 'abcdefghijk'): Linha {
  return { id, site_id: 's1', status: 'active', test_type: 'thumbnail', youtube_videos: { youtube_video_id: vid } }
}
function variante(id: string, testId: string, dhash: string | null, blob: string | null = null): Linha {
  return { id, test_id: testId, thumbnail_dhash: dhash, blob_url: blob }
}
function cicloAberto(testId: string, variantId: string): Linha {
  return { id: `c-${testId}`, test_id: testId, variant_id: variantId, ended_at: null }
}

interface Roteiro {
  head?: (url: string) => Response | Promise<Response>
  get?: (url: string) => Response | Promise<Response>
  blob?: (url: string) => Response | Promise<Response>
}
function criarFetch(r: Roteiro) {
  const chamadas: Array<{ metodo: string; url: string }> = []
  const f = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const metodo = init?.method ?? 'GET'
    chamadas.push({ metodo, url })
    if (url.startsWith('https://i.ytimg.com/vi/')) {
      if (metodo === 'HEAD') return (r.head ?? (() => new Response(null, { status: 200, headers: { etag: ETAG_UTIL } })))(url)
      return (r.get ?? (() => { throw new Error('GET inesperado') }))(url)
    }
    return (r.blob ?? (() => new Response(null, { status: 404 })))(url)
  })
  return { f: f as unknown as typeof fetch, chamadas }
}
const png = async (hex: string) => new Response(new Uint8Array(await imagemComDhash(hex)), { status: 200 })
const agora = new Date('2026-10-18T10:15:42.000Z')

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { vi.useRealTimers() })

describe('rodarSonda', () => {
  it('C-6: zero teste ativo: nenhum fetch e uma única leitura', async () => {
    const fb = criarFakeSb({})
    const { f, chamadas } = criarFetch({})
    const r = await rodarSonda(fb.sb, agora, f)
    expect(r).toEqual({ status: 'ok', testes: 0, gravadas: 0, falhas: 0 })
    expect(chamadas).toHaveLength(0)
    expect(fb.lidas).toHaveLength(1)
    expect(fb.upserts).toHaveLength(0)
  })

  it('fetch que rejeita com TimeoutError: linha falhou com http nulo e erro timeout', async () => {
    const fb = criarFakeSb({ ab_tests: [teste('t1')], ab_test_variants: [variante('a', 't1', H.A), variante('b', 't1', H.B)] })
    const { f } = criarFetch({ head: () => { throw new DOMException('x', 'TimeoutError') } })
    const r = await rodarSonda(fb.sb, agora, f)
    expect(r).toMatchObject({ status: 'ok', gravadas: 1, falhas: 1 })
    expect(fb.upserts[0]!.linhas[0]).toMatchObject({ http: null, erro: 'timeout', leitura_estado: 'falhou' })
  })

  it('HEAD 404: http 404 e erro http_404', async () => {
    const fb = criarFakeSb({ ab_tests: [teste('t1')], ab_test_variants: [variante('a', 't1', H.A)] })
    const { f } = criarFetch({ head: () => new Response(null, { status: 404 }) })
    await rodarSonda(fb.sb, agora, f)
    expect(fb.upserts[0]!.linhas[0]).toMatchObject({ http: 404, erro: 'http_404', leitura_estado: 'falhou' })
  })

  it('grava com onConflict test_id,hora e ignoreDuplicates, hora no início da hora UTC', async () => {
    const fb = criarFakeSb({ ab_tests: [teste('t1')], ab_test_variants: [variante('a', 't1', H.A), variante('b', 't1', H.B)], ab_test_cycles: [cicloAberto('t1', 'a')] })
    const { f } = criarFetch({ get: () => png(H.B) })
    await rodarSonda(fb.sb, agora, f)
    expect(fb.upserts[0]!.opcoes).toEqual({ onConflict: 'test_id,hora', ignoreDuplicates: true })
    expect(fb.upserts[0]!.linhas[0]).toMatchObject({
      hora: '2026-10-18T10:00:00.000Z', lida_em: agora.toISOString(), http: 200, erro: null, etag: ETAG_UTIL,
      enviada_em: '2025-10-18T08:00:00.000Z', dhash: H.B, leitura_estado: 'bate', variante_vista: 'b', variante_esperada: 'a',
    })
  })

  it('ETag útil igual ao da sonda anterior: só HEAD, dhash reusado', async () => {
    const fb = criarFakeSb({
      ab_tests: [teste('t1')], ab_test_variants: [variante('a', 't1', H.A), variante('b', 't1', H.B)],
      ab_test_sondas: [{ test_id: 't1', hora: '2026-10-18T09:00:00.000Z', etag: ETAG_UTIL, dhash: H.B, sha16: 'abcdabcdabcdabcd' }],
    })
    const { f, chamadas } = criarFetch({})
    await rodarSonda(fb.sb, agora, f)
    expect(chamadas.filter((c) => c.metodo === 'GET' && c.url.includes('ytimg'))).toHaveLength(0)
    expect(fb.upserts[0]!.linhas[0]).toMatchObject({ dhash: H.B, sha16: 'abcdabcdabcdabcd', leitura_estado: 'bate', variante_vista: 'b' })
  })

  it('ETag "0" nas duas rodadas com imagem diferente: a 2ª faz GET e grava o dhash novo', async () => {
    const fb = criarFakeSb({
      ab_tests: [teste('t1')], ab_test_variants: [variante('a', 't1', H.A), variante('b', 't1', H.B)],
      ab_test_sondas: [{ test_id: 't1', hora: '2026-10-18T09:00:00.000Z', etag: '"0"', dhash: H.A, sha16: '1111111111111111' }],
    })
    const { f, chamadas } = criarFetch({ head: () => new Response(null, { status: 200, headers: { etag: '"0"' } }), get: () => png(H.B) })
    await rodarSonda(fb.sb, agora, f)
    expect(chamadas.filter((c) => c.metodo === 'GET' && c.url.includes('ytimg'))).toHaveLength(1)
    expect(fb.upserts[0]!.linhas[0]).toMatchObject({ dhash: H.B, variante_vista: 'b', enviada_em: null })
    expect((fb.upserts[0]!.linhas[0] as Linha).sha16).not.toBe('1111111111111111')
  })

  it('variante sem thumbnail_dhash usa o Blob via dhashDoArquivo; sem Blob e nada bate: sem_referencia', async () => {
    const bytes = new Uint8Array(await imagemComDhash(H.B))
    const alvo = await dhashDosBytes(Buffer.from(bytes))
    const cdn = new Uint8Array(await hqdefaultLike(Buffer.from(bytes)))
    let fb = criarFakeSb({ ab_tests: [teste('t1')], ab_test_variants: [variante('a', 't1', H.A), variante('b', 't1', null, BLOB)] })
    let { f } = criarFetch({ get: () => new Response(cdn, { status: 200 }), blob: () => new Response(bytes, { status: 200, headers: { 'content-type': 'image/png' } }) })
    await rodarSonda(fb.sb, agora, f)
    expect(fb.upserts[0]!.linhas[0]).toMatchObject({ dhash: alvo, leitura_estado: 'bate', variante_vista: 'b', variantes_sem_referencia: 0 })

    fb = criarFakeSb({ ab_tests: [teste('t1')], ab_test_variants: [variante('a', 't1', H.A), variante('b', 't1', null, null)] })
    ;({ f } = criarFetch({ get: () => png(H.C) }))
    await rodarSonda(fb.sb, agora, f)
    expect(fb.upserts[0]!.linhas[0]).toMatchObject({ leitura_estado: 'sem_referencia', variantes_sem_referencia: 1, variante_vista: null })
  })

  it('Blob que rejeita com TimeoutError: linha gravada com variantes_sem_referencia 1 e as outras linhas da rodada gravadas', async () => {
    const fb = criarFakeSb({
      ab_tests: [teste('t1'), teste('t2', 'bbbbbbbbbbb')],
      ab_test_variants: [variante('a', 't1', H.A), variante('b', 't1', null, BLOB), variante('c', 't2', H.A), variante('d', 't2', H.B)],
    })
    const { f } = criarFetch({ get: () => png(H.A), blob: () => { throw new DOMException('x', 'TimeoutError') } })
    const r = await rodarSonda(fb.sb, agora, f)
    expect(r).toMatchObject({ status: 'ok', gravadas: 2, falhas: 0 })
    const por = Object.fromEntries(fb.upserts[0]!.linhas.map((l) => [l.test_id as string, l]))
    expect(por.t1).toMatchObject({ variantes_sem_referencia: 1, leitura_estado: 'bate', variante_vista: 'a' })
    expect(por.t2).toMatchObject({ leitura_estado: 'bate', variante_vista: 'c' })
  })

  it('Blob que nunca responde: o prazo de 15 s corta, a linha sai com a variante sem referência', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const fb = criarFakeSb({ ab_tests: [teste('t1')], ab_test_variants: [variante('a', 't1', H.A), variante('b', 't1', null, BLOB)] })
    const { f } = criarFetch({ get: () => png(H.A), blob: () => new Promise<Response>(() => undefined) })
    const p = rodarSonda(fb.sb, agora, f)
    await vi.advanceTimersByTimeAsync(15_001)
    const r = await p
    expect(r).toMatchObject({ status: 'ok', gravadas: 1 })
    expect(fb.upserts[0]!.linhas[0]).toMatchObject({ variantes_sem_referencia: 1, leitura_estado: 'bate' })
  })

  it('última sonda com 1.000 na 1ª página e 10 na 2ª: as 1.010 chegam à decisão do reuso', async () => {
    const antigas: Linha[] = Array.from({ length: 1010 }, (_, i) => ({
      test_id: 't1', hora: new Date(Date.UTC(2026, 9, 17, 12) + i * 60_000).toISOString(),
      etag: i === 1009 ? ETAG_UTIL : '"0"', dhash: i === 1009 ? H.B : H.A, sha16: 'ffffffffffffffff',
    }))
    const fb = criarFakeSb({ ab_tests: [teste('t1')], ab_test_variants: [variante('a', 't1', H.A), variante('b', 't1', H.B)], ab_test_sondas: antigas })
    const { f, chamadas } = criarFetch({})
    await rodarSonda(fb.sb, agora, f)
    expect(chamadas.filter((c) => c.metodo === 'GET' && c.url.includes('ytimg'))).toHaveLength(0)
    expect(fb.upserts[0]!.linhas[0]).toMatchObject({ dhash: H.B, variante_vista: 'b' })
  })

  it('dois testes, um rejeita e outro bate: duas linhas, nenhuma com string vazia', async () => {
    const fb = criarFakeSb({
      ab_tests: [teste('t1', 'aaaaaaaaaaa'), teste('t2', 'bbbbbbbbbbb')],
      ab_test_variants: [variante('a', 't1', H.A), variante('b', 't2', H.B)],
    })
    const { f } = criarFetch({
      head: (u) => { if (u.includes('aaaaaaaaaaa')) throw new TypeError('fetch failed'); return new Response(null, { status: 200, headers: { etag: ETAG_UTIL } }) },
      get: () => png(H.B),
    })
    const r = await rodarSonda(fb.sb, agora, f)
    expect(r).toMatchObject({ status: 'ok', gravadas: 2, falhas: 1 })
    const por = Object.fromEntries(fb.upserts[0]!.linhas.map((l) => [l.test_id as string, l]))
    expect(por.t1).toMatchObject({ leitura_estado: 'falhou', erro: 'rede', http: null })
    expect(por.t2).toMatchObject({ leitura_estado: 'bate' })
    for (const l of fb.upserts[0]!.linhas) for (const v of Object.values(l)) expect(v).not.toBe('')
  })

  it('imagem que o sharp não lê: erro imagem_invalida', async () => {
    const fb = criarFakeSb({ ab_tests: [teste('t1')], ab_test_variants: [variante('a', 't1', H.A)] })
    const { f } = criarFetch({ get: () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }) })
    await rodarSonda(fb.sb, agora, f)
    expect(fb.upserts[0]!.linhas[0]).toMatchObject({ erro: 'imagem_invalida', leitura_estado: 'falhou' })
  })

  it('D1: todas as leituras falharam: recordCronFailure e status error, linhas falhou gravadas', async () => {
    const fb = criarFakeSb({ ab_tests: [teste('t1'), teste('t2', 'bcdefghijkl')] })
    const { f } = criarFetch({ head: () => new Response(null, { status: 404 }) })
    const r = await rodarSonda(fb.sb, agora, f)
    expect(fb.upserts[0]!.linhas).toHaveLength(2)
    expect(saude.recordCronFailure).toHaveBeenCalledTimes(1)
    expect(saude.recordCronFailure).toHaveBeenCalledWith('ab-sonda-miniatura', expect.stringContaining('http_404'))
    expect(r).toMatchObject({ status: 'error', health_written: true })
  })

  it('D1: um 404 e um que bate: status ok e sem falha de saúde', async () => {
    const fb = criarFakeSb({ ab_tests: [teste('t1'), teste('t2', 'bcdefghijkl')], ab_test_variants: [variante('b', 't2', H.A)], ab_test_cycles: [cicloAberto('t2', 'b')] })
    const { f } = criarFetch({
      head: (u) => (u.includes('abcdefghijk') ? new Response(null, { status: 404 }) : new Response(null, { status: 200, headers: { etag: ETAG_UTIL } })),
      get: () => png(H.A),
    })
    const r = await rodarSonda(fb.sb, agora, f)
    expect(r).toMatchObject({ status: 'ok', testes: 2, falhas: 1 })
    expect(saude.recordCronFailure).not.toHaveBeenCalled()
  })

  it('Y3: erro no upsert: falha registrada e status error', async () => {
    const fb = criarFakeSb({ ab_tests: [teste('t1')] })
    fb.erros.ab_test_sondas = 'boom'
    const { f } = criarFetch({ get: () => png(H.A) })
    const r = await rodarSonda(fb.sb, agora, f)
    expect(r).toMatchObject({ status: 'error', health_written: true })
    expect(saude.recordCronFailure).toHaveBeenCalledWith('ab-sonda-miniatura', expect.stringContaining('ab_test_sondas'))
  })

  it('leitura com erro: falha registrada e nada gravado', async () => {
    const fb = criarFakeSb({ ab_tests: [teste('t1')] })
    fb.erros.ab_test_variants = 'boom'
    const { f, chamadas } = criarFetch({})
    const r = await rodarSonda(fb.sb, agora, f)
    expect(r).toMatchObject({ status: 'error', health_written: true })
    expect(saude.recordCronFailure).toHaveBeenCalledWith('ab-sonda-miniatura', expect.stringContaining('ab_test_variants'))
    expect(fb.upserts).toHaveLength(0)
    expect(chamadas).toHaveLength(0)
  })
})
