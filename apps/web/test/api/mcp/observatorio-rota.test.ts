// @vitest-environment node
/**
 * A rota /api/mcp serve a chave do perfil (degrau 2, Tarefa 12). Os dois `createMcpHandler` são simulados, cada um com marca própria;
 * a porta, o registro e o ponto único da chave são os REAIS. Só o banco (um simulador que conta cada `update` e cada `insert`), a leitura
 * de pessoa/vínculo e a prova do direito privado são simulados. Em cada caso importa também o que NÃO pode ter sido chamado.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const h = vi.hoisted(() => ({
  criados: [] as Array<{ cfg: Record<string, unknown>; o: unknown }>,
  pipeline: vi.fn(),
  obs: vi.fn(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  log: vi.fn(),
  banco: { atual: null as unknown },
  modo: { v: 'recusa' as 'recusa' | 'aviso' },
  pessoa: vi.fn(), apagamento: vi.fn(), vinculo: vi.fn(), privado: vi.fn(),
  recusaLeituraFalha: { v: false },
}))

vi.mock('server-only', () => ({}))
vi.mock('mcp-handler', () => ({
  createMcpHandler: vi.fn((_f: unknown, o: unknown, cfg: Record<string, unknown>) => {
    h.criados.push({ cfg, o })
    return h.criados.length === 1 ? h.pipeline : h.obs
  }),
}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: h.captureMessage, captureException: h.captureException }))
vi.mock('@/lib/pipeline/logger', () => ({ pipelineLog: h.log }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => h.banco.atual }))
vi.mock('@/lib/pipeline/mcp/tools', () => ({ registerTools: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/resources', () => ({ registerResources: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/prompts', () => ({ registerPrompts: vi.fn() }))
vi.mock('@/lib/pipeline/leitura-modo', async (o) => {
  const real = await o<typeof import('@/lib/pipeline/leitura-modo')>()
  return { ...real, modoLeitura: () => ({ ...real.modoLeitura(), modo: h.modo.v }) }
})
vi.mock('@/lib/youtube/observatorio/acesso-ia/regras', async (o) => {
  const real = await o<typeof import('@/lib/youtube/observatorio/acesso-ia/regras')>()
  return { ...real, ACESSO_IA_RULES: { ...real.ACESSO_IA_RULES, e19RecusaConferidaEm: '2026-10-20' } }
})
vi.mock('@/lib/youtube/observatorio/acesso-ia/pessoa', () => ({ estadoDaPessoa: h.pessoa, pediuApagamento: h.apagamento, veOSite: h.vinculo }))
vi.mock('@/lib/youtube/observatorio/proprio/leitura-privada', () => ({ provarAcessoPrivadoDaChave: h.privado }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder', () => ({ responder: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_acesso-ia/abrir-por-chave', () => ({ abridorDaChave: vi.fn() }))

import { POST } from '../../../src/app/api/mcp/route'
import { contextoDoObservatorio } from '@/lib/pipeline/mcp/observatorio/contexto'
import { INSTRUCOES } from '@/lib/pipeline/mcp/observatorio/servidor'

const SITE = 'site-1'
const PESSOA = 'user-1'
const CHAVE = 'key-1'
const SENTINELA = 'SENTINELA-PRIVADA-9f3a'
const PREFIXO_HASH = '98599ffc' // sha256('chave-do-teste').slice(0, 8), conferido abaixo
const ACESSO = { leitura: null, edita: false, negativa: 'sem_direito' as const }
const diaFuturo = () => new Date(Date.now() + 30 * 86_400_000).toISOString()

type Linha = Record<string, unknown>
interface Banco { updates: number; inserts: Linha[]; chave: Linha | null; recusaLeitura: 'ok' | 'erro'; sb: unknown }
function novoBanco(chave: Linha | null): Banco {
  const b: Banco = { updates: 0, inserts: [], chave, recusaLeitura: 'ok', sb: null }
  b.sb = {
    from: (tabela: string) => {
      if (tabela === 'pipeline_api_keys') {
        const sel: Record<string, unknown> = {}
        sel.eq = () => sel; sel.is = () => sel
        sel.single = () => Promise.resolve(b.chave ? { data: b.chave, error: null } : { data: null, error: { code: 'PGRST116' } })
        return { select: () => sel, update: () => { b.updates++; return { eq: () => ({ then: (r: (v: unknown) => unknown) => r({ error: null }) }) } } }
      }
      // obs_ai_access_log
      const consulta: Record<string, unknown> = {}
      for (const m of ['eq', 'gte', 'order', 'limit']) consulta[m] = () => consulta
      consulta.abortSignal = () => Promise.resolve(
        b.recusaLeitura === 'erro'
          ? { data: null, error: { code: 'XX000' } }
          : { data: b.inserts.filter((l) => l.result === 'recusado').slice(-1).map(() => ({ at: new Date().toISOString() })), error: null },
      )
      return {
        select: () => consulta,
        insert: (linha: Linha) => ({ abortSignal: () => { b.inserts.push(linha); return Promise.resolve({ error: null }) } }),
      }
    },
  }
  return b
}
const linhaDaChave = (o: Linha = {}): Linha => ({ id: CHAVE, site_id: SITE, name: 'k', permissions: ['observatorio_leitura'], user_id: PESSOA, expires_at: diaFuturo(), ...o })

const req = (auth: string | null = 'Bearer chave-do-teste') =>
  new Request('http://localhost/api/mcp', { method: 'POST', headers: auth ? { Authorization: auth } : {}, body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }) })
const resp = (marca: string) => new Response(JSON.stringify({ jsonrpc: '2.0', result: { marca }, id: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } })

let banco: Banco
const preparar = (chave: Linha | null) => { banco = novoBanco(chave); h.banco.atual = banco.sb }
const tudoQueSaiu = () => JSON.stringify([h.captureMessage.mock.calls, h.captureException.mock.calls, h.log.mock.calls])

beforeEach(() => {
  for (const f of [h.pipeline, h.obs, h.captureMessage, h.captureException, h.log, h.pessoa, h.apagamento, h.vinculo, h.privado]) f.mockReset()
  h.pipeline.mockImplementation(async () => resp('PIPELINE'))
  h.obs.mockImplementation(async () => resp('OBSERVATORIO'))
  h.pessoa.mockResolvedValue({ estado: 'ativa' })
  h.apagamento.mockResolvedValue('nao')
  h.vinculo.mockResolvedValue('sim')
  h.privado.mockResolvedValue(ACESSO)
  h.modo.v = 'recusa'
  process.env.OBSERVATORIO_IA_EXTERNA = 'on'
  preparar(linhaDaChave())
})
afterEach(() => { delete process.env.OBSERVATORIO_IA_EXTERNA })

const marca = async (r: Response) => ((await r.json()) as { result?: { marca?: string } }).result?.marca

describe('/api/mcp com a chave do perfil', () => {
  it('perfil com tudo certo: atende o servidor do Observatório, e o do pipeline NÃO é chamado', async () => {
    const r = await POST(req())
    expect(r.status).toBe(200)
    expect(await marca(r)).toBe('OBSERVATORIO')
    expect(h.obs).toHaveBeenCalledTimes(1)
    expect(h.pipeline).not.toHaveBeenCalled()
    expect(banco.inserts).toEqual([])
  })

  it('o contexto do Observatório leva a prova da chave, o acesso e o t0 da rota', async () => {
    let visto: ReturnType<typeof contextoDoObservatorio> | null = null
    h.obs.mockImplementation(async () => { visto = contextoDoObservatorio(); return resp('OBSERVATORIO') })
    const antes = Date.now()
    await POST(req())
    expect(visto).not.toBeNull()
    expect(visto!.prova.siteId).toBe(SITE)
    expect(visto!.prova.userId).toBe(PESSOA)
    expect(visto!.prova.keyId).toBe(CHAVE)
    expect(visto!.acesso).toBe(ACESSO)
    expect(visto!.t0).toBeGreaterThanOrEqual(antes)
    expect(visto!.t0).toBeLessThanOrEqual(Date.now())
  })

  it('chave read: atende o do pipeline, e o do Observatório não é chamado', async () => {
    preparar(linhaDaChave({ permissions: ['read'], user_id: null, expires_at: null }))
    const r = await POST(req())
    expect(await marca(r)).toBe('PIPELINE')
    expect(h.obs).not.toHaveBeenCalled()
  })

  it.each([['read'], ['write'], ['admin']])('chave do Cowork (%s), sem a permissão nova: nunca chega ao servidor do Observatório', async (p) => {
    preparar(linhaDaChave({ permissions: [p], user_id: null, expires_at: null }))
    await POST(req())
    expect(h.obs).not.toHaveBeenCalled()
    expect(h.privado).not.toHaveBeenCalled()
  })

  it('perfil com read junto: 403, nenhum dos dois servidores é chamado', async () => {
    preparar(linhaDaChave({ permissions: ['observatorio_leitura', 'read'] }))
    const r = await POST(req())
    expect(r.status).toBe(403)
    expect(h.obs).not.toHaveBeenCalled()
    expect(h.pipeline).not.toHaveBeenCalled()
    expect(banco.inserts).toEqual([])
  })

  it('variável APAGADA: 503 "acesso externo desligado", nenhum servidor, nenhuma escrita no banco', async () => {
    delete process.env.OBSERVATORIO_IA_EXTERNA
    const r = await POST(req())
    expect(r.status).toBe(503)
    expect(((await r.json()) as { error: { message: string } }).error.message).toBe('acesso externo desligado')
    expect(h.obs).not.toHaveBeenCalled()
    expect(h.pipeline).not.toHaveBeenCalled()
    expect(h.pessoa).not.toHaveBeenCalled()
    expect(banco.inserts).toEqual([])
    expect(banco.updates).toBe(0)
  })

  it('variável "on" com o modo real ainda em aviso: 503', async () => {
    h.modo.v = 'aviso'
    const r = await POST(req())
    expect(r.status).toBe(503)
    expect(h.obs).not.toHaveBeenCalled()
  })

  it('chave do perfil vencida: 401 com a data, e nada é chamado', async () => {
    preparar(linhaDaChave({ expires_at: '2020-03-05T15:00:00+00:00' }))
    const r = await POST(req())
    expect(r.status).toBe(401)
    expect(((await r.json()) as { error: { message: string } }).error.message).toBe('chave vencida em 05/03: peça outra ao dono')
    expect(h.obs).not.toHaveBeenCalled()
    expect(h.pessoa).not.toHaveBeenCalled()
  })

  it('sem user_id: 401, nada chamado', async () => {
    preparar(linhaDaChave({ user_id: null }))
    const r = await POST(req())
    expect(r.status).toBe(401)
    expect(h.obs).not.toHaveBeenCalled()
    expect(banco.inserts).toEqual([])
  })

  it('pessoa sem vínculo: 403 e UMA linha recusado; a segunda requisição dentro da hora: 403 e nenhuma linha nova', async () => {
    h.vinculo.mockResolvedValue('nao')
    const r1 = await POST(req())
    expect(r1.status).toBe(403)
    expect(banco.inserts).toHaveLength(1)
    expect(banco.inserts[0]).toMatchObject({ site_id: SITE, user_id: PESSOA, key_id: CHAVE, result: 'recusado', action: 'porta', params: expect.objectContaining({ desfecho: 'sem_vinculo' }) })
    const r2 = await POST(req())
    expect(r2.status).toBe(403)
    expect(banco.inserts).toHaveLength(1)
    expect(h.obs).not.toHaveBeenCalled()
  })

  it('pedido de apagamento confirmado: 403 e uma linha recusado com desfecho apagamento_pedido', async () => {
    h.apagamento.mockResolvedValue('sim')
    const r = await POST(req())
    expect(r.status).toBe(403)
    expect(banco.inserts).toHaveLength(1)
    expect(banco.inserts[0]).toMatchObject({ result: 'recusado', params: expect.objectContaining({ desfecho: 'apagamento_pedido' }) })
    expect(h.obs).not.toHaveBeenCalled()
  })

  it('a leitura de recusa recente falha: 403 e NENHUMA linha gravada (a dúvida não grava), com aviso no Sentry', async () => {
    h.vinculo.mockResolvedValue('nao')
    banco.recusaLeitura = 'erro'
    const r = await POST(req())
    expect(r.status).toBe(403)
    expect(banco.inserts).toEqual([])
    expect(h.captureMessage).toHaveBeenCalled()
  })

  it('direito privado negado: atende, e o contexto leva acesso sem leitura', async () => {
    let visto: ReturnType<typeof contextoDoObservatorio> | null = null
    h.obs.mockImplementation(async () => { visto = contextoDoObservatorio(); return resp('OBSERVATORIO') })
    h.privado.mockResolvedValue({ leitura: null, edita: false, negativa: 'sem_direito' })
    const r = await POST(req())
    expect(r.status).toBe(200)
    expect(visto!.acesso.leitura).toBeNull()
    expect(visto!.acesso.negativa).toBe('sem_direito')
  })

  it('sem chave: 401, como hoje', async () => {
    const r = await POST(req(null))
    expect(r.status).toBe(401)
    expect(h.obs).not.toHaveBeenCalled()
    expect(h.pipeline).not.toHaveBeenCalled()
  })

  it('nenhum caminho da chave do perfil faz update em pipeline_api_keys (conta as chamadas de todos os casos acima e abaixo)', async () => {
    h.vinculo.mockResolvedValue('nao')
    await POST(req())
    h.vinculo.mockResolvedValue('sim')
    await POST(req())
    delete process.env.OBSERVATORIO_IA_EXTERNA
    await POST(req())
    expect(banco.updates).toBe(0)
  })

  it('um passo lança com o sentinela e o prefixo do hash na mensagem: a resposta, o log e o Sentry não os contêm', async () => {
    h.privado.mockRejectedValue(new Error(`${SENTINELA} ${PREFIXO_HASH}`))
    const r = await POST(req())
    const corpo = await r.text()
    expect(r.status).toBe(503)
    expect(corpo).not.toContain(SENTINELA)
    expect(corpo).not.toContain(PREFIXO_HASH)
    expect(h.obs).not.toHaveBeenCalled()
    const saiu = tudoQueSaiu()
    expect(saiu).not.toContain(SENTINELA)
    expect(saiu).not.toContain(PREFIXO_HASH)
    expect(h.captureMessage).toHaveBeenCalled() // o aviso existe, só sem a mensagem crua
  })

  it('o servidor do Observatório lança com o sentinela: mesma coisa', async () => {
    h.obs.mockRejectedValue(new Error(SENTINELA))
    const r = await POST(req())
    expect(await r.text()).not.toContain(SENTINELA)
    expect(tudoQueSaiu()).not.toContain(SENTINELA)
  })

  it('o prefixo usado acima é mesmo o do hash da chave do teste', async () => {
    const { createHash } = await import('crypto')
    expect(createHash('sha256').update('chave-do-teste').digest('hex').slice(0, 8)).toBe(PREFIXO_HASH)
  })
})

describe('a configuração dos dois servidores', () => {
  it('(1) só o servidor do Observatório recebe as instructions; o do Cowork continua com {}', () => {
    expect(h.criados[1]!.o).toEqual({ instructions: INSTRUCOES })
    expect(h.criados[0]!.o).toEqual({})
    expect(INSTRUCOES).toBeTypeOf('string')
  })
  it('o 2º handler é criado com verboseLogs false, basePath /api e maxDuration 60', () => {
    expect(h.criados).toHaveLength(2)
    expect(h.criados[1]!.cfg).toEqual({ basePath: '/api', maxDuration: 60, verboseLogs: false })
  })
  it('o 1º (pipeline) segue como era: verboseLogs só em development', () => {
    expect(h.criados[0]!.cfg.verboseLogs).toBe(process.env.NODE_ENV === 'development')
  })
})

describe('completude do registro, item da rota', () => {
  it('route.ts chama registrarServidorDoObservatorio(', () => {
    const texto = readFileSync(join(__dirname, '../../../src/app/api/mcp/route.ts'), 'utf8')
    expect(texto).toContain('registrarServidorDoObservatorio(')
  })
})
