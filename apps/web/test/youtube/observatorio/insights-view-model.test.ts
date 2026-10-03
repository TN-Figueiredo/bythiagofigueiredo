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
      expect(textOf(f.rows[0]!.sentence)).toBe('Hoje: mediana 1,2× com a fórmula, contra 0,8× sem (n = 34 vs 115); 1 outlier com essa fórmula: Luke Damant.')
      expect(f.rows[0]!.link.href).toContain('/cms/youtube/competitors/outliers?')
      expect(f.rows[0]!.link.href).toContain('formula=preco')
      expect(f.rows[0]!.link.href).toContain('min=0')
      expect(f.meta).toBe('158 longos até 24/10, 6 meses')
      expect(f.empty).toBeNull()
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

  it('an empty dataset (no videos): every section has its empty text and no NaN', () => {
    const ds = clone(); ds.videos = []
    const v: InsightsView = view('viagem', 'long', createObservatory(ds))
    expect(v.formulas!.empty).not.toBeNull()
    expect(v.formulas!.rows).toEqual([])
    expect(v.cadence!.empty).toBe('Nenhum longo dos concorrentes de Viagem nos últimos 90 dias.')
    expect(v.heatmap!.empty).toBe('Nenhum longo dos concorrentes de Viagem publicado nos últimos 90 dias.')
    expect(v.themes!.empty).not.toBeNull()
    expect(v.youInNiche!.empty).not.toBeNull()
    expect(v.gaps!.empty).not.toBeNull()
    const json = JSON.stringify(v)
    expect(json).not.toMatch(/NaN|Infinity|undefined|null%/)
  })
})
