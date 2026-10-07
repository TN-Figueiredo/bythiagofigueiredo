// @vitest-environment node
// The sentences about a thumbnail that came back are only true for an immediate return (A → B → A). With other images
// in between they were false in production (plan 2026-10-07-observatorio-historico-muitas-versoes, Task 2; mockup decision C16).
import { describe, it, expect } from 'vitest'
import { loadFase4, setThumbs, VID, DAY, H } from './fase4-world'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { buildMudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'

/** A → B → C → A: A is back after 3 days, with B and C on air in between. */
function abca() {
  const { ds } = loadFase4(), t = ds.now - 12 * DAY
  setThumbs(ds, VID.few, [['A'], ['B', t], ['C', t + DAY + 2 * H], ['A', t + 3 * DAY]])
  return createObservatory(ds)
}
const badges = (obs: ReturnType<typeof createObservatory>, video: string) =>
  Object.fromEntries(buildMudancasView(obs, { video, win: '90' }, new Set()).heroes.map(h => [h.id, h.badges.filter(b => b.kind === 'rev').map(b => b.text)]))
const thumbNotes = (obs: ReturnType<typeof createObservatory>, video: string) => buildHistoricoView(obs, video, {}).versions!.thumbs.notes.filter(n => n.kind === 'ab').map(n => n.text)

describe('motor: a volta é imediata ou não', () => {
  it('A → B → C → A: a volta NÃO é imediata, com 2 imagens no intervalo; a perna B → C não foi "revertida"', () => {
    const obs = abca(), back = obs.change(VID.few + '/thumb/3')!, leg = obs.change(VID.few + '/thumb/2')!
    expect([back.revertTo, back.revertImmediate, back.revertBetween]).toEqual(['A', false, 2])
    expect([leg.revertedBy, leg.revertedImmediate]).toEqual([back.id, false])
  })
  it('A → B → A: imediata, 1 imagem no intervalo', () => {
    const { ds } = loadFase4(), t = ds.now - 12 * DAY
    setThumbs(ds, VID.few, [['A'], ['B', t], ['A', t + DAY]])
    const obs = createObservatory(ds), back = obs.change(VID.few + '/thumb/2')!, leg = obs.change(VID.few + '/thumb/1')!
    expect([back.revertImmediate, back.revertBetween, leg.revertedImmediate]).toEqual([true, 1, true])
  })
  it('o dado não existe: troca sem volta não tem nenhum dos três campos', () => {
    const obs = abca(), first = obs.change(VID.few + '/thumb/1')!
    expect([first.revertImmediate, first.revertBetween, first.revertedImmediate]).toEqual([undefined, undefined, undefined])
  })
  it('paridade com o mockup nos cinco vídeos', () => {
    const { HM, ds } = loadFase4(), obs = createObservatory(ds)
    for (const v of HM.videos) for (const c of v.changes) {
      const p = obs.change(c.id)!
      if (c.type === 'thumb' && c.revertTo) expect([p.revertImmediate, p.revertBetween], c.id).toEqual([c.immediate, c.between])
      expect(!!p.revertedImmediate, c.id).toBe(!!c.revertedImmediate)
    }
  })
})

describe('Mudanças: selos de reversão', () => {
  it('A → B → C → A: diz que a imagem voltou e quantas houve no meio; nada de "com a alternativa" nem "foi revertida"', () => {
    const b = badges(abca(), VID.few)
    expect(b[VID.few + '/thumb/3']).toEqual(['A versão A voltou ao ar depois de 3 dias, com 2 outras imagens no intervalo.'])
    expect(b[VID.few + '/thumb/2']).toEqual([])
    expect(Object.values(b).flat().join(' ')).not.toMatch(/com a alternativa|foi revertida|Testar e comparar/)
  })
  it('os textos aprovados do mockup (estado 6a): B volta depois de C, A e D', () => {
    const { ds } = loadFase4(), b = badges(createObservatory(ds), VID.open)
    expect(b[VID.open + '/thumb/5']).toEqual(['A versão B voltou ao ar depois de 6 dias e 20 horas, com 3 outras imagens no intervalo.'])
    expect(b[VID.open + '/thumb/4']).toEqual([])
  })
  it('A → B → A imediato mantém os dois textos de hoje, palavra por palavra', () => {
    const { ds } = loadFase4(), b = badges(createObservatory(ds), VID.closed)
    expect(b[VID.closed + '/thumb/2']).toEqual(['Voltou à versão A depois de 2 dias e 6 horas com a alternativa. Compatível com Testar e comparar (teste A/B do YouTube, até 14 dias).'])
    expect(b[VID.closed + '/thumb/1']).toEqual(['Esta versão foi revertida 2 dias e 6 horas depois. Compatível com Testar e comparar (teste A/B do YouTube).'])
  })
  it('uma imagem só no intervalo que não é a anterior (linha repetida): singular', () => {
    const { ds } = loadFase4(), t = ds.now - 12 * DAY
    setThumbs(ds, VID.few, [['A'], ['B', t], ['B', t + DAY], ['A', t + 2 * DAY]])
    expect(badges(createObservatory(ds), VID.few)[VID.few + '/thumb/3']).toEqual(['A versão A voltou ao ar depois de 2 dias, com 1 outra imagem no intervalo.'])
  })
})

describe('Histórico: nota e ressalva "Testar e comparar"', () => {
  it('A → B → C → A: nenhuma nota "alternância típica" e nenhuma ressalva de alternância nas comparações', () => {
    const obs = abca(), v = buildHistoricoView(obs, VID.few, {})
    expect(thumbNotes(obs, VID.few)).toEqual([])
    expect(v.comparisons.flatMap(c => c.full?.caveats ?? []).join(' ')).not.toMatch(/Alternância compatível/)
  })
  it('estado 6a do mockup: a nota falsa "B → C → B" some', () => {
    const { ds } = loadFase4()
    expect(thumbNotes(createObservatory(ds), VID.open)).toEqual([])
  })
  it('A → B → A imediato: a nota de hoje continua, com o mesmo texto', () => {
    const { ds } = loadFase4()
    expect(thumbNotes(createObservatory(ds), VID.closed)).toEqual(['A → B → A em 2 d 6 h: alternância típica do Testar e comparar (teste A/B do YouTube). Compatível, não confirmado — o YouTube não informa o teste nem o vencedor.'])
  })
  it('o oráculo de 02/10 não tem volta com imagens no meio: nenhum texto dele muda', () => {
    const obs = createObservatory(datasetFromOracle(loadOracle()))
    expect(obs.changes.filter(c => c.revertImmediate === false)).toEqual([])
    expect(thumbNotes(obs, 'matt-opus55')).toEqual(['A → B → A em 10 h 35 min: alternância típica do Testar e comparar (teste A/B do YouTube). Compatível, não confirmado — o YouTube não informa o teste nem o vencedor.'])
  })
})
