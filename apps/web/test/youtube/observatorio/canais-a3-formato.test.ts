// @vitest-environment node
// A3 Tarefa 1: o filtro de formato "Todos | Longos | Shorts" da lista de Canais (modelo, URL e links).
import { describe, it, expect } from 'vitest'
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisParams, type CanaisRow } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { parseCanaisFmt, fmtDaOrdem, FMT_PADRAO } from '@/app/cms/(authed)/youtube/competitors/_canais/formato'
import { link } from '@/lib/youtube/observatorio/links'
import type { Observatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio/types'

const BASE = a3World() // lido uma vez por arquivo; os testes que mutam pedem outro mundo
const view = (p: Partial<CanaisParams> = {}, obs: Observatory = BASE.obs) => buildCanaisView(obs, { niche: 'todos', limit: 75, ...p })
const rowsOf = (v: ReturnType<typeof view>): CanaisRow[] => v.rows
const byId = (v: ReturnType<typeof view>, id: string) => rowsOf(v).find(r => r.id === id)!
const FMTS = ['longos', 'todos', 'shorts'] as const

/** Um concorrente com longos e Shorts acompanhados no mundo base. */
function comTodos(ds: Dataset = BASE.ds): string {
  const own = new Set(ds.channels.filter(c => c.own).map(c => c.id))
  const id = ds.channels.find(c => !own.has(c.id) && ds.videos.some(v => v.ch === c.id && v.tracked && v.fmt === 'long') && ds.videos.some(v => v.ch === c.id && v.tracked && v.fmt === 'short'))?.id
  if (!id) throw new Error('fixture: nenhum concorrente com longos e Shorts acompanhados')
  return id
}
const semShortsDe = (id: string) => (ds: Dataset) => { ds.videos = ds.videos.filter(v => !(v.ch === id && v.fmt === 'short')) }

describe('A3.1 formato: parâmetro da URL', () => {
  it('sem fmt: Longos, fmtNaUrl false; fmt=longos, fmt=todos e fmt=shorts são aceitos', () => {
    expect(FMT_PADRAO).toBe('longos')
    const d = view()
    expect([d.fmt, d.fmtNaUrl]).toEqual(['longos', false])
    for (const f of FMTS) {
      const v = view({ fmt: f })
      expect([v.fmt, v.fmtNaUrl]).toEqual([f, true])
    }
  })
  it('links antigos: fmt=short abre Shorts e fmt=long abre Longos', () => {
    expect(parseCanaisFmt('short')).toBe('shorts')
    expect(parseCanaisFmt('long')).toBe('longos')
    const s = view({ fmt: 'short' }), l = view({ fmt: 'long' })
    expect([s.fmt, s.fmtNaUrl, l.fmt, l.fmtNaUrl]).toEqual(['shorts', true, 'longos', true])
  })
  it('parâmetros inválidos: fmt=abc, fmt vazio e fmt=TODOS (maiúsculas) dão Longos, sem erro', () => {
    for (const raw of ['abc', '', 'TODOS', 'Shorts', ' todos', undefined]) {
      expect(parseCanaisFmt(raw)).toBeNull()
      const v = view({ fmt: raw })
      expect([v.fmt, v.fmtNaUrl]).toEqual(['longos', false])
      expect(v.rows.length).toBeGreaterThan(0)
    }
  })
  it('fmtDaOrdem: só o filtro Shorts ordena pelos Shorts', () => {
    expect(fmtDaOrdem('todos')).toBe('long')
    expect(fmtDaOrdem('longos')).toBe('long')
    expect(fmtDaOrdem('shorts')).toBe('short')
  })
})

describe('A3.1 formato: células', () => {
  it('Longos e Shorts: as células e as unidades falam só daquele formato (como hoje)', () => {
    const id = comTodos()
    const l = byId(view({ fmt: 'longos' }), id), s = byId(view({ fmt: 'shorts' }), id)
    for (const r of [l, s]) { expect(r.cells.cadence2).toBeUndefined(); expect(r.cells.vpd2).toBeUndefined(); expect(r.cells.out2).toBeUndefined() }
    if (l.cells.cadence.kind !== 'ok' || s.cells.cadence.kind !== 'ok') throw new Error('fixture: ritmo sem dado')
    expect(l.cells.cadence.unit).toBe('longos/sem')
    expect(s.cells.cadence.unit).toBe('Shorts/sem')
    expect(l.outliers.n).toBe(BASE.obs.outliers({ channel: id, fmt: 'long' }).count)
    expect(s.outliers.n).toBe(BASE.obs.outliers({ channel: id, fmt: 'short' }).count)
    const S = BASE.obs.channelStats(id, 'short'), L = BASE.obs.channelStats(id, 'long')
    if (s.cells.vpd.kind !== 'ok' || l.cells.vpd.kind !== 'ok') throw new Error('fixture: views/dia sem dado')
    expect(s.cells.vpd.n).toBe(S.vpdN)
    expect(l.cells.vpd.n).toBe(L.vpdN)
  })
  it('Todos: Ritmo, Views/dia e Outliers têm duas medidas, a dos longos e a dos Shorts; nenhuma mediana misturada', () => {
    const t = view({ fmt: 'todos' }), l = view({ fmt: 'longos' }), s = view({ fmt: 'shorts' })
    let comDuas = 0
    for (const r of rowsOf(t)) {
      const rl = byId(l, r.id), rs = byId(s, r.id)
      // a primeira medida é, por inteiro, a de Longos; a segunda é a de Shorts: nenhuma conta nova
      expect(r.cells.vpd).toEqual(rl.cells.vpd)
      // com Shorts, a segunda medida é, por inteiro, a de Shorts; sem Shorts, é a frase de "falta" (nunca "Nenhum Short acompanhado" nem 0)
      if (BASE.ds.videos.some(x => x.ch === r.id && x.fmt === 'short')) expect(r.cells.vpd2).toEqual(rs.cells.vpd)
      else expect(r.cells.vpd2).toMatchObject({ kind: 'na', text: 'sem Shorts' })
      expect(r.vpd).toBe(rl.vpd)
      expect(r.cells.cadence2).toBeDefined()
      expect(r.cells.out2).toBeDefined()
      if (r.cells.cadence.kind === 'ok' && r.cells.cadence2!.kind === 'ok' && rs.cells.cadence.kind === 'ok') {
        expect(r.cells.cadence2!.pw).toBe(rs.cells.cadence.pw)
        expect(r.cells.cadence2!.unit).toBe('Shorts/sem')
        expect(r.cells.cadence.unit).toBe('longos/sem')
        comDuas++
      }
      if (r.cells.out.kind === 'ok') expect(r.cells.out.mult).toBe(rl.cells.out.kind === 'ok' ? rl.cells.out.mult : null)
      if (r.cells.out2!.kind === 'ok' && rs.cells.out.kind === 'ok') {
        expect(r.cells.out2!.mult).toBe(rs.cells.out.mult)
        expect(r.cells.out2!.count).toBe(rs.cells.out.count)
      }
      expect(r.cells.out2!.kind === 'ok').toBe(rs.cells.out.kind === 'ok')
    }
    expect(comDuas).toBeGreaterThan(5)
  })
  it('Todos: Inscritos, Trocas, Crescimento e Sincronização não mudam com o formato', () => {
    const t = view({ fmt: 'todos' }), l = view({ fmt: 'longos' }), s = view({ fmt: 'shorts' })
    for (const r of rowsOf(t)) for (const o of [byId(l, r.id), byId(s, r.id)]) {
      expect(r.subs).toBe(o.subs)
      expect(r.subsTip).toBe(o.subsTip)
      expect(r.cells.swap).toEqual(o.cells.swap)
      expect(r.cells.growth).toEqual(o.cells.growth)
      expect(r.cells.sync).toEqual(o.cells.sync)
      expect(r.changes).toEqual(o.changes)
    }
  })
  it('Todos: canal sem Shorts diz "sem Shorts" na segunda medida, nunca 0; canal sem vídeos diz "sem vídeos"', () => {
    const alvo = comTodos()
    const outro = 'tnfigueiredo-en'
    const w = a3World(ds => { semShortsDe(alvo)(ds); ds.videos = ds.videos.filter(v => v.ch !== outro) })
    expect(w.owns).toContain(outro)
    const v = view({ fmt: 'todos' }, w.obs)
    const a = byId(v, alvo)
    expect(a.cells.cadence2).toEqual({ kind: 'na', text: 'sem Shorts', title: 'O canal não tem Shorts guardados.' })
    expect(a.cells.vpd2).toEqual({ kind: 'na', text: 'sem Shorts', title: 'O canal não tem Shorts guardados.' })
    expect(a.cells.out2).toMatchObject({ kind: 'na', text: 'sem Shorts' })
    expect(a.cells.vpd.kind).toBe('ok') // os longos continuam medidos
    const o = byId(v, outro)
    for (const c of [o.cells.cadence2, o.cells.vpd2, o.cells.out2]) expect(c).toMatchObject({ kind: 'na', text: 'sem vídeos' })
  })
  it('Todos: concorrente aguardando o 2º registro diz o motivo nas duas medidas; canal próprio diz que não há views diárias', () => {
    const alvo = comTodos()
    const proprio = 'tnfigueiredo'
    const w = a3World(ds => {
      // como no carregador de produção: o canal próprio não tem série diária
      for (const x of ds.videos) if (x.ch === alvo || x.ch === proprio) x.series = []
      // o canal próprio precisa ter Short acompanhado para a segunda medida existir
      const v = ds.videos.find(x => x.ch === proprio && x.tracked && x.fmt === 'long')!
      v.fmt = 'short'; v.isShort = true
    })
    const t = view({ fmt: 'todos' }, w.obs)
    const a = byId(t, alvo)
    expect(a.cells.vpd).toMatchObject({ kind: 'na', text: 'Aguardando o 2º registro diário.' })
    expect(a.cells.vpd2).toMatchObject({ kind: 'na', text: 'Aguardando o 2º registro diário.' })
    const p = byId(t, proprio)
    expect(p.cells.vpd).toMatchObject({ kind: 'na', text: 'Sem views diárias do seu canal.' })
    expect(p.cells.vpd2).toMatchObject({ kind: 'na', text: 'Sem views diárias do seu canal.' })
  })
})

describe('A3.1 formato: ordem', () => {
  it('Todos ordena pelos longos: a ordem é a mesma de Longos e sortNote diz "ordenado pelos longos"', () => {
    for (const sort of ['vpd', 'active', 'outliers', 'subs'] as const) for (const dir of ['desc', 'asc'] as const) {
      const t = view({ fmt: 'todos', sort, dir }), l = view({ fmt: 'longos', sort, dir })
      expect(t.rows.map(r => r.id)).toEqual(l.rows.map(r => r.id))
    }
    expect(view({ fmt: 'todos' }).sortNote).toContain('ordenado pelos longos')
    expect(view({ fmt: 'todos', sort: 'active' }).sortNote).toContain('ordenado pelos longos')
    expect(view({ fmt: 'longos' }).sortNote).not.toContain('ordenado pelos longos')
    expect(view({ fmt: 'shorts' }).sortNote).not.toContain('ordenado pelos longos')
    // inscritos, trocas e crescimento não dependem do formato: não há o que dizer
    expect(view({ fmt: 'todos', sort: 'subs' }).sortNote).not.toContain('ordenado pelos longos')
    expect(view({ fmt: 'todos' }).fmtCab).toEqual({ dois: 'longos em cima, Shorts embaixo', ordenado: 'ordenado pelos longos' })
    expect(view({ fmt: 'longos' }).fmtCab).toBeNull()
  })
  it('Shorts: quem não tem Shorts não tem valor para ordenar (null), nunca -1', () => {
    const alvo = comTodos()
    const w = a3World(semShortsDe(alvo))
    for (const dir of ['desc', 'asc'] as const) for (const sort of ['vpd', 'active', 'outliers'] as const) {
      const v = view({ fmt: 'shorts', sort, dir }, w.obs)
      const comps = v.rows.filter(r => !r.own)
      const sem = comps.find(r => r.id === alvo)!
      expect(sem.sortKeys[sort]).toBeNull()
      // vai para o fim em qualquer direção, depois de todo canal com valor
      const ultimoComValor = comps.map(r => r.sortKeys[sort]).reduce<number>((acc, k, i) => (k != null ? i : acc), -1)
      expect(comps.findIndex(r => r.id === alvo)).toBeGreaterThan(ultimoComValor)
      for (const r of comps) if (r.sortKeys[sort] === null) expect(comps.slice(0, ultimoComValor + 1).includes(r)).toBe(false)
    }
    const vL = view({ fmt: 'longos' }, w.obs)
    expect(byId(vL, alvo).sortKeys.vpd).not.toBeNull() // em Longos o canal tem valor
  })
})

describe('A3.1 formato: aviso e vídeos sem formato', () => {
  it('vídeos com isShort nulo: a linha traz semFormato com a contagem; sem nulos é null', () => {
    const alvo = comTodos()
    for (const r of rowsOf(view({ fmt: 'todos' }))) expect(r.semFormato).toBeNull()
    const w = a3World(ds => {
      const meus = ds.videos.filter(v => v.ch === alvo && v.tracked)
      meus[0]!.isShort = null; meus[1]!.isShort = null
      // um vídeo fora do acompanhamento não entra na conta
      const fora = ds.videos.find(v => v.ch === alvo && !v.tracked) ?? meus[2]!
      fora.isShort = null; fora.tracked = false
    })
    for (const f of FMTS) {
      const r = byId(view({ fmt: f }, w.obs), alvo)
      expect(r.semFormato?.n).toBe(2)
      expect(r.semFormato?.tip).toMatch(/longos/)
      expect(r.semFormato?.tip).toMatch(/confirm/)
    }
    const outros = rowsOf(view({ fmt: 'todos' }, w.obs)).filter(r => r.id !== alvo)
    for (const r of outros) expect(r.semFormato).toBeNull()
  })
  it('fmtNota: o texto do spec 15.3 em Todos e em Shorts; null em Longos', () => {
    expect(view({ fmt: 'longos' }).fmtNota).toBeNull()
    expect(view({}).fmtNota).toBeNull()
    expect(view({ fmt: 'todos' }).fmtNota).toBe('Longos e Shorts lado a lado, sem mediana única (views de Short e de longo não se comparam); ordem pelos longos.')
    expect(view({ fmt: 'shorts' }).fmtNota).toBe('Só Shorts; quem não publica Shorts fica no fim da lista.')
  })
})

describe('A3.1 formato: links', () => {
  it('os links que o modelo monta (problemas, limpar, nicho) levam o fmt atual', () => {
    const semNicho = a3World(ds => { const c = ds.channels.find(x => !x.own)!; c.niche = null })
    for (const f of FMTS) {
      const v = view({ fmt: f })
      expect(v.problems.filterHref).toBe(link.canais({ filter: 'problemas', fmt: f }))
      expect(v.problems.clearHref).toBe(link.canais({ fmt: f }))
      expect(new URL('http://x' + v.problems.clearHref).searchParams.get('fmt')).toBe(f)
      const n = view({ fmt: f, niche: 'ia' }, semNicho.obs)
      expect(n.emptyLink?.href).toContain(`fmt=${f}`)
    }
    // sem fmt na URL o link já leva o padrão: a tela dele nunca fica sem a chave
    expect(view().problems.clearHref).toBe(link.canais({ fmt: 'longos' }))
  })
  it('link.canais emite fmt quando dado; sem ele a URL de hoje não muda', () => {
    expect(link.canais()).toBe('/cms/youtube/competitors')
    expect(link.canais({ filter: 'problemas' })).toBe('/cms/youtube/competitors?filter=problemas')
    expect(link.canais({ nicheEditor: 1 })).toBe('/cms/youtube/competitors?nicheEditor=1')
    expect(link.canais({ fmt: 'todos' })).toBe('/cms/youtube/competitors?fmt=todos')
    expect(link.canais({ niche: 'ia', fmt: 'shorts' })).toBe('/cms/youtube/competitors?niche=ia&fmt=shorts')
    expect(link.canais({ channel: 'abc', fmt: 'longos' })).toBe('/cms/youtube/competitors?channel=abc&fmt=longos')
  })
})
