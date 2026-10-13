// @vitest-environment node
//
// A5 — a chave da YouTube Data API viaja na query (`...&key=<CHAVE>`). O SDK do
// Sentry 10.x NÃO põe a query no `url` das requisições de saída: ela vai num campo
// separado (`http.query`, `url.query`) e também em `http.url`/`url.full`. Estes testes
// montam eventos no formato REAL do SDK instalado (node-core/outgoingFetchRequest.js,
// core/fetch.js, core/utils/url.js) e chamam os ganchos de verdade. NENHUM evento é
// enviado ao Sentry: só as funções puras de `beforeSend`/`beforeBreadcrumb`.
import { describe, it, expect } from 'vitest'
import { redigirSegredosDeUrl, redigirSegredosEmProfundidade } from '@/lib/redigir-segredos-de-url'
import { scrubBreadcrumbPii, scrubEventPii } from '@/lib/sentry-pii'

const CHAVE = 'AIzaSyFAKE-chave_123'
const BASE = 'https://www.googleapis.com/youtube/v3/videos'
const QUERY = `?part=snippet&key=${CHAVE}&id=x`

function semChave(valor: unknown): void {
  expect(JSON.stringify(valor)).not.toContain(CHAVE)
}

describe('redigirSegredosDeUrl — variações de posição e forma', () => {
  it('key= no meio da query: o resto da URL fica legível', () => {
    const out = redigirSegredosDeUrl(`${BASE}${QUERY}`)
    expect(out).toBe(`${BASE}?part=snippet&key=[REDACTED]&id=x`)
  })

  it('key= no começo da query', () => {
    expect(redigirSegredosDeUrl(`${BASE}?key=${CHAVE}&id=x`)).toBe(`${BASE}?key=[REDACTED]&id=x`)
  })

  it('key= no fim da query', () => {
    expect(redigirSegredosDeUrl(`${BASE}?id=x&key=${CHAVE}`)).toBe(`${BASE}?id=x&key=[REDACTED]`)
  })

  it('query solta (http.query) começando em ?', () => {
    expect(redigirSegredosDeUrl(QUERY)).toBe('?part=snippet&key=[REDACTED]&id=x')
  })

  it('query sem o ? inicial (query_string de request)', () => {
    expect(redigirSegredosDeUrl(`part=snippet&key=${CHAVE}`)).toBe('part=snippet&key=[REDACTED]')
    expect(redigirSegredosDeUrl(`key=${CHAVE}`)).toBe('key=[REDACTED]')
  })

  it('separador &amp; (URL copiada de HTML)', () => {
    expect(redigirSegredosDeUrl(`${BASE}?part=snippet&amp;key=${CHAVE}&amp;id=x`)).toBe(
      `${BASE}?part=snippet&amp;key=[REDACTED]&amp;id=x`,
    )
  })

  it('maiúsculas (KEY=, Key=)', () => {
    expect(redigirSegredosDeUrl(`${BASE}?KEY=${CHAVE}&id=x`)).toBe(`${BASE}?KEY=[REDACTED]&id=x`)
    expect(redigirSegredosDeUrl(`${BASE}?id=x&Key=${CHAVE}`)).toBe(`${BASE}?id=x&Key=[REDACTED]`)
  })

  it('valor com caracteres codificados (%2B, %2F)', () => {
    const out = redigirSegredosDeUrl(`${BASE}?key=AIza%2Babc%2Fdef-ghi_jkl&id=x`)
    expect(out).toBe(`${BASE}?key=[REDACTED]&id=x`)
  })

  it('URL aninhada codificada (key%3D)', () => {
    const out = redigirSegredosDeUrl(`https://x.test/r?u=${encodeURIComponent(`${BASE}${QUERY}`)}`)
    expect(out).not.toContain(CHAVE)
    expect(out).toContain('id%3Dx')
  })

  it('fragmento (#access_token=...)', () => {
    expect(redigirSegredosDeUrl('https://x.test/cb#access_token=abc123&state=1')).toBe(
      'https://x.test/cb#access_token=[REDACTED]&state=1',
    )
  })

  it.each(['access_token', 'api_key', 'apikey', 'api-key', 'token', 'id_token', 'refresh_token'])(
    'redige %s=',
    (nome) => {
      const out = redigirSegredosDeUrl(`https://api.test/v1/x?q=ok&${nome}=SEGREDO123&z=1`)
      expect(out).toBe(`https://api.test/v1/x?q=ok&${nome}=[REDACTED]&z=1`)
    },
  )

  it('X-Pipeline-Key e Authorization em texto (cabeçalho ecoado)', () => {
    expect(redigirSegredosDeUrl('sent x-pipeline-key: SEGREDO123 to /api')).not.toContain('SEGREDO123')
    expect(redigirSegredosDeUrl('X-Pipeline-Key=SEGREDO123')).not.toContain('SEGREDO123')
    const auth = redigirSegredosDeUrl('Authorization: Bearer SEGREDO123')
    expect(auth).not.toContain('SEGREDO123')
    expect(auth).toContain('Authorization')
  })

  it('JSON com a chave ("key":"...") não é tocado por nome genérico, mas a forma AIza... sai em qualquer lugar', () => {
    const real = `AIza${'a'.repeat(35)}`
    expect(redigirSegredosDeUrl(`erro ao chamar com ${real} agora`)).not.toContain(real)
  })

  it('texto sem segredo sai idêntico (mesma string)', () => {
    for (const s of [
      '',
      'connection reset by peer',
      `${BASE}?part=snippet&id=x`,
      'primary monkey=1 keyboard=2 turkey 3',
      'https://x.test/blog?page=2&sort=asc',
    ]) {
      expect(redigirSegredosDeUrl(s)).toBe(s)
    }
  })

  it('não lança com entrada não-string', () => {
    expect(() => redigirSegredosDeUrl(undefined as unknown as string)).not.toThrow()
    expect(() => redigirSegredosDeUrl(null as unknown as string)).not.toThrow()
  })
})

describe('redigirSegredosEmProfundidade', () => {
  it('percorre objetos e arrays aninhados', () => {
    const o = { a: { b: [{ c: `${BASE}${QUERY}` }] }, n: 3, ok: true, nulo: null }
    redigirSegredosEmProfundidade(o)
    semChave(o)
    expect(o.a.b[0]!.c).toContain('id=x')
    expect(o.n).toBe(3)
    expect(o.nulo).toBeNull()
  })

  it('redige por NOME de chave (cabeçalhos e campos sensíveis)', () => {
    const o = {
      Authorization: 'Bearer SEGREDO123',
      'X-Pipeline-Key': 'SEGREDO123',
      'x-api-key': 'SEGREDO123',
      api_key: 'SEGREDO123',
      access_token: 'SEGREDO123',
      'content-type': 'application/json',
    }
    redigirSegredosEmProfundidade(o)
    expect(JSON.stringify(o)).not.toContain('SEGREDO123')
    expect(o['content-type']).toBe('application/json')
  })

  it('tolera referência circular e profundidade enorme sem lançar', () => {
    const a: Record<string, unknown> = { url: `${BASE}${QUERY}` }
    a.self = a
    expect(() => redigirSegredosEmProfundidade(a)).not.toThrow()
    semChave(a.url)

    let fundo: Record<string, unknown> = { url: `${BASE}${QUERY}` }
    for (let i = 0; i < 200; i++) fundo = { filho: fundo }
    expect(() => redigirSegredosEmProfundidade(fundo)).not.toThrow()
  })

  it('redige a mensagem de um Error dentro de extra', () => {
    const err = new Error(`fetch falhou: ${BASE}${QUERY}`)
    const o = { err }
    redigirSegredosEmProfundidade(o)
    expect(o.err.message).not.toContain(CHAVE)
    expect(String(o.err.stack ?? '')).not.toContain(CHAVE)
  })

  it('não lança com propriedade somente leitura', () => {
    const o = Object.freeze({ url: `${BASE}${QUERY}` })
    expect(() => redigirSegredosEmProfundidade(o)).not.toThrow()
  })
})

describe('ganchos do Sentry com eventos no formato real do SDK', () => {
  it('(a) breadcrumb de fetch do node-core: data.url sem query + http.query separado', () => {
    // node-core/utils/outgoingFetchRequest.js getBreadcrumbData
    const bc = scrubBreadcrumbPii({
      type: 'http',
      category: 'http',
      data: {
        url: BASE,
        'http.method': 'GET',
        'http.query': QUERY,
        'http.fragment': '#frag',
        status_code: 200,
      },
    })
    semChave(bc)
    expect(bc.data?.['http.query']).toBe('?part=snippet&key=[REDACTED]&id=x')
    expect(bc.data?.url).toBe(BASE)
    expect(bc.data?.status_code).toBe(200)
  })

  it('(a) breadcrumb de fetch do browser/edge: data.url COM query', () => {
    const bc = scrubBreadcrumbPii({
      type: 'http',
      category: 'fetch',
      data: { method: 'GET', url: `${BASE}${QUERY}`, status_code: 200 },
    })
    semChave(bc)
    expect(bc.data?.url).toBe(`${BASE}?part=snippet&key=[REDACTED]&id=x`)
  })

  it('(a) o mesmo breadcrumb dentro de um evento de erro', () => {
    const ev = scrubEventPii({
      breadcrumbs: [
        { category: 'http', data: { url: BASE, 'http.query': QUERY } },
        { category: 'fetch', data: { url: `${BASE}${QUERY}` } },
      ],
    })
    semChave(ev)
  })

  it('(b) transação: spans[] com http.query/url.query/http.url/url.full/description', () => {
    // core/fetch.js getFetchSpanAttributes + core/utils/url.js getHttpSpanDetailsFromUrlObject
    const ev = scrubEventPii({
      type: 'transaction',
      transaction: 'GET /api/cron/sync-youtube',
      spans: [
        {
          op: 'http.client',
          description: `GET ${BASE}${QUERY}`,
          data: {
            url: `${BASE}${QUERY}`,
            type: 'fetch',
            'http.method': 'GET',
            'http.url': `${BASE}${QUERY}`,
            'http.query': QUERY,
            'http.fragment': '#f',
            'server.address': 'www.googleapis.com',
            'url.full': `${BASE}${QUERY}`,
            'url.query': QUERY,
            'url.path': '/youtube/v3/videos',
            'http.response.status_code': 200,
            'sentry.op': 'http.client',
          },
        },
      ],
      contexts: {
        trace: {
          op: 'http.server',
          data: { 'url.query': QUERY, 'url.full': `${BASE}${QUERY}`, 'http.query': QUERY },
        },
      },
    })
    semChave(ev)
    const d = ev.spans![0]!.data!
    expect(d['http.query']).toBe('?part=snippet&key=[REDACTED]&id=x')
    expect(d['url.query']).toBe('?part=snippet&key=[REDACTED]&id=x')
    expect(d['http.url']).toBe(`${BASE}?part=snippet&key=[REDACTED]&id=x`)
    expect(d['url.full']).toBe(`${BASE}?part=snippet&key=[REDACTED]&id=x`)
    expect(d['url.path']).toBe('/youtube/v3/videos')
    expect(d['http.response.status_code']).toBe(200)
  })

  it('(c) exceção: mensagem, extra, contexts, tags e logentry com a URL', () => {
    const url = `${BASE}${QUERY}`
    const ev = scrubEventPii({
      message: `falhou ${url}`,
      exception: { values: [{ type: 'TypeError', value: `Failed to parse URL from ${url}` }] },
      extra: { url, aninhado: { lista: [url] }, n: 7 },
      contexts: { fetch: { url, status: 500 } },
      tags: { alvo: url, componente: 'sync-youtube' },
      logentry: { message: `chamando ${url}` },
    })
    semChave(ev)
    expect(ev.extra?.url).toBe(`${BASE}?part=snippet&key=[REDACTED]&id=x`)
    expect((ev.extra as { n: number }).n).toBe(7)
    expect(ev.tags?.componente).toBe('sync-youtube')
    expect(ev.exception?.values?.[0]!.value).toContain('id=x')
  })

  it('(d) request.url e request.query_string do próprio evento', () => {
    const ev = scrubEventPii({
      request: {
        url: `https://bythiagofigueiredo.com/api/x${QUERY}`,
        query_string: `part=snippet&key=${CHAVE}&id=x`,
        headers: { Authorization: 'Bearer SEGREDO123', 'X-Pipeline-Key': 'SEGREDO123', 'x-pipeline-key': 'SEGREDO123' },
        data: { api_key: 'SEGREDO123', ok: 'sim' },
      },
    })
    semChave(ev)
    expect(JSON.stringify(ev)).not.toContain('SEGREDO123')
    expect(ev.request?.url).toContain('id=x')
    expect(ev.request?.query_string).toBe('part=snippet&key=[REDACTED]&id=x')
  })

  it('(d) request.query_string em forma de objeto e de lista de pares', () => {
    const ev = scrubEventPii({
      request: { query_string: { key: CHAVE, id: 'x' } as unknown as string },
    })
    semChave(ev)
    const ev2 = scrubEventPii({
      request: { query_string: [['key', CHAVE], ['id', 'x']] as unknown as string },
    })
    semChave(ev2)
  })

  it('evento sem segredo sai idêntico (mesmo conteúdo)', () => {
    const fabrica = () => ({
      message: 'algo aconteceu em /blog',
      exception: { values: [{ type: 'Error', value: 'falha comum' }] },
      breadcrumbs: [
        { category: 'http', message: 'ok', data: { url: BASE, 'http.query': '?part=snippet&id=x', status_code: 200 } },
      ],
      extra: { a: 1, b: 'texto', c: { d: [1, 2, 3] } },
      contexts: { runtime: { name: 'node', version: '22' } },
      tags: { componente: 'x' },
      request: { url: 'https://x.test/blog?page=2', query_string: 'page=2', headers: { accept: 'text/html' } },
      spans: [{ description: `GET ${BASE}`, data: { 'http.query': '?part=snippet&id=x', 'url.path': '/v3/videos' } }],
    })
    const a = fabrica()
    const b = fabrica()
    scrubEventPii(a)
    expect(a).toEqual(b)
  })

  it('um erro dentro do gancho não propaga (objeto hostil)', () => {
    const hostil = {
      get extra(): never {
        throw new Error('getter hostil')
      },
      message: `x ${BASE}${QUERY}`,
    }
    expect(() => scrubEventPii(hostil as never)).not.toThrow()
    const bc = {
      get data(): never {
        throw new Error('getter hostil')
      },
    }
    expect(() => scrubBreadcrumbPii(bc as never)).not.toThrow()
  })
})
