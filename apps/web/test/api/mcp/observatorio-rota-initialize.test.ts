// @vitest-environment node
/**
 * A7d T5 (2): o `createMcpHandler` é o REAL (nada de `vi.mock('mcp-handler')`); só a porta, o banco e a leitura da pessoa são simulados, como no teste da rota.
 * Prova que o `mcp-handler` repassa o 2º argumento ao servidor MCP: o POST `initialize` devolve `result.instructions`.
 * A porta, o registro e o ponto único da chave são os REAIS; só o banco (um simulador), a leitura de pessoa/vínculo e a prova do direito privado são simulados.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  log: vi.fn(),
  banco: { atual: null as unknown },
  modo: { v: 'recusa' as 'recusa' | 'aviso' },
  pessoa: vi.fn(), apagamento: vi.fn(), vinculo: vi.fn(), privado: vi.fn(),
}))

vi.mock('server-only', () => ({}))
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
import { INSTRUCOES } from '@/lib/pipeline/mcp/observatorio/servidor'

const SITE = 'site-1'
const PESSOA = 'user-1'
const CHAVE = 'key-1'
const ACESSO = { leitura: null, edita: false, negativa: 'sem_direito' as const }
const diaFuturo = () => new Date(Date.now() + 30 * 86_400_000).toISOString()

type Linha = Record<string, unknown>
interface Banco { updates: number; inserts: Linha[]; chave: Linha | null; sb: unknown }
function novoBanco(chave: Linha | null): Banco {
  const b: Banco = { updates: 0, inserts: [], chave, sb: null }
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
      consulta.abortSignal = () => Promise.resolve({ data: b.inserts.filter((l) => l.result === 'recusado').slice(-1).map(() => ({ at: new Date().toISOString() })), error: null })
      return {
        select: () => consulta,
        insert: (linha: Linha) => ({ abortSignal: () => { b.inserts.push(linha); return Promise.resolve({ error: null }) } }),
      }
    },
  }
  return b
}
const linhaDaChave = (o: Linha = {}): Linha => ({ id: CHAVE, site_id: SITE, name: 'k', permissions: ['observatorio_leitura'], user_id: PESSOA, expires_at: diaFuturo(), ...o })

const initialize = (auth = 'Bearer chave-do-teste') =>
  new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'teste', version: '1.0.0' } } }),
  })

let banco: Banco
const preparar = (chave: Linha | null) => { banco = novoBanco(chave); h.banco.atual = banco.sb }

beforeEach(() => {
  for (const f of [h.captureMessage, h.captureException, h.log, h.pessoa, h.apagamento, h.vinculo, h.privado]) f.mockReset()
  h.pessoa.mockResolvedValue({ estado: 'ativa' })
  h.apagamento.mockResolvedValue('nao')
  h.vinculo.mockResolvedValue('sim')
  h.privado.mockResolvedValue(ACESSO)
  h.modo.v = 'recusa'
  process.env.OBSERVATORIO_IA_EXTERNA = 'on'
  preparar(linhaDaChave())
})
afterEach(() => { delete process.env.OBSERVATORIO_IA_EXTERNA })


const resultado = async (r: Response): Promise<{ instructions?: string; serverInfo?: unknown }> => {
  const t = await r.text()
  const dado = t.startsWith('{') ? t : (t.split('\n').find((l) => l.startsWith('data: ')) ?? '').slice(6)
  return (JSON.parse(dado) as { result: { instructions?: string } }).result
}

describe('initialize pelo handler real da rota do Observatório', () => {
  it('(2) o servidor do perfil devolve result.instructions === INSTRUCOES', async () => {
    const r = await POST(initialize())
    expect(r.status).toBe(200)
    const res = await resultado(r)
    expect(res.instructions).toBe(INSTRUCOES)
    expect(res.instructions as string).toContain('saida "tabela"')
    expect(INSTRUCOES.length).toBeGreaterThan(100)
  })
})
