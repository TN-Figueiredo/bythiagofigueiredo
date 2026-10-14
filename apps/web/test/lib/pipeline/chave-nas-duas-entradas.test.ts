// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * E17 degrau 2, Tarefa 3: as duas entradas de autenticação (pipeline e MCP) usam o ponto único da validade.
 * O comportamento das três chaves vivas (Cowork, forja fila, forja leitura) fica idêntico e travado aqui.
 */

const banco = vi.hoisted(() => ({
  resposta: { data: null, error: null } as { data: unknown; error: { code?: string; message?: string } | null },
  lancar: null as Error | null,
  updates: [] as Array<{ valores: Record<string, unknown>; id: unknown }>,
  selects: [] as unknown[][],
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        banco.selects.push(args)
        const cadeia = {
          eq: () => cadeia,
          is: () => cadeia,
          single: async () => {
            if (banco.lancar) throw banco.lancar
            return banco.resposta
          },
        }
        return cadeia
      },
      update: (valores: Record<string, unknown>) => ({
        eq: (_col: string, id: unknown) => {
          banco.updates.push({ valores, id })
          const feito = { error: null }
          return { then: (ok: (v: unknown) => unknown) => ok(feito), catch: () => undefined, [Symbol.toStringTag]: 'Promise' }
        },
      }),
    }),
  }),
}))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockRejectedValue(new Error('sem sessão')) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))

const logs = vi.hoisted(() => ({ chamadas: [] as Array<{ nivel: string; modulo: string; msg: string; extra?: Record<string, unknown> }> }))
vi.mock('@/lib/pipeline/logger', () => ({
  pipelineLog: (nivel: string, modulo: string, msg: string, extra?: Record<string, unknown>) => {
    logs.chamadas.push({ nivel, modulo, msg, extra })
  },
}))

import { authenticatePipeline } from '@/lib/pipeline/auth'
import { resolveMcpAuth, McpAuthError } from '@/lib/pipeline/mcp/auth'

const DIA = 86_400_000
const noPassado = () => new Date(Date.now() - 3 * DIA).toISOString()
const noFuturo = () => new Date(Date.now() + 30 * DIA).toISOString()

let n = 0
/** Chave nova a cada chamada: o limitador do pipeline é por hash e vive no módulo. */
const chaveNova = () => `chave-teste-${++n}-${Math.random()}`
const pedidoPipeline = (k: string) => ({ headers: new Headers({ 'X-Pipeline-Key': k }) }) as never
const pedidoMcp = (k: string) => new Request('http://localhost/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${k}` } })

const LINHA = { id: 'key-1', site_id: 'site-1', name: 'cowork', permissions: ['read'] }
const poe = (data: unknown, error: { code?: string; message?: string } | null = null) => {
  banco.resposta = { data, error }
}

beforeEach(() => {
  banco.resposta = { data: null, error: null }
  banco.lancar = null
  banco.updates.length = 0
  banco.selects.length = 0
  logs.chamadas.length = 0
})
afterEach(() => vi.clearAllMocks())

describe('validade (item 236): chave comum vencida é 401 com a data, nas duas entradas', () => {
  it('chave read com expires_at no passado: 401 com a data na frase, pelo pipeline e pelo MCP (mesmo banco simulado)', async () => {
    poe({ ...LINHA, expires_at: '2026-01-10T15:00:00+00:00' })
    const p = await authenticatePipeline(pedidoPipeline(chaveNova()))
    expect(p).toEqual({ ok: false, status: 401, error: 'chave vencida em 10/01: peça outra ao dono' })

    poe({ ...LINHA, expires_at: '2026-01-10T15:00:00+00:00' })
    const e = await resolveMcpAuth(pedidoMcp(chaveNova())).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(McpAuthError)
    expect((e as McpAuthError).statusCode).toBe(401)
    expect((e as McpAuthError).message).toBe('chave vencida em 10/01: peça outra ao dono')
  })

  it('chave vencida não grava last_used_at', async () => {
    poe({ ...LINHA, expires_at: noPassado() })
    await authenticatePipeline(pedidoPipeline(chaveNova()))
    await resolveMcpAuth(pedidoMcp(chaveNova())).catch(() => undefined)
    expect(banco.updates).toEqual([])
  })

  it('chave read com expires_at no futuro: passa nas duas', async () => {
    poe({ ...LINHA, expires_at: noFuturo() })
    expect((await authenticatePipeline(pedidoPipeline(chaveNova()))).ok).toBe(true)
    const ctx = await resolveMcpAuth(pedidoMcp(chaveNova()))
    expect(ctx.vencida).toBe(false)
  })

  it('chave read sem a coluna expires_at (banco antes da MG11): passa nas duas, como hoje', async () => {
    poe(LINHA)
    expect((await authenticatePipeline(pedidoPipeline(chaveNova()))).ok).toBe(true)
    const ctx = await resolveMcpAuth(pedidoMcp(chaveNova()))
    expect(ctx.siteId).toBe('site-1')
    expect(ctx.expiresAt).toBeNull()
    expect(ctx.userId).toBeNull()
  })

  it('chave read com expires_at nula: passa nas duas', async () => {
    poe({ ...LINHA, expires_at: null, user_id: null })
    expect((await authenticatePipeline(pedidoPipeline(chaveNova()))).ok).toBe(true)
    expect((await resolveMcpAuth(pedidoMcp(chaveNova()))).vencida).toBe(false)
  })
})

describe('ausente e erro: 401 com a frase de hoje, nas duas entradas', () => {
  it('erro de banco DEVOLVIDO: 401 nas duas (trava o desvio D-13)', async () => {
    poe(null, { code: '57014', message: 'timeout' })
    expect(await authenticatePipeline(pedidoPipeline(chaveNova()))).toEqual({ ok: false, status: 401, error: 'Invalid or revoked API key' })
    const e = await resolveMcpAuth(pedidoMcp(chaveNova())).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(McpAuthError)
    expect((e as McpAuthError).statusCode).toBe(401)
    expect((e as McpAuthError).message).toBe('Invalid or revoked API key')
  })

  it('chave inexistente (dado nulo): 401 nas duas, com a frase de hoje', async () => {
    poe(null)
    expect(await authenticatePipeline(pedidoPipeline(chaveNova()))).toEqual({ ok: false, status: 401, error: 'Invalid or revoked API key' })
    const e = await resolveMcpAuth(pedidoMcp(chaveNova())).catch((x: unknown) => x)
    expect((e as McpAuthError).message).toBe('Invalid or revoked API key')
  })
})

describe('a busca LANÇA: a exceção sobe como hoje', () => {
  it('resolveMcpAuth rejeita com a mesma exceção (a rota /api/mcp responde 500 com -32603: test/api/mcp/route.test.ts)', async () => {
    const falha = new Error('db down')
    banco.lancar = falha
    await expect(resolveMcpAuth(pedidoMcp(chaveNova()))).rejects.toBe(falha)
  })
  it('authenticatePipeline rejeita com a mesma exceção', async () => {
    const falha = new Error('db down')
    banco.lancar = falha
    await expect(authenticatePipeline(pedidoPipeline(chaveNova()))).rejects.toBe(falha)
  })
})

describe('forma da linha', () => {
  it('chave read cuja linha não tem o campo name: passa nas duas, com keyName nulo no pipeline', async () => {
    poe({ id: 'key-1', site_id: 'site-1', permissions: ['read', 'write'] })
    const p = await authenticatePipeline(pedidoPipeline(chaveNova()))
    expect(p.ok && p.auth.keyName).toBeNull()
    expect(p.ok && p.auth.permissions).toEqual(['read', 'write'])
    expect((await resolveMcpAuth(pedidoMcp(chaveNova()))).name).toBeNull()
  })

  it('o que o pipeline devolve para as chaves vivas continua igual (siteId, permissões, origem, hash, id, nome)', async () => {
    poe({ id: 'key-9', site_id: 'site-9', name: 'forja (fila)', permissions: ['intelligence'] })
    const k = chaveNova()
    const r = await authenticatePipeline(pedidoPipeline(k))
    expect(r.ok && r.auth).toMatchObject({ siteId: 'site-9', permissions: ['intelligence'], source: 'api_key', keyId: 'key-9', keyName: 'forja (fila)' })
    expect(r.ok && typeof r.auth.keyHash).toBe('string')
  })

  it('a entrada do MCP devolve o contexto de hoje mais os campos novos', async () => {
    poe({ ...LINHA, name: 'cowork-permanent', permissions: ['read', 'write', 'admin'], user_id: 'u-1', expires_at: noFuturo() })
    const ctx = await resolveMcpAuth(pedidoMcp(chaveNova()))
    expect(ctx).toMatchObject({ siteId: 'site-1', permissions: ['read', 'write', 'admin'], keyId: 'key-1', userId: 'u-1', name: 'cowork-permanent', vencida: false })
    expect(typeof ctx.keyHash).toBe('string')
    expect(typeof ctx.expiresAt).toBe('string')
  })
})

describe('chave do perfil observatorio_leitura', () => {
  const PERFIL_ROW = (extra: Record<string, unknown> = {}) => ({ id: 'key-p', site_id: 'site-1', name: 'observatorio-20261013-abcd', permissions: ['observatorio_leitura'], user_id: 'u-1', expires_at: noFuturo(), ...extra })

  it('no pipeline, vencida ou não: 403 Forbidden, sem update (a ordem: perfil antes de vencida)', async () => {
    poe(PERFIL_ROW())
    expect(await authenticatePipeline(pedidoPipeline(chaveNova()))).toEqual({ ok: false, status: 403, error: 'Forbidden' })
    poe(PERFIL_ROW({ expires_at: noPassado() }))
    expect(await authenticatePipeline(pedidoPipeline(chaveNova()))).toEqual({ ok: false, status: 403, error: 'Forbidden' })
    expect(banco.updates).toEqual([])
  })

  it('perfil misto no pipeline: 403 do mesmo jeito', async () => {
    poe(PERFIL_ROW({ permissions: ['observatorio_leitura', 'read', 'admin'] }))
    expect(await authenticatePipeline(pedidoPipeline(chaveNova()))).toEqual({ ok: false, status: 403, error: 'Forbidden' })
  })

  it('no MCP: nenhum update em pipeline_api_keys (nem last_used_at)', async () => {
    poe(PERFIL_ROW())
    const ctx = await resolveMcpAuth(pedidoMcp(chaveNova()))
    expect(ctx.permissions).toEqual(['observatorio_leitura'])
    expect(ctx.userId).toBe('u-1')
    expect(banco.updates).toEqual([])
  })

  it('no MCP, a chave do perfil VENCIDA não é recusada aqui: segue com vencida = true para a porta decidir', async () => {
    poe(PERFIL_ROW({ expires_at: noPassado() }))
    const ctx = await resolveMcpAuth(pedidoMcp(chaveNova()))
    expect(ctx.vencida).toBe(true)
    expect(banco.updates).toEqual([])
  })

  it('no MCP, o log de sucesso da chave do perfil não leva o prefixo do hash', async () => {
    poe(PERFIL_ROW())
    await resolveMcpAuth(pedidoMcp(chaveNova()))
    const sucesso = logs.chamadas.find((l) => l.msg === 'MCP auth success')
    expect(sucesso).toBeDefined()
    expect(JSON.stringify(sucesso)).not.toMatch(/keyHash/)
  })
})

describe('chave comum no MCP e no pipeline: last_used_at como hoje', () => {
  it('MCP: um update de last_used_at na chave certa', async () => {
    poe(LINHA)
    await resolveMcpAuth(pedidoMcp(chaveNova()))
    expect(banco.updates).toHaveLength(1)
    expect(banco.updates[0].id).toBe('key-1')
    expect(Object.keys(banco.updates[0].valores)).toEqual(['last_used_at'])
  })
  it('pipeline: um update de last_used_at na chave certa', async () => {
    poe(LINHA)
    await authenticatePipeline(pedidoPipeline(chaveNova()))
    expect(banco.updates).toHaveLength(1)
    expect(banco.updates[0].id).toBe('key-1')
  })
  it('o log de sucesso da chave comum no MCP continua com o prefixo do hash, como hoje', async () => {
    poe(LINHA)
    await resolveMcpAuth(pedidoMcp(chaveNova()))
    const sucesso = logs.chamadas.find((l) => l.msg === 'MCP auth success')
    expect(sucesso?.extra).toHaveProperty('keyHash')
  })
})
