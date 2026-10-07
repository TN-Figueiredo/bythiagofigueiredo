// @vitest-environment node
// apps/web/test/youtube/observatorio/pinned-texts.test.ts — what the screens say about an old pinned video.
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import type { ObsVideo } from '@/lib/youtube/observatorio/types'
import { effectView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'

const BASE = createObservatory(datasetFromOracle(loadOracle()))
// The oracle has no change that is inconclusive for lack of peers, so one is built: a change the engine measures, with
// every OTHER video of its channel taken out of the tracked ones (the peers of an effect are tracked videos only, R119).
const measured = BASE.changes.find(c => BASE.effect(c.id)!.status === 'ganhou')!
function fewPeers(patch: Partial<ObsVideo>) {
  const ds = datasetFromOracle(loadOracle())
  const v = ds.videos.find(x => x.id === measured.video)!
  for (const u of ds.videos) if (u.ch === v.ch && u !== v) u.tracked = false
  Object.assign(v, patch)
  return createObservatory(ds)
}
const OLD = 'Faltam vídeos na mesma faixa de idade entre os '

describe('efeito de um fixado antigo (V9)', () => {
  it('o conjunto montado é mesmo inconclusivo por falta de pares (senão este arquivo não testa nada)', () => {
    const obs = fewPeers({}), e = obs.effect(measured.id)!
    expect(e).toMatchObject({ status: 'inconclusivo', inconclusiveKind: 'outro' })
    expect(e.n).toBeLessThan(obs.RULES.effect.minN)
    expect(e.observed).not.toBeNull()
  })
  it('vídeo acompanhado: o texto do motor fica como está', () => {
    const obs = fewPeers({})
    expect(effectView(obs, obs.change(measured.id)!).detail).toMatch(/^Poucos vídeos do canal para comparar/)
  })
  it('fixado fora dos N: a frase que explica, com o N do canal, igual em Mudanças e no Histórico', () => {
    // the engine keeps the series of a pinned video, so the effect is still computed; only `tracked` flips
    const obs = fewPeers({ tracked: false, pinned: true, pinState: 'ativo' })
    const c = obs.change(measured.id)!, e = obs.effect(c.id)!
    expect(e).toMatchObject({ status: 'inconclusivo', inconclusiveKind: 'outro' })
    const N = obs.channel(c.ch)!.video_limit
    const text = OLD + N + ' mais recentes do canal para comparar. É o que costuma acontecer com um vídeo fixado antigo.'
    expect(effectView(obs, c).detail).toBe(text)
    const h = buildHistoricoView(obs, c.video, {})
    expect(JSON.stringify(h.comparisons)).toContain(text)
    expect(JSON.stringify(h.comparisons)).not.toContain('Poucos vídeos do canal para comparar')
  })
  it('fixado ENTRE os N: o texto do motor (ele é comparado com os vizinhos de sempre)', () => {
    const obs = fewPeers({ pinned: true, pinState: 'ativo' })
    expect(effectView(obs, obs.change(measured.id)!).detail).toMatch(/^Poucos vídeos do canal para comparar/)
  })
  it('fixado fora dos N com efeito MEDIDO (há pares): o texto do motor, nunca a frase do fixado antigo', () => {
    const ds = datasetFromOracle(loadOracle())
    Object.assign(ds.videos.find(x => x.id === measured.video)!, { tracked: false, pinned: true, pinState: 'ativo' })
    const obs = createObservatory(ds)
    expect(effectView(obs, obs.change(measured.id)!).detail).not.toContain(OLD)
  })
})

describe('trecho sem pontos e multiplicador de um fixado fora dos N', () => {
  const SHOW = 'matt-opus55'
  /** The showcase video with its last 5 daily points cut off: the series stops before the channel's last record. */
  const cut = (patch: Partial<ObsVideo>) => {
    const ds = datasetFromOracle(loadOracle()), v = ds.videos.find(x => x.id === SHOW)!
    v.series = v.series.slice(0, -5); Object.assign(v, patch)
    const obs = createObservatory(ds)
    return { obs, view: buildHistoricoView(obs, SHOW, {}), last: v.series[v.series.length - 1]!.t }
  }
  it('fixado fora dos N com a série parada: a nota diz quando os pontos voltam, na legenda também', () => {
    const { obs, view, last } = cut({ tracked: false, pinned: true, pinState: 'aguardando-primeira' })
    const text = 'sem pontos depois de ' + obs.date.dm(last) + ': o gráfico volta a ganhar pontos na próxima sincronização do canal depois das 12:00'
    expect(view.chart!.hatch!.note).toBe(text)
    expect(view.legends['']!.some(l => l.kind === 'hatch' && l.text === text)).toBe(true)
  })
  it('fixado que o YouTube não devolveu, com a série parada: a nota não promete a volta dos pontos', () => {
    const { obs, view, last } = cut({ tracked: false, pinned: true, pinState: 'sem-resposta' })
    const text = 'sem pontos depois de ' + obs.date.dm(last) + ': o YouTube não devolveu este vídeo na última sincronização'
    expect(view.chart!.hatch!.note).toBe(text)
    expect(view.legends['']!.some(l => l.kind === 'hatch' && l.text === text)).toBe(true)
    expect(JSON.stringify(view.chart)).not.toContain('volta a ganhar pontos')
    if (!view.header!.mult.text.startsWith('sem multiplicador')) expect(view.header!.mult.text).toContain(', até o registro diário de ')
  })
  it('vídeo acompanhado com a série parada: o texto de hoje não muda', () => {
    const { obs, view, last } = cut({})
    expect(view.chart!.hatch!.note).toBe('sem registro desde ' + obs.date.dm(last))
  })
  it('recém-fixado: o multiplicador leva a data do último registro (a conta é sobre uma série que parou)', () => {
    const { view, obs, last } = cut({ tracked: false, pinned: true, pinState: 'aguardando-primeira' })
    if (view.header!.mult.text.startsWith('sem multiplicador')) return // no base in this fixture: nothing to date
    expect(view.header!.mult.text).toContain(', até o registro diário de ' + obs.date.dmOrDmy(last) + ' ' + obs.date.hm(last))
  })
})
