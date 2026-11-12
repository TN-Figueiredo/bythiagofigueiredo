// @vitest-environment node
/**
 * C1 F2, T12: a decisão por prefixo na rota /api/mcp. Os dois `createMcpHandler` são simulados; porta, registro e ponto único da chave são
 * os REAIS. O banco é um simulador com `rpc` (obs_ai_resolver_token), `from` (chave por hash/id e registro de acesso).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'node:crypto'

const h = vi.hoisted(() => ({
  criados: [] as unknown[],
  pipeline: vi.fn(),
  obs: vi.fn(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  log: vi.fn(),
  banco: { atual: null as unknown },
  clienteLanca: false,
  pessoa: vi.fn(), apagamento: vi.fn(), vinculo: vi.fn(), privado: vi.fn(),
  runCtx: vi.fn(),
  espiaoResolver: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('mcp-handler', () => ({
  createMcpHandler: vi.fn(() => {
    h.criados.push(1)
    return h.criados.length === 1 ? h.pipeline : h.obs
  }),
}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: h.captureMessage, captureException: h.captureException }))
vi.mock('@/lib/pipeline/logger', () => ({ pipelineLog: h.log }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { if (h.clienteLanca) throw new Error('env'); return h.banco.atual } }))
vi.mock('@/lib/pipeline/mcp/tools', () => ({ registerTools: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/resources', () => ({ registerResources: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/prompts', () => ({ registerPrompts: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/context', async (o) => {
  const real = await o<typeof import('@/lib/pipeline/mcp/context')>()
  return { ...real, runWithMcpContext: ((...a: Parameters<typeof real.runWithMcpContext>) => { h.runCtx(); return real.runWithMcpContext(...a) }) as typeof real.runWithMcpContext }
})
vi.mock('@/lib/youtube/observatorio/acesso-ia/oauth/resolver', async (o) => {
  const real = await o<typeof import('@/lib/youtube/observatorio/acesso-ia/oauth/resolver')>()
  return { ...real, resolverTokenDeAcesso: (...a: Parameters<typeof real.resolverTokenDeAcesso>) => { h.espiaoResolver(); return real.resolverTokenDeAcesso(...a) } }
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
import { conviteOAuth, credencialDe, resolverTokenDeAcesso } from '@/lib/youtube/observatorio/acesso-ia/oauth/resolver'
import { registrarRecusaDaPorta } from '@/lib/youtube/observatorio/acesso-ia/registrar'

const SITE = 'site-1'
const PESSOA = 'user-1'
const CHAVE = 'key-1'
const ACESSO = { leitura: null, edita: false, negativa: 'sem_direito' as const }
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()
const CONVITE = 'Bearer resource_metadata="https://bythiagofigueiredo.com/.well-known/oauth-protected-resource/api/mcp", scope="observatorio:read"'

type Linha = Record<string, unknown>
interface Banco { inserts: Linha[]; chave: Linha | null; rpcLinhas: Linha[]; rpcLanca: boolean; rpcErro: Linha | null; fromLanca: boolean; rpcChamadas: unknown[][]; sb: unknown }
function novoBanco(chave: Linha | null): Banco {
  const b: Banco = { inserts: [], chave, rpcLinhas: [], rpcLanca: false, rpcErro: null, fromLanca: false, rpcChamadas: [], sb: null }
  b.sb = {
    rpc: (...a: unknown[]) => {
      b.rpcChamadas.push(a)
      if (b.rpcLanca) throw new Error('rpc caiu')
      if (b.rpcErro) return Promise.resolve({ data: null, error: b.rpcErro })
      return Promise.resolve({ data: b.rpcLinhas, error: null })
    },
    from: (tabela: string) => {
      if (b.fromLanca && tabela === 'pipeline_api_keys') throw new Error('from caiu')
      if (tabela === 'pipeline_api_keys') {
        const sel: Record<string, unknown> = {}
        sel.eq = () => sel; sel.is = () => sel
        sel.single = () => Promise.resolve(b.chave ? { data: b.chave, error: null } : { data: null, error: { code: 'PGRST116' } })
        return { select: () => sel, update: () => ({ eq: () => ({ then: (r: (v: unknown) => unknown) => r({ error: null }) }) }) }
      }
      const consulta: Record<string, unknown> = {}
      for (const m of ['eq', 'gte', 'order', 'limit']) consulta[m] = () => consulta
      consulta.abortSignal = () => Promise.resolve({ data: b.inserts.filter((l) => l.result === 'recusado').slice(-1).map(() => ({ at: new Date().toISOString() })), error: null })
      return { select: () => consulta, insert: (linha: Linha) => ({ abortSignal: () => { b.inserts.push(linha); return Promise.resolve({ error: null }) } }) }
    },
  }
  return b
}
const linhaDaChave = (o: Linha = {}): Linha => ({ id: CHAVE, site_id: SITE, name: 'k', permissions: ['observatorio_leitura'], user_id: PESSOA, expires_at: dia(30), ...o })
const linhaDoToken = (o: Linha = {}): Linha => ({ key_id: CHAVE, token_expira: dia(1), ...o })

const req = (headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/mcp', { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }) })
const resp = (marca: string) => new Response(JSON.stringify({ jsonrpc: '2.0', result: { marca }, id: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } })

let banco: Banco
const preparar = (chave: Linha | null) => { banco = novoBanco(chave); h.banco.atual = banco.sb }
const marca = async (r: Response) => ((await r.json()) as { result?: { marca?: string } }).result?.marca
const msg = async (r: Response) => ((await r.json()) as { error?: { message?: string } }).error?.message
const sha = (t: string) => createHash('sha256').update(t).digest('hex')

beforeEach(() => {
  for (const f of [h.pipeline, h.obs, h.captureMessage, h.captureException, h.log, h.pessoa, h.apagamento, h.vinculo, h.privado, h.runCtx, h.espiaoResolver]) f.mockReset()
  h.pipeline.mockImplementation(async () => resp('PIPELINE'))
  h.obs.mockImplementation(async () => resp('OBSERVATORIO'))
  h.pessoa.mockResolvedValue({ estado: 'ativa' })
  h.apagamento.mockResolvedValue('nao')
  h.vinculo.mockResolvedValue('sim')
  h.privado.mockResolvedValue(ACESSO)
  process.env.OBSERVATORIO_IA_EXTERNA = 'on'
  process.env.OBSERVATORIO_IA_OAUTH = 'on'
  h.clienteLanca = false
  preparar(linhaDaChave())
  banco.rpcLinhas = [linhaDoToken()]
})
afterEach(() => { delete process.env.OBSERVATORIO_IA_EXTERNA; delete process.env.OBSERVATORIO_IA_OAUTH })

describe('credencialDe e conviteOAuth', () => {
  it('classifica a credencial pelo prefixo e pelo cabeçalho', () => {
    expect(credencialDe(req())).toEqual({ tipo: 'nenhuma' })
    expect(credencialDe(req({ Authorization: 'Bearer oat_abc' }))).toEqual({ tipo: 'oat', token: 'oat_abc' })
    expect(credencialDe(req({ 'X-Pipeline-Key': 'oat_abc' }))).toEqual({ tipo: 'oat_em_pipeline_key' })
    expect(credencialDe(req({ Authorization: 'Bearer ort_abc' }))).toEqual({ tipo: 'ort' })
    expect(credencialDe(req({ 'X-Pipeline-Key': 'ort_abc' }))).toEqual({ tipo: 'ort' })
    expect(credencialDe(req({ Authorization: 'Bearer obs_abc' }))).toEqual({ tipo: 'outra' })
  })
  it('o convite é literal', () => { expect(conviteOAuth()).toBe(CONVITE) })
})

describe('C1-1: trava aberta', () => {
  it('sem credencial: 401 com o convite', async () => {
    const r = await POST(req())
    expect(r.status).toBe(401)
    expect(r.headers.get('WWW-Authenticate')).toBe(conviteOAuth())
  })
  it('chave obs_ vencida: 401 com a frase de vencida e SEM convite', async () => {
    preparar(linhaDaChave({ expires_at: new Date(Date.now() - 86_400_000).toISOString() }))
    const r = await POST(req({ Authorization: 'Bearer obs_velha' }))
    expect(r.status).toBe(401)
    expect(r.headers.get('WWW-Authenticate')).toBeNull()
    expect(await msg(r)).toMatch(/^chave vencida em \d{2}\/\d{2}: peça outra ao dono$/)
  })
  it('chave obs_ válida: igual a hoje, sem passar pelo resolvedor OAuth', async () => {
    const r = await POST(req({ Authorization: 'Bearer obs_boa' }))
    expect(r.status).toBe(200)
    expect(await marca(r)).toBe('OBSERVATORIO')
    expect(h.espiaoResolver).not.toHaveBeenCalled()
    expect(h.runCtx).not.toHaveBeenCalled()
  })
  it('oat_ válido: atende o servidor do Observatório, e o contexto do pipeline NÃO é aberto', async () => {
    const r = await POST(req({ Authorization: 'Bearer oat_bom' }))
    expect(r.status).toBe(200)
    expect(await marca(r)).toBe('OBSERVATORIO')
    expect(h.runCtx).not.toHaveBeenCalled()
    expect(banco.rpcChamadas[0]?.[0]).toBe('obs_ai_resolver_token')
    expect(banco.rpcChamadas[0]?.[1]).toMatchObject({ p_hash: sha('oat_bom'), p_tipo: 'acesso' })
  })
  it('oat_ revogado ou desconhecido (rpc sem linha): 401 COM convite', async () => {
    banco.rpcLinhas = []
    const r = await POST(req({ Authorization: 'Bearer oat_morto' }))
    expect(r.status).toBe(401)
    expect(r.headers.get('WWW-Authenticate')).toBe(conviteOAuth())
    expect(h.runCtx).not.toHaveBeenCalled()
  })
  it('oat_ com a chave da conexão vencida: 401 COM convite', async () => {
    preparar(linhaDaChave({ expires_at: new Date(Date.now() - 1000).toISOString() }))
    banco.rpcLinhas = [linhaDoToken()]
    const r = await POST(req({ Authorization: 'Bearer oat_k' }))
    expect(r.status).toBe(401)
    expect(r.headers.get('WWW-Authenticate')).toBe(conviteOAuth())
  })
  it('oat_ cuja pessoa está sem user_id (porta recusa sem_pessoa): 401 COM convite', async () => {
    preparar(linhaDaChave({ user_id: null }))
    banco.rpcLinhas = [linhaDoToken()]
    const r = await POST(req({ Authorization: 'Bearer oat_k' }))
    expect(r.status).toBe(401)
    expect(r.headers.get('WWW-Authenticate')).toBe(conviteOAuth())
  })
  it('oat_ em X-Pipeline-Key: 401 sem convite', async () => {
    const r = await POST(req({ 'X-Pipeline-Key': 'oat_bom' }))
    expect(r.status).toBe(401)
    expect(r.headers.get('WWW-Authenticate')).toBeNull()
  })
})

describe('C1-2: trava fechada', () => {
  beforeEach(() => { delete process.env.OBSERVATORIO_IA_OAUTH })
  it('oat_ válido: 503 temporarily_unavailable e uma linha recusado/desligado (1 por hora)', async () => {
    const r = await POST(req({ Authorization: 'Bearer oat_bom' }))
    expect(r.status).toBe(503)
    expect(await msg(r)).toBe('temporarily_unavailable')
    expect(banco.inserts).toHaveLength(1)
    expect(banco.inserts[0]).toMatchObject({ result: 'recusado', action: 'porta', origin: 'mcp', key_id: CHAVE, user_id: PESSOA, site_id: SITE })
    expect((banco.inserts[0]!.params as Record<string, unknown>).desfecho).toBe('desligado')
    await POST(req({ Authorization: 'Bearer oat_bom' }))
    expect(banco.inserts).toHaveLength(1)
  })
  it('oat_ que não resolve: 503 sem registro', async () => {
    banco.rpcLinhas = []
    const r = await POST(req({ Authorization: 'Bearer oat_morto' }))
    expect(r.status).toBe(503)
    expect(banco.inserts).toEqual([])
  })
  it('sem credencial: 401 sem convite (caminho de hoje)', async () => {
    const r = await POST(req())
    expect(r.status).toBe(401)
    expect(r.headers.get('WWW-Authenticate')).toBeNull()
  })
  it('C1-16: nenhum oat_ chega ao pipeline', async () => {
    await POST(req({ Authorization: 'Bearer oat_bom' }))
    expect(h.runCtx).not.toHaveBeenCalled()
    expect(h.pipeline).not.toHaveBeenCalled()
  })
})

describe('C1-16 e Yannis M4', () => {
  it('oat_ válido e inválido nunca chegam ao pipeline', async () => {
    await POST(req({ Authorization: 'Bearer oat_bom' }))
    banco.rpcLinhas = []
    await POST(req({ Authorization: 'Bearer oat_ruim' }))
    expect(h.runCtx).not.toHaveBeenCalled()
    expect(h.pipeline).not.toHaveBeenCalled()
  })
  it.each([
    ['X-Pipeline-Key', 'oat_x'],
    ['Authorization', 'Bearer ort_x'],
    ['X-Pipeline-Key', 'ort_x'],
  ])('%s %s: 401 sem convite e nenhum log com keyHash', async (cab, valor) => {
    const r = await POST(req({ [cab]: valor }))
    expect(r.status).toBe(401)
    expect(r.headers.get('WWW-Authenticate')).toBeNull()
    expect(JSON.stringify(h.log.mock.calls)).not.toContain('keyHash')
    expect(h.runCtx).not.toHaveBeenCalled()
    expect(banco.rpcChamadas).toEqual([])
  })
})

describe('resolverTokenDeAcesso', () => {
  const agora = Date.now()
  it('Foco 2: token_expira === agora = vencida (401 com convite na rota)', async () => {
    banco.rpcLinhas = [linhaDoToken({ token_expira: new Date(agora).toISOString() })]
    const r = await resolverTokenDeAcesso(banco.sb as never, 'oat_t', agora)
    expect(r.estado).toBe('vencida')
  })
  it('perfil misto = inválido', async () => {
    preparar(linhaDaChave({ permissions: ['observatorio_leitura', 'read'] }))
    banco.rpcLinhas = [linhaDoToken()]
    expect((await resolverTokenDeAcesso(banco.sb as never, 'oat_t', agora)).estado).toBe('invalido')
  })
  it('retorno da rpc fora de forma = erro', async () => {
    banco.rpcLinhas = [{ key_id: 5 }]
    expect((await resolverTokenDeAcesso(banco.sb as never, 'oat_t', agora)).estado).toBe('erro')
  })
  it('rpc que lança: erro nao_conferido', async () => {
    banco.rpcLanca = true
    expect(await resolverTokenDeAcesso(banco.sb as never, 'oat_t', agora)).toEqual({ estado: 'erro', code: 'nao_conferido' })
  })
  it('rota: rpc que lança = 503 sem convite', async () => {
    banco.rpcLanca = true
    const r = await POST(req({ Authorization: 'Bearer oat_bom' }))
    expect(r.status).toBe(503)
    expect(r.headers.get('WWW-Authenticate')).toBeNull()
  })
  it('rota: from() que lança em resolverChavePorId = 503, não 500', async () => {
    banco.fromLanca = true
    const r = await POST(req({ Authorization: 'Bearer oat_bom' }))
    expect(r.status).toBe(503)
    expect(r.headers.get('WWW-Authenticate')).toBeNull()
  })
  it('rota Foco 2: token_expira === agora, com a rpc devolvendo a linha = 401 COM convite', async () => {
    banco.rpcLinhas = [linhaDoToken({ token_expira: new Date().toISOString() })]
    const r = await POST(req({ Authorization: 'Bearer oat_k' }))
    expect(r.status).toBe(401)
    expect(r.headers.get('WWW-Authenticate')).toBe(conviteOAuth())
    expect(h.obs).not.toHaveBeenCalled()
  })
  it('rota: erro DEVOLVIDO pela rpc = 503 sem convite, e o code passa pelo filtro no log e no Sentry', async () => {
    banco.rpcErro = { code: '42501' }
    const r = await POST(req({ Authorization: 'Bearer oat_bom' }))
    expect(r.status).toBe(503)
    expect(r.headers.get('WWW-Authenticate')).toBeNull()
    expect(h.captureMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ tags: expect.objectContaining({ code: '42501' }) }))
  })
  it('M1: code do erro da rpc fora do padrão vira "excecao" no log e no Sentry', async () => {
    banco.rpcErro = { code: 'senha=abc def' }
    await POST(req({ Authorization: 'Bearer oat_bom' }))
    expect(JSON.stringify(h.captureMessage.mock.calls)).not.toContain('senha')
    expect(JSON.stringify(h.log.mock.calls)).not.toContain('senha')
    expect(h.captureMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ tags: expect.objectContaining({ code: 'excecao' }) }))
  })
  it('rota: trava fechada com a rpc falhando = 503 temporarily_unavailable e sem registro', async () => {
    delete process.env.OBSERVATORIO_IA_OAUTH
    banco.rpcErro = { code: '42501' }
    const r = await POST(req({ Authorization: 'Bearer oat_bom' }))
    expect(r.status).toBe(503)
    expect(await msg(r)).toBe('temporarily_unavailable')
    expect(banco.inserts).toEqual([])
  })
  it('I1: getSupabaseServiceClient lançando, trava aberta = 503 nao_conferido sem convite', async () => {
    h.clienteLanca = true
    const r = await POST(req({ Authorization: 'Bearer oat_bom' }))
    expect(r.status).toBe(503)
    expect(r.headers.get('WWW-Authenticate')).toBeNull()
    expect(h.runCtx).not.toHaveBeenCalled()
  })
  it('I1: getSupabaseServiceClient lançando, trava fechada = 503 temporarily_unavailable', async () => {
    delete process.env.OBSERVATORIO_IA_OAUTH
    h.clienteLanca = true
    const r = await POST(req({ Authorization: 'Bearer oat_bom' }))
    expect(r.status).toBe(503)
    expect(await msg(r)).toBe('temporarily_unavailable')
    expect(h.runCtx).not.toHaveBeenCalled()
  })
})

describe('Yannis M5: registrarRecusaDaPorta', () => {
  it.each(['desligado', 'banida', 'ausente', 'apagamento_pedido', 'sem_vinculo'] as const)('aceita %s', async (d) => {
    const r = await registrarRecusaDaPorta(banco.sb as never, { siteId: SITE, userId: PESSOA, keyId: CHAVE, desfecho: d })
    expect(r).toEqual({ ok: true })
  })
  it('recusa desfecho desconhecido', async () => {
    const r = await registrarRecusaDaPorta(banco.sb as never, { siteId: SITE, userId: PESSOA, keyId: CHAVE, desfecho: 'xyz' as never })
    expect(r).toEqual({ ok: false, code: 'desfecho_invalido' })
  })
})
