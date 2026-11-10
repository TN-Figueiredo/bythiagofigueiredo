// @vitest-environment node
// A7 Fatia 3, conserto I1: pela FERRAMENTA REGISTRADA (cliente em memória), com o `responder` real e o registro real, a validação estrita é a nossa.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

const m = vi.hoisted(() => ({ empacotar: {} as Record<string, unknown>, banco: null as unknown }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: () => undefined, captureException: () => undefined }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => m.banco }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: m.empacotar }))

import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'
import { ACOES } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { comContextoDoObservatorio, type ContextoDoObservatorio } from '@/lib/pipeline/mcp/observatorio/contexto'
import type { Responder } from '@/lib/pipeline/mcp/observatorio/executar'
import { NOME_DA_FERRAMENTA, registrarServidorDoObservatorio } from '@/lib/pipeline/mcp/observatorio/servidor'

const C1 = '11111111-1111-4111-8111-111111111111'
const ctx = (): ContextoDoObservatorio => ({ prova: fabricarProva('s', 'u', 'k', '2999-01-01T00:00:00Z'), acesso: { leitura: null, edita: false, negativa: 'sem_direito' }, t0: Date.now() })

let linhas: Array<Record<string, unknown>>
let chamado: ReturnType<typeof vi.fn>
beforeEach(() => {
  linhas = []
  m.empacotar.outliers = vi.fn(async () => null); m.empacotar.canais = vi.fn(async () => null); m.empacotar.canal = vi.fn(async () => null)
  m.banco = {
    rpc: () => ({ abortSignal: async () => ({ data: [{ no_minuto: 1, no_dia: 1 }], error: null }) }),
    from: () => ({ insert: (l: Record<string, unknown>) => ({ abortSignal: async () => { linhas.push(l); return { error: null } } }) }),
  }
  chamado = vi.fn()
})

async function chamar(args: Record<string, unknown>) {
  const real: Responder = async (e, _c, agora) => { chamado(e); return responder(e, ABRIDOR_DE_SESSAO, agora) }
  const server = new McpServer({ name: 't', version: '1.0.0' })
  registrarServidorDoObservatorio(server, real)
  const [ct, st] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 't', version: '1.0.0' }, { capabilities: {} })
  await Promise.all([server.connect(st), client.connect(ct)])
  return comContextoDoObservatorio(ctx(), () => client.callTool({ name: NOME_DA_FERRAMENTA, arguments: args })) as Promise<{ isError?: boolean; content: Array<{ text: string }> }>
}
const params = (): Record<string, unknown> => linhas[0]!.params as Record<string, unknown>

describe('A7 F3 I1: a validação estrita é a nossa, pela ferramenta registrada', () => {
  it('(a) ação inexistente: a nossa recusa (formato e exemplo), sem ecoar o valor, e entra no registro', async () => {
    const r = await chamar({ acao: 'xpto-SEGREDO' })
    expect(chamado).toHaveBeenCalled()
    const texto = r.content[0]!.text
    expect(texto).toContain(`Ações: ${ACOES.join(', ')}`)
    expect(texto).toContain('Exemplo válido:')
    expect(texto).not.toContain('xpto')
    expect(texto).not.toContain('SEGREDO')
    expect(linhas).toHaveLength(1)
    expect(params()).toMatchObject({ desfecho: 'pedido_invalido', campos_invalidos: ['acao'] })
    expect(JSON.stringify(linhas[0])).not.toContain('SEGREDO')
  })
  it('(b) campo sobrando: recusa nossa (não ok), grava (desconhecido), sem ecoar', async () => {
    const r = await chamar({ acao: 'canal', canal_id: C1, ZZ_CAMPO: 'SEGREDO-9' })
    expect(chamado.mock.calls[0]![0]).toMatchObject({ ZZ_CAMPO: 'SEGREDO-9' })
    expect(params()).toMatchObject({ desfecho: 'pedido_invalido', campos_invalidos: ['(desconhecido)'] })
    expect(r.content[0]!.text).toContain('pedido recusado')
    expect(r.content[0]!.text).not.toContain('ZZ_CAMPO')
    expect(r.content[0]!.text).not.toContain('SEGREDO')
  })
  it('(c) nada que antes era recusado passa a ser aceito', async () => {
    for (const args of [{ acao: 'destaques', formato: 'longo' }, { acao: 'listar_canais', janela: 45 }, { acao: 'xpto' }, { acao: 'definicoes', x: 1 }]) {
      linhas = []
      const r = await chamar(args)
      expect(params().desfecho, JSON.stringify(args)).toBe('pedido_invalido')
      expect(r.content[0]!.text, JSON.stringify(args)).toContain('pedido recusado')
    }
  })
  it('(c) o que o SDK ainda barra (acao ausente, tipo errado) continua recusado, sem eco', async () => {
    for (const args of [{}, { acao: 'comparar', canal_ids: 'SEGREDO-1' }]) {
      const r = await chamar(args)
      expect(r.isError, JSON.stringify(args)).toBe(true)
    }
  })
  it('o que era aceito continua aceito', async () => {
    await chamar({ acao: 'definicoes' })
    expect(chamado).toHaveBeenCalled()
    expect(params().desfecho).not.toBe('pedido_invalido')
  })
  it('o schema publicado ainda mostra o enum das ações à IA', async () => {
    const server = new McpServer({ name: 't', version: '1.0.0' })
    registrarServidorDoObservatorio(server, async () => { throw new Error('x') })
    const [ct, st] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 't', version: '1.0.0' }, { capabilities: {} })
    await Promise.all([server.connect(st), client.connect(ct)])
    const js = JSON.stringify((await client.listTools()).tools[0]!.inputSchema)
    for (const a of ACOES) expect(js).toContain(`"${a}"`)
  })
})
