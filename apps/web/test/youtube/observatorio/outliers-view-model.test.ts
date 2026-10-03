// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory, type Observatory } from '@/lib/youtube/observatorio'
import { buildOutliersView, type OutliersView } from '@/app/cms/(authed)/youtube/competitors/_outliers/view-model'

const obs = createObservatory(datasetFromOracle(loadOracle()))

/** The params a screen href carries (what the page would receive after navigating to it). */
const paramsOf = (href: string): Record<string, string> => Object.fromEntries(new URLSearchParams(href.split('?')[1] ?? ''))
const nonWeak = (v: OutliersView) => v.groups.flatMap(g => g.cards).filter(c => !c.weak)

describe('Outliers view model', () => {
  it('default = longs, up to 90 days, count 11 (the tab)', () => {
    const v = buildOutliersView(obs, {})
    expect(nonWeak(v).length).toBe(11)
    expect(v.count).toBe(obs.tabCounts('todos').out)
  })
  it('order = engine orderedGroups (phases in PHASES order)', () => {
    const v = buildOutliersView(obs, {})
    expect(v.groups.flatMap(g => g.cards.map(c => c.id))).toEqual(obs.outliers({ includeWeak: true }).orderedIds('mult'))
    const order = obs.PHASES.map(p => p.id as string)
    const idx = v.groups.map(g => order.indexOf(g.id))
    expect(idx.every(i => i >= 0)).toBe(true)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
    expect(v.groups.map(g => g.label)).toEqual(['Estourando agora', 'Recentes', 'Sem ritmo medido'])
  })
  it('invalid params become removable chips and are not applied', () => {
    const v = buildOutliersView(obs, { ages: '99-100', formula: 'nope' })
    expect(v.chips.filter(c => c.invalid).map(c => c.key).sort()).toEqual(['ages', 'formula'])
    // not applied: same result as no params
    expect(v.groups.flatMap(g => g.cards.map(c => c.id))).toEqual(buildOutliersView(obs, {}).groups.flatMap(g => g.cards.map(c => c.id)))
    const f = v.chips.find(c => c.key === 'formula')!
    expect(f.label).toBe('Fórmula “nope” não reconhecida, ignorada')
    // removing one chip keeps the other one
    const after = buildOutliersView(obs, paramsOf(f.removeHref))
    expect(after.chips.filter(c => c.invalid).map(c => c.label)).toEqual(['Idade “99-100” não reconhecida, ignorada'])
  })
  it('empty-state buttons carry the destination N', () => {
    const empty = buildOutliersView(obs, { ages: '181-365', niche: 'ia', fmt: 'short' })
    expect(empty.empty).not.toBeNull()
    for (const a of empty.empty?.actions ?? []) expect(a.n).toBeGreaterThan(0)
  })
  it('every empty-state N equals the count the destination shows', () => {
    const cases: Array<Record<string, string>> = [
      { ages: '181-365', niche: 'ia', fmt: 'short' },
      { age: '365+' },
      { age: '31-90', niche: 'ia', fmt: 'short' },
      { topic: 'comida-de-rua', niche: 'viagem', age: '0-30' },
    ]
    let checked = 0
    for (const p of cases) {
      const v = buildOutliersView(obs, p)
      expect(v.empty, JSON.stringify(p)).not.toBeNull()
      for (const a of v.empty!.actions) {
        if (a.dest !== 'outliers') continue
        // the niche is persisted server-side (resolveNiche): an href only carries it when it changes it
        const dest = { ...(p.niche ? { niche: p.niche } : {}), ...paramsOf(a.href) }
        expect(buildOutliersView(obs, dest).count, a.label).toBe(a.n)
        // CONVENCOES plural: N = 1 reads "Ver o outlier" / "Ver o vídeo"
        if (a.n === 1 && /^Ver o (outlier|vídeo)/.test(a.label)) continue
        expect(a.label).toContain(String(a.n))
        checked++
      }
    }
    expect(checked).toBeGreaterThan(3)
  })
  it('edge-of-band label says the age at the reading', () => {
    const v = buildOutliersView(obs, { ages: 'all' })
    const edge = v.groups.flatMap(g => g.cards).find(c => /este tinha/.test(c.multLabel))
    if (edge) expect(edge.multLabel).toMatch(/no registro de \d\d\/\d\d \d\d:\d\d \(este tinha \d+ dias?; n = \d+\)/)
  })

  describe('age windows (R15: age=, legacy ages= accepted)', () => {
    it('default selects the shortcut "Até 90 dias" and the first two exclusive windows', () => {
      const v = buildOutliersView(obs, {})
      expect(v.query.ages).toEqual(['0-30', '31-90'])
      expect(v.shortcut).toMatchObject({ label: 'Até 90 dias', selected: true, count: 11 })
      expect(v.timeline.map(t => [t.id, t.label, t.selected])).toEqual([
        ['0-30', '0–30 d', true], ['31-90', '31–90 d', true], ['91-180', '91–180 d', false], ['181-365', '181–365 d', false], ['365+', 'Mais de 1 ano', false],
      ])
      expect(v.timeline.map(t => t.count)).toEqual(obs.OUT_WINDOWS.map(w => obs.outliers({ ages: [w.id] }).count))
      expect(v.allCount).toBe(obs.outliers({ ages: 'all' }).count)
    })
    it('age= is parsed (comma list or all); ages= is an alias', () => {
      expect(buildOutliersView(obs, { age: '91-180' }).query.ages).toEqual(['91-180'])
      expect(buildOutliersView(obs, { age: '0-30,365+' }).query.ages).toEqual(['0-30', '365+'])
      expect(buildOutliersView(obs, { age: 'all' }).query.ages).toBe('all')
      expect(buildOutliersView(obs, { ages: 'all' }).query.ages).toBe('all')
      expect(buildOutliersView(obs, { age: 'all' }).shortcut.selected).toBe(false)
      expect(buildOutliersView(obs, { age: 'all' }).allSelected).toBe(true)
    })
    it('window hrefs toggle that window and emit age=', () => {
      const v = buildOutliersView(obs, {})
      const w3 = v.timeline.find(t => t.id === '91-180')!
      expect(w3.href).toContain('age=0-30%2C31-90%2C91-180')
      expect(buildOutliersView(obs, paramsOf(w3.href)).query.ages).toEqual(['0-30', '31-90', '91-180'])
      const w1 = v.timeline.find(t => t.id === '0-30')!
      expect(buildOutliersView(obs, paramsOf(w1.href)).query.ages).toEqual(['31-90'])
      expect(buildOutliersView(obs, paramsOf(v.allHref)).query.ages).toBe('all')
    })
  })

  describe('count and weak base', () => {
    it('the summary counts only non-weak outliers; weak cards are flagged and only shown with includeWeak', () => {
      const v = buildOutliersView(obs, { age: 'all' })
      const R = obs.outliers({ ages: 'all' }), Rw = obs.outliers({ ages: 'all', includeWeak: true })
      expect(v.count).toBe(R.count)
      expect(v.groups.flatMap(g => g.cards).length).toBe(Rw.countWithWeak)
      for (const c of v.groups.flatMap(g => g.cards)) expect(c.weak).toBe(Rw.items.find(i => i.id === c.id)!.weak)
      expect(v.baseText.startsWith(R.count + ' outliers entre ' + R.analyzed + ' vídeos longos de qualquer idade')).toBe(true)
    })
    it('the summary sentence of the default view', () => {
      expect(buildOutliersView(obs, {}).baseText).toBe('11 outliers entre 303 vídeos longos com até 90 dias; agrupados por fase.')
    })
  })

  describe('cards', () => {
    it('the first card of a group with 2+ cards is the main one; Novos/Sem ritmo never have one', () => {
      const v = buildOutliersView(obs, {})
      for (const g of v.groups) {
        expect(g.cards.filter(c => c.main).length).toBe(g.cards.length > 1 && !['novos', 'sem-ritmo'].includes(g.id) ? 1 : 0)
        if (g.cards.some(c => c.main)) expect(g.cards[0]!.main).toBe(true)
      }
    })
    it('mult, tier and label come from the engine multiplier', () => {
      const c = buildOutliersView(obs, {}).groups[0]!.cards[0]!
      const m = obs.multiplier(c.id)
      expect(c.mult).toBe(obs.fmt.mult(m.value))
      expect(c.tier).toBe(obs.tierOf(m.value))
      expect(c.method).toBe(m.method)
      expect(c.multLabel).toBe('vs vídeos do canal com 8–30 dias (n = 14)')
      expect(c.historyHref.startsWith(obs.link.historico(c.id))).toBe(true)
      expect(c.historyHref).toContain('from=outliers')
      expect(c.url).toBe(obs.video(c.id)!.url)
    })
    it('a channel with a stale sync loses the tier colour and says why', () => {
      const c = buildOutliersView(obs, {}).groups.flatMap(g => g.cards).find(x => x.id === 'paddy-bkk-hotel')!
      expect(c.tier).toBeNull()
      expect(c.stale).toBe(true)
      expect(c.vpdText).toBe('sem views/dia recentes')
    })
  })

  describe('min=0 (all videos with the formula/theme)', () => {
    it('lists every video ≥ 0×, splits above/below 2× and drops the tier colour below 2×', () => {
      const v = buildOutliersView(obs, { formula: 'preco', min: '0' })
      expect(v.groups.map(g => g.id)).toEqual(expect.arrayContaining(['below']))
      const below = v.groups.find(g => g.id === 'below')!
      expect(below.label).toMatch(/^Abaixo de 2,0× \(\d+\)$/)
      for (const c of below.cards) { expect(c.tier).toBeNull(); expect(c.multLabel.startsWith('a mediana do canal')).toBe(true) }
      expect(v.chips.find(c => c.key === 'min')!.label).toBe('Todos os vídeos')
      expect(v.chips.find(c => c.key === 'formula')!.label).toBe('Fórmula “Preço no título”')
      expect(v.groups.flatMap(g => g.cards).some(c => c.main)).toBe(false)
    })
  })

  describe('link filters', () => {
    it('topic= and a known theme slug filter; theme=light|dark is a colour and is ignored', () => {
      expect(buildOutliersView(obs, { topic: 'comida-de-rua' }).query.topic).toBe('comida-de-rua')
      expect(buildOutliersView(obs, { theme: 'comida-de-rua' }).query.topic).toBe('comida-de-rua')
      const light = buildOutliersView(obs, { theme: 'light' })
      expect(light.query.topic).toBeNull()
      expect(light.chips).toEqual([])
    })
    it('link chips remove their own parameter', () => {
      const v = buildOutliersView(obs, { topic: 'comida-de-rua', niche: 'viagem', age: 'all' })
      const t = v.chips.find(c => c.key === 'topic')!
      expect(t.invalid).toBe(false)
      expect(t.label).toBe('Tema “Comida de rua barata”')
      expect(paramsOf(t.removeHref).topic).toBeUndefined()
      expect(paramsOf(t.removeHref).age).toBe('all')
      expect(v.chipsLead).toBe('Filtros do link:')
    })
    it('the own channel is not an outlier source: a chip says so and links to Canais', () => {
      const own = obs.channels.find(c => c.own)!
      const v = buildOutliersView(obs, { channel: own.id })
      const c = v.chips.find(x => x.kind === 'own')!
      expect(c.label).toBe('Seu canal não entra em Outliers:')
      expect(c.link).toEqual({ label: 'veja em Canais', href: obs.link.canais({ channel: own.id }) })
    })
    it('an unknown reading is a removable chip; from= names the origin', () => {
      const v = buildOutliersView(obs, { reading: 'nao-existe', from: 'insights' })
      expect(v.chips.find(c => c.key === 'reading')).toMatchObject({ invalid: true, label: 'Leitura “nao-existe” não reconhecida, ignorada' })
      expect(v.chipsLead).toBe('Vindo de Insights:')
    })
    it('a malformed asof is invalid; a date with no outliers reading says it shows today', () => {
      expect(buildOutliersView(obs, { asof: 'ontem' }).chips.find(c => c.key === 'asof')).toMatchObject({ invalid: true })
      const none = buildOutliersView(obs, { asof: '2026-01-02', niche: 'ia' }).chips.find(c => c.key === 'asof')!
      expect(none.label).toBe('Sem leitura de outliers de IA em 02/01: mostrando os dados de hoje')
    })
  })

  describe('reading scope (?reading= / ?asof=)', () => {
    // The engine's readingScope (Task 32) fills OutliersResult.scope; a stand-in engine here gives it the documented shape.
    const reading = obs.forja.readings.find(r => r.type === 'padroes-titulo' && r.niche === 'viagem')!
    const withScope = (base: Observatory, nThen: number): Observatory => ({
      ...base,
      outliers: q => {
        const r = base.outliers({ ...q, reading: null })
        if (q?.reading !== reading.id) return q?.reading ? { ...r, readingInvalid: true } : r
        return { ...r, readingInvalid: false, scope: { readingId: reading.id, niche: 'viagem', fmt: 'long', channels: obs.channels.filter(c => !c.own && c.niche === 'viagem').map(c => c.id), windowDays: 180, maxAge: 180, ages: ['0-30', '31-90', '91-180'], asof: '2026-10-20', asOf: reading.generatedAt, nThen } }
      },
    })
    it('?asof= resolves the reading of that day and shows "Link da leitura de DD/MM: ela via N; hoje são M"', () => {
      const e = withScope(obs, 7)
      const v = buildOutliersView(e, { niche: 'viagem', asof: obs.date.dmy(reading.generatedAt).split('/').reverse().join('-'), formula: 'preco', min: '0' })
      const M = e.outliers({ niche: 'viagem', fmt: 'long', min: 0, formula: 'preco', reading: reading.id }).count
      expect(v.asofNote).toBe('Link da leitura de ' + obs.date.dm(reading.generatedAt) + ': ela via 7; hoje ' + (M === 1 ? 'é' : 'são') + ' ' + M)
      const chip = v.chips.find(c => c.kind === 'asof')!
      expect(chip.label).toBe(v.asofNote)
      expect(paramsOf(chip.removeHref).reading).toBeUndefined()
      expect(v.shortcut.disabled).toBe(true)
      expect(v.allLabel).toBe('Leitura')
    })
    it('?reading= with the same id gives the same note', () => {
      const v = buildOutliersView(withScope(obs, 3), { reading: reading.id })
      expect(v.asofNote).toMatch(/^Link da leitura de \d\d\/\d\d: ela via 3; hoje (é|são) \d+$/)
    })
    it('without a resolvable reading the note is null', () => {
      expect(buildOutliersView(obs, {}).asofNote).toBeNull()
    })
  })

  describe('sort and paging', () => {
    it('sort=vpd is one flat group in the engine order', () => {
      const v = buildOutliersView(obs, { sort: 'vpd' })
      expect(v.groups.map(g => g.id)).toEqual(['flat'])
      expect(v.groups[0]!.cards.map(c => c.id)).toEqual(obs.outliers({ includeWeak: true }).orderedIds('vpd'))
      expect(v.groups[0]!.cards.some(c => c.main)).toBe(false)
    })
    it('an invalid sort is a chip and falls back to mult', () => {
      const v = buildOutliersView(obs, { sort: 'zzz' })
      expect(v.query.sort).toBe('mult')
      expect(v.chips.find(c => c.key === 'sort')!.invalid).toBe(true)
    })
  })
})
