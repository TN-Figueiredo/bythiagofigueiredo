// @vitest-environment node
// A5 · E14, Tarefa 6: as quatro chamadas à YouTube Data API (commentThreads, channels, comments, videos). fetch falso, dado inventado.
import { describe, expect, it } from 'vitest'
import { criarApi } from '@/lib/youtube/observatorio/comentarios/api'
import { ComentariosErro } from '@/lib/youtube/observatorio/comentarios/erro'

const CHAVE = 'CHAVE-FALSA-DE-TESTE-9f8e7d'
const SENTINELA = 'TEXTO-SENTINELA-123'

interface Chamada { url: string; init: RequestInit | undefined }
type Resp = { status?: number; body?: unknown; raw?: string } | Error

function falso(respostas: Resp[] | ((n: number) => Resp)): { fetchImpl: typeof fetch; chamadas: Chamada[] } {
  const chamadas: Chamada[] = []
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    chamadas.push({ url: String(input), init })
    const r = typeof respostas === 'function' ? respostas(chamadas.length - 1) : respostas[Math.min(chamadas.length - 1, respostas.length - 1)]
    if (r instanceof Error) throw r
    const texto = r.raw ?? JSON.stringify(r.body ?? {})
    return new Response(texto, { status: r.status ?? 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return { fetchImpl, chamadas }
}

const ok = (body: unknown = { items: [] }): Resp => ({ status: 200, body })
const erroApi = (status: number, reason: string | null, message = 'mensagem da API'): Resp => ({
  status,
  body: { error: { code: status, message, errors: reason === null ? [] : [{ reason, domain: 'youtube.commentThread', location: 'videoId' }] } },
})

function mk(r: Resp[] | ((n: number) => Resp), extra: { timeoutMs?: number; base?: string } = {}) {
  const f = falso(r)
  const api = criarApi({ apiKey: CHAVE, fetchImpl: f.fetchImpl, timeoutMs: extra.timeoutMs ?? 6000, ...(extra.base ? { base: extra.base } : {}) })
  return { api, ...f }
}

async function codigoDoErro(p: Promise<unknown>): Promise<{ err: ComentariosErro; codigo: string }> {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(ComentariosErro)
    return { err: e as ComentariosErro, codigo: (e as ComentariosErro).codigo }
  }
  throw new Error('devia ter lançado')
}

describe('criarApi: URLs', () => {
  it('conversas: a URL tem os cinco parâmetros e não tem pageToken', async () => {
    const { api, chamadas } = mk([ok()])
    await api.conversas('VID_abc-123')
    const u = new URL(chamadas[0].url)
    expect(u.pathname).toBe('/youtube/v3/commentThreads')
    expect(u.searchParams.get('part')).toBe('snippet,replies')
    expect(u.searchParams.get('videoId')).toBe('VID_abc-123')
    expect(u.searchParams.get('order')).toBe('relevance')
    expect(u.searchParams.get('maxResults')).toBe('100')
    expect(u.searchParams.get('textFormat')).toBe('plainText')
    expect(u.searchParams.has('pageToken')).toBe(false)
    expect(u.searchParams.get('key')).toBe(CHAVE)
  })

  it('conversas: nextPageToken na resposta NÃO provoca segunda chamada (uma página só, sem laço)', async () => {
    const { api, chamadas } = mk([ok({ items: [{ id: 'a' }], nextPageToken: 'PROXIMA' })])
    const corpo = await api.conversas('v1')
    expect(chamadas).toHaveLength(1)
    expect(api.unidades()).toBe(1)
    expect(corpo).toMatchObject({ items: [{ id: 'a' }] })
  })

  it('por id: a URL não tem maxResults; 51 ids lança antes de chamar (http_400, 0 unidades)', async () => {
    const { api, chamadas } = mk([ok()])
    await api.porId(['c1', 'c2'])
    const u = new URL(chamadas[0].url)
    expect(u.pathname).toBe('/youtube/v3/comments')
    expect(u.searchParams.get('part')).toBe('snippet')
    expect(u.searchParams.get('id')).toBe('c1,c2')
    expect(u.searchParams.get('textFormat')).toBe('plainText')
    expect(u.searchParams.has('maxResults')).toBe(false)

    const b = mk([ok()])
    const ids = Array.from({ length: 51 }, (_, i) => 'c' + i)
    const { codigo } = await codigoDoErro(b.api.porId(ids))
    expect(codigo).toBe('http_400')
    expect(b.chamadas).toHaveLength(0)
    expect(b.api.unidades()).toBe(0)
    await b.api.porId(ids.slice(0, 50))
    expect(b.chamadas).toHaveLength(1)
  })

  it('inscritos: no máximo 50 ids; lista vazia não chama (0 unidades)', async () => {
    const { api, chamadas } = mk([ok()])
    await api.inscritos([])
    await api.porId([])
    expect(chamadas).toHaveLength(0)
    expect(api.unidades()).toBe(0)
    await api.inscritos(['UC1', 'UC2'])
    const u = new URL(chamadas[0].url)
    expect(u.pathname).toBe('/youtube/v3/channels')
    expect(u.searchParams.get('part')).toBe('statistics')
    expect(u.searchParams.get('id')).toBe('UC1,UC2')
    const ids = Array.from({ length: 51 }, (_, i) => 'UC' + i)
    const { codigo } = await codigoDoErro(api.inscritos(ids))
    expect(codigo).toBe('http_400')
    expect(chamadas).toHaveLength(1)
  })

  it('contagem usa videos?part=statistics', async () => {
    const { api, chamadas } = mk([ok({ items: [{ statistics: { commentCount: '3' } }] })])
    await api.contagem('v9')
    const u = new URL(chamadas[0].url)
    expect(u.pathname).toBe('/youtube/v3/videos')
    expect(u.searchParams.get('part')).toBe('statistics')
    expect(u.searchParams.get('id')).toBe('v9')
  })

  it('sem base, a URL começa por https://www.googleapis.com/youtube/v3/', async () => {
    const { api, chamadas } = mk([ok()])
    await api.conversas('v1')
    expect(chamadas[0].url.startsWith('https://www.googleapis.com/youtube/v3/')).toBe(true)
  })

  it('com base (só os testes passam), a URL começa por ela', async () => {
    const { api, chamadas } = mk([ok()], { base: 'http://127.0.0.1:9/youtube/v3' })
    await api.conversas('v1')
    expect(chamadas[0].url.startsWith('http://127.0.0.1:9/youtube/v3/commentThreads?')).toBe(true)
  })

  it('cada chamada leva um AbortSignal', async () => {
    const { api, chamadas } = mk([ok()])
    await api.conversas('v1')
    expect(chamadas[0].init?.signal).toBeInstanceOf(AbortSignal)
  })
})

describe('criarApi: unidades', () => {
  it('cada chamada soma 1 unidade, inclusive a que falha', async () => {
    const { api } = mk([ok(), erroApi(500, null), new Error('queda'), ok({ items: [] })])
    await api.conversas('v1')
    expect(api.unidades()).toBe(1)
    await codigoDoErro(api.inscritos(['UC1']))
    expect(api.unidades()).toBe(2)
    await codigoDoErro(api.porId(['c1']))
    expect(api.unidades()).toBe(3)
    await api.contagem('v1')
    expect(api.unidades()).toBe(4)
  })

  it('a unidade é somada ANTES do fetch (fetch que vê o contador já em 1)', async () => {
    let visto = -1
    const holder: { api?: ReturnType<typeof criarApi> } = {}
    const fetchImpl = (async () => {
      visto = holder.api?.unidades() ?? -1
      return new Response('{"items":[]}', { status: 200 })
    }) as typeof fetch
    holder.api = criarApi({ apiKey: CHAVE, fetchImpl, timeoutMs: 1000 })
    await holder.api.conversas('v1')
    expect(visto).toBe(1)
  })
})

describe('criarApi: classificação do erro', () => {
  it('403 commentsDisabled (forma da fixture c03) → comentarios_desligados', async () => {
    const corpo = {
      error: {
        code: 403,
        message: 'The video identified by the <code>videoId</code> parameter has disabled comments.',
        errors: [{ reason: 'commentsDisabled', domain: 'youtube.commentThread', location: 'videoId' }],
      },
    }
    const { api } = mk([{ status: 403, body: corpo }])
    const { codigo, err } = await codigoDoErro(api.conversas('v1'))
    expect(codigo).toBe('comentarios_desligados')
    expect(err.http).toBe(403)
  })

  it('403 de cota, 403 proibido e 403 desligados são três códigos distintos', async () => {
    const codigos: string[] = []
    for (const reason of ['commentsDisabled', 'quotaExceeded', 'forbidden']) {
      const { api } = mk([erroApi(403, reason)])
      codigos.push((await codigoDoErro(api.conversas('v1'))).codigo)
    }
    expect(codigos).toEqual(['comentarios_desligados', 'cota_esgotada', 'proibido'])
  })

  it('403 quotaExceeded e dailyLimitExceeded → cota_esgotada; 429 → limite_de_taxa', async () => {
    expect((await codigoDoErro(mk([erroApi(403, 'quotaExceeded')]).api.conversas('v'))).codigo).toBe('cota_esgotada')
    expect((await codigoDoErro(mk([erroApi(403, 'dailyLimitExceeded')]).api.conversas('v'))).codigo).toBe('cota_esgotada')
    expect((await codigoDoErro(mk([erroApi(429, 'rateLimitExceeded')]).api.conversas('v'))).codigo).toBe('limite_de_taxa')
    expect((await codigoDoErro(mk([{ status: 429, raw: '' }]).api.conversas('v'))).codigo).toBe('limite_de_taxa')
  })

  it('404 videoNotFound → video_nao_encontrado; 403 forbidden → proibido; 400 → http_400; 503 → http_5xx; 404 sem razão → http_4xx', async () => {
    expect((await codigoDoErro(mk([erroApi(404, 'videoNotFound')]).api.conversas('v'))).codigo).toBe('video_nao_encontrado')
    expect((await codigoDoErro(mk([erroApi(403, 'forbidden')]).api.conversas('v'))).codigo).toBe('proibido')
    expect((await codigoDoErro(mk([erroApi(400, 'invalidFilters')]).api.porId(['c']))).codigo).toBe('http_400')
    expect((await codigoDoErro(mk([erroApi(503, 'backendError')]).api.conversas('v'))).codigo).toBe('http_5xx')
    expect((await codigoDoErro(mk([erroApi(404, null)]).api.conversas('v'))).codigo).toBe('http_4xx')
    expect((await codigoDoErro(mk([erroApi(401, 'unauthorized')]).api.conversas('v'))).codigo).toBe('http_4xx')
  })

  it('erro com corpo ilegível (não JSON) segue a classificação só pelo status', async () => {
    expect((await codigoDoErro(mk([{ status: 502, raw: '<html>bad gateway</html>' }]).api.conversas('v'))).codigo).toBe('http_5xx')
    expect((await codigoDoErro(mk([{ status: 403, raw: 'nope' }]).api.conversas('v'))).codigo).toBe('proibido')
  })

  it('razão fora do formato (espaço, hífen, 80 letras) é ignorada', async () => {
    expect((await codigoDoErro(mk([erroApi(403, 'comments Disabled')]).api.conversas('v'))).codigo).toBe('proibido')
    expect((await codigoDoErro(mk([erroApi(403, 'quota-Exceeded')]).api.conversas('v'))).codigo).toBe('proibido')
    expect((await codigoDoErro(mk([erroApi(403, 'a'.repeat(80))]).api.conversas('v'))).codigo).toBe('proibido')
  })

  it('tempo esgotado → tempo_esgotado; fetch que lança → rede', async () => {
    const t = new DOMException('The operation timed out', 'TimeoutError')
    expect((await codigoDoErro(mk([t]).api.conversas('v'))).codigo).toBe('tempo_esgotado')
    const a = new DOMException('aborted', 'AbortError')
    expect((await codigoDoErro(mk([a]).api.conversas('v'))).codigo).toBe('tempo_esgotado')
    expect((await codigoDoErro(mk([new TypeError('fetch failed')]).api.conversas('v'))).codigo).toBe('rede')
  })

  it('tempo esgotado de verdade: o AbortSignal.timeout dispara', async () => {
    const fetchImpl = ((_u: string, init?: RequestInit) => new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(init.signal?.reason))
    })) as unknown as typeof fetch
    const api = criarApi({ apiKey: CHAVE, fetchImpl, timeoutMs: 20 })
    const { codigo } = await codigoDoErro(api.conversas('v'))
    expect(codigo).toBe('tempo_esgotado')
    expect(api.unidades()).toBe(1)
  })

  it('corpo "<html>…" com status 200 → resposta_ilegivel', async () => {
    const { api } = mk([{ status: 200, raw: '<html>erro ' + SENTINELA + '</html>' }])
    expect((await codigoDoErro(api.conversas('v'))).codigo).toBe('resposta_ilegivel')
  })

  it('200 sem items, com items que não é lista, ou com error no corpo é FALHA (resposta_sem_lista), não "sem comentários"', async () => {
    for (const body of [{}, { items: null }, { items: 'x' }, { error: { code: 500, message: 'x' } }, { items: [], error: { code: 500 } }, [], null]) {
      const r = await codigoDoErro(mk([{ status: 200, raw: JSON.stringify(body) }]).api.conversas('v'))
      expect(r.codigo, JSON.stringify(body)).toBe(Array.isArray(body) || body === null ? 'resposta_ilegivel' : 'resposta_sem_lista')
    }
    expect((await codigoDoErro(mk([{ status: 200, body: {} }]).api.inscritos(['UC1']))).codigo).toBe('resposta_sem_lista')
    expect((await codigoDoErro(mk([{ status: 200, body: {} }]).api.porId(['c1']))).codigo).toBe('resposta_sem_lista')
  })

  it('items: [] é "sem comentários" legítimo: devolve o corpo', async () => {
    const corpo = await mk([ok({ items: [] })]).api.conversas('v')
    expect(corpo).toEqual({ items: [] })
  })
})

describe('criarApi: conserto da revisão das Tarefas 3 a 6', () => {
  it('I-1: inscritos com 200 sem items e totalResults 0 é "nenhum canal encontrado": items vazio', async () => {
    const corpo = await mk([{ status: 200, body: { kind: 'youtube#channelListResponse', pageInfo: { totalResults: 0, resultsPerPage: 5 } } }]).api.inscritos(['UC1'])
    expect(corpo).toMatchObject({ items: [] })
  })

  it('I-1: sem items e SEM totalResults 0 continua falha (resposta_sem_lista), inclusive em inscritos', async () => {
    const corpos: unknown[] = [{}, { pageInfo: {} }, { pageInfo: { totalResults: 3 } }, { pageInfo: { totalResults: '0' } },
      { pageInfo: { totalResults: 0 }, error: { code: 500 } }, { items: null, pageInfo: { totalResults: 0 } }, { items: 'x', pageInfo: { totalResults: 0 } }]
    for (const body of corpos) {
      const r = await codigoDoErro(mk([{ status: 200, body }]).api.inscritos(['UC1']))
      expect(r.codigo, JSON.stringify(body)).toBe('resposta_sem_lista')
    }
  })

  it('I-1: o atalho de totalResults 0 vale só para inscritos (conversas, porId e contagem seguem exigindo items)', async () => {
    const body = { pageInfo: { totalResults: 0 } }
    expect((await codigoDoErro(mk([{ status: 200, body }]).api.conversas('v'))).codigo).toBe('resposta_sem_lista')
    expect((await codigoDoErro(mk([{ status: 200, body }]).api.porId(['c1']))).codigo).toBe('resposta_sem_lista')
    expect((await codigoDoErro(mk([{ status: 200, body }]).api.contagem('v'))).codigo).toBe('resposta_sem_lista')
  })

  it('I-2: 403 rateLimitExceeded e userRateLimitExceeded são limite_de_taxa (passageiro), não proibido', async () => {
    for (const reason of ['rateLimitExceeded', 'userRateLimitExceeded']) {
      const r = await codigoDoErro(mk([erroApi(403, reason)]).api.conversas('v'))
      expect(r.codigo, reason).toBe('limite_de_taxa')
      expect(r.err.http).toBe(403)
    }
    expect((await codigoDoErro(mk([erroApi(403, 'forbidden')]).api.conversas('v'))).codigo).toBe('proibido')
  })

  it('M-3: corpo de erro que estoura o tempo ao ser lido é tempo_esgotado, não proibido', async () => {
    for (const nome of ['TimeoutError', 'AbortError']) {
      const fetchImpl = (async () => ({
        ok: false, status: 403,
        json: () => Promise.reject(new DOMException('demorou', nome)),
      })) as unknown as typeof fetch
      const api = criarApi({ apiKey: CHAVE, fetchImpl, timeoutMs: 1000 })
      const r = await codigoDoErro(api.conversas('v'))
      expect(r.codigo, nome).toBe('tempo_esgotado')
      expect(api.unidades()).toBe(1)
    }
    // corpo ilegível por outro motivo continua só pelo status
    const fetchImpl = (async () => ({ ok: false, status: 403, json: () => Promise.reject(new SyntaxError('x')) })) as unknown as typeof fetch
    expect((await codigoDoErro(criarApi({ apiKey: CHAVE, fetchImpl, timeoutMs: 1000 }).conversas('v'))).codigo).toBe('proibido')
  })

  it('M-4: 408 é passageiro (tempo_esgotado), 429 é limite_de_taxa; 401 segue http_4xx (o catálogo não tem código de chave)', async () => {
    expect((await codigoDoErro(mk([erroApi(408, null)]).api.conversas('v'))).codigo).toBe('tempo_esgotado')
    expect((await codigoDoErro(mk([erroApi(429, null)]).api.conversas('v'))).codigo).toBe('limite_de_taxa')
    expect((await codigoDoErro(mk([erroApi(401, null)]).api.conversas('v'))).codigo).toBe('http_4xx')
  })
})

describe('criarApi: a mensagem de todo erro é só o código', () => {
  const casos: Array<[string, Resp, 'conversas' | 'contagem']> = [
    ['403 desligados', { status: 403, body: { error: { code: 403, message: SENTINELA, errors: [{ reason: 'commentsDisabled', message: SENTINELA }] } } }, 'conversas'],
    ['403 reason com a sentinela', { status: 403, body: { error: { code: 403, message: SENTINELA, errors: [{ reason: SENTINELA }] } } }, 'conversas'],
    ['403 cota', { status: 403, body: { error: { message: SENTINELA, errors: [{ reason: 'quotaExceeded' }] } } }, 'conversas'],
    ['429', { status: 429, body: { error: { message: SENTINELA, errors: [{ reason: SENTINELA }] } } }, 'conversas'],
    ['404', { status: 404, body: { error: { message: SENTINELA, errors: [{ reason: 'videoNotFound' }] } } }, 'conversas'],
    ['400', { status: 400, body: { error: { message: SENTINELA, errors: [{ reason: 'a'.repeat(80) + SENTINELA }] } } }, 'conversas'],
    ['503', { status: 503, body: { error: { message: SENTINELA } } }, 'conversas'],
    ['200 html', { status: 200, raw: '<html>' + SENTINELA }, 'conversas'],
    ['200 com error', { status: 200, body: { error: { message: SENTINELA } } }, 'conversas'],
    ['contagem sem items', { status: 200, body: { nota: SENTINELA } }, 'contagem'],
    ['timeout', new DOMException(SENTINELA + ' ' + CHAVE, 'TimeoutError'), 'conversas'],
    ['rede com a URL e a chave na mensagem', new TypeError('fetch failed for https://x/?key=' + CHAVE + ' ' + SENTINELA), 'conversas'],
  ]
  for (const [nome, resp, quem] of casos) {
    it(nome, async () => {
      const { api } = mk([resp])
      const p = quem === 'contagem' ? api.contagem('v') : api.conversas('v')
      const { err } = await codigoDoErro(p)
      for (const t of [String(err), err.message, err.stack ?? '', JSON.stringify(err)]) {
        expect(t).not.toContain(SENTINELA)
        expect(t).not.toContain(CHAVE)
        expect(t).not.toContain('googleapis')
      }
      expect(err.message).toBe('comentarios: ' + err.codigo)
      expect((err as { cause?: unknown }).cause).toBeUndefined()
    })
  }
})

describe('criarApi: contagem', () => {
  it('commentCount "57" → 57', async () => {
    expect(await mk([ok({ items: [{ id: 'v', statistics: { commentCount: '57' } }] })]).api.contagem('v')).toBe(57)
    expect(await mk([ok({ items: [{ id: 'v', statistics: { commentCount: '0' } }] })]).api.contagem('v')).toBe(0)
  })
  it('ausente → nulo (sem statistics, sem commentCount, sem item, não numérico)', async () => {
    for (const items of [[{ id: 'v', statistics: {} }], [{ id: 'v' }], [], [{ statistics: { commentCount: 'muitos' } }]]) {
      expect(await mk([ok({ items })]).api.contagem('v')).toBeNull()
    }
  })
  it('sem items → lança resposta_sem_lista', async () => {
    expect((await codigoDoErro(mk([ok({})]).api.contagem('v'))).codigo).toBe('resposta_sem_lista')
  })
  it('403 commentsDisabled na contagem também sai classificado', async () => {
    expect((await codigoDoErro(mk([erroApi(403, 'quotaExceeded')]).api.contagem('v'))).codigo).toBe('cota_esgotada')
  })
})

describe('criarApi: corpo limpo na entrada (S-I2)', () => {
  const RUIM = /\u0000|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/
  function achaRuim(x: unknown): boolean {
    if (typeof x === 'string') return RUIM.test(x)
    if (Array.isArray(x)) return x.some(achaRuim)
    if (typeof x === 'object' && x !== null) return Object.entries(x).some(([k, v]) => RUIM.test(k) || achaRuim(v))
    return false
  }

  it('NUL e substituto solitário no nome do autor, na foto e no texto saem limpos; par válido (emoji) fica', async () => {
    const corpo = {
      items: [{
        id: 'T1',
        snippet: {
          topLevelComment: {
            id: 'T1',
            snippet: {
              authorDisplayName: 'Nome\u0000 Inventado\ud83d',
              authorProfileImageUrl: 'https://exemplo.invalido/\ude00foto.jpg',
              textDisplay: 'texto\u0000 com par 😀 e meio\ud800 par',
              'chave\u0000suja': 1,
              likeCount: 3,
            },
          },
        },
      }],
    }
    // a Response precisa carregar o texto cru: JSON.stringify já escapa o substituto solitário como \ud83d
    const { api } = mk([{ status: 200, raw: JSON.stringify(corpo) }])
    const saida = await api.conversas('v')
    expect(achaRuim(saida)).toBe(false)
    const s = JSON.stringify(saida)
    expect(s).not.toMatch(/\\u0000/)
    expect(s).not.toMatch(/\\ud[89ab][0-9a-f]{2}(?!\\ud[c-f])/i)
    expect(s).toContain('😀')
    expect(s).toContain('Nome Inventado')
  })

  it('a limpeza vale para as quatro chamadas', async () => {
    const sujo = { items: [{ x: 'a\u0000b' }] }
    for (const chamar of [
      (a: ReturnType<typeof criarApi>) => a.conversas('v'),
      (a: ReturnType<typeof criarApi>) => a.inscritos(['UC1']),
      (a: ReturnType<typeof criarApi>) => a.porId(['c1']),
    ]) {
      const saida = await chamar(mk([{ status: 200, raw: JSON.stringify(sujo) }]).api)
      expect(achaRuim(saida)).toBe(false)
    }
  })
})
