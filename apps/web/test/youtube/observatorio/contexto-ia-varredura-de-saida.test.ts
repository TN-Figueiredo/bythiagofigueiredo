// @vitest-environment node
/**
 * A5 · E17 degrau 1, Tarefa 12 (itens 159 e 168): a ação `gerarPacoteIa` roda DE VERDADE (`EMPACOTAR`, os `montar…` e os empacotadores reais) sobre o
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

const filaSt = vi.hoisted(() => ({ leitura: null as unknown }))
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
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados', async (orig) => ({
  ausenciaDaProva: (await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_proprio/dados')>()).ausenciaDaProva,
  acessoPrivado: async () => st.acesso,
  lerDadosDoCanal: async () => w.dados,
  lerDadosDoVideo: async () => ({ acesso: 'ok', dado: { alcance: (w.dados.alcance as { dado: unknown }).dado, diario: (w.dados.diario as { dado: unknown }).dado } }),
  lerDiarioLongo: async () => ({ acesso: 'erro' }), longosAcompanhadosDe: () => [],
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_sugestoes/dados', () => ({ abrirSugestoes: async () => ({ n: 0, itens: [], computado_em: null, desatualizado: true, motivoVazio: 'nunca-calculado', contagens: {}, calculoLigado: true }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_saiu/dados', () => ({ abrirFila: async () => filaSt.leitura, contarParaAAba: async () => ({ visivel: false }) }))
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

import { fila, video as itemVideo, canal as itemCanal, grupo as itemGrupo, apagando as itemApagando, respondidoMantido, respondidoApagado, voltouApagado } from './saiu-fixtures'
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
  fila: { consulta: '' },
  ritmo: null,
  sugestoes: { consulta: '' },
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
  if (/n[ãa]o carregou|não carregaram/i.test(saida)) v.push('Não carregou (decisão 75: a palavra é falhou)')
  return v
}

const FILA_CHEIA = () => fila({ esperando: [itemVideo(1), itemCanal(), itemGrupo()], apagando: [itemApagando(1)], voltaram: [voltouApagado()], respondidos: [respondidoMantido(), respondidoApagado()], respondidosTotal: 2 })
beforeEach(() => { filaSt.leitura = FILA_CHEIA(); modo.ligado = true; st.acesso = { leitura: EDICAO, edita: true, negativa: null } })
afterEach(() => { vi.restoreAllMocks() })

describe('a varredura de saída, por tela do registro', () => {
  it('a ação respondeu ok: true em toda tela do registro em existe (sem isso as ausências abaixo provariam nada)', async () => {
    for (const tela of TELAS_EXISTE) {
      const p = PEDIDOS[tela]
      expect(p, `tela sem prova: ${tela}`).not.toBeNull()
      const r = await gerarPacoteIa({ tela, ...p! })
      expect(r.ok, tela).toBe(true)
    }
  })

  for (const tela of TELAS_EXISTE) {
    it(`${tela}: nada do CMS, nenhuma chave, nenhuma moeda, nenhum e-mail, só endereço do YouTube`, async () => {
      const r = await gerarPacoteIa({ tela, ...PEDIDOS[tela]! })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(violacoes(JSON.stringify(r), regiaoDoSite(r.pacote))).toEqual([])
      expect(r.pacote.tela).toBe(tela)
    })

    it(`${tela}: zero chamadas de rede durante a ação`, async () => {
      const espia = vi.spyOn(globalThis, 'fetch')
      await gerarPacoteIa({ tela, ...PEDIDOS[tela]! })
      expect(espia).not.toHaveBeenCalled()
    })
  }

  it('a região de terceiros é exercitada: Mudanças leva endereços de terceiros só em linhas citadas, e a região do site não leva nenhum', async () => {
    const r = await gerarPacoteIa({ tela: 'mudancas', consulta: '' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const todos = r.pacote.segmentos.map((s) => s.texto).join('\n')
    const externos = (todos.match(URL_EXTERNA) ?? []).filter((u) => !DO_YOUTUBE.test(u))
    expect(externos.length).toBeGreaterThan(0)
    expect(regiaoDoSite(r.pacote).match(URL_EXTERNA) ?? []).toEqual([])
    // controle: o mesmo endereço numa linha de rótulo (fora de linha citada) seria achado
    const ruim: Pacote = { ...r.pacote, segmentos: [{ parte: 4, texto: `| Medida | ${externos[0]} |`, corte: null, linhaDoJson: null }] }
    expect(violacoes('', regiaoDoSite(ruim)).length).toBeGreaterThan(0)
  })

  it('controle negativo: a varredura acha cada violação num exemplo ruim', () => {
    expect(violacoes('veja /cms/youtube/competitors')).toContain('endereço do CMS')
    expect(violacoes('Authorization: Bearer abc')).toHaveLength(1)
    expect(violacoes('faturou R$ 1.000')).toContain('valor em moeda')
    expect(violacoes('fale com a.b@exemplo.com')).toContain('e-mail')
    expect(violacoes('https://loja.exemplo/p?ref=abc')).toEqual(['endereço externo https://loja.exemplo/p?ref=abc'])
    expect(violacoes('https://www.youtube.com/watch?v=abc')).toEqual([])
    expect(violacoes(SITE)).toContain('id do site')
    expect(violacoes('Não carregou: o canal')).toHaveLength(1)
    expect(violacoes('falhou (a leitura falhou agora) e restrito (sem direito)')).toEqual([])
  })

  it('tela de outro tipo para o mesmo id: canal com id de canal próprio e canal-proprio com id de concorrente dão nao_encontrado', async () => {
    expect(await gerarPacoteIa({ tela: 'canal', id: w.canalId, consulta: '' })).toEqual({ ok: false, motivo: 'nao_encontrado' })
    expect(await gerarPacoteIa({ tela: 'canal-proprio', id: concCanal.id, consulta: '' })).toEqual({ ok: false, motivo: 'nao_encontrado' })
    expect(await gerarPacoteIa({ tela: 'video', id: proprioVideo.id, consulta: '' })).toEqual({ ok: false, motivo: 'nao_encontrado' })
    expect(await gerarPacoteIa({ tela: 'video-proprio', id: concVideo.id, consulta: '' })).toEqual({ ok: false, motivo: 'nao_encontrado' })
  })

  it('id desconhecido: nao_encontrado, sem exceção', async () => {
    for (const tela of ['canal', 'video', 'canal-proprio', 'video-proprio'] as const) {
      expect(await gerarPacoteIa({ tela, id: 'nao-existe', consulta: '' }), tela).toEqual({ ok: false, motivo: 'nao_encontrado' })
    }
  })
})
