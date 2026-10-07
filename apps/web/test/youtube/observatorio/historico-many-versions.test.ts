// @vitest-environment node
// buildHistoricoView with many versions: period filter, image summary, runs, comparison list
// (plan 2026-10-07-observatorio-historico-muitas-versoes, Task 4).
import { describe, it, expect } from 'vitest'
import { loadFase4, setThumbs, VID, DAY, H } from './fase4-world'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildHistoricoView, type HistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import type { Rich } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'

const { ds } = loadFase4(), obs = createObservatory(ds)
const view = (id: string, range?: string) => buildHistoricoView(obs, id, range ? { range } : {})
const flat = (r: Rich | null | undefined) => (r ?? []).map(x => (typeof x === 'string' ? x : 'b' in x ? x.b : x.num)).join('')
const texts = (v: HistoricoView) => JSON.stringify(v)

describe('quando cada coisa nova aparece', () => {
  it('poucas versões (estado 1): nada novo. Sem filtro, sem resumo, sem recolher, sem sequência, botões de par', () => {
    const v = view(VID.few)
    expect([v.range, v.imageSummary, v.versions!.thumbs.more, v.versions!.thumbs.runNote, v.versions!.titles.runNote, v.compare.mode, v.compare.sum]).toEqual([null, null, null, null, null, 'pairs', null])
    expect(v.lanes.flatMap(l => l.runs)).toEqual([])
    expect(v.legends['']!.some(l => l.kind === 'run')).toBe(false)
    expect(v.lanes.every(l => l.versions.every(x => x.inRange) && l.markers.every(m => m.inRange))).toBe(true)
  })
  it('filtro: só com mais de 30 dias de série ou alguma faixa com mais de 8 períodos', () => {
    expect([VID.few, VID.many, VID.dense, VID.open, VID.closed].map(id => view(id).range?.value ?? null)).toEqual([null, 'tudo', 'tudo', null, 'tudo'])
  })
  it('resumo: só quando alguma imagem voltou ao ar', () => {
    expect([VID.few, VID.many, VID.dense, VID.open, VID.closed].map(id => !!view(id).imageSummary)).toEqual([false, true, true, true, true])
  })
  it('lista de comparação: a partir de 7 trocas; até 6, os botões agrupados de hoje', () => {
    expect([VID.few, VID.many, VID.dense, VID.open, VID.closed].map(id => [view(id).compare.mode, view(id).comparisons.length])).toEqual([['pairs', 2], ['list', 33], ['list', 30], ['pairs', 4], ['pairs', 3]])
  })
  it('grade recolhida: só acima de 8 períodos mostrados', () => {
    expect(view(VID.many).versions!.thumbs.more).toEqual({ keep: 8, open: 'Ver todas (24)', close: 'Mostrar só as 8 mais recentes', srcClosed: 'mostrando os 8 períodos mais recentes de 24', srcOpen: 'mostrando os 24 períodos' })
    expect(view(VID.open).versions!.thumbs.more).toBeNull()
  })
})

describe('resumo por imagem e selo do cabeçalho', () => {
  it('estado 2: cinco linhas, o total e a imagem no ar', () => {
    const s = view(VID.many).imageSummary!
    expect(s.rows.map(r => [r.label, r.passes, r.dur, r.now])).toEqual([['A', 5, '≈ 22,6 d', null], ['B', 4, '≈ 8,2 d', null], ['C', 4, '≈ 4,8 d', null], ['D', 5, '≈ 10,7 d', null], ['E', 6, '≈ 13,9 d', 'no ar']])
    expect(s.total).toMatchObject({ label: '5 imagens', dur: '≈ 60,2 d', passes: 24 })
    expect(s.src).toBe('do vídeo inteiro; passe o mouse, foque ou fixe uma imagem para destacá-la nas faixas e nos cartões')
    expect(s.rows[4]!.rowName).toBe('Imagem E, no ar')
    expect(s.rows[0]!.pinName).toBe('A: fixar o destaque desta imagem')
  })
  it('a tira "quando esteve no ar" cabe em 0 a 100% e o texto diz os mesmos períodos', () => {
    for (const r of view(VID.many).imageSummary!.rows) {
      for (const g of r.segs) { expect(g.left).toBeGreaterThanOrEqual(0); expect(g.left + g.width).toBeLessThanOrEqual(100.0001) }
      expect(r.segsText.split('; ').length).toBe(r.passes)
    }
    expect(view(VID.many).imageSummary!.rows[4]!.segsText).toMatch(/ a agora$/)
  })
  it('selo do cabeçalho: "(uma voltou)" deixa de ser fixo', () => {
    const count = (id: string) => view(id).header!.counts.find(c => c.type === 'thumb')!.text
    expect(count(VID.many)).toBe('5 thumbnails em 24 períodos (5 voltaram)')
    expect(count(VID.open)).toBe('4 thumbnails em 6 períodos (2 voltaram)')
    expect(count(VID.few)).toBe('2 thumbnails em 2 períodos')
    const one = loadFase4(); setThumbs(one.ds, VID.few, [['A'], ['B', one.ds.now - 5 * DAY], ['A', one.ds.now - 3 * DAY]])
    expect(buildHistoricoView(createObservatory(one.ds), VID.few, {}).header!.counts.find(c => c.type === 'thumb')!.text).toBe('2 thumbnails em 3 períodos (uma voltou)')
  })
})

describe('trocas em sequência na tela', () => {
  it('estado 6a: nota na seção de thumbnails, barra na faixa, legenda e linha na comparação', () => {
    const v = view(VID.open)
    expect(v.versions!.thumbs.runNote).toEqual({
      items: [{ strong: 'Trocas em sequência: 5 trocas em 9 dias, ainda aberta', text: ' (desde 30/11 09:20; a mais recente em 09/12 10:20).' }],
      def: 'Chamamos de trocas em sequência as trocas de thumbnail com até 14 dias entre uma e outra. Pode ser um teste; o YouTube não informa.',
    })
    const bar = v.lanes.find(l => l.type === 'thumb')!.runs[0]!
    expect([bar.rest, bar.short, bar.open, bar.cutLeft, bar.aria]).toEqual(['5 trocas em 9 dias, ainda aberta', '5 trocas em sequência', true, false, 'Trocas em sequência: 5 trocas em 9 dias, ainda aberta (thumbnail). Pode ser um teste; o YouTube não informa.'])
    expect(bar.toH).toBeCloseTo(v.chart!.H, 6)
    expect(v.legends['']!.find(l => l.kind === 'run')!.text).toBe('trocas em sequência: trocas do mesmo campo com até 14 dias entre uma e outra. Pode ser um teste; o YouTube não informa.')
    expect(v.comparisons.map(c => c.runLines)).toEqual([['Parte de 5 trocas em sequência em 9 dias. Pode ser um teste; o YouTube não informa.'], ['Parte de 5 trocas em sequência em 9 dias. Pode ser um teste; o YouTube não informa.'], [], ['Parte de 5 trocas em sequência em 9 dias. Pode ser um teste; o YouTube não informa.']])
  })
  it('estado 6b: encerrada na data da última troca; a barra termina nela', () => {
    const v = view(VID.closed), bar = v.lanes.find(l => l.type === 'thumb')!.runs[0]!
    expect(v.versions!.thumbs.runNote!.items).toEqual([{ strong: 'Trocas em sequência: 5 trocas em 9 dias, encerrada em 11/11', text: ' (de 02/11 10:10 a 11/11 11:25).' }])
    expect([bar.open, bar.rest]).toEqual([false, '5 trocas em 9 dias, encerrada em 11/11'])
    expect(bar.toH).toBeLessThan(v.chart!.H)
  })
  it('títulos: a janela não tem minuto, a nota diz só o dia', () => {
    expect(view(VID.many).versions!.titles.runNote!.items).toEqual([
      { strong: 'Trocas em sequência: 4 trocas em 13 dias, encerrada em 27/10', text: ' (vistas de 14/10 a 27/10).' },
      { strong: 'Trocas em sequência: 3 trocas em 9 dias, ainda aberta', text: ' (vistas desde 28/11; a mais recente em 07/12).' }])
  })
  it('descrição nunca tem barra nem nota', () => {
    expect(view(VID.dense).lanes.find(l => l.type === 'desc')!.runs).toEqual([])
  })
  it('estado 6c, o dado não existe: trocas sem testRun (desconhecido) não geram nota, barra, legenda nem linha', () => {
    const w = loadFase4(), o = createObservatory(w.ds)
    for (const c of o.changes) delete c.testRun
    const v = buildHistoricoView(o, VID.open, {})
    expect([v.versions!.thumbs.runNote, v.lanes.flatMap(l => l.runs), v.comparisons.flatMap(c => c.runLines), v.legends['']!.some(l => l.kind === 'run')]).toEqual([null, [], [], false])
    expect(texts(v)).not.toMatch(/em sequência/)
    expect(texts(v)).not.toMatch(/undefined|NaN/)
  })
})

describe('filtro de período', () => {
  it('estado 3 (7 d): a frase diz quanto de cada coisa ficou dentro', () => {
    expect(flat(view(VID.many, '7').range!.text)).toBe('De 05/12 15:02 até agora: 3 de 24 períodos de thumbnail, 2 de 9 títulos, 1 de 3 descrições, 3 de 33 trocas e 7 de 60 dias de views. O cabeçalho e o resultado de cada troca continuam os do vídeo inteiro.')
    expect(flat(view(VID.many, '30').range!.text)).toMatch(/^De 12\/11 15:02 até agora: 12 de 24 períodos de thumbnail, 4 de 9 títulos, 2 de 3 descrições, 15 de 33 trocas e 30 de 60 dias de views\./)
  })
  it('a mesma forma de frase em todos os filtros; filtro maior que o vídeo diz que é o vídeo inteiro', () => {
    expect(flat(view(VID.many).range!.text)).toBe('Vídeo inteiro, desde 13/10 11:00: 24 de 24 períodos de thumbnail, 9 de 9 títulos, 3 de 3 descrições, 33 de 33 trocas e 60 de 60 dias de views. O cabeçalho e o resultado de cada troca continuam os do vídeo inteiro.')
    const v90 = view(VID.many, '90')
    expect([v90.range!.value, v90.range!.cut, v90.chart!.fromH]).toEqual(['90', false, 0])
    expect(flat(v90.range!.text)).toMatch(/^Vídeo inteiro, desde 13\/10 11:00 \(menos que os 90 dias do filtro\): 24 de 24/)
  })
  it('?range= inválido é o vídeo inteiro; num vídeo sem filtro, ?range=7 não corta nada', () => {
    for (const bad of ['xx', '', '8', '-7', '7d']) expect(view(VID.many, bad).range!.value, bad).toBe('tudo')
    const few = view(VID.few, '7')
    expect([few.range, few.chart!.fromH, few.lanes.every(l => l.versions.every(x => x.inRange))]).toEqual([null, 0, true])
    expect(JSON.stringify(few)).toBe(JSON.stringify(view(VID.few)))
  })
  it('gráfico, faixas e versões cortam juntos, no mesmo instante', () => {
    const v = view(VID.many, '7'), from = v.range!.fromH
    expect(v.chart!.fromH).toBe(from)
    expect(v.chart!.bins.every(b => b.b > from && b.a >= from)).toBe(true)
    expect([v.chart!.bins.length, v.chart!.src.bold, v.chart!.table!.length, v.chart!.table![0]![2], v.chart!.table![0]![3]]).toEqual([7, '8 registros diários', 8, 'ponto de partida do período', '—'])
    expect(v.chart!.xTicks[0]!.h).toBe(from)
    for (const l of v.lanes) { expect(l.versions.filter(x => x.inRange).every(x => x.toH > from)).toBe(true); expect(l.versions.filter(x => !x.inRange).every(x => x.toH <= from)).toBe(true) }
    expect(v.lanes.map(l => [l.versions.filter(x => x.inRange).length, l.markers.filter(m => m.inRange).length])).toEqual([[2, 1], [3, 2], [1, 0]])
    expect(v.chart!.aria).toMatch(/, 8 registros diários\. 3 trocas marcadas\./)
  })
  it('os índices não mudam com o filtro: a versão i é a mesma com e sem corte', () => {
    const a = view(VID.many), b = view(VID.many, '7')
    for (const k of [0, 1, 2]) expect(b.lanes[k]!.versions.map(x => x.id)).toEqual(a.lanes[k]!.versions.map(x => x.id))
    expect(b.lanes[1]!.markers.map(m => m.idx)).toEqual(a.lanes[1]!.markers.map(m => m.idx))
  })
  it('um período que começou antes do corte e ainda estava no ar entra, e o grupo diz o corte como começo', () => {
    const v = view(VID.many, '7'), th = v.lanes[1]!.versions.filter(x => x.inRange)
    expect(th[0]!.fromH).toBeLessThan(v.range!.fromH)
    expect(th[0]!.edge.from).toBe('05/12 15:02')
    expect(th[0]!.span).toMatch(/^05\/12 09:37 até/)
  })
  it('vereditos não mudam com o filtro: mesma situação e mesmos números por troca', () => {
    const a = view(VID.many), b = view(VID.many, '7')
    expect(b.comparisons.map(c => [c.changeId, c.situation, c.statusLine, c.before, c.after])).toEqual(a.comparisons.map(c => [c.changeId, c.situation, c.statusLine, c.before, c.after]))
    expect(b.comparisons.filter(c => c.inRange).length).toBe(3)
    expect(b.comparisons.find(c => c.changeId === b.defaultPair)!.inRange).toBe(true)
    expect(JSON.stringify(b.header)).toBe(JSON.stringify(a.header))
  })
  it('resumo, notas e grade seguem o filtro', () => {
    const v = view(VID.many, '7')
    expect(v.imageSummary!.rows.map(r => [r.label, r.passes, r.dur])).toEqual([['D', 1, '≈ 2,2 d'], ['E', 2, '≈ 4,8 d']])
    expect(v.imageSummary!.src).toMatch(/^só o período mostrado, de 05\/12 15:02 até agora;/)
    expect(v.versions!.thumbs.runNote!.items.map(i => i.strong)).toEqual(['Trocas em sequência: 11 trocas em 20 dias, ainda aberta'])
    expect(v.versions!.titles.runNote!.items.map(i => i.strong)).toEqual(['Trocas em sequência: 3 trocas em 9 dias, ainda aberta'])
    expect(v.versions!.thumbs.src).toBe('5 imagens em 24 períodos, em ordem; mostrando 3 de 24. Cada cartão traz o período inteiro da versão, mesmo a parte fora do filtro')
    expect(v.versions!.thumbs.more).toBeNull()
    expect(view(VID.many, '30').versions!.thumbs.more!.open).toBe('Ver todas (12)')
    expect(view(VID.many, '30').versions!.thumbs.more!.srcClosed).toBe('mostrando os 8 períodos mais recentes de 12 do período')
    expect(v.compare.scope).toBe(' no período')
    expect(flat(v.compare.sum)).toMatch(/^3 trocas no período: 3 aguardando os 7 dias\. Nenhuma ganhou ou perdeu\./)
  })
  it('série com buraco de dias: conta dias cobertos, não registros, e o filtro continua oferecido', () => {
    const w = loadFase4(), vid = w.ds.videos.find(x => x.id === VID.many)!
    const before = vid.series.length
    vid.series = vid.series.filter((_, i) => i < 20 || i > 23) // 4 daily records missing in the middle
    const v = buildHistoricoView(createObservatory(w.ds), VID.many, {})
    expect(vid.series.length).toBe(before - 4)
    expect(flat(v.range!.text)).toMatch(/ e 60 de 60 dias de views\./)
    expect(v.chart!.src.bold).toBe('57 registros diários')
    expect(texts(v)).not.toMatch(/NaN|undefined|Infinity/)
  })
  it('?range= que não contém nenhuma troca: diz que não há troca no período, nunca "nenhuma troca registrada"', () => {
    const w = loadFase4(), t = w.ds.now
    setThumbs(w.ds, VID.closed, [['A'], ['B', t - 40 * DAY], ['A', t - 38 * DAY], ['C', t - 36 * DAY]])
    const v = buildHistoricoView(createObservatory(w.ds), VID.closed, { range: '7' })
    expect([v.range!.cut, v.comparisons.length, v.comparisons.filter(c => c.inRange).length, v.defaultPair]).toEqual([true, 2, 0, null])
    expect(v.legends['']!.map(l => l.text)).toContain('Nenhuma troca neste período.')
    expect(v.legends['']!.map(l => l.text)).not.toContain('Nenhuma troca registrada.')
    expect(v.compareEmpty).toBeNull()
    expect(v.lanes[1]!.versions.filter(x => x.inRange).map(x => x.label)).toEqual(['C'])
  })
  it('canal parado há mais tempo que o filtro: nenhum período dentro, e a tela diz isso sem inventar "agora"', () => {
    const w = loadFase4(), ch = w.ds.channels.find(c => c.id === 'rota-barata')!
    ch.sync = { ...ch.sync, state: 'erro', last: w.ds.now - 10 * DAY, errorSince: w.ds.now - 10 * DAY, msg: 'quota' }
    const v = buildHistoricoView(createObservatory(w.ds), VID.closed, { range: '7' })
    expect(v.lanes[1]!.versions.filter(x => x.inRange)).toEqual([])
    expect(v.versions!.thumbs.empty).toBe('Nenhum período de thumbnail neste intervalo.')
    expect(v.imageSummary).toBeNull()
    expect(flat(v.range!.text)).toMatch(/^De 05\/12 15:02 até agora, sem nenhuma conferência \(a última foi em 02\/12 15:02\): 0 de 6 períodos de thumbnail, 0 de 1 título, 0 de 1 descrição, 0 de 5 trocas/)
    const v30 = buildHistoricoView(createObservatory(w.ds), VID.closed, { range: '30' })
    expect(flat(v30.range!.text)).toMatch(/^De 12\/11 15:02 até 02\/12 15:02 \(última conferência\): 1 de 6 períodos de thumbnail/)
    expect(v30.imageSummary!.src).toMatch(/^só o período mostrado, de 12\/11 15:02 até 02\/12 15:02 \(última conferência\);/)
    expect(v30.imageSummary!.rows[0]!.segsText).not.toMatch(/agora/)
    expect(texts(v)).not.toMatch(/NaN|undefined|Infinity/)
  })
})

describe('comparação em lista', () => {
  it('uma linha por troca, da mais recente para a mais antiga, com campo, situação e motivo curto', () => {
    const v = view(VID.many), c = v.comparisons
    expect(c.length).toBe(33)
    expect(c[0]).toMatchObject({ changeId: VID.many + '/thumb/23', field: 'thumb', label: 'Thumbnail D → E', when: '10/12 16:25', situation: 'aguardando', inRange: true })
    expect(new Set(c.map(x => x.changeId)).size).toBe(33)
    expect(c.filter(x => x.field === 'title').length + c.filter(x => x.field === 'thumb').length + c.filter(x => x.field === 'desc').length).toBe(33)
    expect([c.filter(x => x.field === 'title').length, c.filter(x => x.field === 'thumb').length, c.filter(x => x.field === 'desc').length]).toEqual([8, 23, 2])
    expect(c.find(x => x.field === 'title')!.when).toMatch(/^entre \d\d\/\d\d \d\dh e /)
  })
  it('a frase de abertura fecha a conta e chama cada situação pelo nome', () => {
    const v = view(VID.dense)
    expect(flat(v.compare.sum)).toBe('30 trocas: 13 inconclusivas (2 por dois campos em menos de 48 h; 11 por versão com menos de 1 dia no ar), 15 aguardando os 7 dias, 2 sem base. Nenhuma ganhou ou perdeu. Uma troca só é medida com 7 dias sem outra troca do vídeo depois dela e pelo menos 3 antes.')
    const n = (s: string) => v.comparisons.filter(c => c.situation === s).length
    expect([n('inconclusivo'), n('aguardando'), n('sem-base'), n('ganhou') + n('perdeu') + n('neutro')]).toEqual([13, 15, 2, 0])
  })
  it('todo marcador leva a uma linha da lista (a sua própria troca)', () => {
    const v = view(VID.many), ids = new Set(v.comparisons.map(c => c.changeId))
    for (const l of v.lanes) for (const m of l.markers) { expect(m.pairK).toBe(m.changeId); expect(ids.has(m.pairK!)).toBe(true) }
  })
  it('até 6 trocas: os botões de hoje, com a troca e a volta dela juntas', () => {
    expect(view(VID.open).comparisons.map(c => c.label)).toEqual(['Thumbnail A → B', 'Thumbnail B → C → A', 'Título T1 → T2', 'Thumbnail A → D → B'])
  })
})

describe('textos de grupo que a faixa monta', () => {
  it('cada período e cada troca trazem o começo e o fim na precisão do dado', () => {
    const v = view(VID.open), th = v.lanes[1]!, ti = v.lanes[0]!
    expect(th.versions[0]!.edge).toEqual({ from: '25/11 10:00', to: '30/11 09:20' })
    expect(th.versions[5]!.edge).toEqual({ from: '09/12 10:20', to: 'agora' })
    expect(th.versions[5]!.name).toBe('Thumbnail B: 09/12 10:20 até agora, voltou, no ar')
    expect(th.markers[0]!.edge).toEqual({ from: '30/11 09:20', to: '30/11 09:20' })
    expect(th.markers[0]!.list).toEqual({ label: 'A → B, 30/11 09:20', status: 'inconclusivo', line: 'inconclusivo: outra troca nos 7 dias depois' })
    expect(ti.markers[0]!.edge).toEqual({ from: '03/12 06h', to: '03/12 12h' })
    expect([th.unit, th.changeWord, ti.unit]).toEqual([['período', 'períodos'], 'thumbnail', ['título', 'títulos']])
    expect(th.aria).toBe('Faixa de thumbnail: 6 períodos e 5 trocas, em ordem de tempo. As setas para a esquerda e para a direita andam pela faixa.')
  })
})

describe('entradas que a especificação não descreve', () => {
  it('vídeo com 1 período de cada coisa: nada novo aparece e nenhum texto quebra', () => {
    const w = loadFase4(), vid = w.ds.videos.find(x => x.id === VID.few)!
    vid.thumbs = [{ ...vid.thumbs[0]!, current: true, last_seen: w.ds.now }]; vid.titles = [{ ...vid.titles[0]!, current: true, last_seen: w.ds.now }]
    const v = buildHistoricoView(createObservatory(w.ds), VID.few, { range: '7' })
    expect([v.range, v.imageSummary, v.compare.mode, v.comparisons.length, v.versions!.thumbs.more, v.header!.counts.map(c => c.text)]).toEqual([null, null, 'pairs', 0, null, ['Nenhuma troca registrada']])
    expect(texts(v)).not.toMatch(/NaN|undefined|Infinity/)
  })
  it('200 períodos de thumbnail: a tela inteira é montada, as contas fecham e as letras passam de Z', () => {
    const w = loadFase4(), vid = w.ds.videos.find(x => x.id === VID.closed)!, keys = Array.from({ length: 30 }, (_, i) => 'k' + i)
    const start = vid.pub + DAY
    setThumbs(w.ds, VID.closed, [['k0'], ...Array.from({ length: 199 }, (_, i): [string, number] => [keys[(i * 7 + 1) % 30]!, start + i * 5 * H])])
    const v = buildHistoricoView(createObservatory(w.ds), VID.closed, {})
    expect(v.versions!.thumbs.cards.length).toBe(200)
    expect(v.versions!.thumbs.more!.open).toBe('Ver todas (200)')
    expect(v.imageSummary!.rows.length).toBe(30)
    expect(v.imageSummary!.rows.reduce((s, r) => s + r.passes, 0)).toBe(200)
    expect(v.imageSummary!.total.passes).toBe(200)
    expect(v.imageSummary!.rows.map(r => r.label).slice(25, 28)).toEqual(['Z', 'Z1', 'Z2'])
    expect([v.compare.mode, v.comparisons.length]).toEqual(['list', 199])
    expect(v.lanes[1]!.runs.length).toBe(1)
    expect(texts(v)).not.toMatch(/NaN|undefined|Infinity/)
  })
  it('o oráculo de 02/10 continua igual nos campos que já existiam: só a legenda da sequência entra', () => {
    const o = createObservatory(datasetFromOracle(loadOracle())), v = buildHistoricoView(o, 'matt-opus55', {})
    expect([v.range, v.compare.mode, v.versions!.thumbs.more, !!v.imageSummary]).toEqual([null, 'pairs', null, true])
    expect(v.header!.counts.find(c => c.type === 'thumb')!.text).toBe('3 thumbnails em 4 períodos (uma voltou)')
    expect(v.legends['']!.filter(l => l.kind === 'run').length).toBe(1)
    expect(v.versions!.thumbs.runNote!.items[0]!.strong).toBe('Trocas em sequência: 3 trocas em 5 dias, ainda aberta')
  })
})
