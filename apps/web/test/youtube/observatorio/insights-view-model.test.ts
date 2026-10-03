// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { buildInsightsView, formulaChip, type InsightsView } from '@/app/cms/(authed)/youtube/competitors/_insights/view-model'

const DAY = 864e5
const ds0 = datasetFromOracle(loadOracle())
const obs = createObservatory(ds0)
const clone = (): Dataset => structuredClone(ds0)
const view = (niche: 'todos' | 'viagem' | 'ia', fmt?: string, o = obs) => buildInsightsView(o, { niche, fmt })
const textOf = (r: Array<string | Record<string, string>>) => r.map(x => typeof x === 'string' ? x : Object.values(x)[0]).join('')

describe('insights view model', () => {
  it('Todos: one niche at a time, no sections, links to each niche', () => {
    const v = view('todos')
    expect(v.all!.title).toBe('Insights compara dentro de um nicho')
    expect(v.all!.go.map(g => [g.label, g.href])).toEqual([['Ver Viagem', '?niche=viagem'], ['Ver IA', '?niche=ia']])
    expect([v.formulas, v.cadence, v.heatmap, v.themes, v.youInNiche, v.gaps]).toEqual([null, null, null, null, null, null])
    expect(v.reading).toBeNull()
  })

  it('window and format come from the engine clock and the URL', () => {
    const v = view('viagem', 'short')
    expect(v.window.dates).toBe(obs.date.dm(obs.NOW - 90 * DAY) + '–' + obs.date.dm(obs.NOW))
    expect(v.fmt).toBe('short')
    expect(v.fmtOptions.map(f => [f.label, f.pressed])).toEqual([['Longos', false], ['Shorts', true]])
    expect(view('viagem', 'zzz').fmt).toBe('long')
  })

  describe('fórmulas', () => {
    it('a formula with n = 7 never says padrão, even if the verdict claims it', () => {
      const weak = formulaChip(obs, { nUse: 7, diff: 1.2, verdict: { id: 'padrao', text: 'x' } })
      expect(weak.kind).toBe('weak')
      expect(weak.text).toBe('◌ pouco para concluir')
      expect(formulaChip(obs, { nUse: 12, diff: 0.2, verdict: { id: 'padrao', text: 'x' } }).kind).toBe('neg')
      expect(formulaChip(obs, { nUse: 12, diff: 0.3, verdict: { id: 'padrao', text: 'x' } }).kind).toBe('ok')
    })
    it('every row below minN says "recorrência observada (n = N) — pouco para concluir" and never passes', () => {
      const rows = (['viagem', 'ia'] as const).flatMap(n => (['long', 'short'] as const).flatMap(f => view(n, f).formulas!.rows))
      const few = rows.filter(r => /\(n = [2-9] vs/.test(textOf(r.sentence)))
      expect(few.length).toBeGreaterThan(0)
      for (const r of rows) {
        const n = Number(/\(n = (\d+) vs/.exec(textOf(r.sentence))![1])
        if (n < obs.RULES.pattern.minN) {
          expect(r.verdict).not.toBe('padrao')
          expect(r.chip.kind).toBe('weak')
          if (n >= 2) expect(r.verdictText).toContain('recorrência observada (n = ' + n + ') — pouco para concluir')
        }
        if (r.verdict === 'padrao') expect(n).toBeGreaterThanOrEqual(obs.RULES.pattern.minN)
      }
    })
    it('Viagem longos: preço passes the rule; rows sorted by difference; links to Outliers with min=0', () => {
      const f = view('viagem').formulas!
      expect(f.rows[0]!.id).toBe('preco')
      expect(f.rows[0]!.chip.text).toBe('● passa a regra')
      // Task 35b: with the 20/10 reading, the rows are the reading's frozen numbers (insights.html renderFormulas P)
      expect(textOf(f.rows[0]!.sentence)).toBe('Na leitura: mediana 1,2× com a fórmula, contra 0,8× sem (n = 40 vs 132); 1 outlier com essa fórmula: Luke Damant.')
      expect(f.rows[0]!.link.href).toContain('/cms/youtube/competitors/outliers?')
      expect(f.rows[0]!.link.href).toContain('formula=preco')
      expect(f.rows[0]!.link.href).toContain('min=0')
      expect(f.rows[0]!.link.after).toBe('(hoje, nos 7 canais da leitura)')
      expect(f.meta).toBe('184 longos até 19/10 12:00 (7 canais, 6 meses)')
      expect(f.metaRight).toBe('números da leitura de 20/10 06:10')
      expect(f.empty).toBeNull()
    })
    it('without a reading: today\'s analysis ("Hoje"), examples in the niche\'s video order, no right meta', () => {
      const o = createObservatory({ ...clone(), readings: [] })
      const f = view('viagem', 'long', o).formulas!
      expect(textOf(f.rows[0]!.sentence)).toBe('Hoje: mediana 1,2× com a fórmula, contra 0,8× sem (n = 34 vs 115); 1 outlier com essa fórmula: Luke Damant.')
      expect(f.rows[0]!.example).toBe('Living on $9 a Day in Lagos')
      expect(f.meta).toBe('158 longos até 24/10, 6 meses')
      expect(f.metaRight).toBeNull()
      expect(textOf(f.foot)).toContain('Ainda não há leitura: a tabela é a análise de hoje')
    })
    it('a reading whose analysis lacks the numbers falls back to today and says why', () => {
      const ds = clone()
      ds.readings = ds.readings.map(r => r.type === 'padroes-titulo' ? { ...r, analysis: { patterns: [{ formula: 'preco', verdict: { id: 'padrao', text: 'x' } }] } } : r)
      const f = view('viagem', 'long', createObservatory(ds)).formulas!
      expect(textOf(f.rows[0]!.sentence)).toMatch(/^Hoje: /)
      expect(textOf(f.foot)).toContain('A leitura não trouxe os números das fórmulas: a tabela é a análise de hoje')
    })
  })

  describe('cadência', () => {
    it('"costuma" only with ≥ 3 videos and ≥ 30 %; otherwise "horário variado (n = N)"', () => {
      const c = view('viagem').cadence!
      for (const r of c.rows) {
        const cad = obs.cadence(r.id, 'long')
        if (r.costuma) { expect(cad.habit.n).toBeGreaterThanOrEqual(3); expect(cad.habit.share!).toBeGreaterThanOrEqual(0.3); expect(r.habit).toMatch(/^costuma publicar /) }
        else if (r.habit) expect(r.habit).toMatch(/^(horário variado \(n = \d+\)|nenhum vídeo em 13 semanas)$/)
      }
      expect(c.rows.find(r => r.id === 'vou-sem-volta')!.habit).toBe('horário variado (n = 11)')
      expect(c.rows.find(r => r.id === 'luke-damant')!.habit).toBe('costuma publicar quarta às 10:00 (7 de 21)')
    })
    it('the weekday is computed from the clock, never fixed', () => {
      const ax = view('viagem').cadence!.axis
      expect(ax[3]!.text).toBe('hoje, ' + obs.date.weekdayShort(obs.NOW) + ' ' + obs.date.dm(obs.NOW))
      const ds = clone(); ds.now += DAY
      const o2 = createObservatory(ds)
      expect(view('viagem', 'long', o2).cadence!.axis[3]!.text).toBe('hoje, ' + o2.date.weekdayShort(o2.NOW) + ' ' + o2.date.dm(o2.NOW))
      expect(o2.date.weekdayShort(o2.NOW)).not.toBe(obs.date.weekdayShort(obs.NOW))
      const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/app/cms/(authed)/youtube/competitors/_insights')
      for (const f of fs.readdirSync(dir)) expect(fs.readFileSync(path.join(dir, f), 'utf8')).not.toMatch(/['"`](segunda|terça|quarta|quinta|sexta|sábado|domingo)['"`]/i)
    })
    it('a stalled channel shows the engine problemPhrase', () => {
      const r = view('viagem').cadence!.rows.find(x => x.id === 'paddy-doyle')!
      expect(r.syncOff).toBe(true)
      expect(r.warn).toBe(obs.channel('paddy-doyle')!.sync.problemPhrase)
    })
  })

  describe('mapa de calor', () => {
    it('a video published Friday 23:30 SP lands in Friday 22–24', () => {
      const ds = clone(), o0 = createObservatory(ds)
      const v = ds.videos.find(x => x.ch === 'luke-damant' && x.fmt === 'long' && x.tracked && x.ageDays <= 60)!
      let day = o0.NOW - 10 * DAY
      while (o0.date.parts(day).dow !== 5) day -= DAY
      const p = o0.date.parts(day), pub = o0.date.sp(p.y, p.mo, p.d, 23, 30)
      const before = view('viagem', 'long', o0).heatmap!
      v.pub = pub; v.ageDays = Math.floor((ds.now - pub) / DAY)
      const after = view('viagem', 'long', createObservatory(ds)).heatmap!
      expect(after.days[4]).toBe('Sex'); expect(after.blocks[11]).toBe('22h–24h')
      expect(Number(after.uploads.table[4]![11])).toBe(Number(before.uploads.table[4]![11]) + 1)
      // never in Saturday 02–04 (the UTC instant): 23:30 SP is 02:30 UTC
      const was = o0.date.parts(o0.video(v.id)!.pub), wasSat0204 = was.dow === 6 && (was.h === 2 || was.h === 3)
      expect(Number(after.uploads.table[5]![1])).toBe(Number(before.uploads.table[5]![1]) - (wasSat0204 ? 1 : 0))
    })
    it('peak, ties and the dominant channel come from the engine', () => {
      const h = view('viagem').heatmap!
      const hm = obs.heatmap('viagem', 'long')
      const pk = hm.peak!
      expect(h.uploads.cells[pk.dow]![pk.block]!.peak).toBe(true)
      expect(textOf(h.uploads.note)).toContain('Mais uploads: ' + h.days[pk.dow] + ' ' + hm.blocks[pk.block] + ', ' + pk.n + ' de ' + hm.n + '.')
      expect(textOf(h.uploads.note)).toContain('Todos são de Matheus Fonseca: é o hábito de um canal, não do nicho.')
      expect(h.excluded).toBe('Fora do mapa: Vou sem volta: ainda buscando vídeos (18 de 50).')
      expect(textOf(h.mult.note)).toMatch(/blocos com uploads têm menos de 3 vídeos com base e ficam hachurados\.$/)
    })
  })

  describe('temas, você no nicho e lacunas', () => {
    it('themes carry the temas reading seal; empty state when no temas reading exists', () => {
      const t = view('viagem').themes!
      expect(t.seal).toBe('forja · Gemma 12B · gerada 20/10 06:10 (SP)')
      expect(t.rows.map(r => r.theme)[0]).toBe('rotina-nomade')
      const ds = clone(); ds.readings = ds.readings.filter(r => r.type !== 'temas')
      const e = view('viagem', 'long', createObservatory(ds)).themes!
      expect(e.rows).toEqual([]); expect(e.seal).toBeNull()
      expect(e.empty!.title).toBe('Ainda não há temas de Viagem')
      const g = view('viagem', 'long', createObservatory(ds)).gaps!
      expect(g.rows).toEqual([]); expect(g.empty!.title).toBe('Ainda não há temas de Viagem')
    })
    it('você no nicho: relative metrics only, verdicts from the engine', () => {
      const y = view('viagem').youInNiche!
      expect(y.empty).toBeNull()
      expect(y.rows.map(r => r.key)).toEqual(['pw', 'perMilSubs', 'pctOutliers', 'engagement'])
      expect(y.rows[1]!.verdict.text).toBe('▲ 1,8× a mediana do nicho')
      expect(y.rows[0]!.fewText).toBe('n = 8, pouco para concluir')
      expect(y.head!.title).toBe('8 vídeos seus (longos, 13 semanas)')
    })
    it('no vsYou against an own channel with 0 videos: the honest empty state', () => {
      const ds = clone(); const own = ds.channels.find(c => c.own)!.id
      ds.videos = ds.videos.filter(v => v.ch !== own)
      const v = view('viagem', 'long', createObservatory(ds))
      expect(v.youInNiche!.rows).toEqual([])
      expect(v.youInNiche!.empty!.title).toBe('Seu canal ainda não tem longos nas últimas 13 semanas')
      expect(v.gaps!.rows).toEqual([])
      expect(v.gaps!.empty!.title).toBe('Sem longos seus de Viagem para comparar')
    })
    it('own channel set to another niche: no comparison in IA', () => {
      const v = view('ia')
      expect(v.youInNiche!.empty!.title).toBe('Seu canal ainda não tem vídeos de IA')
      expect(v.gaps!.empty).not.toBeNull()
    })
    it('lacunas: themes of ≥ 2 competitors with no own video, by theme and never by tag', () => {
      const g = view('viagem').gaps!
      expect(g.rows.map(r => r.theme)).toEqual(['comida-de-rua'])
      expect(textOf(g.rows[0]!.sub)).toBe('6 canais, 12 vídeos, mediana 1,1× (n = 9) · você: nenhum')
      expect(g.foot).toContain('Por tema, não por tag')
      expect(g.foot).toContain('Temas de um canal só ficam de fora (1).')
    })
  })

  describe('fix round 1: honest texts when the data does not exist', () => {
    it('Temas: the foot ties the names to the reading date (no "toda madrugada"); the model comes from the reading', () => {
      const t = view('viagem').themes!
      expect(t.foot).toContain('Os nomes dos grupos vêm da leitura de temas da forja de 20/10 06:10 (SP)')
      expect(t.foot).not.toMatch(/madrugada/)
      expect(t.seal).toBe('forja · Gemma 12B · gerada 20/10 06:10 (SP)')
      const ds = clone()
      for (const r of ds.readings) if (r.type === 'temas') { r.model = 'gemma3:12b-it'; r.seal = 'forja · gemma3:12b-it · temas' }
      expect(view('viagem', 'long', createObservatory(ds)).themes!.seal).toBe('forja · gemma3:12b-it · gerada 20/10 06:10 (SP)')
      for (const r of ds.readings) if (r.type === 'temas') { delete r.model; r.seal = 'selo antigo' }
      expect(view('viagem', 'long', createObservatory(ds)).themes!.seal).toBe('forja · modelo não registrado · gerada 20/10 06:10 (SP)')
    })
    it('Temas: low theme coverage (production: ≤ 8 videos themed) shows no ▲/▼ and says why', () => {
      expect(obs.themeTrend('viagem', 'long').coverage.trendable).toBe(true)
      const ds = clone()
      let kept = 0
      for (const v of ds.videos) if (v.theme && !(v.ageDays <= 90 && v.niche === 'viagem' && v.fmt === 'long' && v.tracked && v.ch !== 'tnfigueiredo' && kept++ < 8)) v.theme = null
      const o = createObservatory(ds), cv = o.themeTrend('viagem', 'long').coverage
      expect(cv.trendable).toBe(false); expect(cv.prev.themed).toBe(0)
      const t = view('viagem', 'long', o).themes!
      expect(t.coverageNote).toMatch(/^A forja ainda não deu tema a vídeos suficientes para comparar com os 90 dias anteriores: tem tema em \d+ de \d+ longos dos últimos 90 dias e em 0 de \d+ dos 90 anteriores \(a tendência pede 80% em cada janela\)\.$/)
      expect(t.rows.length).toBeGreaterThan(0)
      for (const r of t.rows) { expect(r.trend).toBeNull(); expect(r.trendText).toBeNull(); expect(r.spark).toBeNull() }
      expect(JSON.stringify(t)).not.toMatch(/[▲▼]/)
      expect(t.foot).not.toContain('Tendência')
      expect(view('viagem').themes!.coverageNote).toBeNull()
    })
    it('Lacunas refuse when no own video carries a theme', () => {
      const ds = clone(); const own = ds.channels.find(c => c.own)!.id
      for (const v of ds.videos) if (v.ch === own) v.theme = null
      const g = view('viagem', 'long', createObservatory(ds)).gaps!
      expect(g.rows).toEqual([]); expect(g.none).toBeNull(); expect(g.foot).toBeNull()
      expect(g.empty!.title).toBe('A forja ainda não deu tema aos seus vídeos')
    })
    it('Lacunas refuse when competitor theme coverage is low', () => {
      const ds = clone(); const own = ds.channels.find(c => c.own)!.id
      for (const v of ds.videos) if (v.ch !== own) v.theme = null
      const g = view('viagem', 'long', createObservatory(ds)).gaps!
      expect(g.empty!.title).toBe('A forja ainda não deu tema a vídeos suficientes dos concorrentes')
    })
    it('Lacunas: no theme in ≥ 2 channels is its own case, never "você já tem vídeo em todos"', () => {
      const ds = clone()
      const viagem = ['comida-de-rua', 'lugares-perigosos', 'trens-e-onibus', 'rotina-nomade', 'japao-fora-das-capitais', 'custo-de-viagem']
      const comps = ds.channels.filter(c => !c.own && c.niche === 'viagem').map(c => c.id)
      for (const v of ds.videos) { const i = comps.indexOf(v.ch); if (i >= 0) v.theme = i < viagem.length ? viagem[i]! : 'ia-e-emprego' }
      const g = view('viagem', 'long', createObservatory(ds)).gaps!
      expect(g.empty).toBeNull(); expect(g.rows).toEqual([])
      expect(g.none).toBe('Nenhum tema aparece em 2 canais ou mais nos últimos 90 dias.')
      expect(g.foot).not.toMatch(/cobrem 0 temas/)
      const ds2 = clone(); const own = ds2.channels.find(c => c.own)!.id
      const themesOf = new Set(ds2.videos.filter(v => v.niche === 'viagem' && v.ch !== own && v.fmt === 'long').map(v => v.theme))
      const owned = ds2.videos.filter(v => v.ch === own && v.fmt === 'long' && v.ageDays <= 90)
      let k = 0; const all = [...themesOf].filter((x): x is string => !!x)
      for (const v of owned) v.theme = all[k++ % all.length]!
      const g2 = view('viagem', 'long', createObservatory(ds2)).gaps!
      if (!g2.rows.length) expect(g2.none).toMatch(/^Você já tem vídeo em todos os \d+ temas que aparecem em 2 canais ou mais\.$/)
    })
    it('Heatmap: every channel still fetching → says the map waits and shows the engine reasons', () => {
      const ds = clone()
      for (const c of ds.channels) if (!c.own && c.niche === 'viagem') { c.sync.state = 'backfill'; c.sync.backfill = { done: 5, total: 50 }; c.lastIdx = null }
      const h = view('viagem', 'long', createObservatory(ds)).heatmap!
      expect(h.empty).toBe('O mapa espera os canais de Viagem: todos ainda estão buscando vídeos.')
      expect(h.excluded).toMatch(/^Fora do mapa: .*ainda buscando vídeos \(5 de 50\)/)
      expect(h.empty).not.toMatch(/publicado/)
    })
    it('Fórmulas: the row verdict follows the chip; no dangling "; ."', () => {
      for (const n of ['viagem', 'ia'] as const) for (const r of view(n).formulas!.rows) {
        expect(r.verdict).toBe(r.chip.kind === 'ok' ? 'padrao' : r.chip.kind === 'weak' ? 'recorrencia' : 'sem-diferenca')
        expect(textOf(r.sentence)).not.toMatch(/; \.$/)
      }
      expect(obs.RULES.medianMinN).toBe(5)
    })
  })

  it('an empty dataset (no videos): every section has its empty text and no NaN', () => {
    const ds = clone(); ds.videos = []
    const v: InsightsView = view('viagem', 'long', createObservatory(ds))
    // the frozen reading still stands (its own numbers); today's analysis has nothing
    expect(v.formulas!.metaRight).toBe('números da leitura de 20/10 06:10')
    expect(v.cadence!.empty).toBe('Nenhum longo dos concorrentes de Viagem nos últimos 90 dias. Fora da análise: Vou sem volta: buscando vídeos (18 de 50).')
    expect(v.heatmap!.empty).toBe('Nenhum longo dos concorrentes de Viagem publicado nos últimos 90 dias.')
    expect(v.themes!.empty).not.toBeNull()
    expect(v.youInNiche!.empty).not.toBeNull()
    expect(v.gaps!.empty).not.toBeNull()
    const json = JSON.stringify(v)
    expect(json).not.toMatch(/NaN|Infinity|undefined|null%/)
  })
})

// Task 35b (fidelity sweep): insights.html:775-779 — with Todos and no request, the paragraph says what asking does,
// and with no reading at all the "Ainda não há leitura" note comes as well (both, never one instead of the other)
describe('Insights view model — Todos without a request', () => {
  const MIX = 'Misturar viagem e IA somaria públicos, horários e fórmulas que não têm nada a ver. Escolha um nicho para ver a leitura da forja, as fórmulas e os temas.'
  it('with readings: the ask sentence is part of the paragraph; no note', () => {
    const a = view('todos').all!
    expect(a.text).toBe(MIX + ' Pedir uma leitura daqui envia um pedido dos longos para cada nicho.')
    expect(a.forja.note).toBeNull()
  })
  it('without readings: the same paragraph AND the "Ainda não há leitura" note', () => {
    const a = view('todos', undefined, createObservatory({ ...datasetFromOracle(loadOracle()), readings: [] })).all!
    expect(a.text).toBe(MIX + ' Pedir uma leitura daqui envia um pedido dos longos para cada nicho.')
    expect(a.forja.note).toBe('Ainda não há leitura dos longos em nenhum dos dois nichos.')
  })
})
