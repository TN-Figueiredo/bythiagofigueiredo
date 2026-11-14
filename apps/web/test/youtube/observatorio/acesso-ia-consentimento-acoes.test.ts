// @vitest-environment node
/**
 * C1 T21: a página `/oauth/consentimento` (só leitura) e as actions `aprovar`/`negar` (atômicas, uma função SQL cada), presas ao
 * navegador que abriu o pedido (A1). Supabase, sessão, cookies e `next/navigation` simulados.
 */
import { createHash } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FRASES_DA_TELA } from '@/lib/youtube/observatorio/acesso-ia/frases'

const m = vi.hoisted(() => ({
  hdrs: new Map<string, string>(),
  cookie: { value: undefined as string | undefined },
  apagados: [] as unknown[],
  user: { v: null as { id: string; email: string | null } | null },
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  privado: { v: true as boolean | null },
  rpc: vi.fn(),
  from: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => m.hdrs.get(k.toLowerCase()) ?? null }),
  cookies: async () => ({ get: (n: string) => (n === '__Host-oauth_pedido' && m.cookie.value !== undefined ? { value: m.cookie.value } : undefined), delete: (o: unknown) => void m.apagados.push(o) }),
}))
vi.mock('next/navigation', () => ({
  redirect: (u: string) => { throw new Error(`REDIRECT:${u}`) },
  notFound: () => { throw new Error('NOTFOUND') },
}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: m.captureMessage, captureException: m.captureException }))
vi.mock('@/app/oauth/consentimento/sessao', () => ({ usuarioDaSessao: async () => m.user.v }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ rpc: m.rpc, from: m.from }) }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
vi.mock('@/lib/youtube/observatorio/proprio/leitura-privada', () => ({ vePrivado: async () => m.privado.v }))
vi.mock('@/lib/youtube/observatorio/acesso-ia/interruptor', () => ({
  acessoExternoLigado: (env: NodeJS.ProcessEnv = process.env) => (env.OBSERVATORIO_IA_EXTERNA === 'on' ? { ligado: true } : { ligado: false, motivo: 'variavel' }),
}))

import Pagina from '@/app/oauth/consentimento/page'
import { aprovar, negar } from '@/app/oauth/consentimento/actions'

const ID = 'A'.repeat(43)
const ORIGEM = 'https://bythiagofigueiredo.com'
const AGORA = Date.parse('2026-11-13T15:00:00.000Z')
const FUTURO = new Date(AGORA + 8 * 60_000).toISOString()
const CLAUDE = 'https://claude.ai/api/mcp/auth_callback'
const CHATGPT = 'https://chatgpt.com/connector_platform_oauth_redirect'
const HASH = createHash('sha256').update(ID).digest('hex')

type Res = { data: unknown; error: unknown } | 'lanca'
type Cadeia = { select: () => Cadeia; eq: () => Cadeia; is: () => Cadeia; limit: () => Cadeia; maybeSingle: () => Promise<unknown> }
const cadeia = (r: Res): Cadeia => {
  const c: Cadeia = { select: () => c, eq: () => c, is: () => c, limit: () => c, maybeSingle: async () => { if (r === 'lanca') throw new Error('banco'); return r } }
  return c
}
const pedidoOk = (o: Record<string, unknown> = {}) => ({ data: { client_id: 'cid', redirect_uri: CHATGPT, expires_at: FUTURO, consumido_em: null, site_id: 'site-1', ...o }, error: null })

function tabelas(t: Partial<Record<'obs_ai_oauth_pedidos' | 'obs_ai_liberacoes' | 'obs_ai_conexoes', Res>>) {
  m.from.mockImplementation((nome: string) => cadeia(t[nome as keyof typeof t] ?? { data: null, error: null }))
}
const libOk: Res = { data: { expires_at: new Date(AGORA + 90 * 86_400_000).toISOString() }, error: null }

async function html(id: string | null = ID): Promise<string> {
  return renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve(id === null ? {} : { authorization_id: id }) }))
}
const form = (o: Record<string, string> = { authorization_id: ID }): FormData => {
  const f = new FormData()
  for (const [k, v] of Object.entries(o)) f.set(k, v)
  return f
}
const url = async (p: Promise<unknown>): Promise<URL> => {
  const e = await p.then(() => null, (x: Error) => x)
  expect(e?.message).toMatch(/^REDIRECT:/)
  return new URL(e!.message.slice('REDIRECT:'.length), ORIGEM)
}
const chamadasDe = (nome: string) => m.rpc.mock.calls.filter((c) => c[0] === nome)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  process.env.OBSERVATORIO_IA_OAUTH = 'on'
  process.env.OBSERVATORIO_IA_EXTERNA = 'on'
  m.hdrs = new Map([['host', 'bythiagofigueiredo.com'], ['origin', ORIGEM]])
  m.cookie.value = ID
  m.apagados.length = 0
  m.user.v = { id: 'user-1', email: 'irma@exemplo.com' }
  m.privado.v = true
  m.captureMessage.mockReset()
  m.captureException.mockReset()
  m.rpc.mockReset()
  m.rpc.mockResolvedValue({ data: null, error: null })
  m.from.mockReset()
  tabelas({ obs_ai_oauth_pedidos: pedidoOk(), obs_ai_liberacoes: libOk, obs_ai_conexoes: { data: null, error: null } })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  delete process.env.OBSERVATORIO_IA_OAUTH
  delete process.env.OBSERVATORIO_IA_EXTERNA
})

describe('página /oauth/consentimento', () => {
  it('host fora de hostDoRecurso: notFound, sem rpc nem from', async () => {
    m.hdrs.set('host', 'x.vercel.app')
    await expect(html()).rejects.toThrow('NOTFOUND')
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.from).not.toHaveBeenCalled()
  })
  it('localhost com NODE_ENV=production: notFound', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    m.hdrs.set('host', 'localhost:3000')
    await expect(html()).rejects.toThrow('NOTFOUND')
  })
  it('OBSERVATORIO_IA_OAUTH apagada: desligado, e grava a linha quando há pessoa', async () => {
    delete process.env.OBSERVATORIO_IA_OAUTH
    expect(await html()).toContain(FRASES_DA_TELA.desligado_titulo)
    expect(chamadasDe('obs_ai_log_recusa_consentimento')[0]?.[1]).toMatchObject({ p_user: 'user-1', p_site: 'site-1', p_desfecho: 'desligado', p_cliente: null })
    expect(m.from).not.toHaveBeenCalled()
  })
  it('OBSERVATORIO_IA_EXTERNA apagada com OAuth on: desligado; sem pessoa não grava', async () => {
    delete process.env.OBSERVATORIO_IA_EXTERNA
    m.user.v = null
    expect(await html()).toContain(FRASES_DA_TELA.desligado_titulo)
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it('getUser sem pessoa (ou com erro de JWT): redireciona ao login com o next codificado', async () => {
    m.user.v = null
    const u = await url(html())
    expect(u.pathname + u.search).toBe(`/cms/login?next=%2Foauth%2Fconsentimento%3Fauthorization_id%3D${ID}`)
    expect(m.from).not.toHaveBeenCalled()
  })
  it('id fora da forma: inválido, sem from nem rpc', async () => {
    for (const id of [null, '', 'abc', ID + 'x']) expect(await html(id)).toContain(FRASES_DA_TELA.invalido_titulo)
    expect(m.from).not.toHaveBeenCalled()
    expect(m.rpc).not.toHaveBeenCalled()
  })

  describe('A1: o navegador que abriu o pedido', () => {
    it('pedido vivo sem cookie: outro_navegador com o título novo, sem rpc', async () => {
      tabelas({ obs_ai_oauth_pedidos: pedidoOk() })
      m.cookie.value = undefined
      const h = await html()
      expect(h).toContain('Este pedido não vale mais.')
      expect(h).not.toContain('neste navegador.')
      expect(h).toContain('Volte à sua IA e toque em Conectar de novo. Faça tudo neste mesmo navegador, sem abrir outra aba.')
      expect(m.rpc).not.toHaveBeenCalled()
    })
    it('pedido vivo com cookie de outro pedido: o mesmo', async () => {
      tabelas({ obs_ai_oauth_pedidos: pedidoOk() })
      m.cookie.value = 'B'.repeat(43)
      const h = await html()
      expect(h).toContain(FRASES_DA_TELA.outro_navegador_titulo)
      expect(h).toContain(FRASES_DA_TELA.outro_navegador)
      expect(m.rpc).not.toHaveBeenCalled()
    })
    it('pedido consumido sem cookie (reabrir depois de aprovar): invalido, não outro_navegador', async () => {
      tabelas({ obs_ai_oauth_pedidos: pedidoOk({ consumido_em: new Date(AGORA - 1000).toISOString() }) })
      m.cookie.value = undefined
      const h = await html()
      expect(h).toContain(FRASES_DA_TELA.invalido)
      expect(h).not.toContain(FRASES_DA_TELA.outro_navegador)
    })
    it('pedido vencido sem cookie: invalido', async () => {
      tabelas({ obs_ai_oauth_pedidos: pedidoOk({ expires_at: new Date(AGORA).toISOString() }) })
      m.cookie.value = undefined
      const h = await html()
      expect(h).toContain(FRASES_DA_TELA.invalido)
      expect(h).not.toContain(FRASES_DA_TELA.outro_navegador)
    })
    it('pedido mais antigo com cookie do mais novo (dois Conectar): o consumido vira invalido', async () => {
      tabelas({ obs_ai_oauth_pedidos: pedidoOk({ consumido_em: new Date(AGORA - 1000).toISOString() }) })
      m.cookie.value = 'B'.repeat(43)
      expect(await html()).toContain(FRASES_DA_TELA.invalido_titulo)
    })
  })

  describe('pedido inválido (q7, Foco 4)', () => {
    const q7 = FRASES_DA_TELA.invalido
    it('inexistente', async () => {
      tabelas({ obs_ai_oauth_pedidos: { data: null, error: null } })
      expect(await html()).toContain(q7)
      expect(chamadasDe('obs_ai_log_recusa_consentimento')[0]?.[1]).toMatchObject({ p_desfecho: 'invalido' })
    })
    it('vencido (expires_at = agora)', async () => {
      tabelas({ obs_ai_oauth_pedidos: pedidoOk({ expires_at: new Date(AGORA).toISOString() }) })
      expect(await html()).toContain(q7)
    })
    it('consumido: a mesma aba aberta depois de aprovar', async () => {
      tabelas({ obs_ai_oauth_pedidos: pedidoOk({ consumido_em: new Date(AGORA - 1000).toISOString() }) })
      const h = await html()
      expect(h).toContain(FRASES_DA_TELA.invalido_titulo)
      expect(h).toContain(q7)
      expect(h).not.toContain(FRASES_DA_TELA.aprovar)
    })
    it('pedido de outro site', async () => {
      tabelas({ obs_ai_oauth_pedidos: pedidoOk({ site_id: 'site-2' }) })
      expect(await html()).toContain(q7)
    })
    it('redirect que não é de cliente conhecido', async () => {
      tabelas({ obs_ai_oauth_pedidos: pedidoOk({ redirect_uri: 'https://evil.example/cb' }) })
      expect(await html()).toContain(q7)
    })
  })

  it('select do pedido lança: erro com o código curto c1-<8 hex>', async () => {
    tabelas({ obs_ai_oauth_pedidos: 'lanca' })
    const h = await html()
    expect(h).toContain(FRASES_DA_TELA.erro_titulo)
    expect(h).toMatch(/c1-[0-9a-f]{8}/)
    expect(m.captureException).toHaveBeenCalledTimes(1)
  })
  it('erro do banco na liberação: erro', async () => {
    tabelas({ obs_ai_oauth_pedidos: pedidoOk(), obs_ai_liberacoes: { data: null, error: { code: 'XX000' } } })
    expect(await html()).toContain(FRASES_DA_TELA.erro_titulo)
  })

  describe('pedido normal', () => {
    it('ChatGPT: aviso ACIMA do botão, e a tela nunca aprova sozinha', async () => {
      const h = await html()
      expect(h).toContain('Só aprove se você acabou de clicar em Conectar no seu ChatGPT.')
      expect(h.indexOf('Só aprove se você')).toBeLessThan(h.indexOf('Sim, fui eu. Aprovar'))
      expect(h).toContain('Conectar o ChatGPT')
      expect(h).toContain('irma@exemplo.com')
      expect(h).toContain('Pedido feito às 11:58 pelo ChatGPT')
      expect(h).toContain(FRASES_DA_TELA.risco_vale_ate('11/02/2027'))
      expect(chamadasDe('obs_ai_aprovar_conexao')).toHaveLength(0)
      expect(chamadasDe('obs_ai_negar_pedido')).toHaveLength(0)
    })
    it('redirect do claude.ai: Claude', async () => {
      tabelas({ obs_ai_oauth_pedidos: pedidoOk({ redirect_uri: CLAUDE }), obs_ai_liberacoes: libOk })
      const h = await html()
      expect(h).toContain('Conectar o Claude')
      expect(h).not.toContain('ChatGPT')
    })
    it('sem direito ao privado: texto do quadro 1c', async () => {
      m.privado.v = false
      const h = await html()
      expect(h).toContain(FRASES_DA_TELA.resumo_publico('ChatGPT'))
      expect(h).toContain(FRASES_DA_TELA.nao_privado)
      expect(h).not.toContain(FRASES_DA_TELA.pode_privado)
    })
    it('não deu para conferir o privado (null): estado erro c1-<8 hex>, sem o texto do escopo', async () => {
      m.privado.v = null
      const h = await html()
      expect(h).toContain(FRASES_DA_TELA.erro_titulo)
      expect(h).toMatch(/c1-[0-9a-f]{8}/)
      expect(h).not.toContain('sem acesso nesta conta')
      expect(h).not.toContain(FRASES_DA_TELA.nao_privado)
      expect(h).not.toContain(FRASES_DA_TELA.pode_privado)
    })
    it('com direito ao privado: texto do quadro 1', async () => {
      const h = await html()
      expect(h).toContain(FRASES_DA_TELA.pode_privado)
      expect(h).not.toContain(FRASES_DA_TELA.nao_privado)
    })
    it('pedido com mais de 3 min: aviso reforçado', async () => {
      tabelas({ obs_ai_oauth_pedidos: pedidoOk({ expires_at: new Date(AGORA + 6 * 60_000).toISOString() }), obs_ai_liberacoes: libOk })
      expect(await html()).toContain(FRASES_DA_TELA.aviso_tarde)
    })
    it('sem liberação ativa: mostra o pedido normal (a recusa nasce na função) e a linha "vale até" some', async () => {
      tabelas({ obs_ai_oauth_pedidos: pedidoOk(), obs_ai_liberacoes: { data: null, error: null } })
      const h = await html()
      expect(h).toContain(FRASES_DA_TELA.aprovar)
      expect(h).not.toContain('O acesso vale até')
    })
    it('conexão viva do mesmo cliente: "já conectou antes"', async () => {
      tabelas({ obs_ai_oauth_pedidos: pedidoOk(), obs_ai_liberacoes: libOk, obs_ai_conexoes: { data: { id: 'c1' }, error: null } })
      expect(await html()).toContain('Você já conectou o ChatGPT antes. Se aprovar, a conexão antiga para de funcionar e vale esta.')
    })
    it('erro na leitura da conexão: só omite a linha', async () => {
      tabelas({ obs_ai_oauth_pedidos: pedidoOk(), obs_ai_liberacoes: libOk, obs_ai_conexoes: { data: null, error: { code: 'x' } } })
      const h = await html()
      expect(h).toContain(FRASES_DA_TELA.aprovar)
      expect(h).not.toContain('conexão antiga')
    })
  })
})

describe('actions aprovar e negar', () => {
  const aprovado = (o: Record<string, unknown> = {}) => ({ data: [{ motivo: null, conexao_id: 'c', redirect_uri: CHATGPT, state: 'st-1', cliente: 'chatgpt', ...o }], error: null })
  const recusa = (motivo: string) => ({ data: [{ motivo, conexao_id: null, redirect_uri: CHATGPT, state: 'st-1', cliente: 'chatgpt' }], error: null })

  it('aprovado: redirect só com code, state e iss; code oac_; hash chega à função; p_user vem da sessão, não do FormData', async () => {
    m.rpc.mockResolvedValue(aprovado())
    const u = await url(aprovar(form({ authorization_id: ID, user_id: 'forjado', site_id: 'forjado' })))
    expect([...u.searchParams.keys()].sort()).toEqual(['code', 'iss', 'state'])
    expect(u.origin + u.pathname).toBe(CHATGPT)
    expect(u.searchParams.get('code')).toMatch(/^oac_/)
    expect(u.searchParams.get('state')).toBe('st-1')
    expect(u.searchParams.get('iss')).toBe('https://bythiagofigueiredo.com')
    expect(m.rpc).toHaveBeenCalledTimes(1)
    const [nome, args] = m.rpc.mock.calls[0] as [string, Record<string, string>]
    expect(nome).toBe('obs_ai_aprovar_conexao')
    expect(args).toMatchObject({ p_pedido_hash: HASH, p_user: 'user-1', p_site: 'site-1', p_agora: new Date(AGORA).toISOString() })
    expect(args.p_codigo_hash).toBe(createHash('sha256').update(u.searchParams.get('code')!).digest('hex'))
  })
  it('aprovado: o cookie do pedido é apagado (path / e secure)', async () => {
    m.rpc.mockResolvedValue(aprovado())
    await url(aprovar(form()))
    expect(m.apagados).toEqual([expect.objectContaining({ name: '__Host-oauth_pedido', path: '/', secure: true })])
  })
  it('state nulo: só code e iss', async () => {
    m.rpc.mockResolvedValue(aprovado({ state: null }))
    const u = await url(aprovar(form()))
    expect([...u.searchParams.keys()].sort()).toEqual(['code', 'iss'])
  })
  it('Sentry info sem pessoa, e-mail, client_id nem authorization_id', async () => {
    m.rpc.mockResolvedValue(aprovado())
    await url(aprovar(form()))
    expect(m.captureMessage).toHaveBeenCalledTimes(1)
    const [msg, o] = m.captureMessage.mock.calls[0] as [string, { level: string; tags: Record<string, string> }]
    expect(msg).toBe('acesso-ia: conexão aprovada')
    expect(o.level).toBe('info')
    expect(Object.keys(o.tags).sort()).toEqual(['cliente', 'dia'])
    const tudo = JSON.stringify(m.captureMessage.mock.calls)
    for (const proibido of ['irma@exemplo.com', 'user-1', 'cid', ID, HASH]) expect(tudo).not.toContain(proibido)
  })

  it.each(['abc', '', ID.slice(1), `${ID}=`])('authorization_id "%s": inválido e 0 rpc', async (v) => {
    expect(await aprovar(form({ authorization_id: v }))).toEqual({ estado: 'invalido' })
    expect(await negar(form({ authorization_id: v }))).toEqual({ estado: 'invalido' })
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it('sem o campo authorization_id: inválido', async () => {
    expect(await aprovar(form({}))).toEqual({ estado: 'invalido' })
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it.each(['nao_liberada', 'teto', 'sem_vinculo', 'banida', 'apagamento'])('motivo %s: sem_direito', async (motivo) => {
    m.rpc.mockResolvedValue(recusa(motivo))
    expect(await aprovar(form())).toEqual({ estado: 'sem_direito' })
  })
  it('as cinco recusas de regra mostram a MESMA frase', async () => {
    const frases = new Set<string>()
    for (const motivo of ['nao_liberada', 'teto', 'sem_vinculo', 'banida', 'apagamento']) {
      m.rpc.mockResolvedValue(recusa(motivo))
      const r = await aprovar(form())
      expect(r.estado).toBe('sem_direito')
      frases.add(FRASES_DA_TELA.sem_direito)
    }
    expect([...frases]).toEqual(['Esta conta não tem acesso a esta área.'])
  })
  it.each([['cortado', 'cortado'], ['pedido_invalido', 'invalido'], ['site', 'invalido'], ['sem_login', 'sem_login']])('motivo %s: %s', async (motivo, estado) => {
    m.rpc.mockResolvedValue(recusa(motivo))
    expect(await aprovar(form())).toEqual({ estado })
  })
  it('motivo desconhecido: erro', async () => {
    m.rpc.mockResolvedValue(recusa('novo_motivo'))
    expect((await aprovar(form())).estado).toBe('erro')
  })
  it('recusa de regra não apaga o cookie (o pedido volta a valer e o "Voltar" nega)', async () => {
    m.rpc.mockResolvedValue(recusa('teto'))
    await aprovar(form())
    expect(m.apagados).toHaveLength(0)
  })
  it('C1-20: rpc lança = erro, e erro do banco = erro; nada de redirect', async () => {
    m.rpc.mockRejectedValue(new Error('boom'))
    expect(await aprovar(form())).toEqual({ estado: 'erro', codigo: expect.stringMatching(/^c1-[0-9a-f]{8}$/) })
    m.rpc.mockResolvedValue({ data: null, error: { code: '40P01' } })
    expect((await aprovar(form())).estado).toBe('erro')
    expect(m.apagados).toHaveLength(0)
  })
  it('sem pessoa na sessão: sem_login, 0 rpc', async () => {
    m.user.v = null
    expect(await aprovar(form())).toEqual({ estado: 'sem_login' })
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it('travas fechadas: desligado e 0 rpc', async () => {
    delete process.env.OBSERVATORIO_IA_OAUTH
    expect(await aprovar(form())).toEqual({ estado: 'desligado' })
    expect(await negar(form())).toEqual({ estado: 'desligado' })
    expect(m.rpc).not.toHaveBeenCalled()
    process.env.OBSERVATORIO_IA_OAUTH = 'on'
    delete process.env.OBSERVATORIO_IA_EXTERNA
    expect(await aprovar(form())).toEqual({ estado: 'desligado' })
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it('host fora de hostDoRecurso: inválido, 0 rpc', async () => {
    m.hdrs.set('host', 'x.vercel.app')
    m.hdrs.set('origin', 'https://x.vercel.app')
    expect(await aprovar(form())).toEqual({ estado: 'invalido' })
    expect(m.rpc).not.toHaveBeenCalled()
  })

  describe('A1: cookie e origem', () => {
    it('sem cookie ou com cookie de outro id: outro_navegador, 0 rpc, nas duas actions', async () => {
      for (const v of [undefined, 'B'.repeat(43)]) {
        m.cookie.value = v
        expect(await aprovar(form())).toEqual({ estado: 'outro_navegador' })
        expect(await negar(form())).toEqual({ estado: 'outro_navegador' })
      }
      expect(m.rpc).not.toHaveBeenCalled()
    })
    describe('sem cookie: a action olha o pedido antes de acusar outro navegador', () => {
      const casos: Array<[string, Res]> = [
        ['consumido', pedidoOk({ consumido_em: new Date(AGORA - 60_000).toISOString() })],
        ['vencido', pedidoOk({ expires_at: new Date(AGORA - 1000).toISOString() })],
        ['inexistente', { data: null, error: null }],
      ]
      for (const [nome, ped] of casos) {
        it(`pedido ${nome}: invalido nas duas actions, 0 rpc`, async () => {
          m.cookie.value = undefined
          tabelas({ obs_ai_oauth_pedidos: ped })
          expect(await aprovar(form())).toEqual({ estado: 'invalido' })
          expect(await negar(form())).toEqual({ estado: 'invalido' })
          expect(m.rpc).not.toHaveBeenCalled()
        })
      }
      it('pedido vivo: outro_navegador nas duas actions', async () => {
        m.cookie.value = undefined
        expect(await aprovar(form())).toEqual({ estado: 'outro_navegador' })
        expect(await negar(form())).toEqual({ estado: 'outro_navegador' })
        expect(m.rpc).not.toHaveBeenCalled()
      })
      it('erro de banco na leitura (retorno ou exceção): estado erro, 0 rpc', async () => {
        m.cookie.value = undefined
        for (const r of [{ data: null, error: { code: 'XX000' } } as Res, 'lanca' as Res]) {
          tabelas({ obs_ai_oauth_pedidos: r })
          expect((await aprovar(form())).estado).toBe('erro')
          expect((await negar(form())).estado).toBe('erro')
        }
        expect(m.rpc).not.toHaveBeenCalled()
      })
    })
    it('cookie certo: obs_ai_aprovar_conexao chamado 1 vez e cookie apagado', async () => {
      m.rpc.mockResolvedValue(aprovado())
      await url(aprovar(form()))
      expect(chamadasDe('obs_ai_aprovar_conexao')).toHaveLength(1)
      expect(m.apagados).toHaveLength(1)
    })
    it('Origin de outro site ou ausente: inválido e 0 rpc', async () => {
      m.hdrs.set('origin', 'https://evil.example')
      expect(await aprovar(form())).toEqual({ estado: 'invalido' })
      expect(await negar(form())).toEqual({ estado: 'invalido' })
      m.hdrs.delete('origin')
      expect(await aprovar(form())).toEqual({ estado: 'invalido' })
      expect(m.rpc).not.toHaveBeenCalled()
    })
    it('fora de produção, a origem do host local é aceita', async () => {
      m.hdrs.set('host', 'localhost:3000')
      m.hdrs.set('origin', 'http://localhost:3000')
      m.rpc.mockResolvedValue(aprovado())
      await url(aprovar(form()))
      expect(m.rpc).toHaveBeenCalledTimes(1)
    })
    it('em produção, a origem de localhost não vale', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      m.hdrs.set('host', 'localhost:3000')
      m.hdrs.set('origin', 'http://localhost:3000')
      expect(await aprovar(form())).toEqual({ estado: 'invalido' })
      expect(m.rpc).not.toHaveBeenCalled()
    })
  })

  describe('negar', () => {
    it('sem motivo: redirect com error=access_denied, state e iss', async () => {
      m.rpc.mockResolvedValue({ data: [{ motivo: null, redirect_uri: CLAUDE, state: 'st-9' }], error: null })
      const u = await url(negar(form()))
      expect(u.origin + u.pathname).toBe(CLAUDE)
      expect(u.searchParams.get('error')).toBe('access_denied')
      expect(u.searchParams.get('state')).toBe('st-9')
      expect(u.searchParams.get('iss')).toBe('https://bythiagofigueiredo.com')
      expect([...u.searchParams.keys()].sort()).toEqual(['error', 'iss', 'state'])
      expect(m.rpc.mock.calls[0]).toEqual(['obs_ai_negar_pedido', { p_pedido_hash: HASH, p_user: 'user-1', p_site: 'site-1' }])
      expect(m.apagados).toHaveLength(1)
    })
    it('com motivo pedido_invalido: inválido; rpc lança: erro', async () => {
      m.rpc.mockResolvedValue({ data: [{ motivo: 'pedido_invalido', redirect_uri: null, state: null }], error: null })
      expect(await negar(form())).toEqual({ estado: 'invalido' })
      m.rpc.mockRejectedValue(new Error('x'))
      expect((await negar(form())).estado).toBe('erro')
    })
  })
})
