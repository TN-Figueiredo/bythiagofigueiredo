// @vitest-environment node
/**
 * C1 T23 (C1-22, C1-23 e F2 M1): a MESMA pessoa, pela chave Bearer (`obs_`) e pelo token OAuth (`oat_`), passa pela MESMA `abrirPorta` e recebe a
 * mesma resposta em cada ação (fora a linha "Gerado em"). Os dois `createMcpHandler` são simulados; o do Observatório chama o `responder` REAL
 * com o `abridorDaChave` REAL e a prova que a porta entregou. Só os empacotadores, o banco e a leitura de pessoa/vínculo são simulados.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

const h = vi.hoisted(() => ({
  criados: [] as unknown[],
  pipeline: vi.fn(),
  obs: vi.fn(),
  banco: { atual: null as unknown },
  pessoa: vi.fn(), apagamento: vi.fn(), vinculo: vi.fn(), privado: vi.fn(),
  empacotar: {} as Record<string, unknown>,
  pedido: { atual: { acao: 'definicoes' } as unknown },
  visto: [] as Array<{ siteId: string; userId: string; keyId: string; acesso: unknown }>,
  respostas: [] as Array<{ texto: string; desfecho: string; params: unknown }>,
}))

vi.mock('server-only', () => ({}))
vi.mock('mcp-handler', () => ({
  createMcpHandler: vi.fn(() => { h.criados.push(1); return h.criados.length === 1 ? h.pipeline : h.obs }),
}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/pipeline/logger', () => ({ pipelineLog: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => h.banco.atual }))
vi.mock('@/lib/pipeline/mcp/tools', () => ({ registerTools: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/resources', () => ({ registerResources: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/prompts', () => ({ registerPrompts: vi.fn() }))
vi.mock('@/lib/youtube/observatorio/acesso-ia/regras', async (o) => {
  const real = await o<typeof import('@/lib/youtube/observatorio/acesso-ia/regras')>()
  return { ...real, ACESSO_IA_RULES: { ...real.ACESSO_IA_RULES, e19RecusaConferidaEm: '2026-10-20' } }
})
vi.mock('@/lib/youtube/observatorio/acesso-ia/pessoa', () => ({ estadoDaPessoa: h.pessoa, pediuApagamento: h.apagamento, veOSite: h.vinculo }))
vi.mock('@/lib/youtube/observatorio/proprio/leitura-privada', () => ({ provarAcessoPrivadoDaChave: h.privado }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: h.empacotar }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_consultar/dados', () => ({ lugaresParaDefinicoes: vi.fn(async () => ({ estado: 'nunca' as const })) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_consultar/montar', () => ({ montarConsulta: vi.fn(async (_abrir: unknown, pedido: unknown) => resultadoDaConsulta(pedido)) }))

import { POST } from '../../../src/app/api/mcp/route'
import { contextoDoObservatorio } from '@/lib/pipeline/mcp/observatorio/contexto'
import { registrarServidorDoObservatorio, NOME_DA_FERRAMENTA } from '@/lib/pipeline/mcp/observatorio/servidor'
import { executarChamada } from '@/lib/pipeline/mcp/observatorio/executar'
import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { abridorDaChave } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/abrir-por-chave'
import { ACOES } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { exemploValido } from '@/lib/youtube/observatorio/acesso-ia/exemplos'
import type { TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { modeloCheio } from '../../youtube/observatorio/contexto-ia-fixture'

/** o resultado que o montador devolveria: um vídeo, uma medida (o montador tem teste próprio, `consultar-montar.test.ts`). */
function resultadoDaConsulta(pedido: unknown) {
  const x = (n: number) => ({ x: n, estado: 'medido' as const })
  return {
    pedido, dadosDe: { motor: '2026-11-11T11:00:00.000Z', medidas: '2026-11-11T09:00:00.000Z', lugares: null },
    canaisSemMedida: [], canaisNaoEncontrados: [], leituraMaisAntiga: '2026-11-11T09:00:00.000Z',
    blocos: [{
      formato: 'longos' as const, cortadasPorLimite: 0,
      linhas: [{
        id: '00000000-0000-4000-8000-000000000001', ytId: 'LG000000001', titulo: 'Vídeo longos 1', canal: 'Canal 1', canalId: '00000000-0000-4000-8000-000000009001',
        publicadoEm: '2026-10-20', idadeDias: 22, formato: 'longos', formatoConfirmado: true, estado: 'ativo', medidoEm: '2026-11-11T11:00:00.000Z', lugares: [],
        celulas: { views: x(1001), likes: x(51), comentarios: x(6), multiplicador: x(9) }, multN: 20, multMetodo: 'mesmo dia de vida', baseFraca: false, motivos: [],
      }],
      agregado: { n: 1, elegiveis: 1, baseFraca: 0, sincAtrasado: 0, porMetrica: { multiplicador: { mediana: 3.2, q1: 2.1, q3: 4.8, n: 1, semOsVideos: [], semOsCanais: [] } } },
    }],
  }
}

const SITE = 'site-1'
const PESSOA = 'user-1'
const CHAVE = 'key-1'
const ACESSO = { leitura: null, edita: false, negativa: 'sem_direito' as const }
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

type Linha = Record<string, unknown>
function novoBanco() {
  const b = { rpcChamadas: [] as string[], inserts: [] as Linha[], sb: null as unknown }
  const chave: Linha = { id: CHAVE, site_id: SITE, name: 'k', permissions: ['observatorio_leitura'], user_id: PESSOA, expires_at: dia(30) }
  b.sb = {
    rpc: (nome: string) => {
      // a taxa (`obs_ai_rate_hit_v2`) é da ferramenta, não do token: fica fora de `rpcChamadas`, que só conta quem toca no token
      if (nome === 'obs_ai_rate_hit_v2') return { abortSignal: () => Promise.resolve({ data: [{ no_minuto: 1, no_dia: 1, no_dia_pessoa: 1 }], error: null }) }
      b.rpcChamadas.push(nome); return Promise.resolve({ data: [{ key_id: CHAVE, token_expira: dia(1) }], error: null })
    },
    from: (tabela: string) => {
      if (tabela === 'pipeline_api_keys') {
        const sel: Record<string, unknown> = {}
        sel.eq = () => sel; sel.is = () => sel
        sel.single = () => Promise.resolve({ data: chave, error: null })
        return { select: () => sel, update: () => ({ eq: () => ({ then: (r: (v: unknown) => unknown) => r({ error: null }) }) }) }
      }
      const consulta: Record<string, unknown> = {}
      for (const m of ['eq', 'gte', 'order', 'limit']) consulta[m] = () => consulta
      consulta.abortSignal = () => Promise.resolve({ data: [], error: null })
      return { select: () => consulta, insert: (l: Linha) => ({ abortSignal: () => { b.inserts.push(l); return Promise.resolve({ error: null }) } }) }
    },
  }
  return b
}

const req = (auth: string) => new Request('http://localhost/api/mcp', { method: 'POST', headers: { Authorization: auth }, body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }) })
const semGerado = (t: string) => t.split('\n').filter((l) => !/^Gerado em:/.test(l)).join('\n')
let banco: ReturnType<typeof novoBanco>

beforeEach(() => {
  h.criados.length = 0; h.visto.length = 0; h.respostas.length = 0
  for (const f of [h.pipeline, h.obs, h.pessoa, h.apagamento, h.vinculo, h.privado]) f.mockReset()
  // cada empacotador devolve um pacote cheio e fixo: a resposta tem de sair com conteúdo, nunca "falhou" nos dois lados
  const telas: TelaId[] = ['canais', 'canal', 'video', 'comparar', 'outliers', 'insights', 'mudancas', 'fila', 'canal-proprio', 'video-proprio', 'ritmo', 'sugestoes', 'consultar']
  for (const t of telas) h.empacotar[t] = vi.fn(async () => ({ modelo: { ...modeloCheio(), tela: t }, recente: '13/10/2026 09:10', estado: {} }))
  h.empacotar['canal?'] = vi.fn(async () => ({ modelo: { ...modeloCheio(), tela: 'canal' as const }, recente: '13/10/2026 09:10', estado: {} }))
  h.pipeline.mockImplementation(async () => new Response('{}', { status: 200 }))
  // o servidor do Observatório: o que a rota real faz, com o `executarChamada` (taxa, `responder`, REGISTRO), o `responder` e o `abridorDaChave` reais
  h.obs.mockImplementation(async () => {
    const c = contextoDoObservatorio()
    h.visto.push({ siteId: c.prova.siteId, userId: c.prova.userId, keyId: c.prova.keyId, acesso: c.acesso })
    const r = await executarChamada(h.pedido.atual, {
      sb: h.banco.atual as never,
      agora: () => Date.now(),
      responder: async (e, ctx, agora, prazo) => {
        const x = await responder(e, abridorDaChave(ctx.prova, ctx.acesso), agora, prazo)
        h.respostas.push({ texto: x.texto, desfecho: x.desfecho, params: x.params })
        return x
      },
    })
    return new Response(JSON.stringify({ jsonrpc: '2.0', result: { texto: r.texto }, id: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  h.pessoa.mockResolvedValue({ estado: 'ativa' })
  h.apagamento.mockResolvedValue('nao')
  h.vinculo.mockResolvedValue('sim')
  h.privado.mockResolvedValue(ACESSO)
  process.env.OBSERVATORIO_IA_EXTERNA = 'on'
  process.env.OBSERVATORIO_IA_OAUTH = 'on'
  banco = novoBanco(); h.banco.atual = banco.sb
})
afterEach(() => { delete process.env.OBSERVATORIO_IA_EXTERNA; delete process.env.OBSERVATORIO_IA_OAUTH })

describe('C1-22: chave Bearer e token OAuth da mesma pessoa dão a mesma resposta', () => {
  it.each(ACOES)('%s: mesma prova, mesmo acesso, mesmo texto (fora "Gerado em")', async (acao) => {
    h.pedido.atual = JSON.parse(exemploValido(acao, { uuid: '11111111-1111-4111-8111-111111111111', video: 'dQw4w9WgXcQ' }))
    const pelaChave = await POST(req('Bearer obs_chave'))
    const peloToken = await POST(req('Bearer oat_token'))
    expect(pelaChave.status).toBe(200)
    expect(peloToken.status).toBe(200)
    expect(h.respostas).toHaveLength(2)
    // nenhuma ação pode cair em "falhou" dos dois lados e passar em branco: o texto tem de ter saído com conteúdo
    expect(h.respostas[0]!.desfecho).toBe('ok')
    expect(h.visto[0]).toEqual({ siteId: SITE, userId: PESSOA, keyId: CHAVE, acesso: ACESSO })
    expect(h.visto[1]).toEqual(h.visto[0])
    // a prova privada é chamada com os MESMOS argumentos pelas duas portas (o mock devolve `ACESSO` fixo, então comparar o retorno não provaria nada)
    expect(h.privado.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(h.privado.mock.calls[1]).toEqual(h.privado.mock.calls[0])
    const prova = (i: number) => h.privado.mock.calls[i]![0] as { siteId: string; userId: string; keyId: string }
    expect({ siteId: prova(0).siteId, userId: prova(0).userId, keyId: prova(0).keyId }).toEqual({ siteId: SITE, userId: PESSOA, keyId: CHAVE })
    expect({ siteId: prova(1).siteId, userId: prova(1).userId, keyId: prova(1).keyId }).toEqual({ siteId: SITE, userId: PESSOA, keyId: CHAVE })
    // a linha de registro: cada porta grava uma, com a mesma chave, pessoa, origem e ação
    expect(banco.inserts).toHaveLength(2)
    const linha = (l: Linha) => ({ key_id: l.key_id, user_id: l.user_id, origin: l.origin, action: l.action, site_id: l.site_id })
    expect(linha(banco.inserts[0]!)).toMatchObject({ key_id: CHAVE, user_id: PESSOA, origin: 'mcp', site_id: SITE })
    expect(linha(banco.inserts[1]!)).toEqual(linha(banco.inserts[0]!))
    const [a, b] = h.respostas
    expect(semGerado(b!.texto)).toBe(semGerado(a!.texto))
    expect(b!.desfecho).toBe(a!.desfecho)
    // `ms` é o relógio da chamada
    expect({ ...(b!.params as object), ms: 0 }).toEqual({ ...(a!.params as object), ms: 0 })
    // as duas atravessam a mesma porta: nenhuma leva ao servidor do pipeline
    expect(h.pipeline).not.toHaveBeenCalled()
  })
  it('só o token OAuth passa pelo resolvedor do token; a chave, não', async () => {
    await POST(req('Bearer obs_chave'))
    expect(banco.rpcChamadas).toEqual([])
    await POST(req('Bearer oat_token'))
    expect(banco.rpcChamadas).toEqual(['obs_ai_resolver_token'])
  })
})

describe('C1-23: a ferramenta segue só leitura', () => {
  it('observatorio_leitura é a única ferramenta e traz readOnlyHint true (destructiveHint false)', async () => {
    const server = new McpServer({ name: 't', version: '1' })
    registrarServidorDoObservatorio(server, async () => ({ texto: 'x', desfecho: 'ok', incluiuPrivado: false, params: { acao: 'definicoes' } }))
    const [a, b] = InMemoryTransport.createLinkedPair()
    const cliente = new Client({ name: 'c', version: '1' })
    await Promise.all([server.connect(a), cliente.connect(b)])
    const { tools } = await cliente.listTools()
    expect(tools.map((t) => t.name)).toEqual([NOME_DA_FERRAMENTA])
    expect(tools[0]!.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    await cliente.close()
  })
})

describe('F2 M1: o mesmo oat_ serve depois de religar a trava', () => {
  it('trava fechada = 503; religada, o MESMO oat_ volta a servir; nada revogou, consumiu ou girou o token', async () => {
    h.pedido.atual = { acao: 'definicoes' }
    expect((await POST(req('Bearer oat_mesmo'))).status).toBe(200)
    delete process.env.OBSERVATORIO_IA_OAUTH
    expect((await POST(req('Bearer oat_mesmo'))).status).toBe(503)
    process.env.OBSERVATORIO_IA_OAUTH = 'on'
    const depois = await POST(req('Bearer oat_mesmo'))
    expect(depois.status).toBe(200)
    expect(h.obs).toHaveBeenCalledTimes(2)
    // só `obs_ai_resolver_token` (stable, leitura) tocou no token: nenhuma função de revogar, consumir ou girar
    expect([...new Set(banco.rpcChamadas)]).toEqual(['obs_ai_resolver_token'])
  })
})
