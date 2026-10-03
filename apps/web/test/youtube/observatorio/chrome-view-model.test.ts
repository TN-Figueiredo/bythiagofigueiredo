// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildChromeView, coworkText, syncResultToast } from '@/app/cms/(authed)/youtube/competitors/_chrome/view-model'

const obs = createObservatory(datasetFromOracle(loadOracle()))

describe('chrome view model', () => {
  it('tab counts follow the niche (Todos 14/18/11, Viagem 8/8/5, IA 6/10/6); Insights has none', () => {
    const t = buildChromeView(obs, { tab: 'canais', niche: 'todos' }).tabs
    expect(t.map(x => x.count)).toEqual([14, 18, 11, null])
    expect(buildChromeView(obs, { tab: 'canais', niche: 'viagem' }).tabs.map(x => x.count)).toEqual([8, 8, 5, null])
    expect(buildChromeView(obs, { tab: 'canais', niche: 'ia' }).tabs.map(x => x.count)).toEqual([6, 10, 6, null])
  })
  it('each tab explains its count in title=', () => {
    const t = buildChromeView(obs, { tab: 'mudancas', niche: 'todos' }).tabs
    expect(t[1]!.title).toBe('18 trocas nos últimos 30 dias (título, thumbnail e descrição; longos e Shorts; contadas por evento)')
    expect(t[0]!.title).toBe('14 canais monitorados')
    expect(t[3]!.title).toBe('Leituras publicadas pela forja')
  })
  it('freshness line uses the engine sync text and problemPhrase', () => {
    const f = buildChromeView(obs, { tab: 'canais', niche: 'todos' }).fresh
    expect(f.syncText).toBe('sincronizado há 3 h')
    expect(f.syncTitle).toBe(obs.SYNC.title)
    expect(f.problems.length).toBeGreaterThan(0)
    expect(f.problems.every(p => p.phrase === obs.channel(p.id)!.sync.problemPhrase)).toBe(true)
  })
  it('tab hrefs carry no niche (object links) and point at the routes', () => {
    expect(buildChromeView(obs, { tab: 'canais', niche: 'ia' }).tabs.map(t => t.href)).toEqual(['/cms/youtube/competitors', '/cms/youtube/competitors/mudancas', '/cms/youtube/competitors/outliers', '/cms/youtube/competitors/insights'])
  })
  it('marks only the current tab', () => {
    expect(buildChromeView(obs, { tab: 'outliers', niche: 'todos' }).tabs.map(t => t.current)).toEqual([false, false, true, false])
  })
  it('header constants and niche label/colour', () => {
    const v = buildChromeView(obs, { tab: 'canais', niche: 'viagem' })
    expect(v.title).toBe('Observatório de Competidores')
    expect(v.tzLabel).toBe('Horários em São Paulo')
    expect(v.nicheLabel).toBe('Viagem')
    expect(v.nicheColor).toEqual({ dark: '#5BBF8A', light: '#11692F' })
    expect(v.forja).toBeNull()
    const t = buildChromeView(obs, { tab: 'canais', niche: 'todos' })
    expect(t.nicheLabel).toBe('Todos')
    expect(t.nicheColor).toBeNull()
  })
  it('niche bar counts channels per niche', () => {
    const v = buildChromeView(obs, { tab: 'canais', niche: 'todos' })
    expect(v.niches.map(n => [n.key, n.count, n.pressed])).toEqual([['todos', 14, true], ['viagem', 8, false], ['ia', 6, false]])
  })
  it('problems text: plural with Todos, niche + total otherwise', () => {
    const all = buildChromeView(obs, { tab: 'canais', niche: 'todos' }).fresh
    const n = all.problems.length
    expect(all.problemsText).toBe(n + (n === 1 ? ' canal com problema' : ' canais com problema'))
    expect(all.channelsInNiche).toBe(14)
    expect(all.channelsTotal).toBe(14)
    const via = buildChromeView(obs, { tab: 'canais', niche: 'viagem' }).fresh
    const k = via.problems.filter(p => obs.channel(p.id)!.niche === 'viagem').length
    expect(via.problemsText).toBe(`${k} com problema em Viagem · ${n} no total`)
    expect(via.channelsInNiche).toBe(8)
  })
  it('popover lists problems first, then the ok channels, with "—" in a problem row', () => {
    const f = buildChromeView(obs, { tab: 'canais', niche: 'todos' }).fresh
    const rows = f.rows
    const firstOk = rows.findIndex(r => !r.bad)
    expect(rows.slice(0, firstOk).every(r => r.bad)).toBe(true)
    expect(rows.slice(firstOk).every(r => !r.bad)).toBe(true)
    expect(rows).toHaveLength(14)
    const bad = rows.find(r => r.bad && obs.channel(r.id)!.sync.state !== 'backfill')
    expect(bad?.last).toBeNull()
    expect(f.popoverSub).toContain('Horários em São Paulo.')
  })
  it('a never-synced dataset keeps the engine text (no date computed here)', () => {
    const ds = datasetFromOracle(loadOracle())
    ds.sync.last = null
    const o2 = createObservatory(ds)
    expect(buildChromeView(o2, { tab: 'canais', niche: 'todos' }).fresh.syncText).toBe(o2.SYNC.text)
  })
})

describe('cowork text', () => {
  it('one default per tab, with the niche', () => {
    expect(coworkText('mudancas', 'ia')).toBe('Liste as trocas de título, thumbnail e descrição dos concorrentes (nicho IA, últimos 30 dias) via youtube_observatory. Para as que já têm 7 dias depois da troca, compare a média de views/dia observada com a esperada pela idade. Não afirme causa. Use o MCP bythiagofigueiredo.')
    expect(coworkText('canais', 'todos')).toContain('(todos os nichos)')
  })
})

describe('sync result toast', () => {
  const names = (id: string) => ({ a: 'Paddy Doyle', b: 'Esq Unltd Daily', v: 'Vou sem volta' } as Record<string, string>)[id] ?? id
  it('the spec sentence: "11 de 13 … · Fora da rodada: …"', () => {
    const ok = Array.from({ length: 11 }, (_, i) => 'ok' + i)
    const t = syncResultToast({ ok, problems: [{ id: 'a', label: 'atrasado · x' }, { id: 'b', label: 'erro desde y' }], outOfRound: [{ id: 'v', label: 'buscando vídeos' }] }, names)
    expect(t.text).toBe('11 de 13 canais sincronizados agora; 2 com problema · Fora da rodada: Vou sem volta (buscando vídeos)')
    expect(t.kind).toBe('warn')
    expect(t.title).toBe('11 de 13 canais sincronizados agora; 2 com problema')
    expect(t.body).toBe('Paddy Doyle: atrasado · x; Esq Unltd Daily: erro desde y.')
    expect(t.more).toBe('Fora da rodada: Vou sem volta (buscando vídeos).')
  })
  it('all ok → "Concorrentes sincronizados"', () => {
    const t = syncResultToast({ ok: ['x', 'y'], problems: [], outOfRound: [] }, names)
    expect(t.kind).toBe('ok')
    expect(t.title).toBe('Concorrentes sincronizados')
    expect(t.text).toBe('2 de 2 canais sincronizados agora')
  })
  it('problems listed Viagem before IA; the facade uses the engine channels', () => {
    const info = (id: string) => ({ i: { name: 'Esq', niche: 'ia' }, v: { name: 'Paddy', niche: 'viagem' } } as Record<string, { name: string; niche: string }>)[id]
    expect(syncResultToast({ ok: [], problems: [{ id: 'i', label: 'erro' }, { id: 'v', label: 'atrasado' }], outOfRound: [] }, info).body).toBe('Paddy: atrasado; Esq: erro.')
    const ia = obs.channels.find(c => !c.own && c.niche === 'ia')!, via = obs.channels.find(c => !c.own && c.niche === 'viagem')!
    const t = obs.syncResultToast({ ok: ['x'], problems: [{ id: ia.id, label: 'a' }, { id: via.id, label: 'b' }], outOfRound: [] })
    expect(t.body).toBe(`${via.name}: b; ${ia.name}: a.`)
    expect(t.text).toBe('1 de 3 canais sincronizados agora; 2 com problema')
  })
  it('inRound counts only the ok competitors (the ones the action touches)', () => {
    expect(buildChromeView(obs, { tab: 'canais', niche: 'todos' }).fresh.inRound).toBe(obs.channels.filter(c => !c.own && c.sync.state === 'ok').length)
  })
  it('nothing synced is never a success', () => {
    const t = syncResultToast({ ok: [], problems: [], outOfRound: [] }, names)
    expect(t.kind).toBe('warn')
    expect(t.text).toBe('nenhum canal sincronizado')
  })
})
