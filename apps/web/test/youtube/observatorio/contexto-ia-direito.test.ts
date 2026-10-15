// @vitest-environment node
/**
 * A5 · E17 degrau 1, Tarefa 12 (direito): sem direito ou sem conseguir conferir, a ação não leva dado privado nas telas do canal próprio, do vídeo próprio, de Canais e de Comparar: `params.privado` diz "excluido:…", `privado_medidos` é 0, o registro não marca `incluiuPrivado`, e o texto sai menor que o do dono. Mais: nenhum arquivo do plano usa cache de dados (`unstable_cache`/`cache-tag`). LIMITE: sem banco falso; o direito é simulado pela guarda e pelos dados de page-data/_proprio/dados. Sem dado/estresse de tamanho: ver relatório.
 * : a ação `gerarPacoteIa` roda DE VERDADE (`EMPACOTAR`, os `montar…` e os empacotadores reais) sobre o
 * oráculo do canal próprio, para cada tela do registro em `existe`, com a credencial de maior alcance. O que sai pela resposta não leva endereço do CMS,
 * chave, valor em moeda nem e-mail; endereço externo só do YouTube; nenhuma chamada de rede. Guarda, registro e Sentry são simulados; o resto, não.
 * LIMITE DECLARADO: esta versão varre PADRÕES e a identidade do conjunto (ids de usuário e de site); a semente por campo (um sentinela em cada coluna de
 * cada tabela lida) fica para um banco falso, que a Tarefa 12 pede e o repositório ainda não tem.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proprioWorld } from './proprio-fixture'
import type { ChannelPage } from '@/app/cms/(authed)/youtube/competitors/_chrome/page-data'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import type { OwnMenu } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'
import type { TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'

const w = proprioWorld()
const SITE = '00000000-0000-4000-8000-0000000000aa'
const USUARIO = '00000000-0000-4000-8000-0000000000cc'
const EDICAO = Object.defineProperty({}, 'siteId', { value: SITE, enumerable: false }) as LeituraPrivadaDoSite
const OWNS: OwnMenu = { itens: [{ id: w.canalId, name: 'Meu', nota: 'n', href: '/x' }], principal: null, listaHref: '/l' }

const st = vi.hoisted(() => ({ acesso: { leitura: null as unknown, edita: false, negativa: null as string | null }, dados: null as unknown, vazio: false, regs: [] as unknown[] }))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) }, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: async () => true }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: SITE }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: USUARIO } }) }))
vi.mock('@/lib/youtube/observatorio/contexto-ia/registrar-acesso', () => ({ registrarAcesso: async (l: unknown) => { st.regs.push(l); return { ok: true } } }))
vi.mock('@/lib/youtube/observatorio/medidas-telas/carregar-do-site', () => ({ carregarMedidasDoSite: async () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({
  openChannelPage: async () => ({ siteId: SITE, now: w.obs.NOW, obs: w.obs, canEdit: st.acesso.edita, leitura: st.acesso.leitura, negativa: st.acesso.negativa, ownYtIds: w.ytIds, meuCanalLembrado: null, owns: OWNS } satisfies Partial<ChannelPage> & Record<string, unknown>),
  openObservatoryPage: async () => ({ siteId: SITE, now: w.obs.NOW, rows: {}, obs: w.obs, meuCanalLembrado: null, savedNiche: 'todos', extra: { canUnlock: true, podeEditar: true, legacy: [], bookmarked: new Set<string>() } }),
  lerMeuCanalLembrado: async () => null,
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados', () => ({
  acessoPrivado: async () => st.acesso,
  lerDadosDoCanal: async () => st.dados,
  lerDadosDoVideo: async () => { const d = st.dados as { alcance: { acesso: string; dado?: unknown }; diario: { acesso: string; dado?: unknown } }; return d.alcance.acesso === 'ok' && d.diario.acesso === 'ok' ? { acesso: 'ok', dado: { alcance: d.alcance.dado, diario: d.diario.dado } } : { acesso: d.diario.acesso } },
  lerDiarioLongo: async () => ({ acesso: 'erro' }), longosAcompanhadosDe: () => [],
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados-origem', () => ({ lerOrigem: async () => ({ acesso: 'erro' }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados-termos', () => ({ lerTermosESites: async () => ({ acesso: 'negado' }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/carregar-extras', () => ({
  carregarExtrasProprio: async () => undefined,
  carregarProprioDaComparacao: async () => ({ extras: undefined, soSeuCanal: {} }),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows', async (orig) => ({ ...(await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows')>()), loadSwipeRows: async () => ({ legacy: [], bookmarked: new Set<string>() }) }))
const modo = vi.hoisted(() => ({ ligado: true }))
vi.mock('@/lib/youtube/observatorio/contexto-ia/regras', async (orig) => {
  const m = await orig<typeof import('@/lib/youtube/observatorio/contexto-ia/regras')>()
  return { ...m, CONTEXTO_IA_RULES: new Proxy(m.CONTEXTO_IA_RULES, { get: (t, k) => (k === 'ligado' ? modo.ligado : Reflect.get(t, k)) }) }
})

import { gerarPacoteIa } from '@/app/cms/(authed)/youtube/competitors/contexto-ia-actions'

const proprioVideo = w.obs.videos.find((v) => v.ch === w.canalId)!
const concVideo = w.obs.videos.find((v) => !w.obs.channel(v.ch)!.own)!
const concCanal = w.obs.channels.find((c) => !c.own)!
const PEDIDOS: Record<TelaId, { id?: string; consulta: string } | null> = {
  canais: { consulta: '' },
  canal: { id: concCanal.id, consulta: '' },
  video: { id: concVideo.id, consulta: '' },
  comparar: { consulta: '' },
  outliers: { consulta: '' },
  insights: { consulta: '' },
  mudancas: { consulta: '' },
  'canal-proprio': { id: w.canalId, consulta: '' },
  'video-proprio': { id: proprioVideo.id, consulta: '' },
  fila: null,
  ritmo: null,
}
const TELAS_EXISTE = (Object.keys(TELAS_IA) as TelaId[]).filter((t) => TELAS_IA[t].estado === 'existe')


beforeEach(() => { modo.ligado = true; st.acesso = { leitura: EDICAO, edita: true, negativa: null }; st.dados = w.dados; st.regs = [] })
afterEach(() => { vi.restoreAllMocks() })
const proprioVideo2 = w.obs.videos.find((v) => v.ch === w.canalId)!
const PEDIDO = { 'canal-proprio': { id: w.canalId }, 'video-proprio': { id: proprioVideo2.id }, canais: {}, comparar: {} } as const
type T = keyof typeof PEDIDO
const TELAS: T[] = ['canal-proprio', 'video-proprio', 'canais', 'comparar']
const CASOS = [['sem_direito'], ['nao_foi_possivel_conferir']] as const

function semDireito(neg: 'sem_direito' | 'nao_foi_possivel_conferir') {
  st.acesso = { leitura: null, edita: false, negativa: neg }
  st.dados = { alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } }
}

describe('direito: sem direito nada privado sai', () => {
  it('com o direito do dono, o canal próprio e o vídeo próprio levam dado privado (senão as ausências abaixo provam nada)', async () => {
    const c = await gerarPacoteIa({ tela: 'canal-proprio', consulta: '', ...PEDIDO['canal-proprio'] })
    const v = await gerarPacoteIa({ tela: 'video-proprio', consulta: '', ...PEDIDO['video-proprio'] })
    expect(c.ok && v.ok).toBe(true)
    if (c.ok && v.ok) {
      expect(c.pacote.tela).toBe('canal-proprio')
      expect(st.regs).toHaveLength(2)
      expect(JSON.stringify(st.regs[1])).toContain('"incluiuPrivado":true')
    }
  })
  for (const [neg] of CASOS) {
    for (const t of TELAS) {
      it(`${neg} em ${t}: privado excluído, registro sem privado, texto menor que o do dono`, async () => {
        const dono = await gerarPacoteIa({ tela: t, consulta: '', ...PEDIDO[t] })
        const caracDono = (st.regs[0] as { caracteres: number }).caracteres
        st.regs = []
        semDireito(neg)
        const r = await gerarPacoteIa({ tela: t, consulta: '', ...PEDIDO[t] })
        expect(dono.ok && r.ok).toBe(true)
        if (!r.ok) return
        const reg = st.regs[0] as { incluiuPrivado: boolean; caracteres: number; params: Record<string, unknown> }
        expect(reg.incluiuPrivado).toBe(false)
        expect(String(reg.params.privado)).toMatch(/^excluido:/)
        expect(reg.params.privado_medidos).toBe(0)
        expect(reg.caracteres).toBeLessThanOrEqual(caracDono)
      })
    }
  }
})

describe('cache: nenhum arquivo do degrau usa cache de dados', () => {
  it('sem unstable_cache nem cache-tag', async () => {
    const { readFileSync, readdirSync } = await import('node:fs')
    const { join } = await import('node:path')
    const raiz = join(process.cwd(), 'src')
    const arquivos = [
      ...readdirSync(join(raiz, 'lib/youtube/observatorio/contexto-ia')).map((f) => join(raiz, 'lib/youtube/observatorio/contexto-ia', f)),
      join(raiz, 'app/cms/(authed)/youtube/competitors/contexto-ia-actions.ts'),
      join(raiz, 'app/cms/(authed)/youtube/competitors/_contexto-ia/index.ts'),
    ].filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
    expect(arquivos.length).toBeGreaterThan(10)
    for (const f of arquivos) expect(readFileSync(f, 'utf8'), f).not.toMatch(/unstable_cache|cache-tag/)
  })
})
