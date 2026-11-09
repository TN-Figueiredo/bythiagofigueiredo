// @vitest-environment node
/**
 * E17 degrau 2, Tarefa 8b: cada entrada de `EMPACOTAR` que as ações do MCP usam abre o dado pelo `Abridor` que recebe. Com tudo que é de sessão
 * (site, guarda, cookie, redirect, as portas das telas, `acessoPrivado`) simulado para LANÇAR, a resposta não lança e o abridor falso foi chamado.
 * `fila` e `sugestoes` pedem edição pela sessão: por chave são "não encontrado", sem tocar a guarda nem ler nada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { proprioWorld } from './proprio-fixture'
import type { ChannelPage } from '@/app/cms/(authed)/youtube/competitors/_chrome/page-data'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import type { OwnMenu } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
import type { Abridor } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'

const w = proprioWorld()
const OWNS: OwnMenu = { itens: [{ id: w.canalId, name: 'Meu', nota: 'n', href: '/x' }], principal: null, listaHref: '/l' }
const LEITURA = Object.defineProperty({}, 'siteId', { value: 'site-secreto-8b', enumerable: false }) as LeituraPrivadaDoSite

const st = vi.hoisted(() => ({
  page: null as unknown, site: null as unknown, dados: null as unknown,
  acesso: { leitura: null as unknown, edita: false, negativa: null as string | null },
}))
const sessao = vi.hoisted(() => ({ guarda: vi.fn(), fila: vi.fn(), sugestoes: vi.fn() }))
const LANCA = (nome: string) => () => { throw new Error(`SESSAO ${nome}`) }
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: LANCA('redirect'), notFound: LANCA('notFound') }))
vi.mock('next/headers', () => ({ cookies: LANCA('cookies'), headers: LANCA('headers') }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: LANCA('getSiteContext') }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => { sessao.guarda(...a); throw new Error('SESSAO requireSiteScope') } }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: LANCA('canAdminSiteUsers') }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: LANCA('service') }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/permissao', () => ({ podeEditarSite: LANCA('podeEditarSite') }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({
  openObservatoryPage: LANCA('openObservatoryPage'), openChannelPage: LANCA('openChannelPage'), lerMeuCanalLembrado: LANCA('lerMeuCanalLembrado'),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados', async orig => ({
  ...(await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_proprio/dados')>()),
  acessoPrivado: LANCA('acessoPrivado'),
  lerDadosDoCanal: async () => st.dados,
  lerDadosDoVideo: async () => { const d = st.dados as { alcance: { acesso: string; dado?: unknown }; diario: { acesso: string; dado?: unknown } }; return d.alcance.acesso === 'ok' && d.diario.acesso === 'ok' ? { acesso: 'ok', dado: { alcance: d.alcance.dado, diario: d.diario.dado } } : { acesso: d.diario.acesso } },
  lerDiarioLongo: async () => ({ acesso: 'erro' }), longosAcompanhadosDe: () => [],
}))
// a leitura do teste é um objeto qualquer: a marca vale (como a de uma chave com o direito privado), então `dados-termos` real chega até a guarda de sessão, que lança
vi.mock('@/lib/youtube/observatorio/proprio/leitura-privada', async orig => ({ ...(await orig<typeof import('@/lib/youtube/observatorio/proprio/leitura-privada')>()), leituraValida: () => true }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados-origem', () => ({ lerOrigem: async () => ({ acesso: 'erro' }) }))
// `dados-termos` NÃO é simulado (I-3 do Yannis): é o módulo que chegaria à guarda de sessão (`requireSiteScope`); com leitura válida e sem edição ele nem pode ser chamado
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/carregar-extras', () => ({
  carregarExtrasProprio: async () => undefined,
  carregarProprioDaComparacao: async () => ({ extras: undefined, soSeuCanal: {} }),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows', async orig => ({ ...(await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows')>()), loadSwipeRows: async () => ({ legacy: [], bookmarked: new Set<string>() }) }))
vi.mock('@/lib/youtube/observatorio/medidas-telas/carregar-do-site', () => ({ carregarMedidasDoSite: async () => ({ porCanal: new Map(), extras: { lido: false, causa: 'tempo_esgotado' }, falhas: [], esgotou: 0, videos: new Map() }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_saiu/montar', () => ({ montarFila: sessao.fila }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_sugestoes/montar', () => ({ montarSugestoes: sessao.sugestoes }))

const R = '@/app/cms/(authed)/youtube/competitors'
function falso(): Abridor & { observatorio: ReturnType<typeof vi.fn>; canal: ReturnType<typeof vi.fn>; acessoPrivado: ReturnType<typeof vi.fn> } {
  return { observatorio: vi.fn(async () => st.site), canal: vi.fn(async () => st.page), acessoPrivado: vi.fn(async () => st.acesso) } as never
}
function paginaCanal(leitura: unknown, negativa: string | null): void {
  st.page = { siteId: 's1', now: w.obs.NOW, obs: w.obs, canEdit: false, leitura, negativa, ownYtIds: w.ytIds, meuCanalLembrado: null, owns: OWNS } satisfies Partial<ChannelPage> & Record<string, unknown>
}
beforeEach(() => {
  vi.clearAllMocks()
  st.dados = w.dados
  st.acesso = { leitura: LEITURA, edita: false, negativa: null }
  st.site = { siteId: 's1', now: w.obs.NOW, rows: {}, obs: w.obs, meuCanalLembrado: null, savedNiche: 'todos', extra: { legacy: [], bookmarked: new Set<string>(), canUnlock: false, podeEditar: false } }
  paginaCanal(LEITURA, null)
})

const conc = () => w.obs.channels.find(c => !c.own)!
const videoProprio = () => w.obs.videos.find(v => v.ch === w.canalId)!
const videoConc = () => w.obs.videos.find(v => !w.obs.channel(v.ch)!.own)!

describe('EMPACOTAR por chave (sem sessão)', () => {
  const casos: Array<[string, () => { id?: string; sp: Record<string, string | undefined> }, 'observatorio' | 'canal']> = [
    ['canais', () => ({ sp: {} }), 'observatorio'],
    ['canal', () => ({ id: conc().id, sp: {} }), 'canal'],
    ['canal-proprio', () => ({ id: w.canalId, sp: {} }), 'canal'],
    ['video', () => ({ id: videoConc().id, sp: {} }), 'observatorio'],
    ['video-proprio', () => ({ id: videoProprio().id, sp: {} }), 'observatorio'],
    ['comparar', () => ({ sp: {} }), 'observatorio'],
    ['outliers', () => ({ sp: {} }), 'observatorio'],
    ['insights', () => ({ sp: {} }), 'observatorio'],
    ['mudancas', () => ({ sp: {} }), 'observatorio'],
  ]
  for (const [tela, pedido, porta] of casos) {
    it(`${tela}: responde sem lançar e abre o dado pelo abridor recebido (${porta})`, async () => {
      const { EMPACOTAR } = await import(`${R}/_contexto-ia`)
      const abrir = falso()
      const pacote = await EMPACOTAR[tela as keyof typeof EMPACOTAR]!(pedido(), abrir)
      expect(pacote, tela).not.toBeNull()
      expect(abrir[porta], tela).toHaveBeenCalled()
      expect(sessao.guarda).not.toHaveBeenCalled()
    })
  }

  it('fila e sugestões por chave: "não encontrado", sem chamar a guarda nem ler nada', async () => {
    const { EMPACOTAR } = await import(`${R}/_contexto-ia`)
    const abrir = falso()
    expect(await EMPACOTAR.fila!({ sp: {} }, abrir)).toBeNull()
    expect(await EMPACOTAR.sugestoes!({ sp: {} }, abrir)).toBeNull()
    expect(sessao.guarda).not.toHaveBeenCalled()
    expect(sessao.fila).not.toHaveBeenCalled()
    expect(sessao.sugestoes).not.toHaveBeenCalled()
    expect(abrir.observatorio).not.toHaveBeenCalled()
    expect(abrir.canal).not.toHaveBeenCalled()
    expect(abrir.acessoPrivado).not.toHaveBeenCalled()
  })

  it('sem abridor vale o de sessão: fila e sugestões seguem para o montar (caminho de sessão igual)', async () => {
    sessao.fila.mockResolvedValue({ view: { estado: 'sem_acesso' }, recente: null, estado: {} })
    sessao.sugestoes.mockResolvedValue(null)
    const { EMPACOTAR } = await import(`${R}/_contexto-ia`)
    expect(await EMPACOTAR.fila!({ sp: {} })).toBeNull()
    expect(await EMPACOTAR.sugestoes!({ sp: {} })).toBeNull()
    expect(sessao.fila).toHaveBeenCalledTimes(1)
    expect(sessao.sugestoes).toHaveBeenCalledTimes(1)
  })
})

describe('o privado vem do acesso do abridor (S-I6 b)', () => {
  it('abridor com leitura: o pacote do vídeo próprio marca o privado como incluído', async () => {
    const { EMPACOTAR } = await import(`${R}/_contexto-ia`)
    const abrir = falso()
    const pacote = await EMPACOTAR['video-proprio']!({ id: videoProprio().id, sp: {} }, abrir)
    expect(abrir.acessoPrivado).toHaveBeenCalled()
    expect(JSON.stringify(pacote?.modelo)).toContain('"estado":"incluido"')
  })
  it('abridor sem direito: o pacote do vídeo próprio marca o privado como excluído por sem_direito', async () => {
    st.acesso = { leitura: null, edita: false, negativa: 'sem_direito' }
    st.dados = { alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } }
    const { EMPACOTAR } = await import(`${R}/_contexto-ia`)
    const pacote = await EMPACOTAR['video-proprio']!({ id: videoProprio().id, sp: {} }, falso())
    expect(JSON.stringify(pacote?.modelo)).toContain('"estado":"excluido","motivo":"sem_direito"')
  })
  it('canal próprio: a leitura da página do abridor vira privado incluído; sem direito, excluído por sem_direito', async () => {
    const { EMPACOTAR } = await import(`${R}/_contexto-ia`)
    const com = await EMPACOTAR['canal-proprio']!({ id: w.canalId, sp: {} }, falso())
    expect(JSON.stringify(com?.modelo)).toContain('"estado":"incluido"')
    paginaCanal(null, 'sem_direito')
    st.dados = { alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } }
    const sem = await EMPACOTAR['canal-proprio']!({ id: w.canalId, sp: {} }, falso())
    expect(JSON.stringify(sem?.modelo)).toContain('"estado":"excluido","motivo":"sem_direito"')
  })
})
