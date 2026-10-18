// @vitest-environment node
// The sentences about a thumbnail that came back are only true for an immediate return (A → B → A). With other images
// in between they were false in production (plan 2026-10-07-observatorio-historico-muitas-versoes, Task 2; mockup decision C16).
import { describe, it, expect } from 'vitest'
import { loadFase4, setThumbs, VID, DAY, H } from './fase4-world'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { thumbRepresentatives } from '@/lib/youtube/thumb-hamming'
import { imageLetters } from '@/app/cms/(authed)/youtube/competitors/_chrome/version-span'
import { viewerOfVideo } from '@/app/cms/(authed)/youtube/competitors/_chrome/thumb-viewer/thumb-viewer-versions'
import { buildMudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'

/** A → B → C → A: A is back after 3 days, with B and C on air in between. */
function abca() {
  const { ds } = loadFase4(), t = ds.now - 12 * DAY
  setThumbs(ds, VID.few, [['A'], ['B', t], ['C', t + DAY + 2 * H], ['A', t + 3 * DAY]])
  return createObservatory(ds)
}
const badges = (obs: ReturnType<typeof createObservatory>, video: string) =>
  Object.fromEntries(buildMudancasView(obs, { video, win: '90' }, new Set()).heroes.map(h => [h.id, h.badges.filter(b => b.kind === 'rev').map(b => b.text)]))
const thumbNotes = (obs: ReturnType<typeof createObservatory>, video: string) => buildHistoricoView(obs, video, { range: 'tudo' }).versions!.thumbs.notes.filter(n => n.kind === 'ab').map(n => n.text)

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
    expect(b[VID.closed + '/thumb/2']).toEqual(['Voltou à versão A depois de 2 dias e 6 horas com a alternativa. Alternância de miniatura (A → B → A em até 14 dias).'])
    expect(b[VID.closed + '/thumb/1']).toEqual(['Esta versão foi revertida 2 dias e 6 horas depois. Alternância de miniatura (A → B → A em até 14 dias).'])
  })
  it('uma imagem só no intervalo que não é a anterior (linha repetida): singular', () => {
    const { ds } = loadFase4(), t = ds.now - 12 * DAY
    setThumbs(ds, VID.few, [['A'], ['B', t], ['B', t + DAY], ['A', t + 2 * DAY]])
    expect(badges(createObservatory(ds), VID.few)[VID.few + '/thumb/3']).toEqual(['A versão A voltou ao ar depois de 2 dias, com 1 outra imagem no intervalo.'])
  })
})

describe('Histórico: nota e ressalva da alternância de miniatura', () => {
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
    expect(thumbNotes(createObservatory(ds), VID.closed)).toEqual(['A → B → A em 2 d 6 h: Alternância de miniatura (A → B → A em até 14 dias). Não dá para saber a causa: o YouTube não informa se houve teste.'])
  })
  it('o oráculo de 02/10 não tem volta com imagens no meio: nenhum texto dele muda', () => {
    const obs = createObservatory(datasetFromOracle(loadOracle()))
    expect(obs.changes.filter(c => c.revertImmediate === false)).toEqual([])
    expect(thumbNotes(obs, 'matt-opus55')).toEqual(['A → B → A em 10 h 35 min: Alternância de miniatura (A → B → A em até 14 dias). Não dá para saber a causa: o YouTube não informa se houve teste.'])
  })
})

describe('S2: rótulo sem atribuir ao YouTube e volta tolerante à recompressão', () => {
  const H16 = (n: number) => n.toString(16).padStart(16, '0')
  const flip = (hex: string, bits: number) => H16(parseInt(hex, 16) ^ ((1 << bits) - 1))
  const run = (a2: string, aKey = H16(0xabcdef)) => {
    const { ds } = loadFase4(), t = ds.now - 12 * DAY
    setThumbs(ds, VID.few, [[aKey], [H16(0xfffff0000), t], [a2, t + 5 * DAY]])
    return createObservatory(ds)
  }
  const ALL = (obs: ReturnType<typeof createObservatory>) => [
    ...Object.values(badges(obs, VID.few)).flat(), ...thumbNotes(obs, VID.few),
    ...buildHistoricoView(obs, VID.few, {}).comparisons.flatMap(c => c.full?.caveats ?? []),
  ].join(' ')
  it('A → B → A em 5 dias: nenhum texto traz "Test & Compare" nem "Testar e comparar"', () => {
    const obs = run(H16(0xabcdef)), txt = ALL(obs)
    expect(txt).toMatch(/Alternância de miniatura/)
    expect(txt).not.toMatch(/Test & Compare|Testar e comparar/)
  })
  it('A\' a 3 bits de A: voltou a uma versão anterior', () => {
    const a = H16(0xabcdef), obs = run(flip(a, 3)), c = obs.change(VID.few + '/thumb/2')!
    expect([c.revertTo, c.revertImmediate]).toEqual([a, true])
  })
  it('A\' a 7 bits de A: não volta', () => {
    const obs = run(flip(H16(0xabcdef), 7)), c = obs.change(VID.few + '/thumb/2')!
    expect(c.revertTo).toBeNull()
  })
  it('chave que não é dHash (letras): só igualdade exata, nada inventado', () => {
    const { ds } = loadFase4(), t = ds.now - 12 * DAY
    setThumbs(ds, VID.few, [['A'], ['B', t], ['C', t + DAY]])
    expect(createObservatory(ds).change(VID.few + '/thumb/2')!.revertTo).toBeNull()
  })
})

describe('S2: a mesma imagem recomprimida guarda a letra e a contagem (representante único)', () => {
  const H16 = (n: number) => n.toString(16).padStart(16, '0')
  const flip = (hex: string, bits: number) => H16(parseInt(hex, 16) ^ ((1 << bits) - 1))
  const A = H16(0xabcdef), B = H16(0xfffff0000)
  const world = (a2: string) => {
    const { ds } = loadFase4(), t = ds.now - 12 * DAY
    setThumbs(ds, VID.few, [[A], [B, t], [a2, t + 5 * DAY]])
    return createObservatory(ds)
  }
  it('A, B, A\' (3 bits): letras A, B, A; "2 imagens em 3 períodos"; selo "Voltou à versão A"; visor rotula "Thumbnail A"', () => {
    const a2 = flip(A, 3), obs = world(a2), v = obs.video(VID.few)!
    expect(v.thumbs.map(t => imageLetters(v.thumbs).get(t.key))).toEqual(['A', 'B', 'A'])
    expect(buildHistoricoView(obs, VID.few, { range: 'tudo' }).versions!.thumbs.src).toMatch(/^2 imagens em 3 períodos/)
    // cabeçalho conta pelo mesmo representante (Yannis R2-1)
    expect(buildHistoricoView(obs, VID.few, { range: 'tudo' }).header!.counts.find(c => c.type === 'thumb')!.text).toMatch(/^2 thumbnails em 3 períodos/)
    expect(badges(obs, VID.few)[VID.few + '/thumb/2'].join(' ')).toMatch(/Voltou à versão A /)
    const ch = obs.channels.find(c => c.id === v.ch)!
    expect(viewerOfVideo(obs, v, ch, 't', null)!.versions.map(x => x.label)).toEqual(['Thumbnail A', 'Thumbnail B', 'Thumbnail A'])
  })
  it('A, B, A\' (7 bits): letra C e "3 imagens" (comportamento de sempre)', () => {
    const obs = world(flip(A, 7)), v = obs.video(VID.few)!
    expect(v.thumbs.map(t => imageLetters(v.thumbs).get(t.key))).toEqual(['A', 'B', 'C'])
    expect(buildHistoricoView(obs, VID.few, { range: 'tudo' }).versions!.thumbs.src).toMatch(/^3 imagens em 3 períodos/)
  })
  it('âncora: A, A\'(5), A\'\'(10 de A, 5 de A\') => A\' é A, A\'\' abre imagem nova (sem deriva por elos); imagem distante também', () => {
    const a1 = flip(A, 5), a2 = H16(parseInt(a1, 16) ^ (0b11111 << 5)), far = H16(0x123456789abc)
    const r = thumbRepresentatives([A, a1, a2, far])
    expect(r.get(a2)).toBe(a2)
    expect([r.get(A), r.get(a1), r.get(far)]).toEqual([A, A, far])
    // recompressão repetida (2 + 2 bits) continua sendo A
    const c1 = flip(A, 2), c2 = H16(parseInt(c1, 16) ^ (0b11 << 20))
    const rc = thumbRepresentatives([A, c1, c2])
    expect([rc.get(c1), rc.get(c2)]).toEqual([A, A])
    expect(thumbRepresentatives(['x', 'y', 'x', null as never].slice(0, 3))).toEqual(new Map([['x', 'x'], ['y', 'y']]))
  })
  it('não transitivo: x=0, y=0x3f, z=0xfc0 (y e z a 12 bits) => z cai em x, que é o 1º que o reconhece', () => {
    const [x, y, z] = [H16(0), H16(0x3f), H16(0xfc0)], r = thumbRepresentatives([x, y, z])
    expect([r.get(y), r.get(z)]).toEqual([x, x])
  })
})
