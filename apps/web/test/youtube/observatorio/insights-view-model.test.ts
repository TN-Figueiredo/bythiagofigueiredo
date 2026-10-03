// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadOracle, loadOracleOwns, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { assignLinks, buildInsightsView, formulaChip, ownScope, whereOwns, type GapsSection, type InsightsView, type YouCell, type YouSection } from '@/app/cms/(authed)/youtube/competitors/_insights/view-model'

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
    it('você no nicho: one own channel → one row, relative metrics only, short verdicts from the engine', () => {
      const y = view('viagem').youInNiche!
      expect(y.empty).toBeNull()
      expect(y.cols.map(c => c.key)).toEqual(['pw', 'perMilSubs', 'pctOutliers', 'engagement'])
      expect(y.rows.map(r => r.name)).toEqual(['tnFigueiredo'])
      expect(y.rows[0]!.lang).toBeNull()
      expect(y.rows[0]!.cells![1]).toMatchObject({ kind: 'value', verdict: '▲ 1,8× a mediana', cls: 'up', few: null })
      expect(y.rows[0]!.cells![0]).toMatchObject({ kind: 'value', few: 'n = 8, pouco para concluir', cls: 'flat' })
      expect(y.rows[0]!.sub).toMatch(/^8 vídeos em 13 semanas · .+ inscritos$/)
    })
    it('own channel with 0 videos in the format: the row stays, with the reason instead of the metrics', () => {
      const ds = clone(); const own = ds.channels.find(c => c.own)!.id
      ds.videos = ds.videos.filter(v => v.ch !== own)
      const v = view('viagem', 'long', createObservatory(ds))
      const y = v.youInNiche!
      expect(y.empty).toBeNull()
      expect(y.rows).toHaveLength(1)
      expect(y.rows[0]!.cells).toBeNull()
      expect(y.rows[0]!.emptyText).toBe('Sem longos nas últimas 13 semanas: não há o que comparar. A linha se preenche a partir do primeiro vídeo.')
      expect(y.rows[0]!.sub).toMatch(/^nenhum longo em 13 semanas · /)
      expect(JSON.stringify(y.rows)).not.toMatch(/a mediana|▼|▲/)
      expect(v.gaps!.rows).toEqual([])
      expect(v.gaps!.empty!.title).toBe('Sem longos seus de Viagem para comparar')
    })
    it('own channel set to another niche: no comparison in IA, and the card says where the channel is', () => {
      const v = view('ia')
      const y = v.youInNiche!
      expect(y.empty!.title).toBe('Nenhum canal seu está em IA')
      expect(y.empty!.text).toBe('Você tem 1 canal: 1 de Viagem (tnFigueiredo). Esta comparação usa só os seus canais do nicho. Para um canal entrar aqui, troque o nicho dele na aba Canais, na linha do canal.')
      expect(y.rows).toEqual([]); expect(y.ref).toBeNull(); expect(y.foot).toBeNull()
      expect(v.gaps!.empty).not.toBeNull()
    })
    it('lacunas: themes of ≥ 2 competitors with no own video, by theme and never by tag', () => {
      const g = view('viagem').gaps!
      expect(g.rows.map(r => r.theme)).toEqual(['comida-de-rua'])
      expect(textOf(g.rows[0]!.sub)).toBe('6 canais, 12 vídeos, mediana 1,1× (n = 9)')
      expect(g.rows[0]!.lack).toBe('tnFigueiredo: nenhum vídeo')
      expect(g.foot).toContain('Por tema, não por tag')
      expect(g.foot).toContain('Temas de um canal concorrente só ficam de fora (1).')
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
      if (!g2.rows.length) expect(g2.none).toBe('tnFigueiredo já tem vídeo em todos os temas que aparecem em 2 canais ou mais.')
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
    // the own channel keeps its row, with the reason instead of the metrics
    expect(v.youInNiche!.rows.map(r => r.cells)).toEqual([null])
    expect(v.youInNiche!.rows[0]!.emptyText).toMatch(/^Sem longos nas últimas 13 semanas/)
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

// Task 8 (N canais próprios): "Você no nicho" is a table — one row per own channel of the tab's niche, the niche once.
// The engines are built ONCE per file (the oracle is slow to load).
const PRESETS = ['1', '2', '5', 'mix', 'zero'] as const
const DS = Object.fromEntries(PRESETS.map(p => [p, datasetFromOracle(loadOracleOwns(p))])) as Record<typeof PRESETS[number], Dataset>
const OBS = Object.fromEntries(PRESETS.map(p => [p, createObservatory(DS[p])])) as Record<typeof PRESETS[number], ReturnType<typeof createObservatory>>
/** A niche's competitors leave the dataset (the frozen readings name them, so they go too). */
const withoutCompetitors = (base: Dataset, niche: 'viagem' | 'ia'): Dataset => {
  const ds = structuredClone(base); const gone = new Set(ds.channels.filter(c => !c.own && c.niche === niche).map(c => c.id))
  ds.channels = ds.channels.filter(c => !gone.has(c.id)); ds.videos = ds.videos.filter(v => !gone.has(v.ch))
  ds.readings = []; ds.requests = []
  return ds
}
const NO_REF = (o: ReturnType<typeof createObservatory>, nl: string) => ({ text: `Nenhum concorrente em ${nl} ainda: sem referência para comparar.`, link: { text: 'Definir nicho dos concorrentes', href: o.link.canais({ nicheEditor: 1 }) } })

describe('Insights view model — Você no nicho with N own channels', () => {
  const you = (p: typeof PRESETS[number], niche: 'viagem' | 'ia', fmt?: string): YouSection => buildInsightsView(OBS[p], { niche, fmt }).youInNiche!
  const rowOf = (y: YouSection, name: string) => y.rows.find(r => r.name === name)!
  const cellOf = (y: YouSection, name: string, key: string): YouCell => rowOf(y, name).cells![y.cols.findIndex(c => c.key === key)]!
  const allCells = (y: YouSection) => y.rows.flatMap(r => r.cells ?? [])

  it('preset 2, Viagem, longos: two rows, the niche once, the four columns', () => {
    const o = OBS['2'], y = you('2', 'viagem')
    expect(y.empty).toBeNull()
    expect(y.meta).toBe('2 canais seus de Viagem, mesmo formato')
    expect(y.rows.map(r => r.name)).toEqual(['tnFigueiredo', 'tnFigueiredo EN'])
    expect(y.ref!.sub).toBe(`mediana e faixa dos ${o.nicheRef('viagem', 'long').channels.length} concorrentes de Viagem`)
    expect(y.ref!.cells).toHaveLength(4)
    y.ref!.cells.forEach(c => { expect(c.value).toMatch(/^\d/); expect(c.range).toMatch(/^de \d.* a \d/) })
    expect(y.cols.map(c => c.label)).toEqual(['Ritmo', 'Views/dia', 'Vídeos com 2× ou mais', 'Engajamento'])
    expect(y.cols.map(c => c.unit)).toEqual([
      'vídeos por semana, 13 semanas', `por mil inscritos, mediana desde ${o.SERIES_START_LABEL}`, 'dos últimos 90 dias',
      `curtidas + comentários / views, ${o.channelStats('tnfigueiredo', 'long').engagement.window}`,
    ])
    expect(cellOf(y, 'tnFigueiredo', 'pw')).toEqual({ kind: 'value', value: '0,6', verdict: '▼ 0,6× a mediana', cls: 'flat', few: 'n = 8, pouco para concluir' })
    expect(cellOf(y, 'tnFigueiredo', 'perMilSubs')).toMatchObject({ kind: 'value', verdict: '▲ 1,8× a mediana', cls: 'up', few: null })
    expect(cellOf(y, 'tnFigueiredo EN', 'pctOutliers')).toEqual({ kind: 'nodata', text: 'sem dado', base: 'base fraca (n = 0)', baseTitle: 'Menos de 3 vídeos deste canal com base de comparação' })
    expect(y.rows.map(r => r.lang)).toEqual([{ code: 'PT', title: 'Canal em português' }, { code: 'EN', title: 'Canal em inglês' }])
    expect(y.rows.map(r => r.href)).toEqual([o.link.canais({ channel: 'tnfigueiredo' }), o.link.canais({ channel: 'tnfigueiredo-en' })])
    expect(y.noneNote).toBeNull()
  })

  it('R74: a weak base (pouco para concluir / base fraca) never paints the verdict green or red', () => {
    let weak = 0, strong = 0
    for (const p of PRESETS) for (const n of ['viagem', 'ia'] as const) for (const f of ['long', 'short']) {
      for (const c of allCells(you(p, n, f))) {
        if (c.kind === 'nodata') { weak++; expect(c).not.toHaveProperty('cls'); expect(c.text).toBe('sem dado'); expect(c.base).toMatch(/^base fraca \(n = \d+\)$/) }
        else if (c.few) { weak++; expect(c.cls).toBe('flat') }
        else { strong++; expect(c.verdict.startsWith('▲') ? c.cls === 'up' : c.verdict.startsWith('▼') ? c.cls === 'down' : c.cls === 'flat').toBe(true) }
      }
    }
    expect(weak).toBeGreaterThan(0); expect(strong).toBeGreaterThan(0)
  })

  it('a value never disappears: every cell is a value with a verdict, or "sem dado · base fraca (n = N)"', () => {
    for (const p of PRESETS) for (const n of ['viagem', 'ia'] as const) for (const f of ['long', 'short']) {
      const y = you(p, n, f)
      for (const r of y.rows) { if (r.cells) { expect(r.cells).toHaveLength(4); expect(r.emptyText).toBeNull() } else expect(r.emptyText).toMatch(/^Sem (longos|Shorts) nas últimas 13 semanas/) }
      for (const c of allCells(y)) if (c.kind === 'value') { expect(c.value).not.toBe('—'); expect(c.verdict).toMatch(/^[▲▼≈] \S/) }
      expect(JSON.stringify(y)).not.toMatch(/NaN|Infinity|undefined|null%/)
    }
  })

  it('preset 1: singular meta, one row, no language chip', () => {
    const y = you('1', 'viagem')
    expect(y.meta).toBe('1 canal seu de Viagem, mesmo formato')
    expect(y.rows).toHaveLength(1)
    expect(y.rows[0]!.lang).toBeNull()
  })

  it('preset 2, IA: no own channel in the niche — says where they are and how to bring one in', () => {
    const y = you('2', 'ia')
    expect(y.empty!.title).toBe('Nenhum canal seu está em IA')
    expect(y.empty!.text).toBe('Você tem 2 canais: 2 de Viagem (tnFigueiredo e tnFigueiredo EN). Esta comparação usa só os seus canais do nicho. Para um canal entrar aqui, troque o nicho dele na aba Canais, na linha do canal.')
    expect(y.empty!.links.map(l => l.text)).toEqual(['Ver seus canais'])
    expect(y.empty!.links[0]!.href).toBe(OBS['2'].link.canais({}))
    expect(y.meta).toBe('nenhum canal seu de IA')
    expect(y.rows).toEqual([]); expect(y.ref).toBeNull(); expect(y.noneNote).toBeNull(); expect(y.foot).toBeNull()
  })

  it('preset zero, Viagem: a channel without a niche is named and gets its own link to the assignment', () => {
    const o = OBS.zero, y = you('zero', 'viagem')
    expect(y.empty!.title).toBe('Nenhum canal seu está em Viagem')
    expect(y.empty!.text).toBe('Você tem 2 canais: 1 de IA (Thiago testa IA) e 1 sem nicho (Mochila Leve). Esta comparação usa só os seus canais do nicho. Canal sem nicho não entra em nenhuma: escolha o nicho dele na aba Canais, na linha do canal.')
    expect(y.empty!.links).toEqual([
      { text: 'Escolher o nicho de Mochila Leve', href: o.link.canais({ channel: 'mochila-leve' }) },
      { text: 'Ver seus canais', href: o.link.canais({}) },
    ])
  })

  it('preset mix, Viagem: the channel without a niche stays out of the table, with a note and one link', () => {
    const y = you('mix', 'viagem')
    expect(y.rows.map(r => r.name)).toEqual(['Thiago na Estrada', 'tnFigueiredo', 'tnFigueiredo EN'])
    expect(y.noneNote!.text).toBe('Mochila Leve está sem nicho e fica fora desta comparação.')
    expect(y.noneNote!.links).toEqual([{ text: 'Escolher o nicho de Mochila Leve', href: OBS.mix.link.canais({ channel: 'mochila-leve' }) }])
  })

  it('preset 5, Viagem, Shorts: a channel with no Short keeps its row, with the reason and no verdict; order is R73', () => {
    const o = OBS['5'], y = you('5', 'viagem', 'short')
    expect(y.rows.map(r => r.id)).toEqual(o.ownChannels('viagem').map(c => c.id))
    expect(y.rows).toHaveLength(5)
    const m = rowOf(y, 'Mochila Leve')
    expect(m.cells).toBeNull()
    expect(m.emptyText).toBe('Sem Shorts nas últimas 13 semanas: não há o que comparar. A linha se preenche a partir do primeiro vídeo.')
    expect(m.sub.startsWith('nenhum Short em 13 semanas · ')).toBe(true)
    // the engine's "▼ 0,0× a mediana" for a channel with no video never reaches the view
    expect(JSON.stringify(m)).not.toMatch(/a mediana|▼|▲|0,0/)
    y.rows.filter(r => r !== m).forEach(r => expect(r.cells).toHaveLength(4))
  })

  it('no own channel at all: the connected-channel empty state, no links', () => {
    const ds = structuredClone(DS['2']); const own = new Set(ds.channels.filter(c => c.own).map(c => c.id))
    ds.channels = ds.channels.filter(c => !c.own); ds.videos = ds.videos.filter(v => !own.has(v.ch))
    const o = createObservatory(ds)
    for (const n of ['viagem', 'ia'] as const) {
      const y = buildInsightsView(o, { niche: n }).youInNiche!
      expect(y.empty).toEqual({ title: 'Nenhum canal seu conectado', text: 'Sem um canal seu no Observatório não há o que comparar com o nicho.', links: [] })
      expect(y.meta).toBe('mesmo formato')
      expect(y.rows).toEqual([]); expect(y.ref).toBeNull(); expect(y.foot).toBeNull(); expect(y.noneNote).toBeNull()
    }
    const s = ownScope(o, 'viagem')
    expect(s).toEqual({ all: [], mine: [], none: [] })
    expect(whereOwns(o, 'viagem', s)).toBe('')
    expect(assignLinks(o, s)).toEqual([{ text: 'Ver seus canais', href: o.link.canais({}) }])
  })

  it('foot (preset 2, Viagem): the rule, the sync text once, and relative metrics only', () => {
    const o = OBS['2'], y = you('2', 'viagem')
    expect(y.foot!.startsWith('Cada linha é um canal seu de Viagem; a linha Nicho é a referência, igual para todos. ▲/▼ só fora de ±15% da mediana; com menos de 10 vídeos, “pouco para concluir”; sem vídeos com base de comparação, “base fraca”. ')).toBe(true)
    expect(y.foot).toMatch(/Só métricas relativas: .+ tem .+ inscritos\.$/)
    const sync = [...new Set(o.ownNicheStats('viagem', 'long', ['tnfigueiredo', 'tnfigueiredo-en']).owns.map(r => r.syncText))]
    for (const t of sync) { const T = t.charAt(0).toUpperCase() + t.slice(1); expect(y.foot!.split(T)).toHaveLength(2) }
  })

  it('R78: a niche with own channels and no competitor says so, with the link to the niche editor; no table, no "0 concorrentes"', () => {
    const o = createObservatory(withoutCompetitors(DS['2'], 'viagem'))
    const y = buildInsightsView(o, { niche: 'viagem' }).youInNiche!
    expect(y.noRef).toEqual(NO_REF(o, 'Viagem'))
    expect(y.empty).toBeNull()
    expect(y.meta).toBe('2 canais seus de Viagem, mesmo formato')
    expect(y.rows).toEqual([]); expect(y.ref).toBeNull(); expect(y.cols).toEqual([]); expect(y.noneNote).toBeNull(); expect(y.foot).toBeNull()
    expect(JSON.stringify(y)).not.toMatch(/0 concorrentes|—|sem dado|NaN|Infinity|undefined|null%/)
    // with competitors there is a reference: no such block
    expect(you('2', 'viagem').noRef).toBeNull()
  })

  it('R78: no competitor AND no own channel in the niche → the own-channel message stands', () => {
    const y = buildInsightsView(createObservatory(withoutCompetitors(DS['2'], 'ia')), { niche: 'ia' }).youInNiche!
    expect(y.empty!.title).toBe('Nenhum canal seu está em IA')
    expect(y.noRef).toBeNull()
    const ds = withoutCompetitors(DS['2'], 'viagem'); ds.channels = []; ds.videos = []
    const z = buildInsightsView(createObservatory(ds), { niche: 'viagem' }).youInNiche!
    expect(z.empty!.title).toBe('Nenhum canal seu conectado')
    expect(z.noRef).toBeNull()
  })

  it('uuid ids: same rows, links carry the uuid (no literal id anywhere)', () => {
    const MAP: Record<string, string> = { tnfigueiredo: '0b6f7c0e-5f7e-4d7a-9a55-2f5f5a1d9c11', 'tnfigueiredo-en': '7d1e2a44-91c3-4b0f-8e2a-6c1f0d3b5a22' }
    const ds = structuredClone(DS['2'])
    ds.channels = ds.channels.map(c => MAP[c.id] ? { ...c, id: MAP[c.id]! } : c)
    ds.videos = ds.videos.map(v => MAP[v.ch] ? { ...v, ch: MAP[v.ch]! } : v)
    const o = createObservatory(ds), y = buildInsightsView(o, { niche: 'viagem' }).youInNiche!, base = you('2', 'viagem')
    expect(y.rows.map(r => r.id)).toEqual([MAP.tnfigueiredo, MAP['tnfigueiredo-en']])
    expect(y.rows.map(r => r.href)).toEqual([o.link.canais({ channel: MAP.tnfigueiredo! }), o.link.canais({ channel: MAP['tnfigueiredo-en']! })])
    expect(y.rows.map(r => ({ name: r.name, sub: r.sub, cells: r.cells, lang: r.lang }))).toEqual(base.rows.map(r => ({ name: r.name, sub: r.sub, cells: r.cells, lang: r.lang })))
    expect(y.ref).toEqual(base.ref)
  })

  it('ownScope / whereOwns / assignLinks (reused by Lacunas)', () => {
    const o = OBS.mix, s = ownScope(o, 'ia')
    expect(s.all.map(c => c.id)).toEqual(o.ownChannels().map(c => c.id))
    expect(s.mine.map(c => c.name)).toEqual(['Thiago testa IA'])
    expect(s.none.map(c => c.name)).toEqual(['Mochila Leve'])
    expect(whereOwns(o, 'ia', s)).toBe('Você tem 5 canais: 3 de Viagem (Thiago na Estrada, tnFigueiredo e tnFigueiredo EN) e 1 sem nicho (Mochila Leve).')
    expect(whereOwns(OBS['1'], 'viagem', ownScope(OBS['1'], 'viagem'))).toBe('')
    expect(assignLinks(o, s).map(l => l.text)).toEqual(['Escolher o nicho de Mochila Leve', 'Ver seus canais'])
  })
})

// Task 9 (N canais próprios): Lacunas is one list — each theme says in how many and in which own channels of the niche it is missing.
describe('Insights view model — Lacunas with N own channels', () => {
  type P = typeof PRESETS[number]
  const gaps = (p: P, niche: 'viagem' | 'ia', fmt?: string): GapsSection => buildInsightsView(OBS[p], { niche, fmt }).gaps!
  const gapsOf = (ds: Dataset, niche: 'viagem' | 'ia' = 'viagem', fmt?: string): GapsSection => buildInsightsView(createObservatory(ds), { niche, fmt }).gaps!
  const subOf = (g: GapsSection) => g.rows.map(r => textOf(r.sub))
  /** Every own channel of Viagem gets one long video of every theme that ≥ 2 competitors cover. */
  const coverAll = (p: P): Dataset => {
    const ds = structuredClone(DS[p]), o = OBS[p]
    const themes = o.themeTrend('viagem', 'long').filter(t => t.channels.length >= 2).map(t => t.theme)
    for (const c of o.ownChannels('viagem')) {
      const tpl = ds.videos.find(v => v.ch === c.id && v.fmt === 'long' && v.ageDays <= 90)!
      themes.forEach((t, i) => ds.videos.push({ ...structuredClone(tpl), id: `${c.id}-cover-${i}`, theme: t }))
    }
    return ds
  }

  it('preset 2, Viagem, longos: missing to both, missing to one, and who already has it', () => {
    const g = gaps('2', 'viagem')
    expect(g.empty).toBeNull(); expect(g.noRef).toBeNull()
    expect(g.meta).toBe('temas dos concorrentes que faltam a algum canal seu de Viagem')
    expect(g.rows.map(r => r.theme)).toEqual(['comida-de-rua', 'custo-de-viagem'])
    expect(g.rows[0]!.lack).toBe('falta nos seus 2 canais: tnFigueiredo e tnFigueiredo EN')
    expect(g.rows[0]!.have).toBeNull()
    expect(g.rows[0]!.lacks).toEqual([{ id: 'tnfigueiredo', name: 'tnFigueiredo' }, { id: 'tnfigueiredo-en', name: 'tnFigueiredo EN' }])
    expect(g.rows[1]!.lack).toBe('falta em 1 dos seus 2 canais: tnFigueiredo EN')
    expect(g.rows[1]!.have).toBe('já tem: tnFigueiredo (2)')
    expect(g.rows[1]!.lacks).toEqual([{ id: 'tnfigueiredo-en', name: 'tnFigueiredo EN' }])
    expect(g.foot!.startsWith('Entram os temas que faltam a pelo menos um dos seus 2 canais de Viagem com longos em 90 dias; os que todos já cobrem ficam de fora (3). Por tema, não por tag:')).toBe(true)
    expect(g.foot).toContain('tnFigueiredo: 8 longos, 4 temas; tnFigueiredo EN: 3 longos, 3 temas.')
    expect(g.notes).toEqual([]); expect(g.none).toBeNull()
    // "Criar ideia" is FU-16: nothing in the card promises it
    expect(JSON.stringify(g)).not.toMatch(/ideia/i)
  })

  it('preset 1, Viagem: one own channel reads in the singular, with no "você: nenhum"', () => {
    const g = gaps('1', 'viagem')
    expect(g.meta).toBe('temas dos concorrentes sem vídeo seu')
    expect(g.rows.find(r => r.theme === 'comida-de-rua')!.lack).toBe('tnFigueiredo: nenhum vídeo')
    expect(g.rows.every(r => r.have === null && r.lacks.length === 1)).toBe(true)
    expect(g.foot!.startsWith('Por tema, não por tag:')).toBe(true)
    expect(subOf(g).join('|')).not.toContain('você: nenhum')
  })

  it('preset 2, IA: no own channel in the niche — where they are, and the link to Canais', () => {
    const g = gaps('2', 'ia')
    expect(g.empty!.title).toBe('Nenhum canal seu está em IA')
    expect(g.empty!.text).toBe('Lacunas cruzam os temas dos seus canais do nicho com os dos concorrentes. Você tem 2 canais: 2 de Viagem (tnFigueiredo e tnFigueiredo EN).')
    expect(g.empty!.links).toEqual([{ text: 'Ver seus canais', href: OBS['2'].link.canais({}) }])
    expect(g.rows).toEqual([]); expect(g.notes).toEqual([]); expect(g.foot).toBeNull(); expect(g.none).toBeNull()
  })

  it('preset zero, Viagem: the channel without a niche gets its link in the empty state', () => {
    const g = gaps('zero', 'viagem')
    expect(g.empty!.title).toBe('Nenhum canal seu está em Viagem')
    expect(g.empty!.text).toBe('Lacunas cruzam os temas dos seus canais do nicho com os dos concorrentes. Você tem 2 canais: 1 de IA (Thiago testa IA) e 1 sem nicho (Mochila Leve).')
    expect(g.empty!.links!.map(l => l.text)).toEqual(['Escolher o nicho de Mochila Leve', 'Ver seus canais'])
  })

  it('preset 5, Viagem, Shorts: the channel with no Short stays out of the count, and the foot counts the other four', () => {
    const g = gaps('5', 'viagem', 'short')
    expect(g.empty).toBeNull()
    expect(g.notes.map(n => n.text)).toContain('Mochila Leve fica fora da conta: sem Shorts nos últimos 90 dias.')
    expect(g.foot).toMatch(/^Entram os temas que faltam a pelo menos um dos seus 4 canais de Viagem com Shorts em 90 dias/)
    expect(JSON.stringify(g.rows)).not.toContain('Mochila Leve')
  })

  it('preset 5, Viagem, longos: every row agrees with how many channels lack the theme; order is by channels lacking, then videos', () => {
    const o = OBS['5'], g = gaps('5', 'viagem'), N = 5
    expect(g.rows.length).toBeGreaterThan(0)
    const trend = o.themeTrend('viagem', 'long'), now = (t: string) => trend.find(x => x.theme === t)!.now
    const names = o.ownChannels('viagem').map(c => c.name)
    for (const r of g.rows) {
      const k = r.lacks.length
      expect(k).toBeGreaterThan(0)
      // the names come in the R73 order
      expect(r.lacks.map(l => l.name)).toEqual(names.filter(n => r.lacks.some(l => l.name === n)))
      expect(r.lack.startsWith(k === N ? 'falta em todos os seus 5 canais: ' : `falta em ${k} dos seus 5 canais: `)).toBe(true)
      for (const l of r.lacks) expect(r.lack).toContain(l.name)
      if (k === N) expect(r.have).toBeNull()
      else { expect(r.have).toMatch(/^já tem: .+ \(\d+\)/); for (const l of r.lacks) expect(r.have).not.toContain(l.name + ' (') }
    }
    const key = g.rows.map(r => [r.lacks.length, now(r.theme)] as const)
    expect(key).toEqual([...key].sort((a, b) => b[0] - a[0] || b[1] - a[1]))
    expect(g.foot).toMatch(/^Entram os temas que faltam a pelo menos um dos seus 5 canais de Viagem com longos em 90 dias/)
  })

  it('a theme missing to several but not all: "falta em 2 dos seus 3 canais", and the one that has it is named with its count', () => {
    // three own channels with themes; only the first keeps "custo-de-viagem"
    const ds = structuredClone(DS.mix), ids = OBS.mix.ownChannels('viagem').map(c => c.id)
    expect(ids).toHaveLength(3)
    for (const v of ds.videos) if (ids.includes(v.ch) && v.fmt === 'long' && v.ageDays <= 90) v.theme = v.ch === ids[0] ? 'custo-de-viagem' : 'rotina-nomade'
    const g = gapsOf(ds), names = OBS.mix.ownChannels('viagem').map(c => c.name)
    const r = g.rows.find(x => x.theme === 'custo-de-viagem')!
    expect(r.lack).toBe(`falta em 2 dos seus 3 canais: ${names[1]} e ${names[2]}`)
    expect(r.have).toMatch(new RegExp('^já tem: ' + names[0] + ' \\(\\d+\\)$'))
    const all = g.rows.find(x => x.theme === 'comida-de-rua')!
    expect(all.lack).toBe(`falta em todos os seus 3 canais: ${names[0]}, ${names[1]} e ${names[2]}`)
    // missing to more channels comes first
    expect(g.rows.indexOf(all)).toBeLessThan(g.rows.indexOf(r))
  })

  it('preset mix, Viagem: the channel without a niche stays out, with a note and its link', () => {
    const g = gaps('mix', 'viagem')
    expect(g.notes).toContainEqual({ text: 'Mochila Leve está sem nicho e fica fora.', links: [{ text: 'Escolher o nicho de Mochila Leve', href: OBS.mix.link.canais({ channel: 'mochila-leve' }) }] })
    expect(JSON.stringify(g.rows)).not.toContain('Mochila Leve')
  })

  it('themes every own channel covers stay out of the list: "Seus canais já têm…" / "<canal> já tem…"', () => {
    const g2 = gapsOf(coverAll('2'))
    expect(g2.empty).toBeNull(); expect(g2.rows).toEqual([])
    expect(g2.none).toBe('Seus canais já têm vídeo em todos os temas que aparecem em 2 canais ou mais.')
    expect(g2.foot).toMatch(/; os que todos já cobrem ficam de fora \(5\)\. /)
    const g1 = gapsOf(coverAll('1'))
    expect(g1.rows).toEqual([])
    expect(g1.none).toBe('tnFigueiredo já tem vídeo em todos os temas que aparecem em 2 canais ou mais.')
  })

  it('R49 per channel: a channel whose videos have no theme leaves the count, with a note; the rest is computed without it', () => {
    const ds = structuredClone(DS['2'])
    for (const v of ds.videos) if (v.ch === 'tnfigueiredo-en') v.theme = null
    const g = gapsOf(ds)
    expect(g.empty).toBeNull()
    expect(g.notes).toEqual([{ text: 'tnFigueiredo EN fica fora da conta: a forja ainda não deu tema aos vídeos dele.', links: [] }])
    expect(g.rows.map(r => r.theme)).toEqual(['comida-de-rua'])
    expect(g.rows[0]!.lack).toBe('tnFigueiredo: nenhum vídeo')
    expect(g.rows[0]!.lacks).toEqual([{ id: 'tnfigueiredo', name: 'tnFigueiredo' }])
    expect(g.foot!.startsWith('Por tema, não por tag:')).toBe(true)
    expect(g.foot).not.toContain('tnFigueiredo EN')
    // several channels without theme: plural
    const d5 = structuredClone(DS['5']), ids = OBS['5'].ownChannels('viagem').map(c => c.id)
    for (const v of d5.videos) if (v.ch === ids[1] || v.ch === ids[2]) v.theme = null
    const n5 = gapsOf(d5).notes.map(n => n.text).find(t => t.includes('a forja ainda não deu tema'))!
    expect(n5).toMatch(/^.+ e .+ ficam fora da conta: a forja ainda não deu tema aos vídeos deles\.$/)
  })

  it('R49: no own channel has a themed video → the refusal stands, adding up the videos of every channel', () => {
    const ds = structuredClone(DS['2'])
    for (const v of ds.videos) if (v.ch === 'tnfigueiredo' || v.ch === 'tnfigueiredo-en') v.theme = null
    const g = gapsOf(ds)
    expect(g.empty).toEqual({ title: 'A forja ainda não deu tema aos seus vídeos', text: 'Lacunas cruzam os temas dos seus vídeos com os dos concorrentes. Nenhum dos seus 11 longos dos últimos 90 dias tem tema, então não dá para dizer qual tema falta.' })
    expect(g.rows).toEqual([]); expect(g.notes).toEqual([]); expect(g.foot).toBeNull()
  })

  it('no own video in the format in any channel of the niche → the "Sem longos seus" refusal', () => {
    const ds = structuredClone(DS['2'])
    ds.videos = ds.videos.filter(v => v.ch !== 'tnfigueiredo' && v.ch !== 'tnfigueiredo-en')
    const g = gapsOf(ds)
    expect(g.empty).toEqual({ title: 'Sem longos seus de Viagem para comparar', text: 'Lacunas cruzam os temas dos vídeos dos seus canais com os dos concorrentes. Sem vídeo seu no recorte, todo tema deles viraria lacuna, e a lista não diria nada.' })
  })

  it('no own channel at all: empty, without throwing and without links', () => {
    const ds = structuredClone(DS['2']); const own = new Set(ds.channels.filter(c => c.own).map(c => c.id))
    ds.channels = ds.channels.filter(c => !c.own); ds.videos = ds.videos.filter(v => !own.has(v.ch))
    const g = gapsOf(ds)
    expect(g.empty).toEqual({ title: 'Nenhum canal seu está em Viagem', text: 'Lacunas cruzam os temas dos seus canais do nicho com os dos concorrentes.', links: [] })
    expect(g.meta).toBe('temas dos concorrentes sem vídeo seu')
    expect(JSON.stringify(g)).not.toMatch(/NaN|Infinity|undefined/)
  })

  it('R78: own channels in the niche and no competitor → the sentence and the link, instead of the list', () => {
    const o = createObservatory(withoutCompetitors(DS['2'], 'viagem'))
    const g = buildInsightsView(o, { niche: 'viagem' }).gaps!
    expect(g.noRef).toEqual(NO_REF(o, 'Viagem'))
    expect(g.empty).toBeNull(); expect(g.rows).toEqual([]); expect(g.none).toBeNull(); expect(g.notes).toEqual([]); expect(g.foot).toBeNull()
    // production today: the competitors exist, but none has a niche yet
    const ds = structuredClone(DS['2'])
    for (const c of ds.channels) if (!c.own && c.niche === 'viagem') c.niche = null
    ds.readings = []; ds.requests = []
    const o2 = createObservatory(ds), v2 = buildInsightsView(o2, { niche: 'viagem' })
    expect(v2.gaps!.noRef).toEqual(NO_REF(o2, 'Viagem'))
    expect(v2.youInNiche!.noRef).toEqual(NO_REF(o2, 'Viagem'))
    expect(JSON.stringify([v2.gaps, v2.youInNiche])).not.toMatch(/0 concorrentes|—|sem dado/)
  })

  it('R78: no competitor AND no own channel in the niche → the own-channel message stands', () => {
    const g = buildInsightsView(createObservatory(withoutCompetitors(DS['2'], 'ia')), { niche: 'ia' }).gaps!
    expect(g.empty!.title).toBe('Nenhum canal seu está em IA')
    expect(g.noRef).toBeNull()
  })

  it('every preset, niche and format: no junk, no "ideia", and ownCoverage is always asked per channel', () => {
    for (const p of PRESETS) for (const n of ['viagem', 'ia'] as const) for (const f of ['long', 'short']) {
      const g = gaps(p, n, f)
      expect(JSON.stringify(g)).not.toMatch(/NaN|Infinity|undefined|null%|ideia|você: nenhum/)
      expect(Boolean(g.empty) && g.rows.length > 0).toBe(false)
      for (const r of g.rows) expect(r.lacks.length).toBeGreaterThan(0)
    }
    const src = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/app/cms/(authed)/youtube/competitors/_insights/view-model.ts'), 'utf8')
    expect(src).not.toMatch(/ownCoverage\(\s*fmt\s*\)/)
    expect(src.match(/ownCoverage\(/g)!.length).toBeGreaterThan(0)
  })
})
