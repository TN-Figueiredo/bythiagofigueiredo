// @vitest-environment node
//
// C2 deviation: added the `node` pragma (absent from the plan's own test
// snippet) because the new "redact-secrets é livre de process.env" case does
// `readFileSync(new URL(..., import.meta.url))` — under the default happy-dom
// environment, `URL` is happy-dom's polyfill, not Node's WHATWG URL, and
// `fs.readFileSync` rejects it with "The URL must be of scheme file". This
// file is server-only (imported by sentry.server/edge.config.ts) so `node` is
// also the correct environment for it going forward, not just a workaround.
//
// Sprint 4 H1 — unit tests for the Sentry PII scrubber. These exercise the
// pure helper in isolation; the SDK integration in `sentry.*.config.ts`
// inherits the same behavior via direct import.
import { describe, it, expect } from 'vitest'
import {
  scrubBreadcrumbPii,
  scrubEmail,
  scrubEventPii,
  scrubPiiString,
  CPF_RE,
  EMAIL_RE,
  PHONE_RE,
  IPV4_RE,
  IPV6_RE,
} from '@/lib/sentry-pii'

describe('scrubEmail', () => {
  it('redacts a single email', () => {
    expect(scrubEmail('failed to send to alice@example.com'))
      .toBe('failed to send to <email>')
  })

  it('redacts multiple emails in the same string', () => {
    expect(
      scrubEmail('from=a@b.co to=c@d.co status=bounced'),
    ).toBe('from=<email> to=<email> status=bounced')
  })

  it('handles plus-addressed and dotted locals', () => {
    expect(scrubEmail('user.name+tag@sub.example.co.uk'))
      .toBe('<email>')
  })

  it('leaves strings without emails untouched', () => {
    expect(scrubEmail('connection reset by peer')).toBe('connection reset by peer')
  })

  it('EMAIL_RE is exported for ad-hoc reuse', () => {
    expect(EMAIL_RE.test('x@y.zz')).toBe(true)
  })
})

describe('scrubEventPii', () => {
  it('scrubs event.message', () => {
    const out = scrubEventPii({ message: 'rpc failed for admin@ring.com' })
    expect(out.message).toBe('rpc failed for <email>')
  })

  it('scrubs each exception.values[].value', () => {
    const out = scrubEventPii({
      exception: {
        values: [
          { value: 'duplicate key on user@x.com' },
          { value: 'no email here' },
        ],
      },
    })
    expect(out.exception?.values?.[0]!.value).toBe('duplicate key on <email>')
    expect(out.exception?.values?.[1]!.value).toBe('no email here')
  })

  it('scrubs each breadcrumb.message', () => {
    const out = scrubEventPii({
      breadcrumbs: [
        { message: 'click: [data-email="a@b.co"]' },
        { message: 'navigation: /cms' },
      ],
    })
    expect(out.breadcrumbs?.[0]!.message).toBe('click: [data-email="<email>"]')
    expect(out.breadcrumbs?.[1]!.message).toBe('navigation: /cms')
  })

  it('is a no-op on events without any of the scrubbable fields', () => {
    const event = {}
    expect(scrubEventPii(event)).toBe(event)
  })

  it('returns the same reference (mutation, not copy)', () => {
    const event = { message: 'x@y.z' }
    const out = scrubEventPii(event)
    expect(out).toBe(event)
    expect(event.message).toBe('<email>')
  })

  it('scrubs phone numbers in exception values', () => {
    const out = scrubEventPii({
      exception: { values: [{ value: 'contato +55 (11) 98765-4321 pediu exclusão' }] },
    })
    expect(out.exception?.values?.[0]!.value).toContain('[REDACTED_PHONE]')
    expect(out.exception?.values?.[0]!.value).not.toContain('98765-4321')
  })

  it('scrubs CPF in messages (both punctuated and raw)', () => {
    const out1 = scrubEventPii({ message: 'CPF 123.456.789-00 inválido' })
    expect(out1.message).toBe('CPF [REDACTED_CPF] inválido')
    const out2 = scrubEventPii({ message: 'CPF 12345678900 inválido' })
    expect(out2.message).toBe('CPF [REDACTED_CPF] inválido')
  })

  it('scrubs breadcrumb.data string values (fetch URLs, request bodies)', () => {
    const out = scrubEventPii({
      breadcrumbs: [
        { message: 'fetch', data: { url: 'https://api/foo?email=alice@x.com', status: 400 } },
      ],
    })
    expect(out.breadcrumbs?.[0]!.data?.url).toBe('https://api/foo?email=<email>')
    // Non-string values are preserved.
    expect(out.breadcrumbs?.[0]!.data?.status).toBe(400)
  })

  it('scrubs request.headers and request.data string payloads', () => {
    const out = scrubEventPii({
      request: {
        headers: { cookie: 'session=abc; user=alice@x.com' },
        data: '{"cpf":"123.456.789-00"}',
      },
    })
    expect(out.request?.headers?.cookie).toBe('session=abc; user=<email>')
    expect(out.request?.data).toBe('{"cpf":"[REDACTED_CPF]"}')
  })
})

describe('scrubBreadcrumbPii', () => {
  it('scrubs breadcrumb.message + breadcrumb.data strings', () => {
    const out = scrubBreadcrumbPii({
      message: 'fetch https://x/y?email=a@b.co',
      data: { body: 'CPF 12345678900', method: 'POST' },
    })
    expect(out.message).toBe('fetch https://x/y?email=<email>')
    expect(out.data?.body).toBe('CPF [REDACTED_CPF]')
    expect(out.data?.method).toBe('POST')
  })

  it('returns the same reference on no-op breadcrumb', () => {
    const bc = { message: 'navigation: /foo' }
    expect(scrubBreadcrumbPii(bc)).toBe(bc)
  })
})

describe('scrubPiiString / individual regexes', () => {
  it('PHONE_RE matches BR phone shape', () => {
    PHONE_RE.lastIndex = 0
    expect(PHONE_RE.test('+55 (11) 98765-4321')).toBe(true)
  })

  it('CPF_RE matches punctuated and raw forms', () => {
    CPF_RE.lastIndex = 0
    expect(CPF_RE.test('123.456.789-00')).toBe(true)
    CPF_RE.lastIndex = 0
    expect(CPF_RE.test('12345678900')).toBe(true)
  })

  it('scrubPiiString handles a single CPF, phone, and email in one go', () => {
    expect(
      scrubPiiString('cpf=123.456.789-00 fone=+55 (11) 98765-4321 email=a@b.co'),
    ).toBe('cpf=[REDACTED_CPF] fone=[REDACTED_PHONE] email=<email>')
  })

  it('IPV4_RE matches standard dotted-decimal IPv4', () => {
    IPV4_RE.lastIndex = 0
    expect(IPV4_RE.test('192.168.1.1')).toBe(true)
    IPV4_RE.lastIndex = 0
    expect(IPV4_RE.test('255.255.255.255')).toBe(true)
    IPV4_RE.lastIndex = 0
    expect(IPV4_RE.test('10.0.0.1')).toBe(true)
  })

  it('IPV6_RE matches compressed and full IPv6', () => {
    IPV6_RE.lastIndex = 0
    expect(IPV6_RE.test('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true)
    IPV6_RE.lastIndex = 0
    expect(IPV6_RE.test('::1')).toBe(true)
    IPV6_RE.lastIndex = 0
    expect(IPV6_RE.test('fe80::1')).toBe(true)
  })

  it('scrubPiiString redacts IPv4 and IPv6 addresses', () => {
    expect(scrubPiiString('request from 192.168.1.100 denied'))
      .toBe('request from [REDACTED_IP] denied')
    expect(scrubPiiString('client 2001:db8::ff00:42:8329 connected'))
      .toBe('client [REDACTED_IP] connected')
  })

  it('scrubs IPv4 in event messages', () => {
    const out = scrubEventPii({ message: 'rate limited ip=10.0.0.42' })
    expect(out.message).toBe('rate limited ip=[REDACTED_IP]')
  })
})

// ── C2: redação de segredos (spec §4) ────────────────────────────────────────
// 64 chars hex, SEM o prefixo `IG…` — a redação primária é por NOME de
// parâmetro, nunca pela forma do valor.
const RAW = 'a'.repeat(64)

describe('redação de segredos em query string (por nome de parâmetro)', () => {
  it('redige access_token sem prefixo IG', () => {
    expect(scrubPiiString(`GET https://graph.instagram.com/v25.0/me?fields=id&access_token=${RAW}`))
      .toContain('access_token=[REDACTED]')
    expect(scrubPiiString(`?access_token=${RAW}`)).not.toContain(RAW)
  })

  it('redige signed_request, code, client_secret, state e rebind', () => {
    for (const name of ['signed_request', 'code', 'client_secret', 'state', 'rebind']) {
      const s = scrubPiiString(`https://x/y?a=1&${name}=${RAW}&z=2`)
      expect(s, name).toContain(`${name}=[REDACTED]`)
      expect(s, name).not.toContain(RAW)
      expect(s, name).toContain('z=2')
    }
  })

  it('redige a forma NUA (sem ? nem & antes) numa mensagem de exceção', () => {
    expect(scrubPiiString(`refresh failed access_token=${RAW} after 3 tries`))
      .not.toContain(RAW)
  })

  it('redige a forma de ATRIBUIÇÃO/JSON de um corpo de troca ecoado', () => {
    expect(scrubPiiString(`{"access_token":"${RAW}","token_type":"bearer"}`))
      .not.toContain(RAW)
    expect(scrubPiiString(`client_secret: ${RAW}`)).not.toContain(RAW)
  })
})

describe('scrubEventPii — request.url e query_string', () => {
  it('redige request.url e request.query_string', () => {
    const event = {
      request: {
        url: `https://bythiagofigueiredo.com/api/instagram/oauth?account_id=1&rebind=${RAW}`,
        query_string: `code=${RAW}`,
      },
    }
    scrubEventPii(event)
    expect(event.request.url).not.toContain(RAW)
    expect(event.request.query_string).not.toContain(RAW)
  })

  it('redige o breadcrumb undici (data.url)', () => {
    const event = {
      breadcrumbs: [
        { message: 'http', data: { url: `https://graph.instagram.com/v25.0/me?access_token=${RAW}` } },
      ],
    }
    scrubEventPii(event)
    expect(String(event.breadcrumbs[0]!.data!.url)).not.toContain(RAW)
  })
})

describe('scrubEventPii — spans de transaction (beforeSendTransaction)', () => {
  it('redige span.description e as strings de span.data', () => {
    const url = `GET https://graph.instagram.com/v25.0/me?fields=id&access_token=${RAW}`
    const event = {
      spans: [{ description: url, data: { url, 'http.url': url, status: 'ok' } }],
    }
    scrubEventPii(event)
    expect(event.spans[0]!.description).not.toContain(RAW)
    expect(String(event.spans[0]!.data!.url)).not.toContain(RAW)
    expect(String(event.spans[0]!.data!['http.url'])).not.toContain(RAW)
    expect(event.spans[0]!.data!.status).toBe('ok')
  })
})

describe('registerSecretLiteral', () => {
  it('redige um literal registrado (SOCIAL_MASTER_KEY) em qualquer posição', async () => {
    const { registerSecretLiteral } = await import('@/lib/redact-secrets')
    const key = 'f'.repeat(64)
    registerSecretLiteral(key)
    expect(scrubPiiString(`createDecipheriv failed with key ${key}`)).not.toContain(key)
  })

  it('é no-op para valores curtos (< 16 chars) e para undefined', async () => {
    const { registerSecretLiteral } = await import('@/lib/redact-secrets')
    registerSecretLiteral('short')
    registerSecretLiteral(undefined)
    expect(scrubPiiString('short and sweet')).toBe('short and sweet')
  })
})

describe('redact-secrets é livre de process.env', () => {
  it('o fonte não lê process.env (os literais entram por registerSecretLiteral)', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(
      new URL('../../src/lib/redact-secrets.ts', import.meta.url),
      'utf8',
    )
    // Deviation from the plan's literal snippet: strip block comments before
    // asserting. The file's own doc comment documents (in prose) that it does
    // NOT read `process.env` — a plain substring check on the raw source
    // would fail on that very sentence even though no CODE in the file
    // references process.env. Stripping /* ... */ keeps the check meaningful
    // (no runtime access) without demanding the doc comment avoid the phrase.
    const withoutBlockComments = src.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(withoutBlockComments).not.toContain('process.env')
  })
})

describe('rede secundária: prefixo real do token (gate §7)', () => {
  // Substitua 'IGAAX' pelo prefixo colhido no Step 5 da Tarefa 1.
  it('redige um token com o prefixo real fora de query string', () => {
    const prefixed = `IGAAX${'b'.repeat(59)}`
    expect(scrubPiiString(`stored token ${prefixed} rejected`)).not.toContain(prefixed)
  })
})

// A5 · E14 · Tarefa 7a — ids de autor (UC…) e de comentário (Ugx…) nas chamadas
// às rotas `comments`, `commentThreads` e `channels` da YouTube Data API. As
// formas abaixo são as do SDK instalado (breadcrumb de fetch do Node: `url` sem
// query e a query em `http.query`; span `http.client`: `http.url`, `url.full`,
// `http.query`, `url.query`). Só dado inventado.
describe('A5 E14 — consulta das rotas de comentário some por campo', () => {
  const API = 'https://www.googleapis.com/youtube/v3'
  const ID_COMENTARIO = 'UgxSENTINELAcomentario01'
  const ID_AUTOR = 'UCsentinelaAUTOR000000001'
  const CONSULTA_COMENTARIOS = `?part=snippet&id=${ID_COMENTARIO},UgxB&textFormat=plainText&key=K`
  const CONSULTA_CANAIS = `?part=statistics&id=${ID_AUTOR}&key=K`

  it('1. breadcrumb http real: http.query vira [REDACTED] e a sentinela não sobra', () => {
    const b = scrubBreadcrumbPii({
      category: 'http',
      data: {
        url: `${API}/comments`,
        'http.method': 'GET',
        'http.query': CONSULTA_COMENTARIOS,
      },
    } as { category: string; data: Record<string, unknown> })
    expect(b.data['http.query']).toBe('[REDACTED]')
    expect(b.data['http.method']).toBe('GET')
    expect(b.data.url).toBe(`${API}/comments`)
    expect(JSON.stringify(b)).not.toContain('UgxSENTINELA')
  })

  it('2. span http.client real: os quatro campos e a descrição ficam sem o id', () => {
    const cheia = `${API}/channels${CONSULTA_CANAIS}`
    const ev = scrubEventPii({
      spans: [
        {
          op: 'http.client',
          description: `GET ${cheia}`,
          data: {
            'http.url': cheia,
            'url.full': cheia,
            'http.query': CONSULTA_CANAIS,
            'url.query': CONSULTA_CANAIS,
            'http.fragment': `#${ID_AUTOR}`,
            'url.fragment': `#${ID_AUTOR}`,
          },
        } as { description: string; data: Record<string, unknown> },
      ],
    })
    const span = ev.spans![0]
    expect(span.data!['http.url']).toBe(`${API}/channels?[REDACTED]`)
    expect(span.data!['url.full']).toBe(`${API}/channels?[REDACTED]`)
    expect(span.data!['http.query']).toBe('[REDACTED]')
    expect(span.data!['url.query']).toBe('[REDACTED]')
    expect(span.data!['http.fragment']).toBe('[REDACTED]')
    expect(span.data!['url.fragment']).toBe('[REDACTED]')
    expect(span.description).toBe(`GET ${API}/channels?[REDACTED]`)
    expect(JSON.stringify(ev)).not.toContain('sentinelaAUTOR')
  })

  it('3. commentThreads: a query some inteira', () => {
    const q = '?part=snippet&videoId=VID123&allThreadsRelatedToChannelId=UCsentinelaAUTOR000000001&key=K'
    const b = scrubBreadcrumbPii({
      data: { url: `${API}/commentThreads`, 'http.query': q },
    })
    expect(b.data!['http.query']).toBe('[REDACTED]')
    expect(JSON.stringify(b)).not.toContain('sentinelaAUTOR')
  })

  it('3b. sentinela do mesmo id em seis lugares do evento: nenhum sobra na serialização', () => {
    const cheia = `${API}/comments${CONSULTA_COMENTARIOS}&parentId=${ID_COMENTARIO}`
    const ev = scrubEventPii({
      breadcrumbs: [
        { category: 'http', data: { url: cheia, 'http.query': CONSULTA_COMENTARIOS } },
      ],
      spans: [
        {
          description: `GET ${cheia}`,
          data: { 'http.url': cheia, 'url.full': cheia, 'url.query': CONSULTA_COMENTARIOS },
        },
      ],
    })
    expect(JSON.stringify(ev)).not.toContain('SENTINELA')
    expect(JSON.stringify(ev)).not.toContain('UgxB')
  })

  it('3c. id com codificação de URL (%2C entre vários ids) também some', () => {
    const q = `?part=snippet&id=${ID_COMENTARIO}%2CUgxB%2CUgxC&key=K`
    const b = scrubBreadcrumbPii({ data: { url: `${API}/comments${q}` } })
    expect(JSON.stringify(b)).not.toContain('UgxSENTINELA')
    expect(JSON.stringify(b)).not.toContain('UgxB')
  })

  it('4. videos e playlistItems: http.query continua lá (sem a chave)', () => {
    for (const rota of ['videos', 'playlistItems']) {
      const b = scrubBreadcrumbPii({
        data: { url: `${API}/${rota}`, 'http.query': '?part=snippet&id=VID123&key=K' },
      })
      expect(b.data!['http.query']).toContain('id=VID123')
      expect(b.data!.url).toBe(`${API}/${rota}`)
    }
    const ev = scrubEventPii({
      spans: [
        {
          description: `GET ${API}/videos?part=snippet&id=VID123`,
          data: { 'http.url': `${API}/videos?id=VID123`, 'url.query': '?id=VID123' },
        },
      ],
    })
    expect(ev.spans![0].description).toBe(`GET ${API}/videos?part=snippet&id=VID123`)
    expect(ev.spans![0].data!['url.query']).toBe('?id=VID123')
  })

  it('4b. rota que só começa igual (commentsX, channelsX) não casa', () => {
    const b = scrubBreadcrumbPii({
      data: { url: `${API}/commentsX`, 'http.query': '?id=VID123' },
    })
    expect(b.data!['http.query']).toBe('?id=VID123')
  })

  it('5. breadcrumb sem data, span sem data, data.url que não é texto: não lança e não muda nada', () => {
    expect(() => scrubBreadcrumbPii({ message: 'oi' })).not.toThrow()
    expect(scrubBreadcrumbPii({ message: 'oi' })).toEqual({ message: 'oi' })
    expect(() => scrubEventPii({ spans: [{ description: 'x' }] })).not.toThrow()
    expect(scrubEventPii({ spans: [{ description: 'x' }] }).spans).toEqual([{ description: 'x' }])
    expect(scrubEventPii({})).toEqual({})
    const b = scrubBreadcrumbPii({
      data: { url: 42, 'http.url': null, 'url.full': { a: 1 }, 'http.query': ['?id=x'] },
    })
    expect(b.data).toEqual({ url: 42, 'http.url': null, 'url.full': { a: 1 }, 'http.query': ['?id=x'] })
  })

  it('5b. valor que não é texto numa rota de comentário: o dado cru nunca sobra', () => {
    const circular: Record<string, unknown> = { url: `${API}/comments` }
    circular.self = circular
    circular['http.query'] = { id: ID_COMENTARIO }
    circular['url.query'] = [ID_COMENTARIO]
    const b = scrubBreadcrumbPii({ data: circular })
    expect(() => scrubBreadcrumbPii({ data: circular })).not.toThrow()
    // Sem texto para redigir, o campo estranho sai inteiro (fail-closed) ou fica redigido.
    const saida = b.data as Record<string, unknown> | undefined
    expect(JSON.stringify(saida ?? null, (_k, v) => (v === circular ? '[ciclo]' : v)))
      .not.toContain('UgxSENTINELA')
  })

  it('5c. getter que lança dentro de data: o breadcrumb sai sem data, nunca com dado cru', () => {
    const data: Record<string, unknown> = { 'http.query': `?id=${ID_COMENTARIO}` }
    Object.defineProperty(data, 'url', {
      enumerable: true,
      get() {
        throw new Error('boom')
      },
    })
    const b = scrubBreadcrumbPii({ data })
    expect(b.data).toBeUndefined()
  })

  it('5d. evento com span de getter que lança: sai sem spans, sem lançar', () => {
    const data: Record<string, unknown> = { 'url.query': `?id=${ID_COMENTARIO}` }
    Object.defineProperty(data, 'http.url', {
      enumerable: true,
      get() {
        throw new Error('boom')
      },
    })
    const ev = scrubEventPii({ spans: [{ description: `GET ${API}/comments`, data }] })
    expect(ev.spans).toBeUndefined()
  })

  it('5e. profundidade grande em data: não lança e a sentinela não sobra', () => {
    let fundo: Record<string, unknown> = { x: `${API}/comments?id=${ID_COMENTARIO}` }
    for (let i = 0; i < 200; i++) fundo = { n: fundo }
    const b = scrubBreadcrumbPii({
      data: { url: `${API}/comments`, 'http.query': CONSULTA_COMENTARIOS, fundo },
    })
    expect(b.data!['http.query']).toBe('[REDACTED]')
    expect(JSON.stringify(b)).not.toContain('UgxSENTINELA')
  })

  it('6. host diferente com o mesmo caminho (127.0.0.1:PORTA) também é redigido', () => {
    const b = scrubBreadcrumbPii({
      data: {
        url: `http://127.0.0.1:41234/youtube/v3/comments`,
        'http.query': CONSULTA_COMENTARIOS,
      },
    })
    expect(b.data!['http.query']).toBe('[REDACTED]')
    const ev = scrubEventPii({
      spans: [
        {
          description: `GET http://127.0.0.1:41234/youtube/v3/commentThreads${CONSULTA_COMENTARIOS}`,
          data: { 'http.url': `http://127.0.0.1:41234/youtube/v3/commentThreads${CONSULTA_COMENTARIOS}` },
        },
      ],
    })
    expect(JSON.stringify(ev)).not.toContain('UgxSENTINELA')
  })

})
