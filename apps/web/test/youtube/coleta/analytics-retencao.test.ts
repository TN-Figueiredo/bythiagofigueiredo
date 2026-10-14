// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AnalyticsApiError } from '@/lib/youtube/coleta/analytics-diario'
import { fetchComPrazo, SemTempoError } from '@/lib/youtube/coleta/clock'
import { motivoDoErro } from '@/lib/youtube/coleta/motivo'
import {
  METRICAS_RETENCAO,
  METRICAS_RETENCAO_BASICAS,
  retencaoDoVideo,
} from '@/lib/youtube/coleta/analytics-retencao'

const fixture = (nome: string) =>
  (JSON.parse(readFileSync(join(__dirname, 'fixtures/retencao', nome), 'utf8')) as { resposta: Corpo }).resposta

interface Corpo {
  columnHeaders?: Array<{ name: string }>
  rows?: unknown[][]
}

// Cópias das fixtures reais da conferência C0.1: 100 pontos com 2 métricas, e uma janela recente vazia com as 3 + 2.
const VIDA = fixture('c01-vida-so2.json')
const VAZIA = fixture('c01-28d.json')

const resp = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status })
const cab = (...nomes: string[]) => nomes.map(name => ({ name }))
const COLS3 = cab('elapsedVideoTimeRatio', 'audienceWatchRatio', 'relativeRetentionPerformance', 'totalSegmentImpressions')
const COLS2 = cab('elapsedVideoTimeRatio', 'audienceWatchRatio', 'relativeRetentionPerformance')
const ERRO_GOOGLE = (reason: string) => ({ error: { code: 0, message: 'texto do Google que não pode vazar', errors: [{ reason }] } })

type Entrada = Parameters<typeof retencaoDoVideo>[0]
const base = (f: ReturnType<typeof vi.fn>): Entrada => ({
  token: 'tok-secreto',
  canalUc: 'UCabc',
  videoId: 'vid12345678',
  inicio: '2019-08-16',
  fim: '2026-10-13',
  f: f as unknown as typeof fetch,
})
const fetchCom = (...respostas: Array<Response | Error>) => {
  const f = vi.fn()
  for (const r of respostas) {
    if (r instanceof Error) f.mockRejectedValueOnce(r)
    else f.mockResolvedValueOnce(r)
  }
  return f
}
const urlDa = (f: ReturnType<typeof vi.fn>, n: number) => new URL(String(f.mock.calls[n]![0]))
const comErro = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    return e
  }
  throw new Error('não lançou')
}
const ponto = (t: number, ratio: number, extra: unknown[] = []) => [t, ratio, ...extra]

describe('catálogo', () => {
  it('as listas de métricas', () => {
    expect([...METRICAS_RETENCAO]).toEqual(['audienceWatchRatio', 'relativeRetentionPerformance', 'totalSegmentImpressions'])
    expect([...METRICAS_RETENCAO_BASICAS]).toEqual(['audienceWatchRatio', 'relativeRetentionPerformance'])
  })
})

describe('retencaoDoVideo: o que a API devolve', () => {
  it('resposta real de 100 pontos: 100 pontos em ordem, primeiro t 0.01, último t 1', async () => {
    const f = fetchCom(resp(VIDA))
    const r = await retencaoDoVideo(base(f))
    expect(r.pontos).toHaveLength(100)
    expect(r.pontos[0]).toEqual({ t: 0.01, ratio: 0.9734999999999999, relative: 0.54915, segment_impressions: null })
    expect(r.pontos[99]!.t).toBe(1)
    const ts = r.pontos.map(p => p.t)
    expect(ts).toEqual([...ts].sort((a, b) => a - b))
    expect(r.chamadas).toBe(1)
    expect(r.metricas).toEqual(['audienceWatchRatio', 'relativeRetentionPerformance'])
  })

  it('resposta real vazia (rows: []): pontos [], sem erro, com as 3 métricas do cabeçalho', async () => {
    const f = fetchCom(resp(VAZIA))
    const r = await retencaoDoVideo(base(f))
    expect(r.pontos).toEqual([])
    expect(r.chamadas).toBe(1)
    // O cabeçalho real traz também startedWatching e stoppedWatching: não são métricas nossas.
    expect(r.metricas).toEqual(['audienceWatchRatio', 'relativeRetentionPerformance', 'totalSegmentImpressions'])
  })

  it('37 pontos: 37 (curva curta não é erro)', async () => {
    const rows = Array.from({ length: 37 }, (_, k) => ponto((k + 1) / 37, 0.5, [0.4, 10]))
    const r = await retencaoDoVideo(base(fetchCom(resp({ columnHeaders: COLS3, rows }))))
    expect(r.pontos).toHaveLength(37)
    expect(r.pontos[36]!.t).toBe(1)
  })

  it('ratio 1,2 fica 1,2', async () => {
    const r = await retencaoDoVideo(base(fetchCom(resp({ columnHeaders: COLS2, rows: [ponto(0.5, 1.2, [0.3])] }))))
    expect(r.pontos[0]!.ratio).toBe(1.2)
  })

  it('ratio 0 é 0 (curva que zera é medida)', async () => {
    const r = await retencaoDoVideo(base(fetchCom(resp({ columnHeaders: COLS2, rows: [ponto(1, 0, [0])] }))))
    expect(r.pontos[0]).toMatchObject({ ratio: 0, relative: 0 })
  })

  it('relative ausente num ponto fica nulo, não 0', async () => {
    const rows = [ponto(0.1, 0.9, [null, 5]), ponto(0.2, 0.8, [undefined, 6]), ponto(0.3, 0.7, [0.5])]
    // `undefined` vira `null` no JSON; a terceira linha é curta (sem a coluna de impressões).
    const r = await retencaoDoVideo(base(fetchCom(resp({ columnHeaders: COLS3, rows }))))
    expect(r.pontos.map(p => p.relative)).toEqual([null, null, 0.5])
    expect(r.pontos.map(p => p.segment_impressions)).toEqual([5, 6, null])
  })

  it('sem a coluna totalSegmentImpressions: segment_impressions nulo em todos; metricas sem ela', async () => {
    const rows = [ponto(0.1, 0.9, [0.5]), ponto(0.2, 0.8, [0.4])]
    const r = await retencaoDoVideo(base(fetchCom(resp({ columnHeaders: COLS2, rows }))))
    expect(r.pontos.every(p => p.segment_impressions === null)).toBe(true)
    expect(r.metricas).not.toContain('totalSegmentImpressions')
  })

  it('lê por nome de coluna, não por posição', async () => {
    const colunas = cab('totalSegmentImpressions', 'elapsedVideoTimeRatio', 'relativeRetentionPerformance', 'audienceWatchRatio')
    const r = await retencaoDoVideo(base(fetchCom(resp({ columnHeaders: colunas, rows: [[7, 0.25, 0.6, 0.9]] }))))
    expect(r.pontos).toEqual([{ t: 0.25, ratio: 0.9, relative: 0.6, segment_impressions: 7 }])
  })

  it('devolve ordenado por t mesmo com a resposta fora de ordem', async () => {
    const rows = [ponto(0.3, 0.7), ponto(0.1, 0.9), ponto(0.2, 0.8)]
    const r = await retencaoDoVideo(base(fetchCom(resp({ columnHeaders: COLS2, rows }))))
    expect(r.pontos.map(p => p.t)).toEqual([0.1, 0.2, 0.3])
  })

  it('t 0 e t 1 nas pontas são válidos', async () => {
    const r = await retencaoDoVideo(base(fetchCom(resp({ columnHeaders: COLS2, rows: [ponto(0, 1), ponto(1, 0.1)] }))))
    expect(r.pontos.map(p => p.t)).toEqual([0, 1])
  })
})

describe('retencaoDoVideo: a URL', () => {
  it('pede por vídeo, ORGANIC, as 3 métricas, sem sort e sem startedWatching/stoppedWatching', async () => {
    const f = fetchCom(resp(VIDA))
    await retencaoDoVideo(base(f))
    const u = urlDa(f, 0)
    expect(u.origin + u.pathname).toBe('https://youtubeanalytics.googleapis.com/v2/reports')
    expect(u.searchParams.get('ids')).toBe('channel==UCabc')
    expect(u.searchParams.get('startDate')).toBe('2019-08-16')
    expect(u.searchParams.get('endDate')).toBe('2026-10-13')
    expect(u.searchParams.get('dimensions')).toBe('elapsedVideoTimeRatio')
    expect(u.searchParams.get('filters')).toBe('video==vid12345678;audienceType==ORGANIC')
    expect(u.searchParams.get('metrics')).toBe('audienceWatchRatio,relativeRetentionPerformance,totalSegmentImpressions')
    expect(u.searchParams.has('sort')).toBe(false)
    expect(u.toString()).not.toMatch(/startedWatching|stoppedWatching/)
    expect((f.mock.calls[0]![1] as RequestInit).headers).toEqual({ Authorization: 'Bearer tok-secreto' })
  })
})

describe('retencaoDoVideo: repetições', () => {
  it('400 e depois 200: 2 chamadas; a segunda só com as básicas; metricas = as duas', async () => {
    const f = fetchCom(resp(ERRO_GOOGLE('badRequest'), 400), resp(VIDA))
    const r = await retencaoDoVideo(base(f))
    expect(f).toHaveBeenCalledTimes(2)
    expect(urlDa(f, 0).searchParams.get('metrics')).toBe('audienceWatchRatio,relativeRetentionPerformance,totalSegmentImpressions')
    expect(urlDa(f, 1).searchParams.get('metrics')).toBe('audienceWatchRatio,relativeRetentionPerformance')
    expect(r.chamadas).toBe(2)
    expect(r.metricas).toEqual(['audienceWatchRatio', 'relativeRetentionPerformance'])
    expect(r.pontos).toHaveLength(100)
  })

  it('400 e depois 400: lança, 2 chamadas', async () => {
    const f = fetchCom(resp(ERRO_GOOGLE('badRequest'), 400), resp(ERRO_GOOGLE('badRequest'), 400))
    const e = await comErro(retencaoDoVideo(base(f)))
    expect(e).toBeInstanceOf(AnalyticsApiError)
    expect(e).toMatchObject({ status: 400, reason: 'badRequest', chamadas: 2 })
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('400 e depois 500: lança (não repete a básica), 2 chamadas', async () => {
    const f = fetchCom(resp(ERRO_GOOGLE('badRequest'), 400), resp({}, 500))
    const e = await comErro(retencaoDoVideo(base(f)))
    expect(e).toMatchObject({ status: 500, chamadas: 2 })
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('500 e depois 200: 2 chamadas iguais', async () => {
    const f = fetchCom(resp({}, 500), resp(VAZIA))
    const r = await retencaoDoVideo(base(f))
    expect(f).toHaveBeenCalledTimes(2)
    expect(urlDa(f, 0).toString()).toBe(urlDa(f, 1).toString())
    expect(r.chamadas).toBe(2)
    expect(r.metricas).toContain('totalSegmentImpressions')
  })

  it('500, 500, 200: a terceira com as básicas', async () => {
    const f = fetchCom(resp({}, 500), resp({}, 500), resp(VIDA))
    const r = await retencaoDoVideo(base(f))
    expect(f).toHaveBeenCalledTimes(3)
    expect(urlDa(f, 1).searchParams.get('metrics')).toBe(urlDa(f, 0).searchParams.get('metrics'))
    expect(urlDa(f, 2).searchParams.get('metrics')).toBe('audienceWatchRatio,relativeRetentionPerformance')
    expect(r.chamadas).toBe(3)
  })

  it('500 três vezes: lança AnalyticsApiError(500), 3 chamadas, não 4', async () => {
    const f = fetchCom(resp({}, 500), resp({}, 500), resp({}, 500), resp(VIDA))
    const e = await comErro(retencaoDoVideo(base(f)))
    expect(e).toBeInstanceOf(AnalyticsApiError)
    expect(e).toMatchObject({ status: 500, chamadas: 3 })
    expect(f).toHaveBeenCalledTimes(3)
  })

  it('500 e depois 400: vai às básicas, e a 3ª chamada é a última', async () => {
    const f = fetchCom(resp({}, 500), resp(ERRO_GOOGLE('badRequest'), 400), resp(VIDA))
    const r = await retencaoDoVideo(base(f))
    expect(f).toHaveBeenCalledTimes(2 + 1)
    expect(urlDa(f, 2).searchParams.get('metrics')).toBe('audienceWatchRatio,relativeRetentionPerformance')
    expect(r.chamadas).toBe(3)
  })
})

describe('retencaoDoVideo: erros', () => {
  it('401: lança com status 401, 1 chamada', async () => {
    const f = fetchCom(resp(ERRO_GOOGLE('authError'), 401), resp(VIDA))
    const e = await comErro(retencaoDoVideo(base(f)))
    expect(e).toBeInstanceOf(AnalyticsApiError)
    expect(e).toMatchObject({ status: 401, chamadas: 1 })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it.each([403, 404])('vídeo apagado ou privado (%i): lança, 1 chamada, sem repetir', async status => {
    const f = fetchCom(resp(ERRO_GOOGLE('forbidden'), status), resp(VIDA))
    const e = await comErro(retencaoDoVideo(base(f)))
    expect(e).toMatchObject({ status, chamadas: 1 })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('cota (403 quotaExceeded e 429): lança com o reason, 1 chamada, e o motivo sai como cota', async () => {
    const f1 = fetchCom(resp(ERRO_GOOGLE('quotaExceeded'), 403), resp(VIDA))
    const e1 = await comErro(retencaoDoVideo(base(f1)))
    expect(e1).toMatchObject({ status: 403, reason: 'quotaExceeded', chamadas: 1 })
    expect(motivoDoErro(e1)).toBe('http_403_quotaExceeded')
    expect(f1).toHaveBeenCalledTimes(1)

    const f2 = fetchCom(resp(ERRO_GOOGLE('rateLimitExceeded'), 429), resp(VIDA))
    const e2 = await comErro(retencaoDoVideo(base(f2)))
    expect(e2).toMatchObject({ status: 429, reason: 'rateLimitExceeded', chamadas: 1 })
    expect(f2).toHaveBeenCalledTimes(1)
  })

  it('o erro nunca leva o corpo da resposta: a mensagem só tem o status', async () => {
    const f = fetchCom(resp(ERRO_GOOGLE('forbidden'), 403))
    const e = (await comErro(retencaoDoVideo(base(f)))) as AnalyticsApiError
    expect(e.message).toBe('YouTube Analytics API HTTP 403')
    expect(JSON.stringify(e)).not.toMatch(/texto do Google/)
    expect(e.message).not.toMatch(/tok-secreto|Google que/)
  })

  it('erro com corpo ilegível ainda lança com o status', async () => {
    const f = fetchCom(new Response('<html>oops</html>', { status: 503 }))
    const e = await comErro(retencaoDoVideo(base(f)))
    expect(e).toMatchObject({ status: 503, reason: null })
  })

  it('200 com corpo ilegível: corpo_invalido', async () => {
    const f = fetchCom(new Response('não é json', { status: 200 }))
    const e = await comErro(retencaoDoVideo(base(f)))
    expect(e).toBeInstanceOf(AnalyticsApiError)
    expect(e).toMatchObject({ status: 200, reason: 'corpo_invalido', chamadas: 1 })
  })

  it('fetch que estoura o prazo do passo propaga SemTempoError (e não repete)', async () => {
    const lento = vi.fn(async (_u: unknown, init?: RequestInit) => {
      await new Promise((_, rej) => init?.signal?.addEventListener('abort', () => rej(init.signal!.reason)))
      return resp(VIDA)
    })
    const deadline = Date.now() + 30
    const e = await comErro(retencaoDoVideo({ ...base(vi.fn()), f: fetchComPrazo(deadline, lento as unknown as typeof fetch) }))
    expect(e).toBeInstanceOf(SemTempoError)
    expect(lento).toHaveBeenCalledTimes(1)
  })

  it('prazo que já passou: SemTempoError sem tocar na rede', async () => {
    const f = vi.fn()
    const e = await comErro(retencaoDoVideo({ ...base(f), f: fetchComPrazo(Date.now() - 1, f as unknown as typeof fetch) }))
    expect(e).toBeInstanceOf(SemTempoError)
    expect(f).not.toHaveBeenCalled()
  })

  it('erro de rede do fetch propaga como veio', async () => {
    const rede = new TypeError('fetch failed')
    const f = fetchCom(rede)
    await expect(retencaoDoVideo(base(f))).rejects.toBe(rede)
    expect(f).toHaveBeenCalledTimes(1)
  })
})

describe('retencaoDoVideo: forma estranha é erro, não curva', () => {
  const forma = async (corpo: unknown) => {
    const f = fetchCom(resp(corpo))
    const e = await comErro(retencaoDoVideo(base(f)))
    expect(e).toBeInstanceOf(AnalyticsApiError)
    expect(e).toMatchObject({ status: 200, reason: 'forma_inesperada' })
    expect(motivoDoErro(e)).toBe('forma_inesperada')
    expect((e as Error).message).toBe('YouTube Analytics API HTTP 200')
    expect(f).toHaveBeenCalledTimes(1)
  }

  it('sem columnHeaders', () => forma({ rows: [ponto(0.1, 0.9)] }))
  it('sem columnHeaders e com rows: []', () => forma({ rows: [] }))
  it('columnHeaders que não é lista', () => forma({ columnHeaders: 'x', rows: [] }))
  it('corpo que não é objeto (null, lista, número)', async () => {
    await forma(null)
    await forma([])
    await forma(7)
  })
  it('sem rows', () => forma({ columnHeaders: COLS3 }))
  it('rows que não é lista', () => forma({ columnHeaders: COLS3, rows: 'x' }))
  it('rows: [] mas o cabeçalho não é o pedido (sem audienceWatchRatio)', () =>
    forma({ columnHeaders: cab('elapsedVideoTimeRatio', 'relativeRetentionPerformance'), rows: [] }))
  it('rows: [] mas sem elapsedVideoTimeRatio', () =>
    forma({ columnHeaders: cab('day', 'audienceWatchRatio'), rows: [] }))
  it('cabeçalho com itens que não são objetos', () => forma({ columnHeaders: [null, 3, 'x'], rows: [] }))
  it('linha que não é lista', () => forma({ columnHeaders: COLS3, rows: ['x'] }))
  it('t repetido', () => forma({ columnHeaders: COLS2, rows: [ponto(0.1, 0.9), ponto(0.2, 0.8), ponto(0.1, 0.7)] }))
  it('t fora de ordem E repetido', () => forma({ columnHeaders: COLS2, rows: [ponto(0.3, 0.9), ponto(0.1, 0.8), ponto(0.3, 0.7)] }))
  it('ratio não numérico (texto)', () => forma({ columnHeaders: COLS2, rows: [ponto(0.1, 'abc' as unknown as number)] }))
  it('ratio numérico em texto também é recusado', () => forma({ columnHeaders: COLS2, rows: [ponto(0.1, '0.9' as unknown as number)] }))
  it('ratio nulo (nulo nunca vira zero)', () => forma({ columnHeaders: COLS2, rows: [ponto(0.1, null as unknown as number)] }))
  it('ratio ausente (linha curta)', () => forma({ columnHeaders: COLS2, rows: [[0.1]] }))
  it('ratio negativo', () => forma({ columnHeaders: COLS2, rows: [ponto(0.1, -0.01)] }))
  it('t 1,5', () => forma({ columnHeaders: COLS2, rows: [ponto(1.5, 0.5)] }))
  it('t negativo', () => forma({ columnHeaders: COLS2, rows: [ponto(-0.1, 0.5)] }))
  it('t nulo ou texto', async () => {
    await forma({ columnHeaders: COLS2, rows: [[null, 0.5]] })
    await forma({ columnHeaders: COLS2, rows: [['0.1', 0.5]] })
  })
  it('relative em texto (nem número nem nulo)', () => forma({ columnHeaders: COLS2, rows: [ponto(0.1, 0.5, ['x'])] }))
  it('segment_impressions em texto', () => forma({ columnHeaders: COLS3, rows: [ponto(0.1, 0.5, [0.4, 'x'])] }))
  it('uma linha ruim no meio derruba a resposta inteira (não devolve curva parcial)', () =>
    forma({ columnHeaders: COLS2, rows: [ponto(0.1, 0.9), ponto(0.2, 'x' as unknown as number), ponto(0.3, 0.7)] }))
})
