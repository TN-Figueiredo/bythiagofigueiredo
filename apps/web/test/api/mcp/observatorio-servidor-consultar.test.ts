// @vitest-environment node
// A4 R5 T9: a 11ª ação pela FERRAMENTA REGISTRADA (cliente MCP em memória): esquema tolerante, descrição, instruções, registro.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

const m = vi.hoisted(() => ({ empacotar: {} as Record<string, unknown>, banco: null as unknown, montar: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: () => undefined, captureException: () => undefined }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => m.banco }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: m.empacotar }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_consultar/dados', () => ({ lugaresParaDefinicoes: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_consultar/montar', () => ({ montarConsulta: m.montar }))

import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'
import { comContextoDoObservatorio, type ContextoDoObservatorio } from '@/lib/pipeline/mcp/observatorio/contexto'
import type { Responder } from '@/lib/pipeline/mcp/observatorio/executar'
import { DESCRICAO, INSTRUCOES, ITENS_DE_INSTRUCAO, NOME_DA_FERRAMENTA, registrarServidorDoObservatorio } from '@/lib/pipeline/mcp/observatorio/servidor'

const ctx = (): ContextoDoObservatorio => ({ prova: fabricarProva('s', 'u', 'k', '2999-01-01T00:00:00Z'), acesso: { leitura: null, edita: false, negativa: 'sem_direito' }, t0: Date.now() })
let linhas: Array<Record<string, unknown>>
let chamado: ReturnType<typeof vi.fn>
beforeEach(() => {
  linhas = []
  m.montar.mockReset()
  m.banco = {
    rpc: () => ({ abortSignal: async () => ({ data: [{ no_minuto: 1, no_dia: 1 }], error: null }) }),
    from: () => ({ insert: (l: Record<string, unknown>) => ({ abortSignal: async () => { linhas.push(l); return { error: null } } }) }),
  }
  chamado = vi.fn()
})
async function cliente() {
  const real: Responder = async (e, _c, agora) => { chamado(e); return responder(e, ABRIDOR_DE_SESSAO, agora) }
  const server = new McpServer({ name: 't', version: '1.0.0' })
  registrarServidorDoObservatorio(server, real)
  const [ct, st] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 't', version: '1.0.0' }, { capabilities: {} })
  await Promise.all([server.connect(st), client.connect(ct)])
  return client
}
const chamar = async (args: Record<string, unknown>) => {
  const c = await cliente()
  return comContextoDoObservatorio(ctx(), () => c.callTool({ name: NOME_DA_FERRAMENTA, arguments: args })) as Promise<{ isError?: boolean; content: Array<{ text: string }> }>
}

describe('consultar no servidor MCP', () => {
  it('(d) consultar está no enum de "acao" da ferramenta registrada, com os campos novos', async () => {
    const c = await cliente()
    const { tools } = await c.listTools()
    const esquema = JSON.stringify(tools.find((t) => t.name === NOME_DA_FERRAMENTA)!.inputSchema)
    expect(esquema).toContain('"consultar"')
    for (const k of ['entidade', 'lugar', 'janela_idade', 'publicado_de', 'publicado_ate', 'metricas', 'ordenar_por', 'direcao', 'incluir_base_fraca', 'limite']) expect(esquema, k).toContain(`"${k}"`)
  })
  it('(d) { acao:"consultar", limite:"20" } (texto) chega ao responder e grava limite 20; incluir_base_fraca "true" também', async () => {
    m.montar.mockResolvedValue({ recusa: 'lugar_desconhecido', frase: 'lugar desconhecido; a lista de lugares com dados está em definicoes' })
    await chamar({ acao: 'consultar', limite: '20', incluir_base_fraca: 'true', lugar: 'local:vn-hanoi', janela_idade: '0-30', metricas: ['views'] })
    expect(chamado).toHaveBeenCalled()
    expect(m.montar).toHaveBeenCalledTimes(1)
    const pedido = m.montar.mock.calls[0]![1] as { limite: number; incluirBaseFraca: boolean; janelaIdade: string[] }
    expect(pedido).toMatchObject({ limite: 20, incluirBaseFraca: true, janelaIdade: ['0-30'] })
    expect((linhas[0]!.params as Record<string, unknown>)).toMatchObject({ acao: 'consultar', limite: 20, incluir_base_fraca: true })
  })
  it('consultar com campo inventado ou entidade "comentario": recusa nossa, sem chamar o montador', async () => {
    for (const a of [{ acao: 'consultar', zz: 1 }, { acao: 'consultar', entidade: 'comentario' }, { acao: 'consultar', limite: 99 }]) {
      linhas = []
      const r = await chamar(a)
      expect((linhas[0]!.params as Record<string, unknown>).desfecho, JSON.stringify(a)).toBe('pedido_invalido')
      expect(r.content[0]!.text).toContain('Exemplo válido:')
    }
    expect(m.montar).not.toHaveBeenCalled()
  })
  it('(e) DESCRICAO até 2.000 e INSTRUCOES até 1.200 caracteres; a descrição diz "onze" e traz um exemplo de consultar', () => {
    expect(DESCRICAO.length).toBeLessThanOrEqual(2000)
    expect(INSTRUCOES.length).toBeLessThanOrEqual(1200)
    expect(DESCRICAO).toContain('onze')
    expect(DESCRICAO).not.toContain('dez ações')
    expect(DESCRICAO).toContain('"acao":"consultar"')
  })
  it.each(['recomendar, comparar ou concluir', 'pizza só onde sugerido', 'não são zero', 'a_partir_da_linha', 'Resumo do todo', 'não tem janela'])('as instruções guardam a frase obrigatória "%s"', (frase) => {
    expect(INSTRUCOES).toContain(frase)
  })
  it('as instruções dizem que a consultar não tem janela; toda menção a a_partir_da_linha nomeia as ações com janela', () => {
    const item = ITENS_DE_INSTRUCAO.find((i) => i.fatia === 'A4')
    expect(item?.texto).toMatch(/consultar/)
    expect(item?.texto).toMatch(/não tem janela/)
    for (const i of ITENS_DE_INSTRUCAO.filter((x) => x.texto.includes('a_partir_da_linha'))) {
      expect(i.texto, i.texto).toMatch(/listar_canais/)
      expect(i.texto, i.texto).toMatch(/destaques/)
      expect(i.texto, i.texto).toMatch(/mudancas/)
    }
  })
  it('(f) pacote_da_tela com tela "consultar": recusa "use a ação consultar", sem pacote', async () => {
    const r = await chamar({ acao: 'pacote_da_tela', tela: 'consultar' })
    expect(r.content[0]!.text).toContain('use a ação consultar')
    expect(m.montar).not.toHaveBeenCalled()
  })
})
