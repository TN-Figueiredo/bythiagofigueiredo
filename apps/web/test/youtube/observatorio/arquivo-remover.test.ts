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

const { soMiniaturasDoObservatorio, retentarMiniaturasPendentes, PREFIXO_DAS_MINIATURAS, apagarCanalSemGuardar, pedirRemocao, cancelarRemocao } = remover

const SITE = '11111111-1111-4111-8111-111111111111'
const CANAL = '22222222-2222-4222-8222-222222222222'
const ATOR = '33333333-3333-4333-8333-333333333333'
const BASE = 'https://abc.public.blob.vercel-storage.com/'
const url = (n: number): string => `${BASE}observatorio/thumbs/v${n}/h${n}.jpg`

interface Chamada { fn: string; args: Record<string, unknown> }
type Resp = { data?: unknown; error?: { message: string; code?: string } | null }

function falso(respostas: Record<string, Resp | ((a: Record<string, unknown>) => Resp)>, lotes: unknown[] = [], semArquivo: unknown[] = []): { sb: SupabaseClient; chamadas: Chamada[] } {
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
      let teto = Infinity
      let semVazios = false
      const fonte = tabela === 'obs_unarchived_deletions' ? semArquivo : lotes
      for (const m of ['select', 'eq', 'order']) cadeia[m] = () => cadeia
      cadeia.not = (col: string, op: string, val: unknown) => { if (col === 'blob_urls_pending' && op === 'eq' && val === '{}') semVazios = true; return cadeia }
      cadeia.limit = (n: number) => { teto = n; return cadeia }
      // aplica o que o banco aplicaria: sem os `{}` (se pedido) e depois o teto
      cadeia.then = (ok: (v: unknown) => unknown) => {
        const linhas = (fonte as Array<{ blob_urls_pending?: unknown[] }>).filter(l => !semVazios || (l.blob_urls_pending?.length ?? 0) > 0).slice(0, teto)
        return Promise.resolve({ data: linhas, error: null }).then(ok)
      }
      return cadeia
    },
  }
  return { sb: sb as unknown as SupabaseClient, chamadas }
}


beforeEach(() => { captureMessage.mockReset(); captureException.mockReset(); delete process.env.OBS_E2E; process.env.BLOB_READ_WRITE_TOKEN = 'tok' })
afterEach(() => { vi.useRealTimers(); delete process.env.OBS_E2E; delete process.env.BLOB_READ_WRITE_TOKEN })

describe('Blob da remoção (laço comum aos dois caminhos, exercitado por apagarCanalSemGuardar)', () => {
  const apagadoCom = (urls: string[]): Resp => ({ data: { status: 'apagado', deletion_id: 9, videos: 2, linhas: {}, watch: { readings: 0, thumbs: 0, alvos: 0 }, blob_urls: urls }, error: null })
  const e = { siteId: SITE, canalId: CANAL, actorId: ATOR, nomeDigitado: 'Canal X', motivo: 'entrou_por_engano' }

  it('apaga em blocos de 100', async () => {
    const urls = Array.from({ length: 250 }, (_, i) => url(i))
    const { sb } = falso({ competitor_channel_delete_unarchived: apagadoCom(urls), obs_unarchived_blobs_done: { data: 0, error: null } })
    const apagar = vi.fn(async (_u: string[]) => undefined)
    await apagarCanalSemGuardar(sb, e, { apagarDoBlob: apagar })
    expect(apagar.mock.calls.map(c => c[0].length)).toEqual([100, 100, 50])
  })

  it('prazo no laço do Blob: com 30 blocos de 1 s e prazo de 5 s devolve ok a tempo, com o resto pendente', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(2_000_000)
    const urls = Array.from({ length: 3000 }, (_, i) => url(i))
    const { sb, chamadas } = falso({ competitor_channel_delete_unarchived: apagadoCom(urls), obs_unarchived_blobs_done: { data: 0, error: null } })
    const apagar = vi.fn(async (_u: string[]) => { vi.setSystemTime(Date.now() + 1_000) })
    const r = await apagarCanalSemGuardar(sb, e, { apagarDoBlob: apagar, prazoMs: 5_000, agora: () => Date.now() })
    expect(r).toMatchObject({ ok: true })
    expect(apagar).toHaveBeenCalledTimes(5)
    expect(r.ok && r.miniaturasPendentes).toBe(3000 - 500)
    expect(chamadas.filter(c => c.fn === 'obs_unarchived_blobs_done')).toHaveLength(5)
  })

  it('o padrão do prazo é 15 s', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(2_000_000)
    const urls = Array.from({ length: 3000 }, (_, i) => url(i))
    const { sb } = falso({ competitor_channel_delete_unarchived: apagadoCom(urls), obs_unarchived_blobs_done: { data: 0, error: null } })
    const apagar = vi.fn(async (_u: string[]) => { vi.setSystemTime(Date.now() + 1_000) })
    await apagarCanalSemGuardar(sb, e, { apagarDoBlob: apagar })
    expect(apagar).toHaveBeenCalledTimes(15)
  })

  it('57014 vira demorou_demais e a frase diz que nada foi apagado', async () => {
    const { sb } = falso({ competitor_channel_delete_unarchived: { data: null, error: { message: 'canceling statement', code: '57014' } } })
    const r = await apagarCanalSemGuardar(sb, e)
    expect(r).toMatchObject({ ok: false, codigo: 'demorou_demais' })
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

  it('com 51 lotes já esvaziados na frente, a pendência do 52º é tentada (a leitura exclui os "{}")', async () => {
    const vazios = Array.from({ length: 51 }, (_, i) => lote(`v${i}`, []))
    const { sb } = falso({ obs_archive_blobs_done: { data: 0, error: null } }, [...vazios, lote('novo', [url(1), url(2), url(3)])])
    const apagar = vi.fn(async (_u: string[]) => undefined)
    const r = await retentarMiniaturasPendentes(sb, o(), { apagarDoBlob: apagar })
    expect(r).toEqual({ apagadas: 3, pendentes: 0, foraDoPrefixo: 0 })
    expect(apagar).toHaveBeenCalledWith([url(1), url(2), url(3)])
  })

  it('nunca lança: erro de leitura vira porque', async () => {
    const sb = { from: () => { throw new Error('boom') } } as unknown as SupabaseClient
    const r = await retentarMiniaturasPendentes(sb, o(), { apagarDoBlob: async () => undefined })
    expect(r).toHaveProperty('porque')
  })
})

describe('M9 T13: retentarBlobsDeRemocoes (atrás de OBS_ARQUIVO_LIMPEZA_BLOBS)', () => {
  const { retentarBlobsDeRemocoes } = remover
  const CANAL2 = '44444444-4444-4444-8444-444444444444'
  const lin = (ref: string, urls: string[]) => ({ site_id: SITE, channel_ref: ref, blobs_pending: urls })
  const o = (extra: Partial<{ agoraMs: number; maximo: number; prazoMs: number }> = {}) => ({ agoraMs: Date.now(), maximo: 200, prazoMs: 60_000, ...extra })
  const on = { OBS_ARQUIVO_LIMPEZA_BLOBS: 'on' } as NodeJS.ProcessEnv
  function fal(linhas: unknown[], rpcErro = false): { sb: SupabaseClient; ch: Chamada[]; lido: string[]; eqs: Array<[string, unknown]> } {
    const ch: Chamada[] = []
    const lido: string[] = []
    const eqs: Array<[string, unknown]> = []
    const sb = {
      rpc: async (fn: string, args: Record<string, unknown>) => { ch.push({ fn, args }); return { data: 0, error: rpcErro ? { message: 'x' } : null } },
      from: (t: string) => {
        lido.push(t)
        const c: Record<string, unknown> = {}
        for (const m of ['select', 'not', 'order', 'limit']) c[m] = () => c
        c.eq = (col: string, v: unknown) => { eqs.push([col, v]); return c }
        c.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: linhas, error: null }).then(ok)
        return c
      },
    }
    return { sb: sb as unknown as SupabaseClient, ch, lido, eqs }
  }

  it('sem a variável não tenta', async () => {
    delete process.env.OBS_ARQUIVO_LIMPEZA_BLOBS
    const { sb, lido } = fal([lin(CANAL, [url(1)])])
    expect(await retentarBlobsDeRemocoes(sb, o(), { env: process.env, apagarDoBlob: vi.fn() })).toEqual({ porque: 'flag_desligada' })
    expect(lido).toHaveLength(0)
  })

  it('com off não tenta', async () => {
    const { sb, lido } = fal([lin(CANAL, [url(1)])])
    expect(await retentarBlobsDeRemocoes(sb, o(), { env: { OBS_ARQUIVO_LIMPEZA_BLOBS: 'off' } as NodeJS.ProcessEnv, apagarDoBlob: vi.fn() })).toEqual({ porque: 'flag_desligada' })
    expect(lido).toHaveLength(0)
  })

  it('variável nova ausente com a antiga on: desligada e nada lido', async () => {
    delete process.env.OBS_ARQUIVO_LIMPEZA_BLOBS
    const { sb, lido } = fal([lin(CANAL, [url(1)])])
    const apagar = vi.fn()
    const env = { OBS_ARQUIVO_LIMPEZA_CANAL: 'on' } as NodeJS.ProcessEnv
    expect(await retentarBlobsDeRemocoes(sb, o(), { env, apagarDoBlob: apagar })).toEqual({ porque: 'flag_desligada' })
    expect(apagar).not.toHaveBeenCalled()
    expect(lido).toHaveLength(0)
  })

  it('variável nova on com a antiga ausente: apaga', async () => {
    const { sb } = fal([lin(CANAL, [url(1)])])
    const env = { OBS_ARQUIVO_LIMPEZA_BLOBS: 'on' } as NodeJS.ProcessEnv
    expect(await retentarBlobsDeRemocoes(sb, o(), { env, apagarDoBlob: async () => undefined })).toMatchObject({ apagadas: 1 })
  })

  it.each(['ON', '1', ''])('valor %j da variável nova: desligada', async (v) => {
    const { sb, lido } = fal([lin(CANAL, [url(1)])])
    const env = { OBS_ARQUIVO_LIMPEZA_BLOBS: v } as NodeJS.ProcessEnv
    expect(await retentarBlobsDeRemocoes(sb, o(), { env, apagarDoBlob: vi.fn() })).toEqual({ porque: 'flag_desligada' })
    expect(lido).toHaveLength(0)
  })

  it('Y4: só linha com archive_decision = apagar é selecionada (guardar nunca é tocada)', async () => {
    const { sb, eqs } = fal([lin(CANAL, [url(1)])])
    await retentarBlobsDeRemocoes(sb, o(), { env: on, apagarDoBlob: async () => undefined })
    expect(eqs).toContainEqual(['archive_decision', 'apagar'])
  })

  it('sem token: sem_token', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    const { sb } = fal([lin(CANAL, [url(1)])])
    expect(await retentarBlobsDeRemocoes(sb, o(), { env: on })).toEqual({ porque: 'sem_token' })
  })

  it('com on apaga e baixa', async () => {
    const { sb, ch } = fal([lin(CANAL, [url(1), url(2)]), lin(CANAL2, [url(3)])])
    const apagar = vi.fn(async () => undefined)
    const r = await retentarBlobsDeRemocoes(sb, o(), { env: on, apagarDoBlob: apagar })
    expect(r).toEqual({ apagadas: 3, pendentes: 0, foraDoPrefixo: 0 })
    expect(apagar).toHaveBeenCalledTimes(2)
    expect(ch.filter(c => c.fn === 'obs_archive_removal_blobs_done').map(c => c.args)).toEqual([
      { p_site: SITE, p_ref: CANAL, p_urls: [url(1), url(2)] }, { p_site: SITE, p_ref: CANAL2, p_urls: [url(3)] },
    ])
  })

  it('fora do prefixo fica', async () => {
    const { sb, ch } = fal([lin(CANAL, [url(1), 'https://abc.public.blob.vercel-storage.com/outro/x.jpg'])])
    const apagar = vi.fn(async () => undefined)
    const r = await retentarBlobsDeRemocoes(sb, o(), { env: on, apagarDoBlob: apagar })
    expect(r).toEqual({ apagadas: 1, pendentes: 1, foraDoPrefixo: 1 })
    expect(ch.find(c => c.fn === 'obs_archive_removal_blobs_done')?.args.p_urls).toEqual([url(1)])
  })

  it('falha não baixa e o segundo canal segue', async () => {
    const { sb, ch } = fal([lin(CANAL, [url(1)]), lin(CANAL2, [url(2)])])
    let n = 0
    const r = await retentarBlobsDeRemocoes(sb, o(), { env: on, apagarDoBlob: async () => { if (n++ === 0) throw new Error('x') } })
    expect(r).toEqual({ apagadas: 1, pendentes: 1, foraDoPrefixo: 0 })
    expect(ch.filter(c => c.fn === 'obs_archive_removal_blobs_done').map(c => c.args.p_ref)).toEqual([CANAL2])
  })

  it('prazo: depois do primeiro canal para e devolve o parcial', async () => {
    const { sb, ch } = fal([lin(CANAL, [url(1)]), lin(CANAL2, [url(2)])])
    let t = 1000
    const r = await retentarBlobsDeRemocoes(sb, o({ agoraMs: 1000, prazoMs: 500 }), { env: on, apagarDoBlob: async () => { t += 1000 }, agora: () => t })
    expect(r).toEqual({ apagadas: 1, pendentes: 1, foraDoPrefixo: 0 })
    expect(ch.filter(c => c.fn === 'obs_archive_removal_blobs_done')).toHaveLength(1)
  })

  it('o máximo que sobra limita o apagamento', async () => {
    const { sb } = fal([lin(CANAL, [url(1)]), lin(CANAL2, [url(2)])])
    const r = await retentarBlobsDeRemocoes(sb, o({ maximo: 1 }), { env: on, apagarDoBlob: async () => undefined })
    expect(r).toEqual({ apagadas: 1, pendentes: 1, foraDoPrefixo: 0 })
  })

  it('M1: pendentes conta as URLs das linhas lidas mesmo quando o máximo corta antes delas', async () => {
    const { sb } = fal([lin(CANAL, [url(1)]), lin(CANAL2, [url(2), url(3)])])
    const r = await retentarBlobsDeRemocoes(sb, o({ maximo: 1 }), { env: on, apagarDoBlob: async () => undefined })
    expect(r).toEqual({ apagadas: 1, pendentes: 2, foraDoPrefixo: 0 })
  })

  it('M1: 50 linhas lidas (o limite) marcam maisLinhas', async () => {
    const { sb } = fal(Array.from({ length: 50 }, (_, i) => lin(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, [])))
    expect(await retentarBlobsDeRemocoes(sb, o(), { env: on, apagarDoBlob: async () => undefined })).toMatchObject({ maisLinhas: true })
  })

  it('M2: baixa que falha depois do Blob apagado conta baixaFalhou', async () => {
    const { sb } = fal([lin(CANAL, [url(1)])], true)
    const r = await retentarBlobsDeRemocoes(sb, o(), { env: on, apagarDoBlob: async () => undefined })
    expect(r).toMatchObject({ apagadas: 0, pendentes: 1, baixaFalhou: 1 })
  })
})

describe('F1 do Remover canal: apagarCanalSemGuardar, pedirRemocao, cancelarRemocao', () => {
  const apagado = (urls: string[]): Resp => ({ data: { status: 'apagado', deletion_id: 9, videos: 2, linhas: {}, watch: { readings: 0, thumbs: 0, alvos: 0 }, blob_urls: urls }, error: null })
  const e = { siteId: SITE, canalId: CANAL, actorId: ATOR, nomeDigitado: 'Canal X', motivo: 'entrou_por_engano' }

  it('apagarCanalSemGuardar chama a função, apaga as 2 miniaturas do prefixo e dá a baixa pela RPC nova', async () => {
    const fora = `${BASE}outro/a.jpg`
    const { sb, chamadas } = falso({ competitor_channel_delete_unarchived: apagado([url(1), url(2), fora]), obs_unarchived_blobs_done: { data: 1, error: null } })
    const apagar = vi.fn(async () => undefined)
    const r = await apagarCanalSemGuardar(sb, e, { apagarDoBlob: apagar })
    expect(chamadas[0]).toEqual({ fn: 'competitor_channel_delete_unarchived', args: { p_site: SITE, p_channel: CANAL, p_actor: ATOR, p_confirm_name: 'Canal X', p_motivo: 'entrou_por_engano' } })
    expect(apagar).toHaveBeenCalledWith([url(1), url(2)])
    expect(chamadas.find(c => c.fn === 'obs_unarchived_blobs_done')?.args).toEqual({ p_site: SITE, p_id: 9, p_urls: [url(1), url(2)] })
    expect(r).toEqual({ ok: true, videos: 2, miniaturasPendentes: 1, foraDoPrefixo: 1, imagensRestantes: 1, registrosDiarios: 0, leituras: 0 })
  })

  it('F2: devolve o que a F1 contou ao apagar (leituras da forja + da watch, registros diários); chave ausente em linhas é zero', async () => {
    const { sb } = falso({ competitor_channel_delete_unarchived: { data: { status: 'apagado', deletion_id: 9, videos: 340, linhas: { competitor_readings: 48, competitor_video_daily: 4000 }, watch: { readings: 20, thumbs: 4, alvos: 2 }, blob_urls: [] }, error: null } })
    expect(await apagarCanalSemGuardar(sb, e)).toMatchObject({ ok: true, videos: 340, leituras: 68, registrosDiarios: 4000 })
    const sem = falso({ competitor_channel_delete_unarchived: { data: { status: 'apagado', deletion_id: 9, videos: 1, linhas: {}, watch: { readings: 0, thumbs: 0, alvos: 0 }, blob_urls: [] }, error: null } })
    expect(await apagarCanalSemGuardar(sem.sb, e)).toMatchObject({ leituras: 0, registrosDiarios: 0 })
  })

  it('T12/Q4: imagensRestantes é o que sobrou no Blob depois do laço; sem `blob_urls` na resposta o campo é AUSENTE (nunca 0)', async () => {
    const parcial = falso({ competitor_channel_delete_unarchived: apagado([url(1), url(2), url(3)]), obs_unarchived_blobs_done: { data: 1, error: null } })
    const falha = vi.fn(async () => { throw new Error('x') })
    expect(await apagarCanalSemGuardar(parcial.sb, e, { apagarDoBlob: falha })).toMatchObject({ imagensRestantes: 3, miniaturasPendentes: 3 })
    const limpo = falso({ competitor_channel_delete_unarchived: apagado([url(1)]), obs_unarchived_blobs_done: { data: 1, error: null } })
    expect(await apagarCanalSemGuardar(limpo.sb, e, { apagarDoBlob: vi.fn(async () => undefined) })).toMatchObject({ imagensRestantes: 0 })
    const sem = falso({ competitor_channel_delete_unarchived: { data: { status: 'apagado', deletion_id: 9, videos: 5 }, error: null } })
    const r = await apagarCanalSemGuardar(sem.sb, e)
    expect(r).toMatchObject({ ok: true }); expect('imagensRestantes' in r).toBe(false)
  })

  it('F2: resposta sem linhas ou sem watch deixa os campos AUSENTES, nunca 0', async () => {
    const { sb } = falso({ competitor_channel_delete_unarchived: { data: { status: 'apagado', deletion_id: 9, videos: 5, blob_urls: [] }, error: null } })
    const r = await apagarCanalSemGuardar(sb, e)
    expect(r).toEqual({ ok: true, videos: 5, miniaturasPendentes: 0, foraDoPrefixo: 0, imagensRestantes: 0 })
    const meio = falso({ competitor_channel_delete_unarchived: { data: { status: 'apagado', deletion_id: 9, videos: 5, linhas: { competitor_video_daily: 3 }, blob_urls: [] }, error: null } })
    const m = await apagarCanalSemGuardar(meio.sb, e)
    expect(m).toEqual({ ok: true, videos: 5, miniaturasPendentes: 0, foraDoPrefixo: 0, imagensRestantes: 0, registrosDiarios: 3 })
  })

  it('nome_nao_confere vira falha com a frase e não chama o Blob', async () => {
    const { sb } = falso({ competitor_channel_delete_unarchived: { data: null, error: { message: 'E10:nome_nao_confere: x', code: 'P0001' } } })
    const apagar = vi.fn(async () => undefined)
    const r = await apagarCanalSemGuardar(sb, e, { apagarDoBlob: apagar })
    expect(r).toEqual({ ok: false, codigo: 'nome_nao_confere', frase: codigos.FRASES_E10.nome_nao_confere })
    expect(apagar).not.toHaveBeenCalled()
  })

  it('M3b-apagar-sql: apagar_com_arquivo do botão vira a frase própria, sem Blob e sem Sentry', async () => {
    const { sb } = falso({ competitor_channel_delete_unarchived: { data: null, error: { message: 'apagar_com_arquivo', code: 'P0001' } } })
    const apagar = vi.fn(async () => undefined)
    const r = await apagarCanalSemGuardar(sb, e, { apagarDoBlob: apagar })
    expect(r).toEqual({ ok: false, codigo: 'apagar_com_arquivo', frase: codigos.FRASES_E10.apagar_com_arquivo })
    expect(apagar).not.toHaveBeenCalled()
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('OBS_E2E=1: o Blob não é tocado e as pendências ficam', async () => {
    process.env.OBS_E2E = '1'
    const { sb, chamadas } = falso({ competitor_channel_delete_unarchived: apagado([url(1)]) })
    const apagar = vi.fn(async () => undefined)
    const r = await apagarCanalSemGuardar(sb, e, { apagarDoBlob: apagar })
    expect(apagar).not.toHaveBeenCalled()
    expect(r).toMatchObject({ ok: true, miniaturasPendentes: 1 })
    expect(chamadas.some(c => c.fn === 'obs_unarchived_blobs_done')).toBe(false)
  })

  it('resposta inválida é inesperado', async () => {
    const { sb } = falso({ competitor_channel_delete_unarchived: { data: { status: 'x' }, error: null } })
    expect(await apagarCanalSemGuardar(sb, e)).toMatchObject({ ok: false, codigo: 'inesperado' })
  })

  it('pedirRemocao leva o motivo e mapeia status para jaPedido', async () => {
    const a = falso({ competitor_channel_request_removal: { data: { status: 'pedido' }, error: null } })
    expect(await pedirRemocao(a.sb, { siteId: SITE, canalId: CANAL, actorId: ATOR, motivo: 'm' })).toEqual({ ok: true, jaPedido: false })
    expect(a.chamadas[0]).toEqual({ fn: 'competitor_channel_request_removal', args: { p_site: SITE, p_channel: CANAL, p_by: ATOR, p_motivo: 'm' } })
    const b = falso({ competitor_channel_request_removal: { data: { status: 'ja_pedido' }, error: null } })
    expect(await pedirRemocao(b.sb, { siteId: SITE, canalId: CANAL, actorId: ATOR, motivo: 'm' })).toEqual({ ok: true, jaPedido: true })
  })

  it('cancelarRemocao mapeia naoPedido e despausado; sem_vaga volta com a frase', async () => {
    const a = falso({ competitor_channel_cancel_removal: { data: { status: 'cancelado', despausado: true }, error: null } })
    expect(await cancelarRemocao(a.sb, { siteId: SITE, canalId: CANAL, actorId: ATOR })).toEqual({ ok: true, naoPedido: false, despausado: true })
    const b = falso({ competitor_channel_cancel_removal: { data: { status: 'nao_pedido', despausado: false }, error: null } })
    expect(await cancelarRemocao(b.sb, { siteId: SITE, canalId: CANAL, actorId: ATOR })).toEqual({ ok: true, naoPedido: true, despausado: false })
    const c = falso({ competitor_channel_cancel_removal: { data: null, error: { message: 'E10:sem_vaga: x', code: 'P0001' } } })
    expect(await cancelarRemocao(c.sb, { siteId: SITE, canalId: CANAL, actorId: ATOR })).toEqual({ ok: false, codigo: 'sem_vaga', frase: codigos.FRASES_E10.sem_vaga })
  })

  it('cancelarRemocao com canal já removido devolve a frase da página velha', async () => {
    const { sb } = falso({ competitor_channel_cancel_removal: { data: null, error: { message: 'E10:canal_nao_encontrado: x', code: 'P0002' } } })
    expect(await cancelarRemocao(sb, { siteId: SITE, canalId: CANAL, actorId: ATOR })).toEqual({ ok: false, codigo: 'canal_nao_encontrado', frase: 'Este canal já foi removido. Atualize a página.' })
  })

  it('retentarMiniaturasPendentes chama o sweep uma vez, sem mexer no máximo', async () => {
    const { sb, chamadas } = falso({ obs_archive_blobs_done: { data: 0, error: null } }, [{ site_id: SITE, batch: 'a', channel_ref: CANAL, blob_urls_pending: [url(1)] }])
    const agoraMs = Date.now()
    const r = await retentarMiniaturasPendentes(sb, { agoraMs, maximo: 5, prazoMs: 60_000 }, { apagarDoBlob: async () => undefined })
    expect(chamadas.filter(c => c.fn === 'obs_unarchived_watch_sweep')).toEqual([{ fn: 'obs_unarchived_watch_sweep', args: { p_agora: new Date(agoraMs).toISOString() } }])
    expect(r).toEqual({ apagadas: 1, pendentes: 0, foraDoPrefixo: 0 })
  })

  it('retentarMiniaturasPendentes junta as duas tabelas no mesmo máximo e dá a baixa de cada uma pela sua RPC', async () => {
    const { sb, chamadas } = falso({ obs_archive_blobs_done: { data: 0, error: null }, obs_unarchived_blobs_done: { data: 0, error: null } },
      [{ site_id: SITE, batch: 'a', channel_ref: CANAL, blob_urls_pending: [url(1), url(2)] }],
      [{ id: 7, site_id: SITE, blob_urls_pending: [url(3), url(4)] }])
    const apagar = vi.fn(async () => undefined)
    const r = await retentarMiniaturasPendentes(sb, { agoraMs: Date.now(), maximo: 3, prazoMs: 60_000 }, { apagarDoBlob: apagar })
    expect(r).toEqual({ apagadas: 3, pendentes: 1, foraDoPrefixo: 0 })
    expect(chamadas.find(c => c.fn === 'obs_archive_blobs_done')?.args).toMatchObject({ p_urls: [url(1), url(2)] })
    expect(chamadas.find(c => c.fn === 'obs_unarchived_blobs_done')?.args).toEqual({ p_site: SITE, p_id: 7, p_urls: [url(3)] })
  })

  it('(Yannis I-2) erro na leitura de obs_unarchived_deletions é relatado e as miniaturas dos lotes seguem sendo apagadas', async () => {
    const base = falso({ obs_archive_blobs_done: { data: 0, error: null } }, [{ site_id: SITE, batch: 'a', channel_ref: CANAL, blob_urls_pending: [url(1)] }])
    const deFora = base.sb.from.bind(base.sb)
    const sb = {
      rpc: base.sb.rpc.bind(base.sb),
      from: (t: string) => (t === 'obs_unarchived_deletions'
        ? (() => { const c: Record<string, unknown> = {}; for (const m of ['select', 'eq', 'order', 'not', 'limit']) c[m] = () => c; c.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'x' } }).then(ok); return c })()
        : deFora(t)),
    } as unknown as SupabaseClient
    const apagar = vi.fn(async () => undefined)
    const r = await retentarMiniaturasPendentes(sb, { agoraMs: Date.now(), maximo: 5, prazoMs: 60_000 }, { apagarDoBlob: apagar })
    expect(r).toEqual({ apagadas: 1, pendentes: 0, foraDoPrefixo: 0 })
    expect(captureMessage.mock.calls.map(c => c[0])).toContain('arquivo_remover: leitura_sem_arquivo_falhou')
  })

  it('(Yannis M-5) a chamada inesperada diz qual função do banco falhou', async () => {
    const { sb } = falso({ competitor_channel_request_removal: { data: null, error: { message: 'boom', code: 'XX000' } } })
    await pedirRemocao(sb, { siteId: SITE, canalId: CANAL, actorId: ATOR, motivo: 'entrou_por_engano' })
    const c = captureMessage.mock.calls.find(x => x[0] === 'arquivo_remover: chamada_inesperada')
    expect(c?.[1]).toMatchObject({ tags: { fn: 'competitor_channel_request_removal' } })
  })

  it('(Yannis N9) a chamada que lança diz qual função do banco lançou (tag fn de chamada_excecao)', async () => {
    const { sb } = falso({ competitor_channel_request_removal: () => { throw new Error('rede caiu') } })
    await pedirRemocao(sb, { siteId: SITE, canalId: CANAL, actorId: ATOR, motivo: 'entrou_por_engano' })
    const c = captureMessage.mock.calls.find(x => x[0] === 'arquivo_remover: chamada_excecao')
    expect(c?.[1]).toMatchObject({ tags: { fn: 'competitor_channel_request_removal' } })
  })
})


describe('M6a T13: recusa por mês em trânsito (P0001 sem prefixo E10)', () => {
  it.each(['mes_destacado_em_transito', 'ERROR: mes_destacado_em_transito'])('apagarCanalSemGuardar com %s devolve o código e a frase do catálogo e NÃO vai ao Sentry', async message => {
    const { sb } = falso({ competitor_channel_delete_unarchived: { data: null, error: { code: 'P0001', message } } })
    const r = await apagarCanalSemGuardar(sb, { siteId: SITE, canalId: CANAL, actorId: ATOR, nomeDigitado: 'Canal X', motivo: 'entrou_por_engano' })
    expect(r).toEqual({ ok: false, codigo: 'mes_destacado_em_transito', frase: 'Não dá para remover canal agora: o mês saiu das telas.' })
    expect(captureMessage).not.toHaveBeenCalled()
    expect(captureException).not.toHaveBeenCalled()
  })
})
