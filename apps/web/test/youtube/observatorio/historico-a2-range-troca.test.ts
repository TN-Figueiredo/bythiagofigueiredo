// @vitest-environment node
// Fase A2, tarefa 1: gráfico em 30 dias por padrão (spec 6.4) e chegada pela troca, `troca=` (spec 6.2).
// O mundo é o oráculo de 02/10 (canal-fixture), lido uma vez por arquivo; as mutações trabalham numa cópia.
import { describe, it, expect } from 'vitest'
import { canalWorld } from './canal-fixture'
import { setTitles } from './fase4-world'
import { link } from '@/lib/youtube/observatorio/links'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { RANGE_DEFAULT, parseRange, rangeFor } from '@/app/cms/(authed)/youtube/competitors/_historico/many-versions'

const DAY = 864e5, H = 36e5
const { obs } = canalWorld()
const hv = (id: string, p: Record<string, string | undefined> = {}, o = obs) => buildHistoricoView(o, id, p)

/** Vídeos do oráculo (idade e trocas conferidas): `full` 18 d com 6 trocas; `old` 298 d; `few` com 1 registro; `pre` 91 d; `untr` fora dos acompanhados. */
const V = { full: 'matt-opus55', old: 'dale-ninja-dojo', few: 'matt-fast-cheap', pre: 'nate-ai-agent-business', untr: 'luke-damant-l71', hidden: 'luke-hidden-village', street: 'luke-food-street' } as const
const changesOf = (id: string, o = obs) => o.changes.filter(c => c.video === id)
const rangeId = (id: string, p: Record<string, string | undefined> = {}, o = obs) => hv(id, p, o).range?.value ?? null

describe('período: 30 dias por padrão', () => {
  it('sem range o gráfico mostra 30 dias e o seletor tem 7 d, 30 d, 90 d e tudo, com 30 d marcado', () => {
    const v = hv(V.old)
    expect(RANGE_DEFAULT).toBe('30')
    expect(v.range!.value).toBe('30')
    expect(v.range!.options.map(o => [o.id, o.label])).toEqual([['7', '7 d'], ['30', '30 d'], ['90', '90 d'], ['tudo', 'tudo']])
    // o gráfico começa onde os 30 dias começam
    const v0 = obs.video(V.old)!
    expect(v.range!.cut).toBe(true)
    expect(v.chart!.fromH).toBeCloseTo((obs.NOW - 30 * DAY - v0.pub) / H, 6)
  })
  it('o seletor aparece em vídeo com série curta (antes só aparecia acima de 30 dias de série)', () => {
    const v = hv(V.few)
    expect(obs.video(V.few)!.series.length).toBeLessThan(3)
    expect(v.chart).not.toBeNull()
    expect(v.range).not.toBeNull()
    expect(v.range!.value).toBe('30')
    // vídeo mais novo que 30 dias: nada é cortado
    expect(v.range!.cut).toBe(false)
  })
  it('range=tudo mostra o vídeo inteiro; range=7 e range=90 como hoje', () => {
    const pub = obs.video(V.old)!.pub
    const tudo = hv(V.old, { range: 'tudo' })
    expect([tudo.range!.value, tudo.range!.cut, tudo.chart!.fromH]).toEqual(['tudo', false, 0])
    for (const d of [7, 90]) {
      const v = hv(V.old, { range: String(d) })
      expect([v.range!.value, v.range!.cut]).toEqual([String(d), true])
      expect(v.chart!.fromH).toBeCloseTo((obs.NOW - d * DAY - pub) / H, 6)
    }
  })
  it('parâmetros inválidos: range=abc, range vazio e range=30 dão 30 dias', () => {
    const base = JSON.stringify(hv(V.old))
    for (const bad of ['abc', '', '30', '0', '7d', '90;drop']) {
      const v = hv(V.old, { range: bad })
      expect([bad, v.range!.value]).toEqual([bad, '30'])
      expect(JSON.stringify(v)).toBe(base)
    }
    // os dois juntos, com valor ruim: abre no padrão, sem erro
    const v = hv(V.old, { range: 'abc', troca: 'abc' })
    expect([v.range!.value, v.arrival]).toEqual(['30', null])
  })
  it('vídeo sem gráfico (fora dos acompanhados, não encontrado): range é null, sem erro', () => {
    for (const p of [{}, { range: '7' }, { range: 'tudo', troca: 'qualquer' }]) {
      const u = hv(V.untr, p), n = hv('nao-existe', p)
      expect([u.state, u.chart, u.range, u.arrival]).toEqual(['untr', null, null, null])
      expect([n.state, n.chart, n.range, n.arrival]).toEqual(['not-found', null, null, null])
    }
  })
  it('a faixa "antes de 03/10, sem registro" continua no gráfico de 30 dias', () => {
    const v = hv(V.pre)
    expect(v.range!.cut).toBe(true)
    // o vídeo de 91 dias foi publicado antes do arquivo: a faixa de thumbnail e o gráfico ainda mostram o trecho sem registro
    expect(v.lanes.find(l => l.type === 'thumb')!.pre!.text).toMatch(/^antes de 03\/10/)
    expect(v.chart!.pre).not.toBeNull()
    expect(v.chart!.pre!.lines).toEqual(['sem registro por vídeo antes de ' + obs.SERIES_START_LABEL])
  })
})

describe('chegada pela troca (troca=)', () => {
  const full = changesOf(V.full)
  const pairs = (v: ReturnType<typeof hv>) => v.comparisons.map(c => c.changeId)

  it('troca= de uma troca deste vídeo: arrival preenchido, defaultPair é o par dela, a linha e o status com o texto do spec 6.2', () => {
    // uma troca de thumbnail (minuto exato) e uma de título (janela de 6 h) mostram as duas precisões
    for (const c of [full.find(x => x.type === 'thumb' && !x.window)!, full.find(x => x.type === 'title')!]) {
      const v = hv(V.full, { troca: c.id })
      const a = v.arrival!
      expect(a).not.toBeNull()
      expect([a.changeId, a.lane, v.defaultPair]).toEqual([c.id, c.type, a.pairK])
      expect(pairs(v)).toContain(a.pairK)
      // o índice é o da versão na faixa: o marcador desta troca existe com esse índice
      const lane = v.lanes.find(l => l.type === c.type)!
      expect(lane.markers.find(m => m.changeId === c.id)!.idx).toBe(a.markerIdx)
      const quando = c.whenText
      const nome = c.type === 'thumb' ? /^Thumbnail [A-Z]\d* → [A-Z]\d*$/ : /^Título T\d+ → T\d+$/
      expect(a.line.startsWith('Aberta pela aba Trocas do canal: ')).toBe(true)
      expect(a.line.endsWith(', ' + quando + '.')).toBe(true)
      const nomeTroca = a.line.slice('Aberta pela aba Trocas do canal: '.length, -(quando.length + 3))
      expect(nomeTroca).toMatch(nome)
      expect(a.status).toBe('Aberta a troca: ' + nomeTroca + ', ' + quando + '. Ela está destacada no gráfico, na faixa e em Antes e depois.')
    }
  })
  it('troca= de descrição vale como qualquer outra', () => {
    const d = full.find(x => x.type === 'desc')!
    const v = hv(V.full, { troca: d.id })
    expect([v.arrival?.changeId, v.arrival?.lane]).toEqual([d.id, 'desc'])
    expect(v.arrival!.line).toMatch(/^Aberta pela aba Trocas do canal: Descrição D\d+ → D\d+, /)
  })
  it('troca= de troca agrupada (duas trocas no mesmo par): arrival.pairK é o par do grupo', () => {
    const g = full.find(c => c.sameWindow.length > 0)!
    const mate = obs.change(g.sameWindow[0]!)!
    expect(mate.video).toBe(V.full)
    const a = hv(V.full, { troca: g.id }).arrival!, b = hv(V.full, { troca: mate.id }).arrival!
    expect(a.changeId).toBe(g.id)
    expect(b.changeId).toBe(mate.id)
    // as duas chegam no mesmo botão de "Antes e depois"
    expect(a.pairK).toBe(b.pairK)
    expect(hv(V.full, { troca: g.id }).defaultPair).toBe(a.pairK)
    // e cada uma tem o marcador dela na faixa
    expect(a.markerIdx).toBeGreaterThan(0)
    expect(b.markerIdx).toBeGreaterThan(0)
  })
  it('troca= de outro vídeo, troca=abc, troca vazio: arrival null e defaultPair igual ao de hoje', () => {
    const plain = hv(V.full)
    const other = changesOf(V.old)[0]!.id
    for (const bad of [other, 'abc', '', V.full + '/title/999', V.full + '/nada/1']) {
      const v = hv(V.full, { troca: bad })
      expect([bad, v.arrival]).toEqual([bad, null])
      expect([bad, v.defaultPair]).toEqual([bad, plain.defaultPair])
      expect(JSON.stringify(v)).toBe(JSON.stringify(plain))
    }
  })
  it('troca= mais antiga que 30 dias, sem range: o período é 90; mais antiga que 90: tudo', () => {
    expect(rangeFor(obs.NOW - 29 * DAY, obs.NOW)).toBe('30')
    expect(rangeFor(obs.NOW - 30 * DAY, obs.NOW)).toBe('30')
    expect(rangeFor(obs.NOW - 31 * DAY, obs.NOW)).toBe('90')
    expect(rangeFor(obs.NOW - 90 * DAY, obs.NOW)).toBe('90')
    expect(rangeFor(obs.NOW - 91 * DAY, obs.NOW)).toBe('tudo')
    // troca dentro dos 30 dias: nada muda
    const recent = changesOf(V.street)[0]!
    expect(rangeId(V.street, { troca: recent.id })).toBe('30')
    // 52 dias: 90
    const mid = changesOf(V.hidden)[0]!
    expect(Math.round((obs.NOW - mid.at) / DAY)).toBe(52)
    const v = hv(V.hidden, { troca: mid.id })
    // o vídeo tem 86 dias: os 90 dias já o cobrem inteiro
    expect([v.range!.value, v.arrival?.changeId, v.range!.cut]).toEqual(['90', mid.id, false])
    // 120 dias (uma troca de título de antes do arquivo, montada sobre o vídeo de 298 dias): tudo
    const w = canalWorld(ds => setTitles(ds, V.old, [ds.now - 120 * DAY]))
    const old = changesOf(V.old, w.obs).find(c => c.type === 'title')!
    const t = hv(V.old, { troca: old.id }, w.obs)
    expect([t.range!.value, t.range!.cut, t.arrival?.changeId, t.defaultPair]).toEqual(['tudo', false, old.id, t.arrival?.pairK])
  })
  it('troca= antiga com range=7 na URL: o período sobe para o que inclui a troca e ela fica dentro do gráfico (inRange true)', () => {
    const mid = changesOf(V.hidden)[0]!
    const v = hv(V.hidden, { troca: mid.id, range: '7' })
    // 52 dias: o menor período que a inclui é 90; o 7 da URL só vale quando já a inclui
    expect(v.range!.value).toBe('90')
    expect(v.arrival?.changeId).toBe(mid.id)
    expect(v.defaultPair).toBe(v.arrival!.pairK)
    const cmp = v.comparisons.find(c => c.changeId === v.defaultPair)!
    expect(cmp).toBeDefined()
    expect(cmp.inRange).toBe(true)
    // range=30 também sobe; range=90 e range=tudo (o maior) ficam como estão
    expect(rangeId(V.hidden, { troca: mid.id, range: '30' })).toBe('90')
    expect(rangeId(V.hidden, { troca: mid.id, range: '90' })).toBe('90')
    expect(rangeId(V.hidden, { troca: mid.id, range: 'tudo' })).toBe('tudo')
    // range inválido não vale como explícito: a troca antiga leva ao período que a inclui
    expect(rangeId(V.hidden, { troca: mid.id, range: 'abc' })).toBe('90')
  })
  it('range=tudo com troca recente: fica tudo (o período da URL é o maior)', () => {
    const recent = changesOf(V.street)[0]!
    expect(obs.NOW - recent.at).toBeLessThanOrEqual(30 * DAY)
    const v = hv(V.street, { troca: recent.id, range: 'tudo' })
    expect([v.range!.value, v.arrival?.changeId]).toEqual(['tudo', recent.id])
    // sem troca= o range=7 continua valendo como sempre
    expect(rangeId(V.street, { range: '7' })).toBe('7')
  })
  it('a chegada não muda nada além do par e do período: o resto da tela é o de sempre', () => {
    const c = full.find(x => x.type === 'thumb' && !x.window)!
    const a = hv(V.full, { troca: c.id }), b = hv(V.full)
    expect(JSON.stringify({ ...a, defaultPair: null, arrival: null })).toBe(JSON.stringify({ ...b, defaultPair: null, arrival: null }))
  })
})

describe('links: historico com range, pos e tot', () => {
  const base = '/cms/youtube/competitors/video/v1'
  it('link.historico emite range só quando difere de 30, e pos/tot quando dados; ordem fixa das chaves', () => {
    expect(link.historico('v1', { range: '30' })).toBe(base)
    expect(link.historico('v1', { range: 'tudo' })).toBe(base + '?range=tudo')
    expect(link.historico('v1', { range: '7' })).toBe(base + '?range=7')
    expect(link.historico('v1', { pos: 3, tot: 51 })).toBe(base + '?pos=3&tot=51')
    // pos/tot só valem como inteiros positivos
    expect(link.historico('v1', { pos: 0, tot: -1 })).toBe(base)
    expect(link.historico('v1', { pos: 1.5, tot: Number.NaN })).toBe(base)
    // a ordem das chaves não depende da ordem do objeto: from, back, ids, canal, troca, range, pos, tot
    const all = link.historico('v1', { tot: 51, pos: 3, range: '90', troca: 'v1/title/1', canal: 'abc', ids: ['a', 'b'], back: '?tab=trocas', from: 'canais' })
    expect(all).toBe(base + '?from=canais&back=%3Ftab%3Dtrocas&ids=a%2Cb&canal=abc&troca=v1%2Ftitle%2F1&range=90&pos=3&tot=51')
    expect(Object.keys(Object.fromEntries(new URL('http://x' + all).searchParams))).toEqual(['from', 'back', 'ids', 'canal', 'troca', 'range', 'pos', 'tot'])
  })
  it('parseRange ausente ou lixo é o padrão', () => {
    expect([undefined, '', 'x'].map(r => parseRange(r))).toEqual(['30', '30', '30'])
  })
})
