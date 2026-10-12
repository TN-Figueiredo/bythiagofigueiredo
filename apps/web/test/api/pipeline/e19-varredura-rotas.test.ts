// @vitest-environment node
// E19, item 209: a prova é pela lista de arquivos (glob), não por lista escrita à mão. Rota nova sem autenticação quebra aqui.
//
// FORA DO ALCANCE desta varredura (a ausência abaixo NÃO é cobertura):
//  - O MCP (`app/api/mcp/route.ts`) tem autenticação própria (`resolveMcpAuth`, que exige `read` em route.ts) e não usa os
//    helpers de `authenticate*`; a chave `observatorio_leitura` ainda fica aberta lá (pendência da E17, item 235). O caso
//    "o alcance é app/api/pipeline" no fim do arquivo prende esse limite por asserção.
//  - Os pisos de 91 rotas e 129 handlers são PISOS (>=): rota removida não falha aqui; rota nova entra sozinha pelo glob.
//  - O rótulo textual do helper é o da primeira chamada dentro do corpo do handler (até o `}` na coluna 0); o fechamento real
//    é o dinâmico (403 em modo recusa), que não depende do rótulo.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const estado = vi.hoisted(() => ({
  permissions: ['observatorio_leitura'] as string[],
  cfg: { modo: 'aviso' as 'aviso' | 'recusa', avisoDesde: '2026-10-13', controleFechadoEm: null as string | null, conferenciaAte: null as string | null },
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/pipeline/leitura-modo', () => ({ modoLeitura: () => estado.cfg }))
vi.mock('@/lib/supabase/service', () => {
  // Banco mínimo: devolve a chave com as permissões do teste e aceita qualquer outra chamada sem fazer nada.
  const cadeia = (tabela: string): unknown => {
    const alvo: Record<string | symbol, unknown> = {
      single: async () => ({ data: tabela === 'pipeline_api_keys' ? { id: 'k1', site_id: 's1', name: 'teste', permissions: estado.permissions } : null, error: null }),
      insert: async () => ({ error: null }),
      then: (ok: (v: unknown) => unknown) => ok({ data: [], error: null, count: 0 }),
    }
    return new Proxy(alvo, { get: (t, p) => (p in t ? t[p] : () => cadeia(tabela)) })
  }
  return { getSupabaseServiceClient: () => ({ from: (t: string) => cadeia(t), rpc: async () => ({ data: null, error: null }) }) }
})

const modulos = import.meta.glob('../../../src/app/api/pipeline/**/route.ts')
const METODOS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const
type Metodo = (typeof METODOS)[number]
type Helper = 'authenticateRead' | 'authenticateWrite' | 'authenticateIntel' | 'authenticateReadOrIntel' | 'authenticatePipeline' | 'NENHUM'
const ID = '00000000-0000-4000-8000-000000000001'
const PARAMS = { id: ID, key: 'k', code: 'c', domain: 'd', section: 's', linkId: ID }
const rotaDe = (arq: string) => arq.replace(/^.*\/src\/app\/api\/pipeline\/?/, '').replace(/\/?route\.ts$/, '')

/**
 * As únicas rotas em que a chave só com `intelligence` passa. Cada uma é nomeada, com o motivo. O teste "as exceções são
 * exatamente estas" falha se uma delas deixar de existir (nada fica na lista em silêncio) e se uma nova aparecer sem entrar aqui.
 */
const MOTIVOS_INTELLIGENCE: Record<string, string> = {
  'GET youtube/channels': 'authenticateReadOrIntel: a forja descobre os canais com a chave da fila ({intelligence}); a chave de leitura do proxy ({read}) também passa',
  'GET youtube/competitors/readings': 'authenticateIntel: a forja lê a tarefa de leitura de concorrentes que reivindicou',
  'POST youtube/competitors/readings': 'authenticateIntel: a forja devolve a leitura de concorrentes que fez',
  'GET youtube/intelligence': 'authenticateIntel: a forja lê o snapshot da tarefa da fila',
  'PATCH youtube/intelligence': 'authenticateIntel: a forja entrega o resultado da tarefa',
  'GET youtube/intelligence/task': 'authenticateIntel: rota legada do Cowork (exige write/admin dentro da rota); a permissão intelligence é só a porta',
  'POST youtube/intelligence/task/[id]/fail': 'authenticateIntel (apiKeyOnly): a forja devolve ou recusa a tarefa',
  'POST youtube/intelligence/task/claim': 'authenticateIntel: a forja reivindica a próxima tarefa da fila',
}
const EXCECOES_INTELLIGENCE = Object.keys(MOTIVOS_INTELLIGENCE).sort()

/**
 * Achado da Tarefa 4: GET youtube/intelligence/task passa pelo authenticateIntel mas a ROTA exige `write` depois
 * (`requirePermission(auth, 'write')`, anterior à E19): chave só com `intelligence` toma 403 por regra própria do recurso.
 * Continua na lista das exceções (a autenticação aceita `intelligence`), mas sai da prova "a chave da fila passa"; o teste
 * seguinte prova que com `intelligence` + `write` ela passa. Esta lista também é nomeada e falha se a rota mudar de regra.
 */
const EXIGE_WRITE_NA_ROTA = ['GET youtube/intelligence/task']

interface Handler { rota: string; metodo: Metodo; helper: Helper; chamar: (req: NextRequest, ctx: unknown) => Promise<Response> }

async function listarHandlers(): Promise<Handler[]> {
  const out: Handler[] = []
  for (const arq of Object.keys(modulos).sort()) {
    const fonte = readFileSync(resolve(__dirname, arq), 'utf8')
    expect(fonte, `${arq}: handler exportado como const não é lido por esta varredura`).not.toMatch(/export\s+const\s+(GET|POST|PATCH|PUT|DELETE)\b/)
    const partes = fonte.split(/export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b/)
    const helperDe = new Map<string, Helper>()
    for (let i = 1; i < partes.length; i += 2) {
      const corpo = partes[i + 1]!.split(/\n\}/)[0]!   // só o corpo do handler: função privada declarada depois não empresta o rótulo
      const achado = corpo.match(/\b(authenticateReadOrIntel|authenticateRead|authenticateWrite|authenticateIntel|authenticatePipeline)\(/)
      helperDe.set(partes[i]!, (achado?.[1] as Helper | undefined) ?? 'NENHUM')
    }
    const mod = (await modulos[arq]!()) as Record<string, unknown>
    for (const metodo of METODOS) {
      const h = mod[metodo]
      if (typeof h !== 'function') continue
      out.push({ rota: rotaDe(arq), metodo, helper: helperDe.get(metodo) ?? 'NENHUM', chamar: h as Handler['chamar'] })
    }
  }
  return out
}

// Uma chave por pedido: o limite de 100 pedidos por minuto é por chave, e a varredura faz mais de 600.
let pedidos = 0
const pedir = (h: Handler) => h.chamar(
  new NextRequest(`https://x.test/api/pipeline/${h.rota.replace(/\[(\w+)\]/g, (_, n: string) => PARAMS[n as keyof typeof PARAMS] ?? 'x')}`, {
    method: h.metodo, headers: { 'X-Pipeline-Key': `chave-de-teste-${pedidos++}`, 'content-type': 'application/json' }, body: h.metodo === 'GET' ? undefined : '{}',
  }),
  { params: Promise.resolve(PARAMS) },
)

let handlers: Handler[] = []
beforeEach(async () => {
  if (handlers.length === 0) handlers = await listarHandlers()
  estado.cfg.modo = 'aviso'
  estado.permissions = ['observatorio_leitura']
})

describe('E19: todo route.ts de app/api/pipeline', () => {
  it('o glob achou as rotas (se vier vazio, a prova não prova nada)', () => {
    expect(Object.keys(modulos).length).toBeGreaterThanOrEqual(91)
    expect(handlers.length).toBeGreaterThanOrEqual(129)
  })

  it('todo handler autentica por um dos quatro helpers; nenhum chama authenticatePipeline direto', () => {
    const fora = handlers.filter(h => h.helper === 'NENHUM' || h.helper === 'authenticatePipeline').map(h => `${h.metodo} ${h.rota}`)
    expect(fora).toEqual([])
    expect(handlers.find(h => h.rota === 'context' && h.metodo === 'GET')?.helper).toBe('authenticateRead')
    expect(handlers.find(h => h.rota === 'audio-library/resolve' && h.metodo === 'POST')?.helper).toBe('authenticateRead')   // leitura que não é GET
  })

  it('as exceções da chave intelligence são exatamente as oito escritas neste teste', () => {
    const reais = handlers.filter(h => h.helper === 'authenticateIntel' || h.helper === 'authenticateReadOrIntel').map(h => `${h.metodo} ${h.rota}`).sort()
    expect(reais).toEqual(EXCECOES_INTELLIGENCE)
    for (const [rota, motivo] of Object.entries(MOTIVOS_INTELLIGENCE)) expect(motivo.length, `${rota} precisa de motivo`).toBeGreaterThan(20)
  })

  it('chave só com observatorio_leitura: 403 em todo handler, em todo método, COM A RECUSA DA E19 DESLIGADA (commit 2 revertido)', async () => {
    const passou: string[] = []
    for (const h of handlers) {
      const res = await pedir(h)
      if (res.status !== 403) passou.push(`${h.metodo} ${h.rota} -> ${res.status}`)
    }
    expect(passou).toEqual([])
  }, 60_000)

  it('chave com observatorio_leitura E read: 403 em todo handler também', async () => {
    estado.permissions = ['observatorio_leitura', 'read']
    const passou: string[] = []
    for (const h of handlers) {
      const res = await pedir(h)
      if (res.status !== 403) passou.push(`${h.metodo} ${h.rota} -> ${res.status}`)
    }
    expect(passou).toEqual([])
  }, 60_000)

  it('modo recusa, chave só com intelligence: 403 em todo handler que não é exceção (leitura e escrita)', async () => {
    estado.cfg.modo = 'recusa'
    estado.permissions = ['intelligence']
    const passou: string[] = []
    let chamados = 0
    for (const h of handlers) {
      if (EXCECOES_INTELLIGENCE.includes(`${h.metodo} ${h.rota}`)) continue
      chamados++
      const res = await pedir(h)
      if (res.status !== 403) passou.push(`${h.metodo} ${h.rota} -> ${res.status}`)
    }
    expect(passou).toEqual([])
    expect(chamados).toBe(handlers.length - EXCECOES_INTELLIGENCE.length)
  }, 60_000)

  it('modo recusa, chave sem permissão nenhuma: 403 em todo handler', async () => {
    estado.cfg.modo = 'recusa'
    estado.permissions = []
    const passou: string[] = []
    for (const h of handlers) {
      const res = await pedir(h)
      if (res.status !== 403) passou.push(`${h.metodo} ${h.rota} -> ${res.status}`)
    }
    expect(passou).toEqual([])
  }, 60_000)

  // (emenda do portão: S19-M3) O outro lado do item 209: quem TEM a permissão continua passando, rota a rota.
  // Aqui o handler segue para o serviço com o banco mínimo: pode devolver 404, 400, 500 ou lançar. Tudo isso conta como
  // "passou da autenticação"; só 401 e 403 são barrados. Handler que não responde em 3 s também passou (está no serviço).
  const desfechoDe = async (h: Handler): Promise<number | 'lancou' | 'demorou'> => {
    try {
      return await Promise.race([
        pedir(h).then(r => r.status),
        new Promise<'demorou'>(ok => setTimeout(() => ok('demorou'), 3000)),
      ])
    } catch {
      return 'lancou'
    }
  }

  it('modo recusa, chave com read: nenhum handler de leitura devolve 401 nem 403 (lê como antes)', async () => {
    estado.cfg.modo = 'recusa'
    estado.permissions = ['read']
    const barrados: string[] = []
    const leitura = handlers.filter(h => h.helper === 'authenticateRead')
    expect(leitura.length).toBeGreaterThanOrEqual(57)
    for (const h of leitura) {
      const d = await desfechoDe(h)
      if (d === 401 || d === 403) barrados.push(`${h.metodo} ${h.rota} -> ${d}`)
    }
    expect(barrados).toEqual([])
  }, 240_000)

  it('modo recusa, chave só com intelligence: passa nas oito exceções (a fila da forja não é cortada)', async () => {
    estado.cfg.modo = 'recusa'
    estado.permissions = ['intelligence']
    const barrados: string[] = []
    const alvo = handlers.filter(x => EXCECOES_INTELLIGENCE.includes(`${x.metodo} ${x.rota}`) && !EXIGE_WRITE_NA_ROTA.includes(`${x.metodo} ${x.rota}`))
    expect(alvo).toHaveLength(EXCECOES_INTELLIGENCE.length - EXIGE_WRITE_NA_ROTA.length)
    for (const h of alvo) {
      const d = await desfechoDe(h)
      if (d === 401 || d === 403) barrados.push(`${h.metodo} ${h.rota} -> ${d}`)
    }
    expect(barrados).toEqual([])
  }, 60_000)

  it('a exceção que exige write na própria rota: 403 só com intelligence (regra do recurso, anterior à E19) e passa com intelligence + write', async () => {
    estado.cfg.modo = 'recusa'
    for (const nome of EXIGE_WRITE_NA_ROTA) {
      const h = handlers.find(x => `${x.metodo} ${x.rota}` === nome)
      expect(h, `${nome} deixou de existir: tirar da lista EXIGE_WRITE_NA_ROTA`).toBeDefined()
      estado.permissions = ['intelligence']
      expect((await pedir(h!)).status, `${nome} só com intelligence`).toBe(403)
      estado.permissions = ['intelligence', 'write']
      const d = await desfechoDe(h!)
      expect(d === 401 || d === 403, `${nome} com intelligence + write -> ${d}`).toBe(false)
    }
  }, 60_000)

  it('não existe handler do pipeline fora de route.ts (a varredura só lê route.ts)', () => {
    expect(Object.keys(import.meta.glob('../../../src/app/api/pipeline/**/route.{tsx,js,jsx,mjs}'))).toEqual([])
  })

  it('o alcance é app/api/pipeline: o MCP fica de fora e tem autenticação própria (documentado, não coberto)', () => {
    const mcp = readFileSync(resolve(__dirname, '../../../src/app/api/mcp/route.ts'), 'utf8')
    expect(mcp).toContain('resolveMcpAuth')
    expect(mcp).not.toMatch(/\bauthenticate(Read|Write|Intel|ReadOrIntel|Pipeline)\(/)
    expect(Object.keys(modulos).some(a => a.includes('/api/mcp/'))).toBe(false)
  })
})
