// @vitest-environment node
// Decisão 75, guarda A23 (contra o colapso de estados): negado, erro e "não medido" nunca viram um número, um zero medido nem o mesmo estado.
// Tabela por produtor, cada um com o contrato REAL dele (plano da D75, Task 4). A tabela de termos está em proprio-dados-termos.test.ts
// (guarda caída = erro, sem_direito = negado, leitor que lança = erro); a de `lerDadosDoVideo` e `lerTrocas` em proprio-dados.test.ts e
// proprio-dados-trocas.test.ts (o leitor que lança LANÇA, D5; sem token = negado). Aqui: o ponto único `ausenciaDaProva`, o carregador das
// páginas com a guarda caída e os modelos com `negado`/`erro` sem dado algum.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { proprioWorld, DADOS } from './proprio-fixture'
import { entrada as entradaOrigem } from './proprio-origem-fixture'

const requireSiteScope = vi.fn()
const getSupabaseServiceClient = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => requireSiteScope(...a) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => getSupabaseServiceClient() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

import { acessoPrivado, ausenciaDaProva } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import { carregarExtrasProprio, carregarProprioDaComparacao } from '@/app/cms/(authed)/youtube/competitors/_proprio/carregar-extras'
import { ausenciaDoVpdComNegativa } from '@/app/cms/(authed)/youtube/competitors/_chrome/ausencia/estado'
import { buildProprioVideos } from '@/app/cms/(authed)/youtube/competitors/_proprio/videos-model'
import { buildProprioHeader } from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'
import { buildImpressoes } from '@/app/cms/(authed)/youtube/competitors/_proprio/impressoes-model'
import { buildOrigem } from '@/app/cms/(authed)/youtube/competitors/_proprio/origem-model'
import { buildReguas } from '@/app/cms/(authed)/youtube/competitors/_proprio/reguas-model'
import { buildVideoBlocos } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos-model'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import { mundoVideo } from './proprio-video-fixture'

const SITE = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a77' // uuid: sem isto a guarda devolve sem_direito antes de perguntar
const GUARDA_CAIDA = () => requireSiteScope.mockRejectedValue(new Error('guarda caiu'))
const SEM_DIREITO = () => requireSiteScope.mockResolvedValue({ ok: false, reason: 'insufficient_access' })

beforeEach(() => {
  requireSiteScope.mockReset()
  getSupabaseServiceClient.mockReset()
  getSupabaseServiceClient.mockReturnValue(fakeSupabase({ yt_reporting_reports: [] as Row[], yt_own_video_reach_daily: [] as Row[], yt_own_video_daily: [] as Row[] }).client)
})

describe('ausenciaDaProva: o ponto único (só sem_direito é negado)', () => {
  it('guarda caída → erro; sem direito → negado; leitura → ok', async () => {
    GUARDA_CAIDA()
    const caida = await acessoPrivado(SITE)
    expect(caida.negativa).toBe('nao_foi_possivel_conferir')
    expect(ausenciaDaProva(caida)).toEqual({ acesso: 'erro' })
    SEM_DIREITO()
    const sem = await acessoPrivado(SITE)
    expect(sem.negativa).toBe('sem_direito')
    expect(ausenciaDaProva(sem)).toEqual({ acesso: 'negado' })
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    expect(ausenciaDaProva(await acessoPrivado(SITE))).toBe('ok')
  })
})

describe('carregarExtrasProprio e carregarProprioDaComparacao com a guarda caída: erro, nunca cadeado', () => {
  const W = proprioWorld()
  const AGORA = W.obs.NOW
  const donos = W.obs.ownChannels().map(c => c.id)

  it('guarda caída: o views por dia de todo canal próprio sai "leitura-falhou" (falhou) e nenhum sai "sem-acesso" (restrito)', async () => {
    GUARDA_CAIDA()
    const e = await carregarExtrasProprio(W.obs, SITE, AGORA)
    expect(e).toBeDefined()
    for (const id of donos) {
      expect(e!.vpd.get(id)!.motivo).toBe('leitura-falhou')
      expect(ausenciaDoVpdComNegativa(e!.vpd.get(id)!.motivo, e!.negativa ?? null)).toBe('falhou')
    }
  })
  it('sem_direito: o views por dia sai "sem-acesso" (restrito); é o único caminho do cadeado', async () => {
    SEM_DIREITO()
    const e = await carregarExtrasProprio(W.obs, SITE, AGORA)
    for (const id of donos) expect(ausenciaDoVpdComNegativa(e!.vpd.get(id)!.motivo, 'sem_direito')).toBe('restrito')
  })
  it('com o `previo` da página do canal e a guarda caída, o canal da página também lê "leitura-falhou"', async () => {
    const e = await carregarExtrasProprio(W.obs, SITE, AGORA, undefined, { leitura: null, canalId: donos[0]!, diario: { acesso: 'negado' }, negativa: 'nao_foi_possivel_conferir' })
    for (const id of donos) expect(e!.vpd.get(id)!.motivo).toBe('leitura-falhou')
    const sem = await carregarExtrasProprio(W.obs, SITE, AGORA, undefined, { leitura: null, canalId: donos[0]!, diario: { acesso: 'negado' }, negativa: 'sem_direito' })
    expect(sem!.vpd.get(donos[0]!)!.motivo).toBe('sem-acesso')
  })
  it('a comparação com a guarda caída: o cartão "Só o seu canal mede" de cada canal próprio é erro, nunca negado', async () => {
    GUARDA_CAIDA()
    const r = await carregarProprioDaComparacao(W.obs, SITE, AGORA)
    for (const id of donos) expect(r.soSeuCanal[id]!.acesso).toBe('erro')
    SEM_DIREITO()
    const s = await carregarProprioDaComparacao(W.obs, SITE, AGORA)
    for (const id of donos) expect(s.soSeuCanal[id]!.acesso).toBe('negado')
  })
})

describe('negado e erro SEM dado algum: o bloco inteiro cai em ausência, nunca em zero (Review Focus 5)', () => {
  const w = proprioWorld()
  const hoje = w.hoje
  for (const cenario of ['negado', 'erro'] as const) {
    const dados = DADOS[cenario](w.canalId, w.ytIds, hoje)
    const esperado = cenario === 'erro' ? 'falhou' : 'restrito'
    it(`${cenario}: lista de vídeos (A4) e cabeçalho — nenhum número, nenhum zero medido, estado ${esperado}`, () => {
      const v = buildProprioVideos(w.obs, w.canalId, dados, { hoje, dm: w.dm, negativa: 'sem_direito' })!
      for (const x of v.videos) {
        expect(x.imp).toBeNull(); expect(x.cliques).toBeNull(); expect(x.semImpressao).toBe(false)
        expect(x.impEstado).toBe(esperado); expect(x.cliquesEstado).toBe(esperado)
      }
      const h = buildProprioHeader(w.obs, w.canalId, dados, { hoje, dm: w.dm, posicao: null, muitosProprios: false, negativa: 'sem_direito' })!
      for (const k of ['impressoes', 'diasComImpressao', 'cliques', 'taxaClique', 'videosComImpressao']) {
        const c = [...h.faixa, ...h.todos].find(x => x.key === k)!
        expect(c.value).toBeNull(); expect(c.ausencia).toBe(esperado)
      }
    })
    it(`${cenario}: gráfico de impressões (A16) — sem coluna, sem dia, vazioEstado ${esperado}`, () => {
      const g = buildImpressoes([], null, { escopo: 'canal', alturaArea: 180, dm: w.dm, acesso: cenario, hoje, negativa: 'sem_direito' })
      expect(g.colunas).toEqual([]); expect(g.vazioEstado).toBe(esperado)
    })
  }
  it('origem (A20): origem negada ou com erro vira UM bloco de erro, sem número', () => {
    for (const acesso of ['negado', 'erro'] as const) {
      const v = buildOrigem(entradaOrigem({ origem: { acesso } }))
      expect(v.periodos.length).toBeGreaterThan(0)
      for (const p of v.periodos) {
        expect(p.grupo.blocos).toHaveLength(1)
        expect(p.grupo.blocos[0]).toMatchObject({ id: 'origem', estado: 'erro' })
      }
    }
  })
  it('vídeo (A12, A21, A22): negado e erro sem dado — nenhum bloco, nenhuma linha de zero medido, estado na nota', () => {
    const wv = mundoVideo()
    for (const [acesso, esperado] of [['negado', 'restrito'], ['erro', 'falhou']] as const) {
      const b = buildVideoBlocos({ obs: wv.obs, videoId: wv.foco.id, dados: { acesso }, hoje: wv.hoje, dm: dmDia, negativa: 'sem_direito' })
      expect(b).toMatchObject({ views: null, impressoes: null, assistido: null, ausencia: esperado })
      expect(b.canal.reguas.linhas.some(l => l.zeroMedido || l.valor === '0')).toBe(false)
    }
  })
  it('réguas (A15): alcance não lido nunca é zero medido, com ou sem estado', () => {
    const wv = mundoVideo()
    const videos = wv.obs.videos.filter(v => v.ch === wv.canalId).map(v => ({ id: v.id, ytId: v.ytId, views: v.views ?? null, likes: v.likes ?? null, comments: v.comments ?? null, dur: v.dur ?? null }))
    const r = buildReguas({ videoId: wv.foco.id, videos, porVideo: new Map(), alcanceLido: false, dias: { medidos: 0, semRelatorio: 0 }, periodoTexto: null, hrefs: { vistos: '/v', imp: '/i' }, ausenciaImpressoes: 'restrito' })
    expect(r.linhas[0]).toMatchObject({ numero: 'impressoes', valor: null, zeroMedido: false, ausencia: 'restrito' })
  })
})
