// @vitest-environment node
// apps/web/test/youtube/observatorio/canais-view-model.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
const obs = createObservatory(datasetFromOracle(loadOracle()))
describe('Canais view model', () => {
  it('"14 de 75 canais" — own channel not counted', () => expect(buildCanaisView(obs, { niche: 'todos', limit: 75 }).slots.text).toBe('14 de 75 canais'))
  it('never negative slots', () => expect(buildCanaisView(obs, { niche: 'todos', limit: 10 }).slots.free).toBe(0))
  it('link N = destination N (outliers and changes per channel)', () => {
    const v = buildCanaisView(obs, { niche: 'todos', limit: 75 })
    for (const r of v.rows.filter(r => !r.own)) {
      expect(r.outliers.n).toBe(obs.outliers({ channel: r.id, fmt: 'long' }).count)
      expect(r.changes.n).toBe(obs.changesIn({ channel: r.id }).length)
    }
  })
  it('problem rows use problemPhrase verbatim', () => {
    for (const r of buildCanaisView(obs, { niche: 'todos', limit: 75 }).rows) expect(r.sync.phrase).toBe(obs.channel(r.id)!.sync.problemPhrase ?? null)
  })
  it('?filter=problemas keeps only non-ok channels', () => {
    expect(buildCanaisView(obs, { niche: 'todos', limit: 75, filter: 'problemas' }).rows.every(r => r.sync.state !== 'ok')).toBe(true)
  })
  it('stalled channel numbers say "até o registro diário de DD/MM HH:MM"', () => {
    const v = buildCanaisView(obs, { niche: 'todos', limit: 75, channel: 'bald-and-bankrupt' })
    expect(JSON.stringify(v.drawer)).toMatch(/até o registro diário de \d\d\/\d\d \d\d:\d\d/)
  })
  // ---- beyond the brief's oracle checks
  it('full: "14 de 14 canais", the sentence from canais.html, free 0', () => {
    const v = buildCanaisView(obs, { niche: 'todos', limit: 14 })
    expect(v.slots.text).toBe('14 de 14 canais')
    expect(v.slots.fullText).toBe('Sem vagas: 14 de 14 concorrentes. Remova um canal para adicionar outro.')
    expect(buildCanaisView(obs, { niche: 'todos', limit: 75 }).slots.fullText).toBeNull()
  })
  it('own channel first, then Viagem and IA groups; a niche keeps only its group', () => {
    const v = buildCanaisView(obs, { niche: 'todos', limit: 75 })
    expect(v.own.row?.own).toBe(true)
    expect(v.groups.map(g => g.label)).toEqual(['Viagem', 'IA'])
    expect(buildCanaisView(obs, { niche: 'ia', limit: 75 }).groups.map(g => g.label)).toEqual(['IA'])
    expect(v.groups[0]!.flags.map(f => f.text)).toEqual(['1 com sincronização atrasada', '1 buscando vídeos', '1 parado'])
  })
  it('defaults and URL params: scale, fmt, layout, add, filter, drawer tab', () => {
    const d = buildCanaisView(obs, { niche: 'todos', limit: 75 })
    expect([d.scale, d.fmt, d.layout, d.filter, d.addOpen, d.drawer]).toEqual(['per-mil', 'long', 'table', 'todos', false, null])
    const v = buildCanaisView(obs, { niche: 'todos', limit: 75, scale: 'abs', fmt: 'short', layout: 'cards', add: '1', channel: 'matt-wolfe', tab: 'videos' })
    expect([v.scale, v.fmt, v.layout, v.addOpen, v.drawer?.tab]).toEqual(['abs', 'short', 'cards', true, 'videos'])
    expect(buildCanaisView(obs, { niche: 'todos', limit: 75, channel: 'nope' }).drawer).toBeNull()
  })
  it('drawer links: "Ver as N trocas em Mudanças" count = Mudanças filtered by channel', () => {
    const v = buildCanaisView(obs, { niche: 'todos', limit: 75, channel: 'matt-wolfe' })
    const l = v.drawer!.swaps.link!
    expect(l.n).toBe(obs.changesIn({ channel: 'matt-wolfe' }).length)
    expect(l.href).toBe(obs.link.mudancas({ channel: 'matt-wolfe' }))
    for (const s of v.drawer!.outliers.sections) if (s.link) expect(s.link.n).toBe(obs.outliers({ channel: 'matt-wolfe', fmt: s.fmt }).count)
  })
  it('backfill channel: no numbers invented, progress from the engine', () => {
    const r = buildCanaisView(obs, { niche: 'todos', limit: 75 }).rows.find(x => x.id === 'vou-sem-volta')!
    expect(r.sync.label).toBe('Buscando vídeos')
    expect(r.cells.sync.progress).toEqual({ done: 18, total: 50 })
    expect(r.cells.vpd.kind).toBe('na')
  })
  it('admin unlock label and the add-form texts', () => {
    const v = buildCanaisView(obs, { niche: 'todos', limit: 16, unlockStep: 25 })
    expect(v.slots.unlockText).toBe('Destravar mais 25 vagas')
    expect(v.slots.nearFull).toBe(true)
    expect(buildCanaisView(obs, { niche: 'todos', limit: 75 }).slots.nearFull).toBe(false)
    expect(v.add.cap).toBe('14 de 16 concorrentes acompanhados (o seu canal não conta): sobram 2 vagas.')
  })
})
