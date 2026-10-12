// @vitest-environment node
/**
 * Tarefa 11d, a tela: o botão da forja (cabeçalho das abas) e o cartão do Histórico do vídeo oferecem o mesmo que o servidor aceita
 * (forja/novidade.ts): sem limite por dia, pedido novo só com dado novo. Nenhuma frase fala em cota, em "hoje" ou em "libera".
 */
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { plain } from './fase4-world'
import { SHOWCASE } from './forja-scenarios'
import { createObservatory, type Observatory } from '@/lib/youtube/observatorio'
import { createClock } from '@/lib/youtube/observatorio/time'
import type { Dataset, ForjaRequest, FrozenReading } from '@/lib/youtube/observatorio/types'
import { buildForjaView } from '@/app/cms/(authed)/youtube/competitors/_chrome/forja-view-model'
import { buildForjaCard, headerAsk } from '@/app/cms/(authed)/youtube/competitors/_historico/forja-card-model'

const MIN = 6e4
const ID = SHOWCASE
const FRASE = 'já usa o dado mais recente. Dá para pedir de novo quando houver coleta nova.'
const NICHO_ID = 'padroes-titulo-ia-20-10', VIDEO_ID = 'leitura-video-matt-opus55-20-10'

let base: Dataset | null = null
const baseDs = (): Dataset => (base ??= plain(datasetFromOracle(loadOracle())))
const reading = (ds: Dataset, id: string): FrozenReading => ds.readings.find(r => r.id === id)!
/** Leitura em dia: congelada no último registro diário do alvo, sem nada novo desde então. `idx` = relativo ao último. */
function emDia(ds: Dataset, id: string, idx: number | 'ultimo' = 'ultimo') {
  const obs = createObservatory(ds), r = reading(ds, id)
  const alvo = r.target?.video ? obs.channel(obs.video(r.target.video)!.ch)!.lastIdx! : obs.LAST_IDX
  r.sent.asOf = createClock(ds.now, ds.seriesStart, ds.snap0).snapTime(idx === 'ultimo' ? alvo : alvo + idx)
  delete r.sent.asOfIdx
  r.generatedAt = ds.now - MIN
  delete r.base
  r.effects = []
}
function world(mut?: (ds: Dataset) => void): Observatory {
  const ds = plain(baseDs())
  mut?.(ds)
  return createObservatory(ds)
}
function dbReq(ds: Dataset, o: Partial<ForjaRequest> & { state: ForjaRequest['state'] }): ForjaRequest {
  const type = o.type ?? 'padroes-titulo', niche = o.niche ?? 'ia'
  return {
    id: 'db-' + type + '-' + niche + '-' + o.state, type, niche, status: 'pending', video: null, target: { kind: 'niche', niche, fmt: 'long' },
    createdAt: ds.now - 4 * MIN, claimedAt: null, startedAt: null, publishedAt: null, failedAt: null, attempt: 1, refusedReason: null, readingId: null,
    ...o,
  }
}
const lv = (ds: Dataset, o: Partial<ForjaRequest> & { state: ForjaRequest['state'] }) =>
  dbReq(ds, { type: 'leitura-video', video: ID, target: { kind: 'video', niche: 'ia', video: ID }, ...o })
const cardOf = (obs: Observatory) => { const v = obs.video(ID)!; return buildForjaCard(obs, v, obs.channel(v.ch)!)! }
const publicadoHoje = (ds: Dataset) => dbReq(ds, { state: 'publicado', status: 'completed', createdAt: ds.now - 25 * MIN, publishedAt: ds.now - 5 * MIN })

describe('11d: botão da forja nas abas', () => {
  it('leitura em dia: botão apagado com a frase da regra nova, e a nota do cartão é a mesma', () => {
    const obs = world(ds => { emDia(ds, NICHO_ID); ds.requests.push(publicadoHoje(ds)) })
    const v = buildForjaView(obs, { screen: 'insights', niche: 'ia' })
    expect(v.button.mode).toBe('disabled')
    expect(v.button.disabledText).toBe('A leitura de IA ' + FRASE)
    expect(v.card.askNote).toBe('A leitura de IA ' + FRASE)
    expect(v.ask).toBeNull()
  })
  it('leitura em dia e nenhum pedido hoje: o botão apagado diz o mesmo (meia-noite não muda a frase)', () => {
    const obs = world(ds => emDia(ds, NICHO_ID))
    const v = buildForjaView(obs, { screen: 'insights', niche: 'ia' })
    expect(v.button).toMatchObject({ mode: 'disabled', disabledText: 'A leitura de IA ' + FRASE })
  })
  it('dado novo no mesmo dia do pedido publicado: o botão pede de novo', () => {
    const obs = world(ds => { emDia(ds, NICHO_ID, -1); ds.requests.push(publicadoHoje(ds)) })
    const v = buildForjaView(obs, { screen: 'insights', niche: 'ia' })
    expect(v.button).toMatchObject({ mode: 'free', label: 'Pedir nova leitura à forja' })
    expect(v.ask).toEqual({ scope: 'ia', niches: ['ia'] })
    expect(v.card.askNote).toBeNull()
  })
  it('falha hoje com leitura velha: o botão pede de novo', () => {
    const obs = world(ds => { emDia(ds, NICHO_ID, -1); ds.requests.push(dbReq(ds, { state: 'falhou', status: 'failed', failedAt: ds.now - 5 * MIN })) })
    expect(buildForjaView(obs, { screen: 'insights', niche: 'ia' }).button.mode).toBe('free')
  })
  it('Todos com IA em dia e Viagem com dado novo: o botão fica para Viagem', () => {
    const obs = world(ds => emDia(ds, NICHO_ID))
    const v = buildForjaView(obs, { screen: 'insights', niche: 'todos' })
    expect(v.button).toMatchObject({ mode: 'free-niche', label: 'Pedir leitura de Viagem à forja' })
    expect(v.ask).toEqual({ scope: 'viagem', niches: ['viagem'] })
  })
  it('Todos com os dois nichos em dia: a frase fala dos dois, uma vez só', () => {
    const obs = world(ds => { emDia(ds, NICHO_ID); emDia(ds, 'padroes-titulo-viagem-20-10') })
    const v = buildForjaView(obs, { screen: 'insights', niche: 'todos' })
    expect(v.button.mode).toBe('disabled')
    expect(v.button.disabledText).toBe('A leitura de cada nicho ' + FRASE)
  })
  it('nenhuma frase do botão, do cartão nem do status fala em cota, em hoje ou em "libera"', () => {
    for (const pedido of [true, false]) {
      const obs = world(ds => { emDia(ds, NICHO_ID); if (pedido) ds.requests.push(publicadoHoje(ds)) })
      const v = buildForjaView(obs, { screen: 'insights', niche: 'ia' })
      expect(JSON.stringify([v.button, v.card, v.status])).not.toMatch(/cota|libera |Libera |hoje/i)
    }
  })
})

describe('11d: leitura de vídeo (botão e cartão do Histórico)', () => {
  it('leitura em dia: o cartão apaga o botão com a frase "deste vídeo", por = sem-novidade', () => {
    const obs = world(ds => emDia(ds, VIDEO_ID))
    const c = cardOf(obs)
    expect(c.botao).toMatchObject({ habilitado: false, motivo: 'A leitura deste vídeo ' + FRASE, por: 'sem-novidade' })
    expect(headerAsk(c)).toMatchObject({ frase: 'A leitura deste vídeo ' + FRASE })
  })
  it('a leitura de OUTRO vídeo do nicho, em dia, não apaga o botão deste (rótulo do nicho some)', () => {
    const obs = world(ds => {
      const outro = ds.videos.find(v => v.id !== ID && v.niche === 'ia' && v.tracked)!.id
      ds.readings.push({ ...plain(reading(ds, VIDEO_ID)), id: 'leitura-outro', target: { kind: 'video', niche: 'ia', video: outro } })
      emDia(ds, 'leitura-outro')
      ds.requests.push({ ...lv(ds, { state: 'publicado', status: 'completed', publishedAt: ds.now - 3 * MIN }), id: 'db-outro', video: outro, target: { kind: 'video', niche: 'ia', video: outro } })
    })
    const c = cardOf(obs)
    expect(c.botao.habilitado).toBe(true)
    expect(c.botao.motivo).toBeNull()
  })
  it('leitura vazia (sem evidências) com dado igual: "Não deu", sem convite, com o motivo real', () => {
    const obs = world(ds => { reading(ds, VIDEO_ID).text.items = []; emDia(ds, VIDEO_ID); ds.requests.push(lv(ds, { state: 'publicado', status: 'completed', createdAt: ds.now - 25 * MIN, publishedAt: ds.now - 5 * MIN })) })
    const c = cardOf(obs)
    expect(c.situacao).toBe('nao-deu')
    expect(c.frase).toBe('Não deu: a leitura saiu sem evidências. A leitura deste vídeo ' + FRASE)
    expect(c.botao).toMatchObject({ label: 'Pedir de novo', habilitado: false, por: 'sem-novidade' })
  })
  it('leitura vazia com dado novo: convida a pedir de novo', () => {
    const obs = world(ds => { reading(ds, VIDEO_ID).text.items = []; emDia(ds, VIDEO_ID, -1) })
    const c = cardOf(obs)
    expect(c.frase).toBe('Não deu: a leitura saiu sem evidências. Pode pedir de novo.')
    expect(c.botao.habilitado).toBe(true)
  })
  it('pedido publicado cuja leitura não aparece: não há com o que comparar, pode pedir de novo', () => {
    const obs = world(ds => { ds.readings = ds.readings.filter(r => r.id !== VIDEO_ID); ds.requests.push(lv(ds, { state: 'publicado', status: 'completed', publishedAt: ds.now - 3 * MIN })) })
    const c = cardOf(obs)
    expect(c.frase).toBe('Não deu: o pedido terminou, mas a leitura não está aqui. Pode pedir de novo.')
    expect(c.botao.habilitado).toBe(true)
  })
  it('leitura sem marca de registro diário (asOf nulo): permite pedir e a frase diz que não dá para saber os dados da anterior', () => {
    const obs = world(ds => {
      const r = reading(ds, VIDEO_ID)
      ;(r.sent as Record<string, unknown>).asOf = Number.NaN; delete r.sent.asOfIdx; r.text.items = []
    })
    const c = cardOf(obs)
    expect(c.botao.habilitado).toBe(true)
    expect(c.frase).toBe('Não deu: a leitura saiu sem evidências. Não dá para saber com que dados a leitura anterior foi escrita; pode pedir de novo.')
  })
  it('falha com a leitura em dia: o motivo real é o dado, não a falha', () => {
    const obs = world(ds => { emDia(ds, VIDEO_ID); ds.requests.push(lv(ds, { state: 'falhou', status: 'failed', failedAt: ds.now - 5 * MIN, failReason: 'erro-xyz' })) })
    const c = cardOf(obs)
    expect(c.frase).toBe('Não deu: o pedido falhou às 14:57. A leitura deste vídeo ' + FRASE)
    expect(c.botao.habilitado).toBe(false)
  })
  it('sem nicho: continua a frase do nicho, nunca a do dado', () => {
    const obs = world(ds => { ds.videos.find(v => v.id === ID)!.niche = null })
    const c = cardOf(obs)
    expect(c.botao).toMatchObject({ por: 'sem-nicho', motivo: 'Este canal ainda não tem nicho; a forja lê por nicho.' })
  })
  it('nenhum texto do cartão fala em cota, em hoje nem em "libera"', () => {
    for (const mut of [(ds: Dataset) => emDia(ds, VIDEO_ID), (ds: Dataset) => { emDia(ds, VIDEO_ID); ds.requests.push(lv(ds, { state: 'publicado', status: 'completed', publishedAt: ds.now - 3 * MIN })) }]) {
      const c = cardOf(world(mut))
      expect(JSON.stringify(c)).not.toMatch(/cota|Libera amanhã|libera |Já houve uma leitura/)
    }
  })
})
