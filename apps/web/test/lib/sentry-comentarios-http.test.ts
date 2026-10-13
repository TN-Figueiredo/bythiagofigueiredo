// @vitest-environment node
//
// A5 · E14 · Tarefa 7a — prova de ponta a ponta com HTTP de verdade: servidor `http`
// local em 127.0.0.1, `@sentry/nextjs` inicializado com as MESMAS três funções que
// `sentry.server.config.ts` usa e um transporte que guarda os envelopes. Só dado
// inventado. As afirmações positivas existem para o teste não passar por não ter
// enviado nada; se a instrumentação de `fetch` não rodar sob o vitest, elas falham.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import * as Sentry from '@sentry/nextjs'
import { scrubBreadcrumbPii, scrubEventPii } from '@/lib/sentry-pii'

const ID_COMENTARIO = 'UgxSENTINELAcomentario01'
const ID_AUTOR = 'UCsentinelaAUTOR000000001'
const ROTAS = ['commentThreads', 'channels', 'comments', 'videos'] as const

describe('Sentry com HTTP de verdade: ids de comentário e de autor não saem do processo', () => {
  let servidor: Server
  let porta = 0
  const envelopes: string[] = []

  beforeAll(async () => {
    servidor = createServer((req, res) => {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ items: [], nextPageToken: null, rota: req.url?.split('?')[0] }))
    })
    await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok))
    porta = (servidor.address() as AddressInfo).port

    Sentry.init({
      dsn: 'https://publica@o0.ingest.sentry.io/0',
      tracesSampleRate: 1,
      sendDefaultPii: false,
      beforeSend: scrubEventPii,
      beforeSendTransaction: scrubEventPii,
      beforeBreadcrumb: scrubBreadcrumbPii,
      transport: () => ({
        send: async (envelope) => {
          envelopes.push(JSON.stringify(envelope))
          return {}
        },
        flush: async () => true,
      }),
    })
  })

  afterAll(async () => {
    await Sentry.close(2000)
    await new Promise<void>((ok) => servidor.close(() => ok()))
  })

  it('7. as quatro rotas, com o fetch global, dentro de um span', async () => {
    const base = `http://127.0.0.1:${porta}/youtube/v3`
    const consultas: Record<(typeof ROTAS)[number], string> = {
      commentThreads: `?part=snippet&videoId=VID123&allThreadsRelatedToChannelId=${ID_AUTOR}&key=K`,
      channels: `?part=statistics&id=${ID_AUTOR},UCsentinelaOUTRO0000002&key=K`,
      comments: `?part=snippet&id=${ID_COMENTARIO},UgxB&parentId=${ID_COMENTARIO}&textFormat=plainText&key=K`,
      videos: '?part=statistics&id=VID123&key=K',
    }
    await Sentry.startSpan({ name: 'prova-comentarios', op: 'test' }, async () => {
      for (const rota of ROTAS) {
        const r = await fetch(`${base}/${rota}${consultas[rota]}`)
        await r.json()
      }
    })
    Sentry.captureException(new Error('falha de teste'))
    await Sentry.flush(2000)

    const transacoes = envelopes.filter((e) => e.includes('"type":"transaction"'))
    const eventos = envelopes.filter((e) => e.includes('falha de teste'))
    expect(transacoes.length).toBeGreaterThan(0)
    expect(eventos.length).toBeGreaterThan(0)

    // Positivo: um span http.client por rota na transação, e um breadcrumb http por rota no erro.
    for (const rota of ROTAS) {
      expect(transacoes.some((t) => t.includes('http.client') && t.includes(`/youtube/v3/${rota}`))).toBe(true)
      expect(eventos.some((e) => e.includes('"category":"http"') && e.includes(`/youtube/v3/${rota}`))).toBe(true)
    }
    // A consulta de `videos` continua (só a chave sai): o diagnóstico dos outros módulos não quebra.
    expect(transacoes.some((t) => t.includes('id=VID123'))).toBe(true)

    // Negativo: nenhuma sentinela em nenhum envelope.
    expect(envelopes.length).toBeGreaterThan(0)
    for (const e of envelopes) {
      expect(e).not.toContain(ID_COMENTARIO)
      expect(e).not.toContain(ID_AUTOR)
      expect(e).not.toContain('sentinelaOUTRO')
      expect(e).not.toContain('UgxB')
    }
  })
})
