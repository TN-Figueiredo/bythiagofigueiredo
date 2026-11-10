// @vitest-environment jsdom
/**
 * A5 F0.5b (revisão do Yannis, B1/B2/M1): `semana`/`fuso`/`dias` provados com os EMPACOTADORES REAIS das telas (canal próprio, vídeo próprio, canal, insights),
 * não com `tabelaDeDiaADia` chamado pelo teste. Sem isto, trocar `'soma'` por `undefined` num chamador de produção passava com a suíte verde.
 */
import { describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ pacotes: {} as Record<string, unknown> }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({
  EMPACOTAR: new Proxy({}, { get: (_t, k) => async () => m.pacotes[String(k)] ?? null }),
}))

import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { proprioWorld } from './proprio-fixture'
import { viewDe, type Mundo } from './proprio-mount'
import { mundoVideo } from './proprio-video-fixture'
import { canalWorld } from './canal-fixture'
import { loadOracle, datasetFromOracle } from './oracle'
import { AGORA_CHEIA, insumosCheios } from './medidas-fixture'
import { montarComoEsta } from '@/app/cms/(authed)/youtube/competitors/_proprio/como-esta-model'
import { concorrentesDoSite, posicaoDoSite } from '@/app/cms/(authed)/youtube/competitors/_proprio/posicao-do-site'
import { publicacoesDe } from '@/lib/youtube/observatorio/proprio/dias'
import { buildProprioVideoBase } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-model'
import { buildVideoBlocos } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos-model'
import { buildCanalView } from '@/app/cms/(authed)/youtube/competitors/_canal/view-model'
import { buildInsightsView } from '@/app/cms/(authed)/youtube/competitors/_insights/view-model'
import { createObservatory } from '@/lib/youtube/observatorio'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import { empacotarCanalProprio, modeloDeCanalProprio } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canal-proprio'
import { empacotarVideoProprio, modeloDeVideoProprio } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-video-proprio'
import { empacotarCanal, modeloDeCanal } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canal'
import { empacotarInsights, modeloDeInsights } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-insights'
import { projetarMedidas } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canal-medidas'
import type { ContextoDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/canal-derivado'
import { medidasDoCanal, type Insumos } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import { SEMANA_FECHADA, type EstadoDoPrivado, type PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import type { DadosDoVideo } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import type { Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { HOJE_CHEIA } from './medidas-fixture'

const C1 = '11111111-1111-4111-8111-111111111111'
const lido = (id: string): EstadoDoPrivado => ({ acessoPorCanal: { [id]: { diario: 'ok', alcance: 'ok' } }, negativa: null })

// ───────────────────────── os pacotes reais
function canalProprio(): { p: PacoteModelo; w: Mundo } {
  const w = proprioWorld()
  const pv = viewDe(w, {}, {})
  const { posicao } = posicaoDoSite(w.obs, w.canalId)
  const ce = montarComoEsta({
    dados: w.dados, hoje: w.hoje, dm: w.dm, posicao, posicaoItens: pv.header.posicaoItens, canalId: w.canalId,
    videos: pv.videos.videos.map((v) => ({ id: v.id, ytId: v.ytId, title: v.title, thumb: v.thumbSrc })),
    concorrentes: concorrentesDoSite(w.obs, w.canalId), publicacoes: publicacoesDe(w.obs.videos.filter((v) => v.ch === w.canalId)),
  })
  return { p: empacotarCanalProprio(modeloDeCanalProprio(pv, ce, {}), lido(w.canalId)), w }
}

const VW = mundoVideo({ mut: (ds) => { for (const v of ds.videos) if (v.fmt === 'long') v.dur = 600 } })
function videoProprio(id: string): PacoteModelo {
  const { alcance, diario } = VW.dados
  if (alcance.acesso !== 'ok' || diario.acesso !== 'ok') throw new Error('a fixture esperava dado lido')
  const dados: Privado<DadosDoVideo> = { acesso: 'ok', dado: { alcance: alcance.dado, diario: diario.dado } }
  const base = buildProprioVideoBase(VW.obs, id, {})
  if (!base) throw new Error('a fixture esperava a página do vídeo')
  return empacotarVideoProprio(modeloDeVideoProprio(base.header, buildVideoBlocos({ obs: VW.obs, videoId: id, dados, hoje: VW.hoje, dm: dmDia })), lido(VW.canalId))
}
const novoId = VW.obs.videos.filter((v) => v.ch === VW.canalId).sort((a, b) => b.pub - a.pub)[0]!.id

function canalDe(ins: Insumos): CanalInteiro {
  const naoLido = { lido: false, causa: 'erro_do_banco' } as const
  return {
    medidas: medidasDoCanal(ins, { agoraMs: AGORA_CHEIA }),
    videos: ins.videos.lido ? { lido: true, dados: ins.videos.dados } : naoLido,
    retratos: ins.retratos.lido ? { lido: true, dados: ins.retratos.dados } : naoLido,
    marcas: ins.marcas.lido ? { lido: true, dados: ins.marcas.dados } : naoLido,
    serie: ins.series !== 'nao_pedida' && ins.series.lido ? { lido: true, dados: ins.series.dados.series } : 'nao_pedida',
    mudancas: ins.mudancas !== 'nao_pedida' && ins.mudancas.lido ? { lido: true, dados: ins.mudancas.dados.mudancas } : 'nao_pedida',
    horas: 'nao_pedida', falhas: [], esgotou: [],
  }
}
const contexto = (): ContextoDoCanal => ({
  F: { num: (v: number | null) => (v === null ? '—' : String(Math.round(v))), subs: (v: number) => String(v) } as unknown as ContextoDoCanal['F'],
  subs: 84_000, sync: { state: 'ok', last: AGORA_CHEIA - 3_600_000, errorSince: null }, hojeSP: HOJE_CHEIA, agoraMs: AGORA_CHEIA, primeiraBusca: false, semVideos: false,
  titulos: [], trocas: [], thumbs: [], criador: { nome: 'Matt Wolfe', avatar: null, ini: 'MW', color: '#336699' },
})
function canalConcorrente(): PacoteModelo {
  const { obs, chId } = canalWorld()
  return empacotarCanal(modeloDeCanal(buildCanalView(obs, chId, {})!, null, projetarMedidas(canalDe(insumosCheios()), contexto(), null)))
}
function insights(): PacoteModelo {
  const obs = createObservatory(datasetFromOracle(loadOracle()))
  return empacotarInsights(modeloDeInsights(buildInsightsView(obs, { niche: 'viagem' }), obs.nicheLabel('viagem')))
}

const todos = (): Array<[string, PacoteModelo]> => [
  ['canal próprio', canalProprio().p], ['vídeo próprio', videoProprio(VW.foco.id)], ['vídeo próprio novo (faixa dos 7 dias)', videoProprio(novoId)],
  ['canal (concorrente)', canalConcorrente()], ['insights', insights()],
]

// ───────────────────────── B2: a regra sobre o pacote de cada tela real
describe('F0.5b B2: inventário de semana/fuso/dias nos empacotadores reais', () => {
  it('toda dia_a_dia de toda tela declara semana ou está em SEMANA_FECHADA; toda com semana declara fuso e dias do tamanho de linhas', () => {
    let vistas = 0
    for (const [nome, p] of todos()) {
      for (const t of p.tabelas.filter((x) => x.tipo === 'dia_a_dia')) {
        vistas++
        expect(t.semana !== undefined || SEMANA_FECHADA[t.id] !== undefined, `${nome}: ${t.id}`).toBe(true)
        if (t.semana) {
          expect(t.fuso, `${nome}: ${t.id}`).toBeDefined()
          expect(t.dias?.length, `${nome}: ${t.id}`).toBe(t.linhas.length)
        }
      }
    }
    expect(vistas).toBeGreaterThanOrEqual(6)
  })
  it('as tabelas com semana do canal próprio são exatamente as duas privadas, em soma e Pacífico', () => {
    const com = canalProprio().p.tabelas.filter((t) => t.semana)
    expect(com.map((t) => t.id).sort()).toEqual(['privado-impressoes-por-dia', 'privado-views-por-dia'])
    for (const t of com) { expect(t.semana, t.id).toBe('soma'); expect(t.fuso, t.id).toBe('pacifico') }
  })
})

// ───────────────────────── B1: o que cada chamador de produção declara
describe('F0.5b B1: os chamadores de produção declaram soma', () => {
  it('vídeo próprio: views e impressões por dia do vídeo são soma, Pacífico, com dias paralelo a linhas', () => {
    const p = videoProprio(VW.foco.id)
    for (const id of ['privado-views-por-dia-do-video', 'privado-impressoes-por-dia-do-video']) {
      const t = p.tabelas.find((x) => x.id === id)
      expect(t, id).toBeDefined()
      expect(t!.semana, id).toBe('soma')
      expect(t!.fuso, id).toBe('pacifico')
      expect(t!.dias!.length, id).toBe(t!.linhas.length)
    }
  })
  it('canal próprio, grão semana pelo responder: as duas séries dizem "ganho diário", nunca "tipo não declarado"', async () => {
    const { p, w } = canalProprio()
    m.pacotes = { 'canal-proprio': { modelo: p, recente: null, estado: {} } }
    const r = await responder({ acao: 'serie', canal_id: C1, de: '2020-01-01', ate: '2026-12-31', grao: 'semana' }, ABRIDOR_DE_SESSAO, w.obs.NOW)
    expect(r.texto).not.toContain('não declarado')
    const avisos = r.texto.split('\n').filter((l) => l.includes('grão semana,') || l.includes('grão semana:'))
    expect(avisos.length).toBeGreaterThanOrEqual(2)
    for (const a of avisos) expect(a).toContain('ganho diário')
  })
})

// ───────────────────────── M1: a frase da semana fechada
describe('F0.5b M1: a frase de SEMANA_FECHADA no grão semana', () => {
  it('faixa dos 7 dias do vídeo novo: o aviso cita por que não há semana de calendário', async () => {
    const p = videoProprio(novoId)
    const cedo = p.tabelas.find((t) => t.id === 'privado-impressoes-por-dia-do-video-cedo' || t.id === 'privado-views-por-dia-do-video-cedo')
    expect(cedo, 'a fixture do vídeo novo precisa trazer a faixa dos 7 dias').toBeDefined()
    m.pacotes = { 'video-proprio': { modelo: p, recente: null, estado: {} } }
    const r = await responder({ acao: 'serie', video_id: C1, de: '2020-01-01', ate: '2026-12-31', grao: 'semana' }, ABRIDOR_DE_SESSAO, VW.obs.NOW)
    expect(r.texto).toContain(SEMANA_FECHADA[cedo!.id]!)
  })
})
