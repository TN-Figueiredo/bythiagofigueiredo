// @vitest-environment node
/**
 * A5 · E10, Tarefa 11a: a remoção de canal liberada por exportação confirmada (`arquivo/remover.ts`) e a nova tentativa de apagar as
 * miniaturas pendentes. O banco e o Blob são falsos. Os testes de código e frase moram em `arquivo-codigos.test.ts` (Tarefa 5).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const captureMessage = vi.hoisted(() => vi.fn())
const captureException = vi.hoisted(() => vi.fn())
vi.mock('@sentry/nextjs', () => ({ captureMessage, captureException }))

import * as remover from '@/lib/youtube/observatorio/arquivo/remover'
import * as codigos from '@/lib/youtube/observatorio/arquivo/codigos'
import { RULES } from '@/lib/youtube/observatorio/rules'

const { removerCanalArquivado, soMiniaturasDoObservatorio, retentarMiniaturasPendentes, PREFIXO_DAS_MINIATURAS } = remover

const SITE = '11111111-1111-4111-8111-111111111111'
const CANAL = '22222222-2222-4222-8222-222222222222'
const ATOR = '33333333-3333-4333-8333-333333333333'
const BASE = 'https://abc.public.blob.vercel-storage.com/'
const url = (n: number): string => `${BASE}observatorio/thumbs/v${n}/h${n}.jpg`

interface Chamada { fn: string; args: Record<string, unknown> }
type Resp = { data?: unknown; error?: { message: string; code?: string } | null }

function falso(respostas: Record<string, Resp | ((a: Record<string, unknown>) => Resp)>, lotes: unknown[] = []): { sb: SupabaseClient; chamadas: Chamada[] } {
  const chamadas: Chamada[] = []
  const sb = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      chamadas.push({ fn, args })
      const r = respostas[fn]
      return (typeof r === 'function' ? r(args) : r) ?? { data: null, error: null }
    },
    from: (tabela: string) => {
      chamadas.push({ fn: `from:${tabela}`, args: {} })
      const cadeia: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'not', 'limit', 'order']) cadeia[m] = () => cadeia
      cadeia.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: lotes, error: null }).then(ok)
      return cadeia
    },
  }
  return { sb: sb as unknown as SupabaseClient, chamadas }
}

const removido = (urls: string[]): Resp => ({ data: { status: 'removido', batch: 'canal-22222222-2026-10-14', arquivos: 5, linhas: 40, blob_urls: urls, featured_refs_cleared: 0 }, error: null })

beforeEach(() => { captureMessage.mockReset(); captureException.mockReset(); delete process.env.OBS_E2E; process.env.BLOB_READ_WRITE_TOKEN = 'tok' })
afterEach(() => { vi.useRealTimers(); delete process.env.OBS_E2E; delete process.env.BLOB_READ_WRITE_TOKEN })

describe('A5 E10 T11a: removerCanalArquivado', () => {
  it('remover reexporta o catálogo de codigos.ts', () => {
    expect(remover.codigoE10).toBe(codigos.codigoE10)
    expect(remover.FRASES_E10).toBe(codigos.FRASES_E10)
  })

  it('os três ids vão para a função', async () => {
    const { sb, chamadas } = falso({ competitor_channel_remove_archived: removido([]) })
    await removerCanalArquivado(sb, { siteId: SITE, canalId: CANAL, actorId: ATOR })
    expect(chamadas[0]).toEqual({ fn: 'competitor_channel_remove_archived', args: { p_site: SITE, p_channel: CANAL, p_actor: ATOR } })
  })

  it('removido: o Blob é chamado com as URLs e a pendência é baixada', async () => {
    const urls = [url(1), url(2)]
    const { sb, chamadas } = falso({ competitor_channel_remove_archived: removido(urls), obs_archive_blobs_done: { data: 0, error: null } })
    const apagar = vi.fn(async () => undefined)
    const r = await removerCanalArquivado(sb, { siteId: SITE, canalId: CANAL, actorId: ATOR }, { apagarDoBlob: apagar })
    expect(r).toEqual({ ok: true, lote: 'canal-22222222-2026-10-14', linhas: 40, miniaturasPendentes: 0, foraDoPrefixo: 0 })
    expect(apagar).toHaveBeenCalledWith(urls)
    expect(chamadas.find(c => c.fn === 'obs_archive_blobs_done')?.args).toEqual({ p_site: SITE, p_batch: 'canal-22222222-2026-10-14', p_channel_ref: CANAL, p_urls: urls })
  })

  it('o Blob falha: ok continua true e miniaturasPendentes diz quantas; o Sentry recebe só a contagem', async () => {
    const { sb, chamadas } = falso({ competitor_channel_remove_archived: removido([url(1), url(2), url(3)]) })
    const apagar = vi.fn(async () => { throw new Error('token-secreto-do-blob') })
    const r = await removerCanalArquivado(sb, { siteId: SITE, canalId: CANAL, actorId: ATOR }, { apagarDoBlob: apagar })
    expect(r).toMatchObject({ ok: true, miniaturasPendentes: 3 })
    expect(chamadas.some(c => c.fn === 'obs_archive_blobs_done')).toBe(false)
    expect(JSON.stringify([captureMessage.mock.calls, captureException.mock.calls])).not.toContain('token-secreto-do-blob')
    expect(captureMessage).toHaveBeenCalled()
  })

  it('sem URLs: o Blob não é chamado', async () => {
    const { sb } = falso({ competitor_channel_remove_archived: removido([]) })
    const apagar = vi.fn(async () => undefined)
    await removerCanalArquivado(sb, { siteId: SITE, canalId: CANAL, actorId: ATOR }, { apagarDoBlob: apagar })
    expect(apagar).not.toHaveBeenCalled()
  })

  it('URL de outro prefixo não vai ao Blob, fica na pendência e é contada (inclui prefixo no meio do caminho)', async () => {
    const intrusas = [`${BASE}outro/arquivo.jpg`, `${BASE}x/observatorio/thumbs/v/h.jpg`, 'não é url', `${BASE}observatorio/thumbs/../segredo.jpg`]
    const { sb } = falso({ competitor_channel_remove_archived: removido([url(1), ...intrusas]), obs_archive_blobs_done: { data: 4, error: null } })
    const apagar = vi.fn(async () => undefined)
    const r = await removerCanalArquivado(sb, { siteId: SITE, canalId: CANAL, actorId: ATOR }, { apagarDoBlob: apagar })
    expect(apagar).toHaveBeenCalledTimes(1)
    expect(apagar).toHaveBeenCalledWith([url(1)])
    expect(r).toMatchObject({ ok: true, foraDoPrefixo: 4, miniaturasPendentes: 4 })
  })

  it('apaga em blocos de 100', async () => {
    const urls = Array.from({ length: 250 }, (_, i) => url(i))
    const { sb } = falso({ competitor_channel_remove_archived: removido(urls), obs_archive_blobs_done: { data: 0, error: null } })
    const apagar = vi.fn(async (_u: string[]) => undefined)
    await removerCanalArquivado(sb, { siteId: SITE, canalId: CANAL, actorId: ATOR }, { apagarDoBlob: apagar })
    expect(apagar.mock.calls.map(c => c[0].length)).toEqual([100, 100, 50])
  })

  it('57014 vira demorou_demais e a frase diz que nada foi apagado', async () => {
    const { sb } = falso({ competitor_channel_remove_archived: { data: null, error: { message: 'canceling statement', code: '57014' } } })
    const r = await removerCanalArquivado(sb, { siteId: SITE, canalId: CANAL, actorId: ATOR })
    expect(r).toMatchObject({ ok: false, codigo: 'demorou_demais' })
    if (!r.ok) expect(r.frase).toMatch(/nada foi apagado/)
  })

  it('erro do banco com código conhecido: a frase vem do catálogo, sem pedaço da mensagem', async () => {
    const { sb } = falso({ competitor_channel_remove_archived: { data: null, error: { message: 'E10:banco_difere_do_manifesto: competitor_video_daily 2026-10 banco=3 arquivo=2', code: 'P0001' } } })
    const r = await removerCanalArquivado(sb, { siteId: SITE, canalId: CANAL, actorId: ATOR })
    expect(r).toMatchObject({ ok: false, codigo: 'banco_difere_do_manifesto' })
    if (!r.ok) expect(r.frase).not.toContain('competitor_video_daily')
  })

  it('resposta nula ou sem status "removido" é inesperado (nunca ok: true)', async () => {
    for (const data of [null, {}, { status: 'outro' }, 'removido']) {
      const { sb } = falso({ competitor_channel_remove_archived: { data, error: null } })
      const r = await removerCanalArquivado(sb, { siteId: SITE, canalId: CANAL, actorId: ATOR })
      expect(r).toMatchObject({ ok: false, codigo: 'inesperado' })
    }
  })

  it('OBS_E2E=1: nenhuma chamada ao Blob e a pendência fica', async () => {
    process.env.OBS_E2E = '1'
    const { sb, chamadas } = falso({ competitor_channel_remove_archived: removido([url(1)]) })
    const apagar = vi.fn(async () => undefined)
    const r = await removerCanalArquivado(sb, { siteId: SITE, canalId: CANAL, actorId: ATOR }, { apagarDoBlob: apagar })
    expect(apagar).not.toHaveBeenCalled()
    expect(chamadas.some(c => c.fn === 'obs_archive_blobs_done')).toBe(false)
    expect(r).toMatchObject({ ok: true, miniaturasPendentes: 1 })
  })

  it('soMiniaturasDoObservatorio decide pelo caminho da URL, não por includes', () => {
    expect(PREFIXO_DAS_MINIATURAS).toBe('observatorio/thumbs/')
    const r = soMiniaturasDoObservatorio([url(1), `${BASE}a/observatorio/thumbs/x.jpg`, `${BASE}observatorio/thumbs/%2e%2e/x.jpg`, `${BASE}?p=observatorio/thumbs/x.jpg`])
    expect(r.apagar).toEqual([url(1)])
    expect(r.fora).toHaveLength(3)
  })
})

describe('A5 E10 T11a: retentarMiniaturasPendentes', () => {
  const lote = (batch: string, urls: string[]) => ({ site_id: SITE, batch, channel_ref: CANAL, blob_urls_pending: urls })
  const o = (extra: Partial<{ agoraMs: number; maximo: number; prazoMs: number }> = {}) => ({ agoraMs: Date.now(), maximo: RULES.archive.blobRetryMaxPerDay, prazoMs: 60_000, ...extra })

  it('a pendência some quando o Blob responde', async () => {
    const { sb, chamadas } = falso({ obs_archive_blobs_done: { data: 0, error: null } }, [lote('a', [url(1), url(2)])])
    const apagar = vi.fn(async () => undefined)
    const r = await retentarMiniaturasPendentes(sb, o(), { apagarDoBlob: apagar })
    expect(r).toEqual({ apagadas: 2, pendentes: 0, foraDoPrefixo: 0 })
    expect(chamadas.filter(c => c.fn === 'obs_archive_blobs_done')).toHaveLength(1)
  })

  it('o Blob falha de novo e a pendência fica inteira', async () => {
    const { sb, chamadas } = falso({}, [lote('a', [url(1), url(2)])])
    const r = await retentarMiniaturasPendentes(sb, o(), { apagarDoBlob: async () => { throw new Error('x') } })
    expect(r).toEqual({ apagadas: 0, pendentes: 2, foraDoPrefixo: 0 })
    expect(chamadas.some(c => c.fn === 'obs_archive_blobs_done')).toBe(false)
  })

  it('sem token devolve porque e não apaga', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    const { sb } = falso({}, [lote('a', [url(1)])])
    expect(await retentarMiniaturasPendentes(sb, o())).toEqual({ porque: 'sem_token' })
  })

  it('OBS_E2E=1: nenhuma chamada ao Blob', async () => {
    process.env.OBS_E2E = '1'
    const { sb } = falso({}, [lote('a', [url(1)])])
    const apagar = vi.fn(async () => undefined)
    expect(await retentarMiniaturasPendentes(sb, o(), { apagarDoBlob: apagar })).toEqual({ porque: 'e2e' })
    expect(apagar).not.toHaveBeenCalled()
  })

  it('respeita o máximo por dia', async () => {
    const urls = Array.from({ length: 10 }, (_, i) => url(i))
    const { sb } = falso({ obs_archive_blobs_done: { data: 7, error: null } }, [lote('a', urls)])
    const apagar = vi.fn(async (_u: string[]) => undefined)
    const r = await retentarMiniaturasPendentes(sb, o({ maximo: 3 }), { apagarDoBlob: apagar })
    expect(apagar.mock.calls.flatMap(c => c[0])).toHaveLength(3)
    expect(r).toEqual({ apagadas: 3, pendentes: 7, foraDoPrefixo: 0 })
  })

  it('com dois lotes: uma baixa de pendência por lote', async () => {
    const { sb, chamadas } = falso({ obs_archive_blobs_done: { data: 0, error: null } }, [lote('a', Array.from({ length: 150 }, (_, i) => url(i))), lote('b', [url(900), url(901)])])
    const apagar = vi.fn(async (_u: string[]) => undefined)
    const r = await retentarMiniaturasPendentes(sb, o(), { apagarDoBlob: apagar })
    expect(chamadas.filter(c => c.fn === 'obs_archive_blobs_done').map(c => c.args.p_batch)).toEqual(['a', 'b'])
    expect(apagar.mock.calls.map(c => c[0].length)).toEqual([100, 50, 2])
    expect(r).toEqual({ apagadas: 152, pendentes: 0, foraDoPrefixo: 0 })
  })

  it('URL de outro prefixo fica na pendência e é contada', async () => {
    const { sb } = falso({ obs_archive_blobs_done: { data: 1, error: null } }, [lote('a', [url(1), `${BASE}outro/x.jpg`])])
    const apagar = vi.fn(async (_u: string[]) => undefined)
    const r = await retentarMiniaturasPendentes(sb, o(), { apagarDoBlob: apagar })
    expect(apagar).toHaveBeenCalledWith([url(1)])
    expect(r).toEqual({ apagadas: 1, pendentes: 1, foraDoPrefixo: 1 })
  })

  it('cortada pelo prazo: devolve o que baixou e não lança', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const { sb, chamadas } = falso({ obs_archive_blobs_done: { data: 100, error: null } }, [lote('a', Array.from({ length: 200 }, (_, i) => url(i)))])
    const apagar = vi.fn(async (_u: string[]) => { vi.setSystemTime(Date.now() + 5_000) })
    const r = await retentarMiniaturasPendentes(sb, { agoraMs: 1_000_000, maximo: 200, prazoMs: 4_000 }, { apagarDoBlob: apagar })
    expect(apagar).toHaveBeenCalledTimes(1)
    expect(r).toEqual({ apagadas: 100, pendentes: 100, foraDoPrefixo: 0 })
    expect(chamadas.filter(c => c.fn === 'obs_archive_blobs_done')).toHaveLength(1)
  })

  it('nunca lança: erro de leitura vira porque', async () => {
    const sb = { from: () => { throw new Error('boom') } } as unknown as SupabaseClient
    const r = await retentarMiniaturasPendentes(sb, o(), { apagarDoBlob: async () => undefined })
    expect(r).toHaveProperty('porque')
  })
})
