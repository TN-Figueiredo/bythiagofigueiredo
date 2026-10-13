// @vitest-environment node
//
// A5 — cada `Sentry.init` do site (servidor, edge, cliente) tem de ligar a redação da
// chave de API em TODOS os seus ganchos. O `Sentry.init` é substituído por um espião:
// nada é inicializado de verdade e NENHUM evento é enviado. Os ganchos capturados são
// chamados direto com eventos no formato real do SDK.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const CHAVE = 'AIzaSyFAKE-chave_123'
const BASE = 'https://www.googleapis.com/youtube/v3/videos'
const QUERY = `?part=snippet&key=${CHAVE}&id=x`

interface Opcoes {
  beforeSend?: (e: Record<string, unknown>) => unknown
  beforeSendTransaction?: (e: Record<string, unknown>) => unknown
  beforeBreadcrumb?: (b: Record<string, unknown>) => unknown
}

let capturadas: Opcoes[] = []

async function carregar(arquivo: string): Promise<Opcoes> {
  capturadas = []
  vi.resetModules()
  vi.doMock('@sentry/nextjs', () => ({
    init: (o: Opcoes) => {
      capturadas.push(o)
    },
    getClient: () => undefined,
    browserTracingIntegration: () => ({}),
    replayIntegration: () => ({ start() {}, stop() {} }),
  }))
  await import(/* @vite-ignore */ arquivo)
  expect(capturadas).toHaveLength(1)
  return capturadas[0]!
}

function transacao() {
  return {
    type: 'transaction',
    spans: [
      {
        op: 'http.client',
        description: `GET ${BASE}`,
        data: { url: BASE, 'http.url': `${BASE}${QUERY}`, 'http.query': QUERY, 'url.full': `${BASE}${QUERY}`, 'url.query': QUERY },
      },
    ],
    contexts: { trace: { data: { 'url.query': QUERY } } },
  }
}

function erro() {
  return {
    message: `falhou ${BASE}${QUERY}`,
    exception: { values: [{ value: `Failed to parse URL from ${BASE}${QUERY}` }] },
    extra: { url: `${BASE}${QUERY}` },
    tags: { alvo: `${BASE}${QUERY}` },
    contexts: { x: { url: `${BASE}${QUERY}` } },
    breadcrumbs: [{ category: 'http', data: { url: BASE, 'http.query': QUERY } }],
    request: { url: `https://x.test/a${QUERY}`, query_string: `key=${CHAVE}&id=x` },
  }
}

describe('configurações do Sentry do site redigem a chave de API', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://publica@o0.ingest.example.invalid/0')
    vi.stubEnv('SENTRY_DSN', 'https://publica@o0.ingest.example.invalid/0')
  })
  afterEach(() => {
    vi.doUnmock('@sentry/nextjs')
    vi.unstubAllEnvs()
  })

  it.each(['../../sentry.server.config.ts', '../../sentry.edge.config.ts'])(
    '%s: beforeSend, beforeSendTransaction e beforeBreadcrumb',
    async (arquivo) => {
      const o = await carregar(arquivo)
      expect(typeof o.beforeSend).toBe('function')
      expect(typeof o.beforeSendTransaction).toBe('function')
      expect(typeof o.beforeBreadcrumb).toBe('function')
      expect(JSON.stringify(o.beforeSend!(erro()))).not.toContain(CHAVE)
      expect(JSON.stringify(o.beforeSendTransaction!(transacao()))).not.toContain(CHAVE)
      const bc = o.beforeBreadcrumb!({ category: 'http', data: { url: BASE, 'http.query': QUERY } })
      expect(JSON.stringify(bc)).not.toContain(CHAVE)
    },
  )

  it('sentry.client.config.ts: beforeSend, beforeSendTransaction e beforeBreadcrumb', async () => {
    // O arquivo só inicia quando há `window`.
    vi.stubGlobal('window', {
      localStorage: { getItem: () => null },
      addEventListener: () => undefined,
    })
    try {
      const o = await carregar('../../sentry.client.config.ts')
      expect(typeof o.beforeSend).toBe('function')
      expect(typeof o.beforeSendTransaction).toBe('function')
      expect(typeof o.beforeBreadcrumb).toBe('function')
      expect(JSON.stringify(o.beforeSend!(erro()))).not.toContain(CHAVE)
      expect(JSON.stringify(o.beforeSendTransaction!(transacao()))).not.toContain(CHAVE)
      const bc = o.beforeBreadcrumb!({ category: 'fetch', data: { url: `${BASE}${QUERY}` } })
      expect(JSON.stringify(bc)).not.toContain(CHAVE)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
