// @vitest-environment node
// apps/web/test/youtube/observatorio/canais-view-model.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, loadOracleOwns, datasetFromOracle } from './oracle'
import type { OwnPreset } from '../../fixtures/observatorio/own-presets'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
const obs = createObservatory(datasetFromOracle(loadOracle()))
describe('Canais view model', () => {
  it('"14 de 75 canais" — own channel not counted', () => expect(buildCanaisView(obs, { niche: 'todos', limit: 75 }).slots.text).toBe('14 de 75 canais'))
  it('R124: cada linha leva a foto do canal; no oráculo (sem foto) é sempre nulo', () => {
    for (const r of buildCanaisView(obs, { niche: 'todos', limit: 75 }).rows) expect(r.avatar).toBeNull()
  })
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
    expect(v.own.rows[0]?.own).toBe(true)
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
  it('niche editor rows: every competitor, whatever the scope or ?filter', () => {
    const v = buildCanaisView(obs, { niche: 'ia', limit: 75, filter: 'problemas' })
    const all = obs.channels.filter(c => !c.own)
    expect(v.nicheRows.map(r => r.id).sort()).toEqual(all.map(c => c.id).sort())
    expect(v.nicheRows.some(r => r.niche === 'viagem')).toBe(true)
    expect(v.nicheRows.find(r => r.id === 'tnfigueiredo')).toBeUndefined()
  })
  it('slots come from the engine with the site limit', () => {
    expect(obs.channelSlots(16)).toEqual({ used: 14, limit: 16, free: 2 })
    expect(obs.channelSlots()).toEqual({ used: 14, limit: 75, free: 61 })
    expect(buildCanaisView(obs, { niche: 'todos', limit: 16 }).slots).toMatchObject(obs.channelSlots(16))
  })
  it('sync-in-progress bar (canais.html copy) and the queued state of the channels in the round', () => {
    const v = buildCanaisView(obs, { niche: 'todos', limit: 75 })
    expect(v.syncbar.text).toBe('Sincronização em andamento: 11 concorrentes na rodada; fora da rodada: Vou sem volta (ainda buscando vídeos). O resultado de cada canal aparece quando a rodada termina.')
    expect(v.syncbar.meta).toBe('Seu canal não entra nesta rodada; ele sincroniza pelo Painel. O canal em coleta continua a própria coleta.')
    const row = (id: string) => v.groups.flatMap(g => g.rows).find(r => r.id === id)!
    expect(row('matt-wolfe').cells.sync.queued?.label).toBe('Na fila desta rodada')
    expect(row('paddy-doyle').cells.sync.queued).toBeNull()
    expect(v.own.rows[0]!.cells.sync.queued).toBeNull()
  })
})


// Task 35b (fidelity sweep, canais.html:563-564/783)
describe('Canais view model — fidelity with canais.html', () => {
  it('the own channel with tracked videos but no daily views says so (never "Nenhum vídeo longo acompanhado")', () => {
    const ds = datasetFromOracle(loadOracle())
    for (const v of ds.videos) if (ds.channels.find(c => c.id === v.ch)?.own) v.series = []
    const own = buildCanaisView(createObservatory(ds), { niche: 'todos', limit: 75 }).own.rows[0]!
    expect(own.cells.vpd).toMatchObject({ kind: 'na', text: 'Sem views diárias do seu canal.' })
  })
})

// Plano "N canais próprios", Task 6: o grupo "Seus canais"
// one engine per preset: buildCanaisView never mutates it
const cache = new Map<OwnPreset, ReturnType<typeof createObservatory>>()
const obsOf = (preset: OwnPreset) => { let o = cache.get(preset); if (!o) { o = createObservatory(datasetFromOracle(loadOracleOwns(preset))); cache.set(preset, o) } return o }
const viewOf = (preset: OwnPreset, p: Partial<CanaisParams> = {}) => buildCanaisView(obsOf(preset), { niche: 'todos', limit: 75, ...p })
const texts = (v: ReturnType<typeof buildCanaisView>) => v.own.group?.parts.map(x => (x.num ? x.num + ' ' : '') + x.text) ?? null
const SYNC_ONE = 'Seu canal não entra nesta rodada; ele sincroniza pelo Painel. O canal em coleta continua a própria coleta.'
const SYNC_MANY = 'Seus canais não entram nesta rodada; eles sincronizam pelo Painel. O canal em coleta continua a própria coleta.'

describe('Canais view model — grupo "Seus canais" (N canais próprios)', () => {
  it('preset 1, Todos: sem cabeçalho de grupo, sem chip de idioma, textos no singular', () => {
    const v = viewOf('1')
    expect(v.own.group).toBeNull()
    expect(v.own.many).toBe(false)
    expect(v.own.rows).toHaveLength(1)
    expect(v.own.rows[0]!.lang).toBeNull()
    expect(v.slots.tip).toContain('o seu canal não ocupa vaga')
    expect(v.add.cap).toContain('(o seu canal não conta)')
    expect(v.syncbar.meta).toBe(SYNC_ONE)
    expect(v.sortNote).toBe('Ordenado por Views/dia por mil inscritos, maior primeiro')
  })
  it('preset 2, Todos: grupo com "2 canais", ordem R73, chips PT/EN, textos no plural', () => {
    const v = viewOf('2')
    expect(v.own.group!.label).toBe('Seus canais')
    expect(v.own.group!.parts).toEqual([
      { num: '2', text: 'canais', warn: false },
      { num: null, text: 'fora do limite de concorrentes', warn: false },
    ])
    expect(v.own.many).toBe(true)
    expect(v.own.rows.map(r => r.name)).toEqual(['tnFigueiredo', 'tnFigueiredo EN'])
    expect(v.own.rows.map(r => r.lang)).toEqual([{ code: 'PT', title: 'Canal em português' }, { code: 'EN', title: 'Canal em inglês' }])
    expect(v.slots.tip).toContain('os seus canais não ocupam vaga')
    expect(v.add.cap).toContain('(os seus canais não contam)')
    expect(v.syncbar.meta).toBe(SYNC_MANY)
    expect(v.sortNote).toBe('Ordenado por Views/dia por mil inscritos, maior primeiro; os seus canais ficam sempre no topo')
    expect(v.slots.text).toBe('14 de 75 canais')
  })
  it('preset 2, IA: nenhuma linha própria e o grupo diz onde os canais estão', () => {
    const v = viewOf('2', { niche: 'ia' })
    expect(v.own.rows).toEqual([])
    expect(texts(v)).toEqual(['nenhum de IA', '2 em outro nicho (aparecem em Todos)', 'fora do limite de concorrentes'])
    expect(v.rows.some(r => r.own)).toBe(false)
  })
  it('preset mix, Viagem: os do nicho e o sem nicho, na ordem R73; partes com o aviso', () => {
    const v = viewOf('mix', { niche: 'viagem' })
    expect(v.own.rows.map(r => r.name)).toEqual(['Thiago na Estrada', 'tnFigueiredo', 'Mochila Leve', 'tnFigueiredo EN'])
    expect(v.own.group!.parts).toEqual([
      { num: '3', text: 'de Viagem', warn: false },
      { num: null, text: '1 sem nicho: escolha o nicho na linha do canal', warn: true },
      { num: null, text: '1 em outro nicho (aparece em Todos)', warn: false },
      { num: null, text: 'fora do limite de concorrentes', warn: false },
    ])
    expect(v.own.rows.find(r => r.name === 'Mochila Leve')!.niche).toBeNull()
  })
  it('preset mix, Todos: "5 canais", o aviso de sem nicho, e nenhuma parte "em outro nicho"', () => {
    const v = viewOf('mix')
    expect(v.own.group!.parts[0]).toEqual({ num: '5', text: 'canais', warn: false })
    expect(texts(v)).toContain('1 sem nicho: escolha o nicho na linha do canal')
    expect(texts(v)!.some(t => t.includes('em outro nicho'))).toBe(false)
    expect(v.own.rows).toHaveLength(5)
  })
  it('preset mix, IA: o canal de IA e o sem nicho; os três de Viagem ficam em Todos', () => {
    const v = viewOf('mix', { niche: 'ia' })
    expect(v.own.rows.map(r => r.name)).toEqual(['Thiago testa IA', 'Mochila Leve'])
    expect(texts(v)).toEqual(['1 de IA', '1 sem nicho: escolha o nicho na linha do canal', '3 em outro nicho (aparecem em Todos)', 'fora do limite de concorrentes'])
  })
  it('preset 5: cinco linhas próprias na ordem R73, e nenhuma ocupa vaga', () => {
    const o = obsOf('5'), v = buildCanaisView(o, { niche: 'todos', limit: 75 })
    expect(v.own.rows.map(r => r.id)).toEqual(o.ownChannels().map(c => c.id))
    expect(v.own.rows.map(r => r.name)).toEqual(['Thiago na Estrada', 'tnFigueiredo', 'Slow Roads', 'Mochila Leve', 'tnFigueiredo EN'])
    expect(v.slots.used).toBe(14)
    expect(v.rows.slice(0, 5).map(r => r.id)).toEqual(v.own.rows.map(r => r.id))
  })
  it('sem ?sort= a ordem é Views/dia (a mesma de ?sort=vpd); ?sort=subs ordena os concorrentes por inscritos', () => {
    const comp = (v: ReturnType<typeof buildCanaisView>) => v.groups.flatMap(g => g.rows)
    const def = viewOf('1')
    expect(def.sort).toBe('vpd')
    expect(comp(def).map(r => r.id)).toEqual(comp(viewOf('1', { sort: 'vpd' })).map(r => r.id))
    expect(viewOf('1', { scale: 'abs' }).sortNote).toBe('Ordenado por Views/dia em número absoluto, maior primeiro')
    const subs = viewOf('1', { sort: 'subs', niche: 'viagem' })
    expect(subs.sortNote).toBe('Ordenado por Inscritos, maior primeiro')
    const keys = comp(subs).map(r => r.sortKeys.subs)
    expect(keys.length).toBeGreaterThan(2)
    expect(keys).toEqual([...keys].sort((a, b) => b - a))
    expect(new Set(keys).size).toBeGreaterThan(1)
  })
  it('a coluna clicada não reordena os canais próprios (R73 fica)', () => {
    const base = viewOf('5').own.rows.map(r => r.id)
    for (const sort of ['active', 'vpd', 'outliers', 'swaps', 'growth', 'subs']) for (const dir of ['asc', 'desc'])
      expect(viewOf('5', { sort, dir }).own.rows.map(r => r.id)).toEqual(base)
  })
  it('um canal próprio sem nicho: o grupo aparece pedindo o nicho, e o canal aparece em Todos, Viagem e IA', () => {
    const ds = datasetFromOracle(loadOracleOwns('1'))
    const id = ds.channels.find(c => c.own)!.id
    for (const c of ds.channels) if (c.id === id) c.niche = null
    for (const x of ds.videos) if (x.ch === id) x.niche = null
    const o = createObservatory(ds)
    const all = buildCanaisView(o, { niche: 'todos', limit: 75 })
    expect(texts(all)).toEqual(['1 canal', '1 sem nicho: escolha o nicho na linha do canal', 'fora do limite de concorrentes'])
    expect(all.own.group!.parts[1]!.warn).toBe(true)
    for (const niche of ['todos', 'viagem', 'ia'] as const) {
      const v = buildCanaisView(o, { niche, limit: 75 })
      expect(v.own.rows.map(r => r.id)).toEqual([id])
      expect(v.own.rows[0]!.niche).toBeNull()
      expect(v.own.group).not.toBeNull()
    }
    expect(texts(buildCanaisView(o, { niche: 'ia', limit: 75 }))).toEqual(['nenhum de IA', '1 sem nicho: escolha o nicho na linha do canal', 'fora do limite de concorrentes'])
    // textos continuam no singular: é um canal só
    expect(all.slots.tip).toContain('o seu canal não ocupa vaga')
  })
  it('dataset sem canal próprio: nada lança, sem grupo, sem linha, textos no singular, unidade com o início da série', () => {
    const ds = datasetFromOracle(loadOracle())
    const owns = new Set(ds.channels.filter(c => c.own).map(c => c.id))
    ds.channels = ds.channels.filter(c => !c.own)
    ds.videos = ds.videos.filter(x => !owns.has(x.ch))
    const o = createObservatory(ds)
    for (const niche of ['todos', 'viagem', 'ia'] as const) for (const filter of [undefined, 'problemas']) {
      const v = buildCanaisView(o, { niche, limit: 75, filter })
      expect(v.own).toEqual({ rows: [], group: null, many: false })
      expect(v.rows.some(r => r.own)).toBe(false)
      expect(v.slots.tip).toContain('o seu canal não ocupa vaga')
      expect(v.add.cap).toContain('(o seu canal não conta)')
      expect(v.syncbar.meta).toBe(SYNC_ONE)
      expect(v.sortNote).toBe('Ordenado por Views/dia por mil inscritos, maior primeiro')
      expect(v.vpdUnit).toBe(`por mil inscritos, mediana desde ${o.SERIES_START_LABEL}`)
      expect(JSON.stringify(v)).not.toMatch(/undefined|NaN/)
    }
  })
  it('?filter=problemas: as linhas próprias continuam em own.rows e saem da lista plana', () => {
    const v = viewOf('2', { filter: 'problemas' })
    expect(v.own.rows).toHaveLength(2)
    expect(v.rows.some(r => r.own)).toBe(false)
    expect(v.rows.length).toBeGreaterThan(0)
  })
  it('cada linha própria: trocas no A/B Lab, nunca na fila da rodada', () => {
    for (const preset of ['1', '2', '5', 'mix'] as const) for (const r of viewOf(preset).own.rows) {
      expect(r.own).toBe(true)
      expect(r.cells.swap).toEqual({ kind: 'na', text: 'Suas trocas ficam no A/B Lab.' })
      expect(r.cells.sync.queued).toBeNull()
    }
  })
  it('canal próprio sem vídeos no formato: a linha diz que não há vídeos, nunca um veredito contra a mediana', () => {
    const o = obsOf('5')
    expect(o.videos.some(x => x.ch === 'mochila-leve' && x.fmt === 'short')).toBe(false)
    const r = buildCanaisView(o, { niche: 'todos', limit: 75, fmt: 'short' }).own.rows.find(x => x.id === 'mochila-leve')!
    expect(r.cells.vpd.kind).toBe('na')
    expect(r.cells.out).toMatchObject({ kind: 'na', text: 'Não publicou Shorts em 90\u00a0d.' })
    expect(JSON.stringify(r.cells)).not.toMatch(/a mediana|▼|NaN|undefined/)
  })
  it('lang só nos canais próprios; concorrente nunca tem chip', () => {
    const v = viewOf('5')
    expect(v.groups.flatMap(g => g.rows).every(r => r.lang === null)).toBe(true)
    expect(v.own.rows.every(r => r.lang !== null)).toBe(true)
  })
})

describe('Canais view model — gaveta e filtro de nicho (requisito 9)', () => {
  it('?niche= explícito de outro nicho que o do canal: a gaveta não abre e a URL perde ?channel=', () => {
    const v = viewOf('2', { nicheExplicit: true, niche: 'ia', channel: 'luke-damant' })
    expect(v.drawer).toBeNull()
    expect(v.drawerDropped).toBe(true)
    expect(v.drawerForja).toBeNull()
  })
  it('nicho só persistido (link de outra aba): a gaveta abre como hoje', () => {
    const v = viewOf('2', { nicheExplicit: false, niche: 'ia', channel: 'luke-damant' })
    expect(v.drawer?.id).toBe('luke-damant')
    expect(v.drawerDropped).toBe(false)
    const w = viewOf('2', { niche: 'ia', channel: 'luke-damant' })
    expect(w.drawer?.id).toBe('luke-damant')
    expect(w.drawerDropped).toBe(false)
  })
  it('Todos explícito e o próprio nicho explícito: aberta', () => {
    for (const niche of ['todos', 'viagem'] as const) {
      const v = viewOf('2', { nicheExplicit: true, niche, channel: 'luke-damant' })
      expect(v.drawer?.id).toBe('luke-damant')
      expect(v.drawerDropped).toBe(false)
    }
  })
  it('canal sem nicho abre em qualquer aba', () => {
    const v = viewOf('mix', { nicheExplicit: true, niche: 'ia', channel: 'mochila-leve' })
    expect(v.drawer?.id).toBe('mochila-leve')
    expect(v.drawer?.niche).toBeNull()
    expect(v.drawerDropped).toBe(false)
  })
  it('canal próprio de outro nicho segue a mesma regra', () => {
    const v = viewOf('2', { nicheExplicit: true, niche: 'ia', channel: 'tnfigueiredo-en' })
    expect(v.drawer).toBeNull()
    expect(v.drawerDropped).toBe(true)
  })
  it('?channel= desconhecido ou ausente nunca marca drawerDropped', () => {
    expect(viewOf('2', { nicheExplicit: true, niche: 'ia', channel: 'nope' })).toMatchObject({ drawer: null, drawerDropped: false })
    expect(viewOf('2', { nicheExplicit: true, niche: 'ia' })).toMatchObject({ drawer: null, drawerDropped: false })
  })
  it('gaveta de canal próprio: own, o nicho do canal e o chip de idioma', () => {
    const d = viewOf('2', { channel: 'tnfigueiredo-en' }).drawer!
    expect(d).toMatchObject({ own: true, niche: 'viagem', lang: { code: 'EN', title: 'Canal em inglês' } })
    expect(viewOf('1', { channel: 'tnfigueiredo' }).drawer).toMatchObject({ own: true, niche: 'viagem', lang: null })
    expect(viewOf('2', { channel: 'luke-damant' }).drawer!.lang).toBeNull()
  })
})

// Plano "N canais próprios", Task 10 (FU-11): inscritos ocultos
describe('inscritos ocultos pelo canal (subs === null)', () => {
  const dsH = datasetFromOracle(loadOracleOwns('1'))
  const target = (() => {
    const o = createObservatory(dsH)
    return dsH.channels.find(c => !c.own && o.channelStats(c.id, 'long').vpdMedian != null)!
  })()
  const hidden = structuredClone(dsH)
  hidden.channels.find(c => c.id === target.id)!.subs = null
  const oH = createObservatory(hidden)
  const rowOf = (p: Partial<CanaisParams>) => buildCanaisView(oH, { niche: 'todos', limit: 75, ...p }).groups.flatMap(g => g.rows).find(r => r.id === target.id)!
  it('a linha diz Inscritos ocultos e a dica diz que o canal esconde a contagem', () => {
    const r = rowOf({})
    expect(r.subs).toBe('Inscritos ocultos')
    expect(r.subsTip).toBe('Este canal esconde a contagem de inscritos no YouTube.')
    expect(JSON.stringify(r)).not.toMatch(/NaN|Infinity|exato|\b0 inscritos/)
  })
  it('escala por mil inscritos: a célula aponta o Absoluto, nunca "Nenhum vídeo longo acompanhado."', () => {
    expect(rowOf({ scale: 'per-mil' }).vpd).toBe('Inscritos ocultos: veja em Absoluto.')
    const cell = buildCanaisView(oH, { niche: 'todos', limit: 75 }).groups.flatMap(g => g.rows).find(r => r.id === target.id)!.cells.vpd
    expect(cell).toMatchObject({ kind: 'na', title: 'O canal não informa os inscritos; veja a escala Absoluto.' })
  })
  it('escala Absoluto: a célula mostra o número', () => {
    expect(rowOf({ scale: 'abs' }).vpd).toMatch(/^[\d.,]+/)
    expect(rowOf({ scale: 'abs' }).vpd).not.toMatch(/Inscritos ocultos|Nenhum/)
  })
  it('gaveta: "inscritos ocultos pelo canal"', () => {
    expect(buildCanaisView(oH, { niche: 'todos', limit: 75, channel: target.id }).drawer!.subsText).toBe('inscritos ocultos pelo canal')
  })
})
