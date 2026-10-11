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
  it('vídeo sem gráfico (fora dos acompanhados, não encontrado): range é null, sem erro, e uma troca REAL do vídeo não vira chegada', () => {
    // o vídeo fora dos acompanhados do oráculo não tem troca nenhuma: ganha duas de título (id de verdade, efeito 'sem-serie' NÃO nulo)
    const w = canalWorld(ds => setTitles(ds, V.untr, [ds.now - 10 * DAY, ds.now - 3 * DAY]))
    const real = changesOf(V.untr, w.obs)
    expect(real.map(c => c.id)).toEqual([V.untr + '/title/2', V.untr + '/title/1'])
    expect(real.every(c => w.obs.effect(c.id) != null)).toBe(true)
    for (const p of [{}, { range: '7' }, { range: 'tudo', troca: 'qualquer' }, ...real.map(c => ({ troca: c.id })), ...real.map(c => ({ troca: c.id, range: 'tudo' }))]) {
      const u = hv(V.untr, p, w.obs), n = hv('nao-existe', p, w.obs)
      expect([u.state, u.chart, u.range, u.arrival, u.defaultPair]).toEqual(['untr', null, null, null, null])
      expect([n.state, n.chart, n.range, n.arrival]).toEqual(['not-found', null, null, null])
    }
  })
  it('vídeo FORA dos acompanhados mostra o histórico inteiro: versões e trocas com mais de 30 dias continuam na tela, com ou sem range na URL', () => {
    // título trocado há 70 e há 60 dias; a última conferência (ds.now) é de hoje, então tudo isto é anterior ao período padrão
    const w = canalWorld(ds => setTitles(ds, V.untr, [ds.now - 70 * DAY, ds.now - 60 * DAY]))
    const base = JSON.stringify(hv(V.untr, {}, w.obs))
    const real = changesOf(V.untr, w.obs)
    expect(real.length).toBe(2)
    expect(real.every(c => w.obs.effect(c.id) != null && w.obs.NOW - c.at > 30 * DAY)).toBe(true)
    // sem gráfico não há seletor nem chegada: nem `range=` nem uma troca= REAL (e antiga) mudam a tela; o guarda de `troca=` e o período
    // do vídeo sem gráfico são os dois que esta afirmação protege (apagar qualquer um muda o JSON)
    const entradas = [{}, { range: '7' }, { range: 'abc' }, { range: '30' }, { range: 'tudo' }, ...real.map(c => ({ troca: c.id })), ...real.map(c => ({ troca: c.id, range: '7' }))]
    for (const p of entradas) {
      const v = hv(V.untr, p, w.obs)
      expect([JSON.stringify(p), v.state, v.range, v.chart]).toEqual([JSON.stringify(p), 'untr', null, null])
      expect([JSON.stringify(p), JSON.stringify(v)]).toEqual([JSON.stringify(p), base])
      const titulos = v.versions!.titles.items
      expect(titulos.length).toBeGreaterThanOrEqual(3)
      expect(titulos.every(t => t.inRange)).toBe(true)
      const faixa = v.lanes.find(l => l.type === 'title')!
      expect(faixa.versions.length).toBe(titulos.length)
      expect(faixa.versions.every(x => x.inRange)).toBe(true)
      expect(faixa.markers.length).toBeGreaterThanOrEqual(2)
      expect(faixa.markers.every(m => m.inRange)).toBe(true)
    }
  })
  it('vídeo fora dos acompanhados cuja última conferência é antiga (>30 dias): a versão atual e as raias não somem', () => {
    const w = canalWorld(ds => {
      setTitles(ds, V.untr, [ds.now - 90 * DAY, ds.now - 80 * DAY])
      // a última conferência do vídeo ficou para trás
      const t = ds.videos.find(x => x.id === V.untr)!.titles
      t[t.length - 1]!.last_seen = ds.now - 45 * DAY
    })
    const v = hv(V.untr, {}, w.obs)
    expect(v.state).toBe('untr')
    const titulos = v.versions!.titles.items
    expect(titulos.length).toBeGreaterThanOrEqual(3)
    expect(titulos.every(t => t.inRange)).toBe(true)
    expect(v.lanes.find(l => l.type === 'title')!.versions.every(x => x.inRange)).toBe(true)
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
  it('troca= antiga com range explícito menor que ela: NÃO há chegada, a tela abre como hoje (par padrão, sem linha)', () => {
    const mid = changesOf(V.hidden)[0]!
    expect(Math.round((obs.NOW - mid.at) / DAY)).toBe(52)
    for (const r of ['7', '30']) {
      const v = hv(V.hidden, { troca: mid.id, range: r }), plain = hv(V.hidden, { range: r })
      expect([r, v.range!.value, v.arrival, v.range!.why]).toEqual([r, r, null, null])
      // idêntica à tela sem troca=: mesmo par padrão, mesmas comparações
      expect(JSON.stringify(v)).toBe(JSON.stringify(plain))
    }
    // range explícito que já a inclui (90, tudo): vale o da URL e a chegada existe, sem texto de "ampliado"
    for (const r of ['90', 'tudo'] as const) {
      const v = hv(V.hidden, { troca: mid.id, range: r })
      expect([r, v.range!.value, v.arrival?.changeId, v.range!.why]).toEqual([r, r, mid.id, null])
    }
    // range inválido não vale como explícito: a troca antiga leva ao período que a inclui
    expect(rangeId(V.hidden, { troca: mid.id, range: 'abc' })).toBe('90')
  })
  it('range=tudo com troca recente: fica tudo e a chegada existe', () => {
    const recent = changesOf(V.street)[0]!
    expect(obs.NOW - recent.at).toBeLessThanOrEqual(30 * DAY)
    const v = hv(V.street, { troca: recent.id, range: 'tudo' })
    expect([v.range!.value, v.arrival?.changeId, v.range!.why]).toEqual(['tudo', recent.id, null])
    // sem troca= o range=7 continua valendo como sempre
    expect(rangeId(V.street, { range: '7' })).toBe('7')
  })
  it('invariante: uma chegada sempre tem a troca dentro do período, com marcador na raia e par visível em "Antes e depois"', () => {
    const w = canalWorld(ds => setTitles(ds, V.old, [ds.now - 120 * DAY, ds.now - 20 * DAY]))
    let withArrival = 0, without = 0
    for (const id of [V.full, V.hidden, V.old, V.street, V.pre]) {
      for (const c of changesOf(id, w.obs)) {
        for (const range of [undefined, '7', '30', '90', 'tudo', 'abc']) {
          const v = hv(id, { troca: c.id, range }, w.obs), a = v.arrival
          if (!a) { without++; expect(v.defaultPair).toBe(hv(id, { range }, w.obs).defaultPair); continue }
          withArrival++
          const cmp = v.comparisons.find(x => x.changeId === a.pairK)
          expect([id, c.id, range, cmp?.inRange]).toEqual([id, c.id, range, true])
          expect(v.defaultPair).toBe(a.pairK)
          const lane = v.lanes.find(l => l.type === c.type)!
          expect(lane.markers.find(m => m.changeId === c.id)?.inRange).toBe(true)
          if (v.range!.value !== 'tudo') expect(c.at).toBeGreaterThanOrEqual(w.obs.NOW - Number(v.range!.value) * DAY)
        }
      }
    }
    expect(withArrival).toBeGreaterThan(20)
    expect(without).toBeGreaterThan(5)
  })
  it('período ampliado pela troca (sem range na URL): o texto diz por quê; nos outros casos não há texto', () => {
    const mid = changesOf(V.hidden)[0]!
    expect(hv(V.hidden, { troca: mid.id }).range!.why).toBe('Período ampliado para 90 dias para incluir a troca aberta.')
    const w = canalWorld(ds => setTitles(ds, V.old, [ds.now - 120 * DAY]))
    const old = changesOf(V.old, w.obs).find(c => c.type === 'title')!
    expect(hv(V.old, { troca: old.id }, w.obs).range!.why).toBe('Período ampliado para o vídeo inteiro para incluir a troca aberta.')
    // troca recente, sem troca, troca inválida, range explícito: nenhum texto
    expect(hv(V.street, { troca: changesOf(V.street)[0]!.id }).range!.why).toBeNull()
    expect(hv(V.hidden).range!.why).toBeNull()
    expect(hv(V.hidden, { troca: 'abc' }).range!.why).toBeNull()
    expect(hv(V.hidden, { troca: mid.id, range: '90' }).range!.why).toBeNull()
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
