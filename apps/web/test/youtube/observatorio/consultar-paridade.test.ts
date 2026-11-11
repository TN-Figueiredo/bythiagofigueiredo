// @vitest-environment node
/**
 * A4 R5 T10: a consultar dá o MESMO número que a tela. Rede: nasce verde; fica vermelha se a consulta se afastar da Outliers (mult, vpd, o
 * filtro de acompanhados, a ordem por views/dia) ou da tela Canal (curtidas e comentários). Nunca se compara a posição: só id e valor.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: () => undefined, captureException: () => undefined }))

import { montarConjunto } from '@/lib/youtube/observatorio/consulta/conjunto'
import { ordenar } from '@/lib/youtube/observatorio/consulta/ordem'
import { agregar } from '@/lib/youtube/observatorio/consulta/agregados'
import { METRICAS_DA_CONSULTA } from '@/lib/youtube/observatorio/consulta/catalogo'
import type { LinhaDaConsulta, MetricaDaConsulta } from '@/lib/youtube/observatorio/consulta/tipos'
import { chaveDeVpd } from '@/lib/youtube/observatorio/outliers'
import { DEFAULT_AGES, RULES } from '@/lib/youtube/observatorio/rules'
import { FORMA_DOS_PARAMS, filtrarParams } from '@/lib/youtube/observatorio/acesso-ia/registrar'
import { ENTRADA, traduzir } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { reacoesDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/reacoes-do-canal'
import { reacaoComEstado } from '@/lib/youtube/observatorio/medidas/engajamento'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import { buildCanalVideos, numNb } from '@/app/cms/(authed)/youtube/competitors/_canal/videos-model'
import { respostaDaConsulta } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/consultar'
import { paramsDaEntrada } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import type { ResultadoDaConsulta } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-consulta'
import { mundo } from './consulta-fixture'

const TODAS: MetricaDaConsulta[] = ['views', 'likes', 'comentarios', 'vpd7', 'multiplicador', 'engajamento', 'inscritos']
const atrasado = (ds: { channels: Array<{ id: string; sync: { state: string } }> }): void => { ds.channels.find((c) => c.id === 'luke-damant')!.sync.state = 'atrasado' }
const todas = (r: ReturnType<typeof montarConjunto>): LinhaDaConsulta[] => [...r.longos, ...r.shorts]

describe('paridade com a tela Outliers (§7 teste 1)', () => {
  it('longos, 0-30 e 31-90, multiplicador ≥ outlierMin e base sólida: os mesmos ids e os mesmos valores de obs.outliers; nunca a posição', () => {
    const w = mundo(undefined, {}, { formato: 'longos', janelaIdade: [...DEFAULT_AGES], metricas: TODAS })
    const doMotor = w.obs.outliers({ fmt: 'long', ages: DEFAULT_AGES })
    expect(doMotor.items.length).toBeGreaterThan(3)
    const nossas = montarConjunto(w.p, w.entrada).longos.filter((l) => (l.celulas.multiplicador?.x ?? -1) >= RULES.outlierMin && !l.baseFraca)
    expect(new Set(nossas.map((l) => l.id))).toEqual(new Set(doMotor.items.filter((i) => !i.weak).map((i) => i.id)))
    for (const it of doMotor.items.filter((i) => !i.weak)) {
      const l = nossas.find((x) => x.id === it.id)!
      expect(l.celulas.multiplicador!.x).toBe(it.mult.value)
      expect(l.multN).toBe(it.mult.n)
    }
  })
  it('a ordem por views por dia é a chave da Outliers (canal atrasado no fim, sem taxa depois): a sequência de chaves é a de orderedIds("vpd")', () => {
    const w = mundo(atrasado as never, {}, { formato: 'longos', janelaIdade: [...DEFAULT_AGES], metricas: TODAS, ordenarPor: 'vpd7' })
    const doMotor = w.obs.outliers({ fmt: 'long', ages: DEFAULT_AGES })
    const chaveDe = (id: string): number => { const v = w.obs.videos.find((x) => x.id === id)!; return chaveDeVpd(w.obs.channel(v.ch)!.sync.state, v) }
    const ids = new Set(doMotor.items.filter((i) => !i.weak).map((i) => i.id))
    const conjunto = montarConjunto(w.p, w.entrada).longos.filter((l) => ids.has(l.id))
    const ordem = ordenar(conjunto, w.p, { canalAtrasado: (c) => ['atrasado', 'erro'].includes(w.obs.channel(c)!.sync.state) })
    const esperado = doMotor.orderedIds('vpd').filter((id) => ids.has(id)).map(chaveDe)
    expect(ordem.map((l) => chaveDe(l.id))).toEqual(esperado)
    expect(new Set(esperado).has(-2)).toBe(true)
  })
  it('vídeo fora dos acompanhados: vpd7 e multiplicador não medidos, como a tela (que não o traz)', () => {
    const w = mundo(undefined, {}, { formato: 'longos', janelaIdade: 'todas', metricas: TODAS })
    const fora = w.obs.videos.filter((v) => !v.tracked && !w.obs.channel(v.ch)!.own)
    expect(fora.length).toBeGreaterThan(0)
    const linhas = todas(montarConjunto(w.p, w.entrada))
    for (const v of fora) {
      const l = linhas.find((x) => x.id === v.id)
      if (!l) continue
      expect(l.celulas.vpd7?.estado).toBe('nao_medido')
      expect(l.celulas.multiplicador?.estado).toBe('nao_medido')
    }
    expect(w.obs.outliers({ fmt: 'long', ages: 'all' }).items.some((i) => fora.some((v) => v.id === i.id))).toBe(false)
  })
  it('vídeo que o motor tem com múltiplo e views por dia, mas fora dos acompanhados: a consulta o dá como não medido e a Outliers não o traz', () => {
    const w = mundo((ds) => { for (const v of ds.videos.filter((x) => x.ch === 'luke-damant' && x.fmt === 'long').slice(0, 6)) v.tracked = false }, {}, { formato: 'longos', janelaIdade: 'todas', metricas: TODAS })
    const fora = w.obs.videos.filter((v) => v.ch === 'luke-damant' && v.fmt === 'long' && !v.tracked)
    expect(fora.length).toBeGreaterThanOrEqual(6)
    // a premissa do caso: o motor calcula sozinho algo para eles (senão o teste não separaria o filtro de acompanhados do dado ausente)
    expect(fora.some((v) => v.vpd7 != null || v.mult?.value != null || v.vpd != null)).toBe(true)
    const linhas = todas(montarConjunto(w.p, w.entrada))
    for (const v of fora) {
      const l = linhas.find((x) => x.id === v.id)!
      expect(l.celulas.vpd7, v.id).toMatchObject({ estado: 'nao_medido', x: null })
      expect(l.celulas.multiplicador, v.id).toMatchObject({ estado: 'nao_medido', x: null })
    }
    expect(w.obs.outliers({ fmt: 'long', ages: 'all' }).items.some((i) => fora.some((v) => v.id === i.id))).toBe(false)
  })
})

describe('paridade com a tela Canal (§7 teste 2)', () => {
  it('curtidas e comentários medidos têm o texto da coluna da tela, igualdade direta; o que a tela mostra "0" sem sinal sai não medido', () => {
    const w = mundo(undefined, {}, { formato: 'todos', janelaIdade: 'todas', canalIds: ['matt-wolfe'], metricas: TODAS, limite: 50 })
    const tela = buildCanalVideos(w.obs, 'matt-wolfe').videos
    const linhas = todas(montarConjunto(w.p, w.entrada)).filter((l) => w.obs.videos.find((v) => v.id === l.id)!.ch === 'matt-wolfe')
    expect(linhas.length).toBeGreaterThan(5)
    let medidos = 0
    for (const l of linhas) {
      const v = tela.find((x) => x.id === l.id)!
      for (const [m, texto] of [['likes', v.likesText], ['comentarios', v.commentsText]] as const) {
        const c = l.celulas[m]!
        if (c.estado === 'medido' || c.estado === 'zero_medido') { expect(numNb(w.obs.fmt, c.x!), `${l.id} ${m}`).toBe(texto); medidos++ }
        else expect(texto, `${l.id} ${m}`).toBeNull()
      }
    }
    expect(medidos).toBeGreaterThan(5)
  })
  it('com curtidas ocultas (12), 0 com sinalizador "não oculto" e 0 com sinalizador nulo: a célula da consultar é a decisão da célula da tela (reacaoComEstado + reacoesDoCanal), sem divergência', () => {
    const CASOS = [
      { likes: 12, comments: 12, likesHidden: true, commentsDisabled: true },     // oculto com número cru: não medido nos dois lados
      { likes: 0, comments: 0, likesHidden: false, commentsDisabled: false },     // 0 confirmado: zero medido
      { likes: 0, comments: 0, likesHidden: null, commentsDisabled: null },       // 0 sem sinalizador: não medido
      { likes: 7, comments: 7, likesHidden: false, commentsDisabled: false },     // controle
    ]
    const w = mundo((ds) => {
      const meus = ds.videos.filter((v) => v.ch === 'matt-wolfe').slice(0, CASOS.length)
      meus.forEach((v, i) => { v.likes = CASOS[i]!.likes; v.comments = CASOS[i]!.comments })
    }, (obs) => {
      const meus = obs.videos.filter((v) => v.ch === 'matt-wolfe').slice(0, CASOS.length)
      return { info: Object.fromEntries(meus.map((v, i) => [v.id, { likesHidden: CASOS[i]!.likesHidden, commentsDisabled: CASOS[i]!.commentsDisabled }])) }
    }, { formato: 'todos', janelaIdade: 'todas', canalIds: ['matt-wolfe'], metricas: TODAS, limite: 50 })
    const tela = buildCanalVideos(w.obs, 'matt-wolfe').videos
    const meusIds = w.obs.videos.filter((v) => v.ch === 'matt-wolfe').slice(0, CASOS.length).map((v) => v.id)
    // os sinalizadores como a tela Canal os lê (mesmas leituras do banco, mesma função)
    const lido = { videos: { lido: true, dados: meusIds.map((id, i) => ({ id, likesHidden: CASOS[i]!.likesHidden, commentsDisabled: CASOS[i]!.commentsDisabled })) } } as unknown as CanalInteiro
    const sinais = reacoesDoCanal(lido, tela)!
    const linhas = todas(montarConjunto(w.p, w.entrada))
    expect(w.entrada.medidas.videos!.get(meusIds[0]!)!.likesHidden).toBe(true)
    meusIds.forEach((id, i) => {
      const v = tela.find((x) => x.id === id)!
      const l = linhas.find((x) => x.id === id)!
      for (const [m, cru, sinal, texto] of [['likes', v.likes, sinais[id]?.likesHidden ?? null, v.likesText], ['comentarios', v.comments, sinais[id]?.commentsDisabled ?? null, v.commentsText]] as const) {
        const daTela = reacaoComEstado(cru, sinal)
        const c = l.celulas[m]!
        expect(c.estado, `${i} ${m} estado`).toBe(daTela.estado)
        expect(c.x, `${i} ${m} x`).toBe(daTela.x)
        if (daTela.x !== null) expect(numNb(w.obs.fmt, c.x!), `${i} ${m} texto`).toBe(texto)
      }
    })
    // as três formas pedidas existem de fato
    expect(linhas.find((x) => x.id === meusIds[0])!.celulas.likes).toMatchObject({ estado: 'nao_medido', x: null })
    expect(linhas.find((x) => x.id === meusIds[1])!.celulas.likes).toMatchObject({ estado: 'zero_medido', x: 0 })
    expect(linhas.find((x) => x.id === meusIds[2])!.celulas.likes).toMatchObject({ estado: 'nao_medido', x: null })
  })
})

describe('varredura do catálogo (§7 teste 4)', () => {
  it('cada métrica do catálogo sai em toda linha, com estado e valor coerentes, e a que o motor guarda tem o valor do motor', () => {
    const w = mundo(undefined, {}, { formato: 'todos', janelaIdade: 'todas', metricas: TODAS })
    const linhas = todas(montarConjunto(w.p, w.entrada))
    expect(linhas.length).toBeGreaterThan(20)
    expect(Object.keys(METRICAS_DA_CONSULTA).sort()).toEqual([...TODAS].sort())
    for (const l of linhas) {
      const v = w.obs.videos.find((x) => x.id === l.id)!
      for (const m of TODAS) {
        const c = l.celulas[m]
        expect(c, `${l.id} ${m}`).toBeDefined()
        const mede = c!.estado === 'medido' || c!.estado === 'zero_medido'
        expect(mede ? Number.isFinite(c!.x) : c!.x === null, `${l.id} ${m}`).toBe(true)
        if (c!.estado === 'zero_medido') expect(c!.x).toBe(0)
        if (!mede) expect(c!.causa ?? c!.estado, `${l.id} ${m}`).toBeTruthy()
      }
      if (v.views != null) expect(l.celulas.views).toMatchObject({ x: v.views })
      if (v.tracked && v.vpd7 != null) expect(l.celulas.vpd7!.x).toBe(v.vpd7)
      expect(l.celulas.inscritos!.x).toBe(w.obs.channel(v.ch)!.subs ?? null)
    }
  })
})

describe('completude do registro (§7 teste 12)', () => {
  it('a chamada real: nenhuma chave dos params da consultar é descartada pelo registro, e o JSON cabe no teto', () => {
    const w = mundo(undefined, {}, { formato: 'todos', janelaIdade: [...DEFAULT_AGES], metricas: ['views', 'likes', 'comentarios', 'multiplicador'], limite: 20 })
    const conj = montarConjunto(w.p, w.entrada)
    const ctx = { canalAtrasado: () => false }
    const bloco = (formato: 'longos' | 'shorts', ls: LinhaDaConsulta[]) => {
      const ord = ordenar(ls, w.p, ctx)
      return { formato, linhas: ord.slice(0, w.p.limite), agregado: agregar(ls, w.p, w.entrada), cortadasPorLimite: Math.max(0, ord.length - w.p.limite) }
    }
    const r: ResultadoDaConsulta = {
      pedido: w.p, blocos: [bloco('longos', conj.longos), bloco('shorts', conj.shorts)],
      dadosDe: { motor: '2026-11-11T11:00:00.000Z', medidas: '2026-11-11T09:00:00.000Z', lugares: '2026-11-10T10:00:00.000Z' }, canaisSemMedida: [], canaisNaoEncontrados: [],
      lugar: { estado: 'marcado', calculadoEm: '2026-11-10T10:00:00.000Z', atrasado: false, emRecalculo: false, semLugarCalculado: 3, maisDeUmLugar: 1, maisDeUmLugarSobre: 'marcados' },
      leituraMaisAntiga: '2026-11-11T09:41:00.000Z',
    }
    const lida = ENTRADA.parse({ acao: 'consultar', lugar: 'pais:VN', formato: 'todos', metricas: ['views', 'likes', 'comentarios', 'multiplicador'], limite: 20, ordenar_por: 'multiplicador', nicho: 'ia', publicado_de: '2026-10-01', publicado_ate: '2026-11-01', direcao: 'desc', incluir_base_fraca: false })
    expect(traduzir(lida).ok).toBe(true)
    const saida = respostaDaConsulta(r, lida as Extract<typeof lida, { acao: 'consultar' }>, 55_000, w.obs.NOW)
    const chamada = { ...paramsDaEntrada(lida), ...saida.params, desfecho: 'ok', completa: false }
    const { params, cortado } = filtrarParams(chamada)
    expect(cortado).toBe(false)
    const perdidas = Object.keys(chamada).filter((k) => !(k in params))
    expect(perdidas).toEqual([])
    for (const k of ['elegiveis', 'linhas', 'total', 'cortadas', 'sem_lugar_calculado', 'dados_de', 'n_metricas', 'n_faixas', 'lugar', 'limite']) expect(params, k).toHaveProperty(k)
    expect(params.dados_de).toBe('2026-11-11T09')
    expect(Object.keys(chamada).every((k) => k in FORMA_DOS_PARAMS)).toBe(true)
  })
})
