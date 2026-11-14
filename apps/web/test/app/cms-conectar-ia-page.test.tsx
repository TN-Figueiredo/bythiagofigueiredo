// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RECURSO } from '@/lib/youtube/observatorio/acesso-ia/oauth/config'

const h = vi.hoisted(() => ({
  host: 'bythiagofigueiredo.com',
  user: { id: 'user-da-sessao' } as { id: string } | null,
  linhas: [] as unknown,
  from: vi.fn(),
  eq: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: h.host }),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
  redirect: (u: string) => { throw new Error(`NEXT_REDIRECT:${u}`) },
  useRouter: () => ({ refresh: () => {} }),
}))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1', timezone: 'America/Sao_Paulo' }) }))
vi.mock('@tn-figueiredo/auth-nextjs', () => ({
  createServerClient: () => ({ auth: { getUser: async () => (h.user ? { data: { user: h.user }, error: null } : { data: { user: null }, error: null }) } }),
}))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => {
    const q: Record<string, unknown> = {}
    q.select = () => q
    q.eq = (...a: unknown[]) => { h.eq(...a); return q }
    q.order = () => q
    q.limit = async () => ({ data: h.linhas, error: null })
    return { from: (...a: unknown[]) => { h.from(...a); return q } }
  },
}))
vi.mock('@/lib/youtube/observatorio/acesso-ia/interruptor', () => ({
  acessoExternoLigado: (env: NodeJS.ProcessEnv = process.env) =>
    env.OBSERVATORIO_IA_EXTERNA === 'on' ? { ligado: true } : { ligado: false, motivo: 'variavel' },
}))
vi.mock('@/app/cms/(authed)/_shared/cms-link', () => ({ default: () => null }))

const AGORA = Date.parse('2026-11-12T12:00:00Z')
const L = (o: Record<string, unknown>) => ({ expires_at: '2027-02-11T03:00:00Z', revoked_at: null, revogada_por: null, bloqueios: [], created_at: '2026-11-01T00:00:00Z', ...o })

async function render(sp: Record<string, string> = {}) {
  const { default: Page } = await import('@/app/cms/(authed)/conectar-ia/page')
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(sp) }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(AGORA)
  process.env.OBSERVATORIO_IA_OAUTH = 'on'; process.env.OBSERVATORIO_IA_EXTERNA = 'on'
  h.host = 'bythiagofigueiredo.com'; h.user = { id: 'user-da-sessao' }; h.linhas = [L({})]
  h.from.mockClear(); h.eq.mockClear()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('/cms/conectar-ia (page)', () => {
  it('host errado e localhost em produção: notFound sem leitura', async () => {
    h.host = 'x.vercel.app'
    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND')
    vi.stubEnv('NODE_ENV', 'production'); h.host = 'localhost:3000'
    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(h.from).not.toHaveBeenCalled()
  })
  it('sem usuário: redireciona ao login com next+ia', async () => {
    h.user = null
    await expect(render({ ia: 'claude' })).rejects.toThrow('NEXT_REDIRECT:/cms/login?next=%2Fcms%2Fconectar-ia%3Fia%3Dclaude')
    await expect(render()).rejects.toThrow('NEXT_REDIRECT:/cms/login?next=%2Fcms%2Fconectar-ia')
  })
  it('OAuth desligado (variável apagada): bloco desligado, sem RECURSO, sem leitura', async () => {
    delete process.env.OBSERVATORIO_IA_OAUTH
    const html = await render()
    expect(html).toContain('A conexão está desligada por enquanto.')
    expect(html).not.toContain(RECURSO)
    expect(html).not.toContain('api/mcp')
    expect(h.from).not.toHaveBeenCalled()
  })
  it('acesso externo desligado (variável apagada): idem', async () => {
    delete process.env.OBSERVATORIO_IA_EXTERNA
    const html = await render()
    expect(html).toContain('A conexão está desligada por enquanto.')
    expect(html).not.toContain('api/mcp')
    expect(h.from).not.toHaveBeenCalled()
  })
  it('ativa: RECURSO e a data', async () => {
    const html = await render()
    expect(html).toContain(RECURSO)
    expect(html).toContain('Você tem acesso até 11/02/2027.')
    expect(html).toContain('Conectar sua IA')
  })
  it('ativa com data inválida: sem frase de acesso e sem 00/00', async () => {
    h.linhas = [L({ expires_at: 'lixo' })]
    const html = await render()
    expect(html).not.toContain('Você tem acesso')
    expect(html).not.toContain('00/00')
    expect(html).toContain(RECURSO)
  })
  it('nunca / vencida / cortada: sem endereço', async () => {
    h.linhas = []
    let html = await render()
    expect(html).toContain('Você ainda não tem acesso.'); expect(html).not.toContain('api/mcp')
    h.linhas = [L({ revoked_at: 'x', revogada_por: 'vencida', expires_at: '2026-11-05T02:00:00Z' })]
    html = await render()
    expect(html).toContain('Seu acesso venceu em 04/11/2026.'); expect(html).not.toContain('api/mcp')
    h.linhas = [L({ revoked_at: 'x', revogada_por: 'dono' })]
    html = await render()
    expect(html).toContain('Acesso pausado pelo Thiago.'); expect(html).not.toContain('api/mcp')
  })
  it('erro de leitura: lança', async () => {
    h.linhas = null
    await expect(render()).rejects.toThrow('conectar-ia: leitura')
  })
  it('o user_id do filtro é o da sessão, não o da URL', async () => {
    await render({ user_id: 'forjado' })
    expect(h.eq).toHaveBeenCalledWith('user_id', 'user-da-sessao')
    expect(h.eq).toHaveBeenCalledWith('site_id', 'site-1')
    expect(h.eq).not.toHaveBeenCalledWith('user_id', 'forjado')
  })
})
