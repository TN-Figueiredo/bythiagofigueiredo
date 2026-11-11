// @vitest-environment node
// A4 R6 `clientInfo`: com o `createMcpHandler` REAL (o mesmo da rota), o nome do cliente do `initialize` chega à ferramenta?
import { describe, expect, it, vi } from 'vitest'
import { createMcpHandler } from 'mcp-handler'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: () => undefined, captureException: () => undefined }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({
    rpc: () => ({ abortSignal: async () => ({ data: [{ no_minuto: 1, no_dia: 1 }], error: null }) }),
    from: () => ({ insert: () => ({ abortSignal: async () => ({ error: null }) }) }),
  }) }))

import { comContextoDoObservatorio, type ContextoDoObservatorio } from '@/lib/pipeline/mcp/observatorio/contexto'
import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'
import type { Responder } from '@/lib/pipeline/mcp/observatorio/executar'
import { NOME_DA_FERRAMENTA, registrarServidorDoObservatorio } from '@/lib/pipeline/mcp/observatorio/servidor'

const ctx = (): ContextoDoObservatorio => ({ prova: fabricarProva('s', 'u', 'k', '2999-01-01T00:00:00Z'), acesso: { leitura: null, edita: false, negativa: 'sem_direito' }, t0: Date.now() })
const HEADERS = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }
const post = (h: (r: Request) => Promise<Response>, body: unknown) =>
  h(new Request('http://localhost/api/mcp', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) }))

describe('A4 R6: clientInfo.name do initialize', () => {
  it('no servidor sem estado do mcp-handler, o nome NÃO chega ao callback da ferramenta (dívida)', async () => {
    const vistos: Array<{ cliente: unknown }> = []
    let srv: { server: { getClientVersion(): { name: string } | undefined } } | null = null
    const responder: Responder = async () => {
      vistos.push({ cliente: srv?.server.getClientVersion()?.name })
      return { texto: 'x', desfecho: 'ok' as const, incluiuPrivado: false, params: { acao: 'definicoes' } }
    }
    const handler = createMcpHandler(
      (server) => { srv = server; registrarServidorDoObservatorio(server, responder) },
      {},
      { basePath: '/api', maxDuration: 60, verboseLogs: false },
    ) as unknown as (r: Request) => Promise<Response>

    const init = await post(handler, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'claude-ai', version: '9.9' } } })
    expect(init.status).toBe(200)
    await init.text()
    const r = await comContextoDoObservatorio(ctx(), () => post(handler, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: NOME_DA_FERRAMENTA, arguments: { acao: 'definicoes' } } }))
    await r.text()
    expect(vistos.length).toBeGreaterThan(0)
    // dívida: clientInfo não chega ao callback (R6). Cada POST cria um McpServer novo; o do tools/call nunca viu o initialize.
    expect(vistos[0]!.cliente).toBeUndefined()
  })
})
