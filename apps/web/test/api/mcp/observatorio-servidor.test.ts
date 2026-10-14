// @vitest-environment node
// A ferramenta e o segundo servidor do Observatório (degrau 2, Tarefa 11): cliente do próprio SDK ligado ao servidor por transporte em
// memória, sem `mcp-handler`. Banco e `responder` simulados.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

const { captureMessage, captureException, bancoDe } = vi.hoisted(() => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  bancoDe: { atual: null as unknown },
}))
vi.mock('@sentry/nextjs', () => ({ captureMessage, captureException }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => bancoDe.atual }))

import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'
import { ACESSO_IA_RULES } from '@/lib/youtube/observatorio/acesso-ia/regras'
import { comContextoDoObservatorio, contextoDoObservatorio, type ContextoDoObservatorio } from '@/lib/pipeline/mcp/observatorio/contexto'
import { executarChamada, type Responder, type Resposta } from '@/lib/pipeline/mcp/observatorio/executar'
import { NOME_DA_FERRAMENTA, registrarServidorDoObservatorio } from '@/lib/pipeline/mcp/observatorio/servidor'
import { createPipelineMcpServer } from '@/lib/pipeline/mcp'

const SITE = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10'
const PESSOA = '9a1b2c3d-0000-4000-8000-00000000aaaa'
const CHAVE = '7c1d2e3f-0000-4000-8000-00000000bbbb'
const SENTINELA = 'SENTINELA-PRIVADO-123'
const AGORA = 1_800_000_000_000

const prova = () => fabricarProva(SITE, PESSOA, CHAVE, '2999-01-01T00:00:00Z')
const ctx = (t0 = AGORA): ContextoDoObservatorio => ({ prova: prova(), acesso: { leitura: null, edita: false, negativa: 'sem_direito' }, t0 })

interface Banco {
  ordem: string[]
  linhas: Array<Record<string, unknown>>
  /** o que a taxa devolve; mude entre chamadas se quiser */
  taxa: { no_minuto: number; no_dia: number } | { erro: true }
  insertFalha: boolean
  insertNaoResponde: boolean
}
function novoBanco(): Banco & { sb: unknown } {
  const b: Banco = { ordem: [], linhas: [], taxa: { no_minuto: 1, no_dia: 1 }, insertFalha: false, insertNaoResponde: false }
  const sb = {
    rpc: (nome: string) => ({
      abortSignal: async () => {
        b.ordem.push(`rpc:${nome}`)
        return 'erro' in b.taxa ? { data: null, error: { code: 'XX000' } } : { data: [b.taxa], error: null }
      },
    }),
    from: (tabela: string) => ({
      insert: (linha: Record<string, unknown>) => ({
        abortSignal: () => {
          b.ordem.push(`insert:${tabela}`)
          if (b.insertNaoResponde) return new Promise(() => undefined)
          if (b.insertFalha) return Promise.resolve({ error: { code: '23503' } })
          b.linhas.push(linha)
          return Promise.resolve({ error: null })
        },
      }),
    }),
  }
  return Object.assign(b, { sb })
}

const resposta = (o: Partial<Resposta> = {}): Resposta => ({ texto: `texto com ${SENTINELA}`, desfecho: 'ok', incluiuPrivado: true, params: { acao: 'definicoes' }, ...o })
const respondeOk: Responder = async () => resposta()

let banco: ReturnType<typeof novoBanco>
beforeEach(() => {
  banco = novoBanco()
  bancoDe.atual = banco.sb
  captureMessage.mockReset(); captureException.mockReset()
})
afterEach(() => { vi.useRealTimers() })

const SEM_T0 = Symbol('sem t0')
const rodar = (entrada: unknown, responder: Responder, t0: number | typeof SEM_T0 = AGORA, agora = () => AGORA) =>
  comContextoDoObservatorio(t0 === SEM_T0 ? { ...ctx(), t0: undefined as unknown as number } : ctx(t0), () => executarChamada(entrada, { sb: banco.sb as never, responder, agora }))

async function conectar(responder: Responder, servidor?: McpServer) {
  const server = servidor ?? new McpServer({ name: 'observatorio-teste', version: '1.0.0' })
  if (!servidor) registrarServidorDoObservatorio(server, responder)
  const [ct, st] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'teste', version: '1.0.0' }, { capabilities: {} })
  await Promise.all([server.connect(st), client.connect(ct)])
  return { client, server }
}
const textoDe = (r: unknown): string => JSON.stringify(r)

describe('o servidor: o que ele expõe', () => {
  it('tools/list devolve exatamente uma ferramenta, com o nome e readOnlyHint true', async () => {
    const { client } = await conectar(respondeOk)
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name)).toEqual([NOME_DA_FERRAMENTA])
    expect(tools[0]!.annotations?.readOnlyHint).toBe(true)
  })
  it('resources/list e prompts/list: lista vazia ou erro de método não suportado; nunca um item', async () => {
    const { client } = await conectar(respondeOk)
    for (const f of [() => client.listResources(), () => client.listPrompts(), () => client.listResourceTemplates()]) {
      const r = await f().then((x) => x, () => null)
      if (r !== null) {
        const itens = ('resources' in r ? r.resources : 'prompts' in r ? r.prompts : r.resourceTemplates) as unknown[]
        expect(itens).toEqual([])
      }
    }
  })
  it('para cada ferramenta, recurso e prompt REGISTRADOS no servidor do pipeline, chamar no do Observatório dá erro e nenhum texto', async () => {
    const pipeline = createPipelineMcpServer()
    const [ct, st] = InMemoryTransport.createLinkedPair()
    const cp = new Client({ name: 'p', version: '1' }, { capabilities: {} })
    await Promise.all([pipeline.connect(st), cp.connect(ct)])
    const ferramentas = (await cp.listTools()).tools.map((t) => t.name)
    const recursos = (await cp.listResources()).resources.map((r) => r.uri)
    const prompts = (await cp.listPrompts()).prompts.map((p) => p.name)
    expect(ferramentas.length).toBeGreaterThan(0)
    const responder = vi.fn(respondeOk)
    const { client } = await conectar(responder)
    for (const nome of ferramentas) {
      const r = await comContextoDoObservatorio(ctx(), () => client.callTool({ name: nome, arguments: {} })).then((x) => x, () => 'erro' as const)
      if (r !== 'erro') {
        expect(r.isError, nome).toBe(true)
        expect(textoDe(r), nome).not.toContain(SENTINELA)
      }
    }
    for (const uri of recursos) await expect(client.readResource({ uri }), uri).rejects.toThrow()
    for (const name of prompts) await expect(client.getPrompt({ name }), name).rejects.toThrow()
    expect(responder).not.toHaveBeenCalled()
    expect(banco.ordem).toEqual([])
  })
  it('sem contexto (a ferramenta chamada fora da porta): erro, e nada é lido nem gravado', async () => {
    const responder = vi.fn(respondeOk)
    const { client } = await conectar(responder)
    const r = await client.callTool({ name: NOME_DA_FERRAMENTA, arguments: { acao: 'definicoes' } })
    expect(r.isError).toBe(true)
    expect(textoDe(r)).not.toContain(SENTINELA)
    expect(responder).not.toHaveBeenCalled()
    expect(banco.ordem).toEqual([])
    expect(() => contextoDoObservatorio()).toThrow()
    await expect(rodarSemContexto()).rejects.toThrow()
  })
  it('uma chamada pelo cliente: um hit na taxa, um responder, um insert, e o texto (nessa ordem)', async () => {
    const ordem = banco.ordem
    const responder: Responder = async (e) => { ordem.push('responder'); return resposta({ params: { acao: (e as { acao: string }).acao } }) }
    const { client } = await conectar(responder)
    const r = await comContextoDoObservatorio(ctx(Date.now()), () => client.callTool({ name: NOME_DA_FERRAMENTA, arguments: { acao: 'definicoes' } }))
    expect(textoDe(r)).toContain(SENTINELA)
    expect(ordem).toEqual(['rpc:obs_ai_rate_hit', 'responder', 'insert:obs_ai_access_log'])
  })
  it('duas chamadas na mesma requisição (lote): dois hits, duas linhas', async () => {
    const { client } = await conectar(respondeOk)
    await comContextoDoObservatorio(ctx(Date.now()), async () => {
      await client.callTool({ name: NOME_DA_FERRAMENTA, arguments: { acao: 'definicoes' } })
      await client.callTool({ name: NOME_DA_FERRAMENTA, arguments: { acao: 'listar_canais' } })
    })
    expect(banco.ordem.filter((o) => o === 'rpc:obs_ai_rate_hit')).toHaveLength(2)
    expect(banco.linhas).toHaveLength(2)
  })
})
const rodarSemContexto = () => executarChamada({ acao: 'definicoes' }, { sb: banco.sb as never, responder: respondeOk, agora: () => AGORA })

describe('executarChamada: a ordem de 4.5', () => {
  it('uma chamada servida: taxa, responder, insert, texto; a linha leva a prova, a ação, o desfecho, o tamanho e incluiuPrivado', async () => {
    const ordem = banco.ordem
    const r = await rodar({ acao: 'canal' }, async () => { ordem.push('responder'); return resposta({ params: { acao: 'canal' } }) })
    expect(ordem).toEqual(['rpc:obs_ai_rate_hit', 'responder', 'insert:obs_ai_access_log'])
    expect(r).toEqual({ texto: `texto com ${SENTINELA}`, erro: false })
    expect(banco.linhas).toHaveLength(1)
    expect(banco.linhas[0]).toMatchObject({ site_id: SITE, user_id: PESSOA, key_id: CHAVE, origin: 'mcp', action: 'canal', included_private: true, output_chars: `texto com ${SENTINELA}`.length, result: 'ok' })
    expect((banco.linhas[0]!.params as Record<string, unknown>).desfecho).toBe('ok')
  })
  it('o registro falha: a resposta é erro e NÃO contém o sentinela que o texto carregava', async () => {
    banco.insertFalha = true
    const r = await rodar({ acao: 'canal' }, respondeOk)
    expect(r.erro).toBe(true)
    expect(r.texto).not.toContain(SENTINELA)
    expect(r.texto).toContain('nada foi entregue')
  })
  it('o registro não responde no prazo: idem', async () => {
    banco.insertNaoResponde = true
    const r = await rodar({ acao: 'canal' }, respondeOk)
    expect(r.erro).toBe(true)
    expect(r.texto).not.toContain(SENTINELA)
  }, 12_000)
  it('a taxa dá erro: responder não é chamado, nada é entregue', async () => {
    banco.taxa = { erro: true }
    const responder = vi.fn(respondeOk)
    const r = await rodar({ acao: 'canal' }, responder)
    expect(r.erro).toBe(true)
    expect(responder).not.toHaveBeenCalled()
    expect(banco.linhas).toEqual([])
  })
  it('taxa em limite do dia (501): responder NÃO é chamado, a resposta traz a hora de volta, e a linha limite leva por dia', async () => {
    banco.taxa = { no_minuto: 3, no_dia: 501 }
    const responder = vi.fn(respondeOk)
    const r = await rodar({ acao: 'canal' }, responder)
    expect(responder).not.toHaveBeenCalled()
    expect(r.erro).toBe(true)
    expect(r.texto).toMatch(/limite de uso atingido: tente de novo a partir das \d\d:\d\d/)
    expect(banco.linhas).toHaveLength(1)
    expect(banco.linhas[0]).toMatchObject({ result: 'limite' })
    expect(banco.linhas[0]!.params).toMatchObject({ desfecho: 'limite', por: 'dia' })
    expect(banco.linhas[0]!.output_chars).toBeNull()
  })
  it('limite do minuto (31): linha com por minuto; 32: sem linha (registrar false)', async () => {
    banco.taxa = { no_minuto: 31, no_dia: 40 }
    await rodar({ acao: 'canal' }, respondeOk)
    expect(banco.linhas).toHaveLength(1)
    expect(banco.linhas[0]!.params).toMatchObject({ desfecho: 'limite', por: 'minuto' })
    banco.taxa = { no_minuto: 32, no_dia: 41 }
    const r = await rodar({ acao: 'canal' }, respondeOk)
    expect(r.erro).toBe(true)
    expect(banco.linhas).toHaveLength(1)
  })
  it('limite com registrar true e o insert falha: a resposta continua sendo o limite', async () => {
    banco.taxa = { no_minuto: 31, no_dia: 40 }
    banco.insertFalha = true
    const r = await rodar({ acao: 'canal' }, respondeOk)
    expect(r.texto).toMatch(/limite de uso atingido/)
    expect(captureMessage).toHaveBeenCalled()
  })
  it('responder devolve falhou, pedido_invalido ou nao_encontrado: a linha tem result ok, o desfecho certo e output_chars NULO; incluiu_private falso', async () => {
    for (const d of ['falhou', 'pedido_invalido', 'nao_encontrado'] as const) {
      banco.linhas.length = 0
      const r = await rodar({ acao: 'canal' }, async () => resposta({ desfecho: d, texto: 'não encontrado', incluiuPrivado: true }))
      expect(r).toEqual({ texto: 'não encontrado', erro: true })
      expect(banco.linhas[0]).toMatchObject({ result: 'ok', output_chars: null, included_private: false })
      expect((banco.linhas[0]!.params as Record<string, unknown>).desfecho).toBe(d)
    }
  })
  it('responder lança: erro com frase fechada, sem a mensagem crua, linha com desfecho falhou', async () => {
    const r = await rodar({ acao: 'canal' }, async () => { throw new Error(`boom ${SENTINELA}`) })
    expect(r.erro).toBe(true)
    expect(r.texto).not.toContain(SENTINELA)
    expect((banco.linhas[0]!.params as Record<string, unknown>).desfecho).toBe('falhou')
  })
  it('nenhuma linha sai sem desfecho (todas as linhas dos testes acima têm params.desfecho)', async () => {
    await rodar({ acao: 'canal' }, respondeOk)
    banco.taxa = { no_minuto: 31, no_dia: 40 }
    await rodar({ acao: 'canal' }, respondeOk)
    for (const l of banco.linhas) expect((l.params as Record<string, unknown>).desfecho).toBeTypeOf('string')
  })
  it('ação desconhecida na entrada: a linha leva a ação "invalida", nunca o texto que a pessoa mandou', async () => {
    await rodar({ acao: `pergunta livre ${SENTINELA}` }, async () => resposta({ desfecho: 'pedido_invalido', texto: 'x' }))
    expect(banco.linhas[0]!.action).toBe('invalida')
    expect(JSON.stringify(banco.linhas[0])).not.toContain(SENTINELA)
  })
})

describe('executarChamada: o prazo único, contado do início da requisição', () => {
  const nuncaResponde: Responder = () => new Promise<Resposta>(() => undefined)

  it('responder passa do prazo (50 s): erro, sem dado, e a linha leva desfecho tempo e output_chars nulo', async () => {
    vi.useFakeTimers()
    const p = rodar({ acao: 'canal' }, nuncaResponde)
    await vi.advanceTimersByTimeAsync(49_999)
    expect(banco.linhas).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    const r = await p
    expect(r).toEqual({ texto: 'a consulta demorou demais: nada foi entregue', erro: true })
    expect((banco.linhas[0]!.params as Record<string, unknown>).desfecho).toBe('tempo')
    expect(banco.linhas[0]!.output_chars).toBeNull()
  })
  it('com t0 de 30 s atrás (relógio injetado): responder recebe prazo de 22.000 ms (60 − 30 − 5 − 3)', async () => {
    vi.useFakeTimers()
    const p = rodar({ acao: 'canal' }, nuncaResponde, AGORA - 30_000)
    await vi.advanceTimersByTimeAsync(21_999)
    expect(banco.linhas).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    await p
    expect((banco.linhas[0]!.params as Record<string, unknown>).desfecho).toBe('tempo')
  })
  it('com t0 de 48 s atrás: responder NÃO é chamado, a resposta é "a consulta demorou demais", e a linha tem desfecho tempo e output_chars nulo', async () => {
    const responder = vi.fn(respondeOk)
    const r = await rodar({ acao: 'canal' }, responder, AGORA - 48_000)
    expect(responder).not.toHaveBeenCalled()
    expect(r.texto).toContain('a consulta demorou demais')
    expect(banco.linhas).toHaveLength(1)
    expect((banco.linhas[0]!.params as Record<string, unknown>).desfecho).toBe('tempo')
    expect(banco.linhas[0]!.output_chars).toBeNull()
  })
  it('sem t0 (NaN, undefined) ou t0 no futuro: trata como sem tempo (não chama), nunca como prazo cheio', async () => {
    for (const t0 of [Number.NaN, SEM_T0, AGORA + 10_000]) {
      const responder = vi.fn(respondeOk)
      const r = await rodar({ acao: 'canal' }, responder, t0)
      expect(r.erro, String(t0.toString())).toBe(true)
      expect(r.texto).toContain('demorou demais')
      expect(responder).not.toHaveBeenCalled()
    }
    expect(banco.ordem).toEqual([])
  })
  it('com t0 de 50 s atrás: ZERO chamadas à taxa, zero a responder, a resposta é "a consulta demorou demais", e UMA linha com desfecho tempo', async () => {
    const responder = vi.fn(respondeOk)
    const r = await rodar({ acao: 'canal' }, responder, AGORA - 50_000)
    expect(banco.ordem.filter((o) => o.startsWith('rpc:'))).toEqual([])
    expect(responder).not.toHaveBeenCalled()
    expect(r.texto).toContain('a consulta demorou demais')
    expect(banco.linhas).toHaveLength(1)
    expect((banco.linhas[0]!.params as Record<string, unknown>).desfecho).toBe('tempo')
  })
  it('fronteira da taxa: com 47.000 ms a taxa é chamada; com 47.001 não é', async () => {
    banco.taxa = { no_minuto: 32, no_dia: 41 } // barra logo depois da taxa, sem chamar responder
    await rodar({ acao: 'canal' }, respondeOk, AGORA - 47_000)
    expect(banco.ordem.filter((o) => o === 'rpc:obs_ai_rate_hit')).toHaveLength(1)
    await rodar({ acao: 'canal' }, respondeOk, AGORA - 47_001)
    expect(banco.ordem.filter((o) => o === 'rpc:obs_ai_rate_hit')).toHaveLength(1)
  })
  it('com t0 de 53 s atrás: zero chamadas à taxa e NENHUMA linha (não sobra a reserva do registro), e um aviso no Sentry', async () => {
    await rodar({ acao: 'canal' }, respondeOk, AGORA - 53_000)
    expect(banco.ordem).toEqual([])
    expect(banco.linhas).toEqual([])
    expect(captureMessage).toHaveBeenCalled()
  })
  it('fronteira do registro: com 52.000 ms grava a linha tempo; 52.001 não grava', async () => {
    await rodar({ acao: 'canal' }, respondeOk, AGORA - 52_000)
    expect(banco.linhas).toHaveLength(1)
    await rodar({ acao: 'canal' }, respondeOk, AGORA - 52_001)
    expect(banco.linhas).toHaveLength(1)
  })
  it('a segunda chamada do mesmo lote recebe o prazo que sobrou, não 50 s', async () => {
    vi.useFakeTimers()
    // primeira: serve depressa; segunda: t0 de 38 s atrás = prazo de 14 s
    await rodar({ acao: 'canal' }, respondeOk, AGORA)
    const p = rodar({ acao: 'canal' }, nuncaResponde, AGORA - 38_000)
    await vi.advanceTimersByTimeAsync(13_999)
    expect(banco.linhas).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    await p
    expect(banco.linhas).toHaveLength(2)
  })
  it('o maxDuration escrito em app/api/mcp/route.ts vezes 1.000 é igual a tetoDaRequisicaoMs', () => {
    const texto = readFileSync(join(__dirname, '../../../src/app/api/mcp/route.ts'), 'utf8')
    const m = /export const maxDuration = (\d+)/.exec(texto)
    expect(m).not.toBeNull()
    expect(Number(m![1]) * 1000).toBe(ACESSO_IA_RULES.tetoDaRequisicaoMs)
  })
})
