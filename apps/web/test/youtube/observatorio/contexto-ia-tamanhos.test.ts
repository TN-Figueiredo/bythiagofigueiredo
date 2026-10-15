// @vitest-environment node
/**
 * A5 · E17 degrau 1, Tarefa 12: tamanhos. Gera o pacote de cada tela sobre o oráculo (a ação roda de verdade) e sobre as fixtures de estresse
 * (60 canais x 90 dias; 40 trocas e 30 versões de 5.000 caracteres) e SÓ AFIRMA: o piso (seção 5.2) e o teto de 1 MB. Não grava arquivo.
 * Cada caso escreve uma linha `console.info('tamanho', tela, fixture, total, copia, completo)`; a tabela da C4 sai da saída deste arquivo.
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

const st = vi.hoisted(() => ({ acesso: { leitura: null as unknown, edita: false, negativa: null as string | null } }))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) }, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: async () => true }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: SITE }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: USUARIO } }) }))
vi.mock('@/lib/youtube/observatorio/contexto-ia/registrar-acesso', () => ({ registrarAcesso: async () => ({ ok: true }) }))
vi.mock('@/lib/youtube/observatorio/medidas-telas/carregar-do-site', () => ({ carregarMedidasDoSite: async () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({
  openChannelPage: async () => ({ siteId: SITE, now: w.obs.NOW, obs: w.obs, canEdit: true, leitura: EDICAO, negativa: null, ownYtIds: w.ytIds, meuCanalLembrado: null, owns: OWNS } satisfies Partial<ChannelPage> & Record<string, unknown>),
  openObservatoryPage: async () => ({ siteId: SITE, now: w.obs.NOW, rows: {}, obs: w.obs, meuCanalLembrado: null, savedNiche: 'todos', extra: { canUnlock: true, podeEditar: true, legacy: [], bookmarked: new Set<string>() } }),
  lerMeuCanalLembrado: async () => null,
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados', () => ({
  acessoPrivado: async () => st.acesso,
  lerDadosDoCanal: async () => w.dados,
  lerDadosDoVideo: async () => ({ acesso: 'ok', dado: { alcance: (w.dados.alcance as { dado: unknown }).dado, diario: (w.dados.diario as { dado: unknown }).dado } }),
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
// Portão do N3 (Yannis Y1): o oráculo tem a Origem e os cartões de período em erro, que são os dois blocos que CRESCEM. O caso "completo" liga os dois.
const extras = vi.hoisted(() => ({ completos: false }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_canal/montar', async (orig) => {
  const m = await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_canal/montar')>()
  const { origemDe, periodosDe } = await import('./contexto-ia-periodos-origem-fixture')
  return {
    ...m,
    assistidoDoCanal: async (...a: Parameters<typeof m.assistidoDoCanal>) => (extras.completos ? periodosDe('medido') : m.assistidoDoCanal(...a)),
    origemDoCanal: async (...a: Parameters<typeof m.origemDoCanal>) => (extras.completos ? origemDe('completa') : m.origemDoCanal(...a)),
  }
})
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

const PADROES_DE_CHAVE = [/eyJ[A-Za-z0-9_-]{8,}/, /\bsk-[A-Za-z0-9]/, /Bearer /, /\bsb-/, /apikey/i, /cookie/i]
const MOEDA = /R\$|US\$|\b(revenue|rpm|cpm|adsense|receita)\b/i
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const URL_EXTERNA = /https?:\/\/[^\s"')\]|]+/g
const DO_YOUTUBE = /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)(\/|$)/

type Pacote = Extract<Awaited<ReturnType<typeof gerarPacoteIa>>, { ok: true }>['pacote']
/** Os textos de terceiros que o oráculo traz (título, nome de canal): são dado, e podem ter moeda, e-mail e endereço. */
const TERCEIROS_CONHECIDOS = [...w.obs.videos.map((v) => v.title), ...w.obs.channels.map((c) => c.name)].filter((t) => t.length >= 3).sort((a, b) => b.length - a.length)
/**
 * As duas regiões do plano (D-I4): a do SITE (tudo o que o site escreve) e a de TERCEIROS (linhas `│ ` dos blocos citados, o JSON deles, e o título
 * ou o nome que o oráculo conhece). Moeda, e-mail e endereço externo valem só na região do site; chave, `/cms/` e ids valem na saída inteira.
 */
function regiaoDoSite(p: Pacote): string {
  const linhas: string[] = []
  const json: unknown[] = []
  for (const s of p.segmentos) {
    const citado = s.texto.includes('texto de terceiros]')
    linhas.push(...s.texto.split('\n').filter((l) => !l.startsWith('│')))
    if (!citado && s.linhaDoJson) json.push(s.linhaDoJson)
  }
  let texto = linhas.join('\n') + JSON.stringify({ ...p, segmentos: [] }) + JSON.stringify(json)
  for (const t of TERCEIROS_CONHECIDOS) texto = texto.split(t).join('')
  return texto
}

/** Tudo o que a violação procura numa saída; devolve as violações achadas (lista vazia = limpa). */
function violacoes(saida: string, regiao: string = saida): string[] {
  const v: string[] = []
  if (saida.includes('/cms/')) v.push('endereço do CMS')
  for (const p of PADROES_DE_CHAVE) if (p.test(saida)) v.push(`padrão de chave ${String(p)}`)
  if (MOEDA.test(regiao)) v.push('valor em moeda')
  if (EMAIL.test(regiao)) v.push('e-mail')
  for (const u of regiao.match(URL_EXTERNA) ?? []) if (!DO_YOUTUBE.test(u)) v.push(`endereço externo ${u}`)
  if (saida.includes(SITE)) v.push('id do site')
  if (saida.includes(USUARIO)) v.push('id de usuário')
  return v
}


import { CONTEXTO_IA_RULES } from '@/lib/youtube/observatorio/contexto-ia/regras'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { resumir } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { CONTEXTO, modeloEstresse, modeloEstresseMudancas, modeloEstresseVideo } from './contexto-ia-fixture'

const TETO = 1_000_000
const PISO_PASSA: readonly TelaId[] = ['canal-proprio']
const TETO_DO_PISO_QUE_PASSA = 31_500
beforeEach(() => { extras.completos = false; modo.ligado = true; st.acesso = { leitura: EDICAO, edita: true, negativa: null } })
afterEach(() => { vi.restoreAllMocks() })

describe('tamanhos dos pacotes', () => {
  it('a ação respondeu ok: true em toda tela do registro em existe (sem isso as afirmações abaixo provariam nada)', async () => {
    for (const tela of TELAS_EXISTE) {
      expect(PEDIDOS[tela], `tela sem prova: ${tela}`).not.toBeNull()
      expect((await gerarPacoteIa({ tela, ...PEDIDOS[tela]! })).ok, tela).toBe(true)
    }
  })

  for (const tela of TELAS_EXISTE) {
    it(`${tela} (oráculo): o piso não passa, a cópia cabe em ${CONTEXTO_IA_RULES.limiteCopia} (salvo a lista declarada) e a resposta serializada fica abaixo de 1 MB`, async () => {
      const r = await gerarPacoteIa({ tela, ...PEDIDOS[tela]! })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      const t = resumir(r.pacote, 'x'.repeat(CONTEXTO_IA_RULES.perguntaMax))
      console.info('tamanho', tela, 'oraculo', t.copia.totalSemCorte, t.copia.caracteres, t.completo.caracteres)
      expect(t.copia.pisoPassou, 'piso').toBe(false)
      expect(t.copia.caracteres).toBeLessThanOrEqual(CONTEXTO_IA_RULES.limiteCopia)
      expect(t.completo.caracteres).toBeLessThanOrEqual(CONTEXTO_IA_RULES.limiteCompleto)
      expect(JSON.stringify(r.pacote).length).toBeLessThan(TETO)
    })
  }

  it('canal-proprio com os cartões de período e a Origem COMPLETOS (o estado real do canal do dono): a cópia fica abaixo do teto declarado e a resposta abaixo de 1 MB', async () => {
    extras.completos = true
    const r = await gerarPacoteIa({ tela: 'canal-proprio', ...PEDIDOS['canal-proprio']! })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.pacote.tabelas.some((x) => x.id === 'privado-origem-linhas'), 'a Origem entrou no pacote (sem isso o caso provaria nada)').toBe(true)
    expect(r.pacote.tabelas.some((x) => x.id === 'privado-assistido-por-periodo'), 'os cartões de período entraram no pacote').toBe(true)
    const t = resumir(r.pacote, 'x'.repeat(CONTEXTO_IA_RULES.perguntaMax))
    console.info('tamanho', 'canal-proprio', 'completo', t.copia.totalSemCorte, t.copia.caracteres, t.completo.caracteres)
    // Pergunta 3 do plano (seção 8): a cópia desta tela pode sair um pouco acima do limite; a barra e a linha "Por tamanho" dizem o número real.
    expect(PISO_PASSA).toContain('canal-proprio')
    expect(t.copia.caracteres).toBeLessThanOrEqual(TETO_DO_PISO_QUE_PASSA)
    expect(t.completo.caracteres).toBeLessThanOrEqual(CONTEXTO_IA_RULES.limiteCompleto)
    expect(JSON.stringify(r.pacote).length).toBeLessThan(TETO)
  })

  const ESTRESSES = {
    'estresse 60 canais x 90 dias': modeloEstresse(),
    'estresse 40 trocas de 5.000': modeloEstresseMudancas(),
    'estresse 30 versões de 5.000': modeloEstresseVideo(),
  }
  for (const [nome, modelo] of Object.entries(ESTRESSES)) {
    it(`${nome}: o piso não passa, a cópia cabe, o completo cabe e o total fica abaixo de 1 MB`, () => {
      const pacote = segmentar(modelo, CONTEXTO)
      const t = resumir(pacote, 'x'.repeat(CONTEXTO_IA_RULES.perguntaMax))
      console.info('tamanho', modelo.tela, nome, t.copia.totalSemCorte, t.copia.caracteres, t.completo.caracteres)
      expect(t.copia.pisoPassou).toBe(false)
      expect(t.copia.caracteres).toBeLessThanOrEqual(CONTEXTO_IA_RULES.limiteCopia)
      expect(t.completo.caracteres).toBeLessThanOrEqual(CONTEXTO_IA_RULES.limiteCompleto)
      expect(JSON.stringify(pacote).length, 'o pacote serializado (a resposta da ação)').toBeLessThan(TETO)
    })
  }

  it('controle negativo: um pacote com definições de enchimento acima do limite faz o piso passar (o teste enxerga o piso)', () => {
    const modelo = modeloEstresse(2, 2)
    modelo.definicoes = [{ medida: 'Enchimento', frase: 'x'.repeat(31_000), limiares: [] }]
    const t = resumir(segmentar(modelo, CONTEXTO), '')
    expect(t.copia.pisoPassou).toBe(true)
  })
})
