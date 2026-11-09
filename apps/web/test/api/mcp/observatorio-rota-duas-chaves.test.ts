// @vitest-environment node
/**
 * Duas chaves ao mesmo tempo, com o `mcp-handler` DE VERDADE (aqui ele NÃO é simulado; só o banco, a porta e `responder` são).
 * É o teste que olharia a resposta de uma pessoa chegando à outra: mesmo `id` JSON-RPC, esperas desiguais, 50 repetições.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ linhas: [] as Array<Record<string, unknown>> }))

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/pipeline/logger', () => ({ pipelineLog: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/tools', () => ({ registerTools: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/resources', () => ({ registerResources: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/prompts', () => ({ registerPrompts: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: () => ({ abortSignal: async () => ({ data: [{ no_minuto: 1, no_dia: 1 }], error: null }) }),
    from: () => ({ insert: (l: Record<string, unknown>) => ({ abortSignal: async () => { h.linhas.push(l); return { error: null } } }) }),
  }),
}))
// A chave de cada requisição vem do cabeçalho; a porta passa e fabrica a prova DA CHAVE (a fábrica real).
vi.mock('@/lib/pipeline/mcp/auth', async (o) => {
  const real = await o<typeof import('@/lib/pipeline/mcp/auth')>()
  return {
    ...real,
    resolveMcpAuth: async (req: Request) => {
      const k = req.headers.get('X-Pipeline-Key') ?? ''
      return { siteId: 'site-1', permissions: ['observatorio_leitura'], keyHash: 'x', keyId: `key-${k}`, userId: `user-${k}`, expiresAt: '2999-01-01T00:00:00+00:00', name: null, vencida: false }
    },
  }
})
vi.mock('@/lib/youtube/observatorio/acesso-ia/porta', async () => {
  const prova = await import('@/lib/youtube/observatorio/acesso-ia/prova')
  return { abrirPorta: async (c: { siteId: string; userId: string; id: string; expiresAt: string }) => ({ ok: true, prova: prova.fabricarProva(c.siteId, c.userId, c.id, c.expiresAt) }) }
})
// A pessoa A tem o direito privado, a B não (decidido pelo user da prova).
vi.mock('@/lib/youtube/observatorio/proprio/leitura-privada', () => ({
  provarAcessoPrivadoDaChave: async (p: { userId: string }) => (p.userId === 'user-A' ? { leitura: {}, edita: false } : { leitura: null, edita: false, negativa: 'sem_direito' }),
}))
// O abridor carrega a prova e o acesso que a rota passou; o `responder` simulado lê deles (nunca de variável de módulo).
vi.mock('@/app/cms/(authed)/youtube/competitors/_acesso-ia/abrir-por-chave', () => ({ abridorDaChave: (prova: unknown, acesso: unknown) => ({ prova, acesso }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder', () => ({
  responder: async (_e: unknown, abrir: { prova: { userId: string }; acesso: { leitura: unknown } }) => {
    const quem = abrir.prova.userId.replace('user-', '')
    await new Promise((r) => setTimeout(r, quem === 'A' ? 8 : 1))
    await new Promise((r) => setTimeout(r, quem === 'A' ? 1 : 6))
    return { texto: `SENTINELA-${quem}`, desfecho: 'ok', incluiuPrivado: abrir.acesso.leitura !== null, params: { acao: 'definicoes', desfecho: 'ok' } }
  },
}))

import { POST } from '../../../src/app/api/mcp/route'

const chamada = (chave: string) =>
  new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: { 'X-Pipeline-Key': chave, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'observatorio_leitura', arguments: { acao: 'definicoes' } } }),
  })

describe('duas chaves ao mesmo tempo, mcp-handler de verdade', () => {
  beforeEach(() => { h.linhas.length = 0; process.env.OBSERVATORIO_IA_EXTERNA = 'on' })

  it('cada resposta só leva o próprio sentinela e a linha gravada leva a própria prova (50 repetições)', async () => {
    for (let i = 0; i < 50; i++) {
      h.linhas.length = 0
      const [a, b] = await Promise.all([POST(chamada('A')), POST(chamada('B'))])
      const [ta, tb] = [await a.text(), await b.text()]
      expect(ta).toContain('SENTINELA-A'); expect(ta).not.toContain('SENTINELA-B')
      expect(tb).toContain('SENTINELA-B'); expect(tb).not.toContain('SENTINELA-A')
      expect(h.linhas).toHaveLength(2)
      expect(h.linhas.find((l) => l.user_id === 'user-A')).toMatchObject({ key_id: 'key-A', included_private: true })
      expect(h.linhas.find((l) => l.user_id === 'user-B')).toMatchObject({ key_id: 'key-B', included_private: false })
    }
  })
})
