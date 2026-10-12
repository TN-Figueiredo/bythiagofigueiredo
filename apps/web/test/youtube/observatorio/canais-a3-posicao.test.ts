// @vitest-environment node
// A3 Tarefa 2: posição no nicho e no geral, lista única (canal próprio na posição dele), divisor "Ainda sem medida
// para ordenar (N)", bloco "Seus canais" e linha presa (modelo, sem tela).
import { describe, it, expect } from 'vitest'
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisParams, type CanaisRow, type CanaisSort, type CanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { fraseSeuCanal, motivoTexto, POSICIONADAS, type MotivoSemMedida } from '@/app/cms/(authed)/youtube/competitors/_canais/posicao-model'
import { ownChannelHref } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-channels'
import { principalDoMotor } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
import { link } from '@/lib/youtube/observatorio/links'
import type { Observatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import type { OwnPreset } from '../../fixtures/observatorio/own-presets'

const SORTS: CanaisSort[] = ['subs', 'vpd', 'active', 'outliers', 'swaps', 'growth']
const FMTS = ['longos', 'todos', 'shorts'] as const
const SCALES = ['per-mil', 'abs'] as const
const BASE = a3World() // lido uma vez por arquivo; os testes que mutam pedem outro mundo
const view = (p: Partial<CanaisParams> = {}, obs: Observatory = BASE.obs) => buildCanaisView(obs, { niche: 'todos', limit: 75, ...p })
const all = (v: CanaisView): CanaisRow[] => [...v.list.ranked, ...v.list.unranked]
const byId = (v: CanaisView, id: string) => all(v).find(r => r.id === id)!
const cheia = (v: CanaisView, id: string) => {
  const l = v.own.block!.linhas.find(x => x.id === id)!
  if (l.tipo !== 'cheia') throw new Error('linha fina: ' + id)
  return l
}
const ownIds = (obs: Observatory) => obs.ownChannels().map(c => c.id)
const compIds = (obs: Observatory) => obs.channels.filter(c => !c.own).map(c => c.id)
const PALAVRAS_INTERNAS = /\b(pack|pacote|dataset|conjunto do site|motor|sentinela|R73|escala √|ranking)\b/i

/** Sem leitura diária: o motor não deriva views por dia (o canal próprio de produção não tem o diário até a A4). */
const semDiario = (v: Dataset['videos'][number]) => { v.series = []; v.firstIdx = null }

/** O que o mundo precisa para um concorrente: o primeiro com longos E Shorts acompanhados. */
function comTodos(ds: Dataset): string {
  const own = new Set(ds.channels.filter(c => c.own).map(c => c.id))
  const id = ds.channels.find(c => !own.has(c.id) && ds.videos.some(v => v.ch === c.id && v.tracked && v.fmt === 'long' && v.series.length > 1) && ds.videos.some(v => v.ch === c.id && v.tracked && v.fmt === 'short'))?.id
  if (!id) throw new Error('fixture: nenhum concorrente com longos e Shorts acompanhados')
  return id
}
/** Os concorrentes de um mundo, na ordem do conjunto, que não são o `fora`. */
const outrosConc = (ds: Dataset, fora: string[] = []) => ds.channels.filter(c => !c.own && !fora.includes(c.id)).map(c => c.id)

/** Oráculo independente: 1 + quantos têm valor maior, entre `ids`; quem não tem valor fica fora. Com `txt`, o empate é pelo valor ESCRITO. */
function oraculo(ids: string[], x: (id: string) => number | null, txt?: (n: number) => string) {
  const com = ids.filter(id => x(id) != null)
  return (id: string) => {
    const v = x(id)
    if (v == null) return null
    const igual = (o: string) => (txt ? txt(x(o)!) === txt(v) : x(o) === v)
    return { pos: 1 + com.filter(o => x(o)! > v && !igual(o)).length, de: com.length, empate: com.filter(o => o !== id && igual(o)).length > 0 }
  }
}
const subsDe = (obs: Observatory) => (id: string) => obs.channel(id)!.subs
const vpdDe = (obs: Observatory, rel: boolean, f: 'long' | 'short') => (id: string) => { const S = obs.channelStats(id, f); return rel ? S.perMilSubs : S.vpdMedian }

/** Mundos com cada tipo de "sem medida" da coluna Views/dia (e o canal que o causa). */
function mundoSemMedida() {
  const base = a3World()
  const alvoSh = comTodos(base.ds)
  const [aguarda, bf, oculto, semSh] = outrosConc(base.ds, [alvoSh]).slice(0, 4)
  // o canal de Shorts do filtro Shorts: um concorrente com longos mas sem nenhum Short
  const w = a3World(ds => {
    const propria = ds.channels.find(c => c.own)!.id
    for (const v of ds.videos) if (v.ch === propria) semDiario(v) // canal próprio: o diário só chega na A4
    for (const v of ds.videos) if (v.ch === aguarda && v.tracked) semDiario(v) // concorrente aguardando o 2º registro
    const s = ds.channels.find(c => c.id === bf)!.sync; s.state = 'backfill'; s.backfill = { done: 12, total: 48 }
    ds.channels.find(c => c.id === oculto)!.subs = null // inscritos ocultos
    ds.videos = ds.videos.filter(v => !(v.ch === semSh && v.fmt === 'short'))
  })
  return { ...w, aguarda: aguarda!, bf: bf!, oculto: oculto!, semSh: semSh!, propria: w.owns[0]! }
}

describe('A3.2 lista única', () => {
  it('lista única: os canais próprios ficam NA POSIÇÃO deles entre os concorrentes, em qualquer ordenação e direção', () => {
    const obs = BASE.obs, own = new Set(ownIds(obs))
    let pelaMeio = 0
    for (const sort of SORTS) for (const dir of ['desc', 'asc'] as const) {
      const v = view({ sort, dir, fmt: 'longos' })
      const todos = all(v)
      expect(todos.map(r => r.id).sort()).toEqual(obs.channels.map(c => c.id).sort()) // cada canal uma vez
      expect(v.list.ranked.every(r => r.valor[sort] != null)).toBe(true)
      expect(v.list.unranked.every(r => r.valor[sort] == null)).toBe(true)
      // a ordem dos que têm valor é a da direção
      const xs = v.list.ranked.map(r => r.valor[sort]!)
      const ord = [...xs].sort((a, b) => (dir === 'desc' ? b - a : a - b))
      expect(xs).toEqual(ord)
      // nenhum grupo fixo no topo: algum concorrente vem antes de algum canal próprio com valor
      const iFirstOwn = v.list.ranked.findIndex(r => own.has(r.id))
      if (iFirstOwn > 0) pelaMeio++
    }
    expect(pelaMeio).toBeGreaterThan(3)
  })
  it('os canais próprios ficam em Inscritos exatamente onde os inscritos os põem', () => {
    const obs = BASE.obs
    const v = view({ sort: 'subs', dir: 'desc' })
    const ids = v.list.ranked.map(r => r.id)
    const esperado = obs.channels.filter(c => c.subs != null).sort((a, b) => b.subs! - a.subs!).map(c => c.id)
    expect(ids.length).toBe(esperado.length)
    // mesma ordem de valores (os empates podem trocar de lugar entre si)
    expect(ids.map(id => obs.channel(id)!.subs)).toEqual(esperado.map(id => obs.channel(id)!.subs))
  })
})

describe('A3.2 conjunto da posição', () => {
  it('nicho escolhido: conjunto "em <Nicho>" e a posição conta só os canais do nicho (próprios incluídos)', () => {
    const obs = BASE.obs
    const v = view({ niche: 'viagem', sort: 'subs' })
    expect(v.conjunto).toEqual({ tipo: 'nicho', niche: 'viagem', label: 'Viagem' })
    expect(v.conjuntoAviso).toBeNull()
    const doNicho = obs.channels.filter(c => c.niche === 'viagem').map(c => c.id)
    const ora = oraculo(doNicho, subsDe(obs))
    expect(v.list.ranked.length).toBe(doNicho.length)
    for (const r of v.list.ranked) expect(r.pos).toEqual(ora(r.id))
    // um próprio de Viagem está no conjunto: o "de N" conta ele
    expect(v.list.ranked.find(r => r.own)!.pos!.de).toBe(doNicho.length)
    // o outro nicho tem outra conta
    const ia = view({ niche: 'ia', sort: 'subs' })
    const doIa = obs.channels.filter(c => c.niche === 'ia').map(c => c.id)
    expect(ia.conjunto).toEqual({ tipo: 'nicho', niche: 'ia', label: obs.nicheLabel('ia') })
    for (const r of ia.list.ranked) expect(r.pos).toEqual(oraculo(doIa, subsDe(obs))(r.id))
  })
  it('nicho Todos: conjunto "no geral", todos os nichos e os sem nicho numerados juntos, com o aviso da emenda 45', () => {
    const w = a3World(undefined, 'mix'), obs = w.obs
    const v = view({ sort: 'subs' }, obs)
    expect(v.conjunto).toEqual({ tipo: 'geral' })
    expect(v.conjuntoAviso).toBe('Canais de nichos diferentes têm públicos de tamanhos diferentes, então a posição geral ordena, não julga.')
    const ora = oraculo(obs.channels.map(c => c.id), subsDe(obs))
    expect(all(v).length).toBe(obs.channels.length)
    for (const r of v.list.ranked) expect(r.pos).toEqual(ora(r.id))
    // há mais de um nicho e um canal sem nicho, e todos estão numerados no mesmo conjunto
    expect(new Set(all(v).map(r => r.niche)).size).toBeGreaterThan(2)
    expect(byId(v, 'mochila-leve').niche).toBeNull()
    expect(byId(v, 'mochila-leve').pos).toEqual(ora('mochila-leve'))
    expect(new Set(v.list.ranked.map(r => r.pos!.de))).toEqual(new Set([obs.channels.length]))
  })
  it('canal próprio sem nicho: tem posição no geral; dentro de um nicho fica sem posição e a frase é "escolha o nicho do canal para ver a posição"', () => {
    const w = a3World(undefined, 'mix'), obs = w.obs
    const geral = view({ sort: 'subs' }, obs)
    expect(byId(geral, 'mochila-leve').pos).not.toBeNull()
    expect(byId(geral, 'mochila-leve').semMedida).toBeNull()
    expect(cheia(geral, 'mochila-leve').frase).toContain(' no geral, em inscritos')
    for (const niche of ['viagem', 'ia'] as const) {
      const v = view({ niche, sort: 'subs' }, obs)
      const r = byId(v, 'mochila-leve') // continua na lista (como o grupo de hoje)
      expect(r.pos).toBeNull()
      expect(r.semMedida).toBe('sem-nicho')
      expect(r.valor.subs).not.toBeNull() // tem o valor, só não tem conjunto
      expect(cheia(v, 'mochila-leve').frase).toContain('escolha o nicho do canal para ver a posição')
      expect(cheia(v, 'mochila-leve').vizinhos).toBeNull()
      // os outros não contam o canal sem nicho no "de N"
      const doNicho = obs.channels.filter(c => c.niche === niche).length
      for (const x of v.list.ranked) if (x.pos) expect(x.pos.de).toBe(doNicho)
    }
  })
})

describe('A3.2 posição só onde existe', () => {
  it('posição só em Inscritos e Views/dia (nas duas escalas); em Ritmo, Outliers, Trocas e Crescimento pos é null em todas as linhas e a frase é a de D4 (b)', () => {
    expect([...POSICIONADAS]).toEqual(['subs', 'vpd'])
    const FRASE = 'Esta ordenação não mostra posição. Ordene por Inscritos ou por Views/dia para ver a do seu canal.'
    const obs = BASE.obs
    for (const scale of SCALES) for (const fmt of FMTS) for (const sort of SORTS) {
      const v = view({ sort, scale, fmt })
      const posicionada = (POSICIONADAS as readonly string[]).includes(sort)
      expect(all(v).some(r => r.pos != null), `${sort}/${scale}/${fmt}`).toBe(posicionada)
      if (!posicionada) {
        expect(motivoTexto('ordenacao-sem-posicao')).toBe(FRASE)
        for (const id of ownIds(obs)) { const l = cheia(v, id); expect(l.frase).toBe(FRASE); expect(l.vizinhos).toBeNull() }
        expect(v.pe!.texto).toBe('seu canal · ' + FRASE)
      }
    }
    // as duas escalas dão posições diferentes para o mesmo canal (por mil ≠ absoluto)
    const a = view({ sort: 'vpd', scale: 'abs' }), p = view({ sort: 'vpd', scale: 'per-mil' })
    const ora = (rel: boolean) => oraculo(obs.channels.map(c => c.id), vpdDe(obs, rel, 'long'), n => (rel ? obs.fmt.dec1(n) : obs.fmt.num(n)))
    for (const r of a.list.ranked) expect(r.pos).toEqual(ora(false)(r.id))
    for (const r of p.list.ranked) expect(r.pos).toEqual(ora(true)(r.id))
    expect(a.list.ranked.map(r => r.id)).not.toEqual(p.list.ranked.map(r => r.id))
  })
  it('empate: "(empate)" na frase e empate true nos dois', () => {
    const { ds, obs, owns } = (() => {
      const w = a3World(d => { // um concorrente com exatamente os inscritos do canal próprio
        const own = d.channels.find(c => c.own)!, comp = d.channels.find(c => !c.own)!
        comp.subs = own.subs
      })
      return w
    })()
    const dono = owns[0]!, par = ds.channels.find(c => !c.own)!.id
    const v = view({ sort: 'subs' }, obs)
    expect(byId(v, dono).pos!.empate).toBe(true)
    expect(byId(v, par).pos!.empate).toBe(true)
    expect(byId(v, dono).pos!.pos).toBe(byId(v, par).pos!.pos)
    expect(cheia(v, dono).frase).toMatch(/^\d+º de \d+ no geral \(empate\), em inscritos, com /)
    // sem empate, sem a palavra
    expect(cheia(view({ sort: 'subs' }), owns[0]!).frase).not.toContain('empate')
  })
})

describe('A3.2 sem medida', () => {
  const W = mundoSemMedida()
  const MOTIVOS: Array<[string, string, MotivoSemMedida, Partial<CanaisParams>]> = [
    ['canal próprio sem views por dia', W.propria, 'sem-views-dia-proprio', {}],
    ['aguardando o 2º registro', W.aguarda, 'aguarda-2o-registro', {}],
    ['em primeira sincronização', W.bf, 'buscando-videos', {}],
    ['inscritos ocultos (em por mil)', W.oculto, 'inscritos-ocultos', { scale: 'per-mil' }],
    ['sem Shorts (no filtro Shorts)', W.semSh, 'sem-shorts', { fmt: 'shorts' }],
  ]
  it('sem medida vai para o fim sob o divisor, em desc E em asc: canal próprio sem views por dia, aguardando o 2º registro, em primeira sincronização, inscritos ocultos (em por mil), sem Shorts (no filtro Shorts)', () => {
    for (const [nome, id, motivo, extra] of MOTIVOS) for (const dir of ['desc', 'asc'] as const) {
      const v = view({ sort: 'vpd', dir, ...extra }, W.obs)
      const r = byId(v, id)
      expect(r.valor.vpd, nome).toBeNull()
      expect(r.pos, nome).toBeNull()
      expect(r.semMedida, nome).toBe(motivo)
      expect(v.list.unranked.map(x => x.id), `${nome} ${dir}`).toContain(id)
      expect(v.list.ranked.map(x => x.id), `${nome} ${dir}`).not.toContain(id)
      expect(v.list.divisor!.titulo).toBe(`Ainda sem medida para ordenar (${v.list.unranked.length})`)
    }
    // inscritos ocultos só atrapalham o por mil: em Absoluto o canal tem valor e posição
    const abs = view({ sort: 'vpd', scale: 'abs' }, W.obs)
    expect(byId(abs, W.oculto).valor.vpd).not.toBeNull()
    expect(byId(abs, W.oculto).pos).not.toBeNull()
    // inscritos ocultos em Inscritos: sem valor, motivo próprio
    const subs = view({ sort: 'subs' }, W.obs)
    expect(byId(subs, W.oculto).valor.subs).toBeNull()
    expect(byId(subs, W.oculto).semMedida).toBe('inscritos-ocultos')
  })
  it('o fim da lista: concorrentes antes dos canais próprios, e cada grupo por inscritos', () => {
    for (const dir of ['desc', 'asc'] as const) {
      const v = view({ sort: 'vpd', dir }, W.obs)
      const un = v.list.unranked
      expect(un.length).toBeGreaterThan(2)
      const iPrimeiroProprio = un.findIndex(r => r.own)
      if (iPrimeiroProprio >= 0) expect(un.slice(iPrimeiroProprio).every(r => r.own)).toBe(true)
      for (const grupo of [un.filter(r => !r.own), un.filter(r => r.own)]) {
        const s = grupo.map(r => r.valor.subs ?? -Infinity)
        expect(s).toEqual([...s].sort((a, b) => b - a))
      }
    }
  })
  it('nenhuma linha sem medida tem pos; nenhuma posição é calculada sobre -1 ou -99', () => {
    for (const niche of ['todos', 'viagem'] as const) for (const scale of SCALES) for (const fmt of FMTS) for (const sort of SORTS) for (const dir of ['desc', 'asc'] as const) {
      const v = view({ niche, scale, fmt, sort, dir }, W.obs)
      for (const r of all(v)) {
        if (r.valor[sort] == null) expect(r.pos, `${r.id} ${sort}`).toBeNull()
        for (const k of SORTS) { expect(r.valor[k]).not.toBe(-1); expect(r.valor[k]).not.toBe(-99) }
        if (r.pos) { expect(r.pos.pos).toBeGreaterThanOrEqual(1); expect(r.pos.pos).toBeLessThanOrEqual(r.pos.de) }
      }
      // os que têm valor vêm antes dos que não têm, e só os de valor numeram o "de N"
      const nComValor = v.list.ranked.filter(r => r.pos).length
      for (const r of v.list.ranked) if (r.pos) expect(r.pos.de).toBeLessThanOrEqual(nComValor + all(v).filter(x => x.pos == null && x.valor[sort] != null).length)
    }
    // o canal em primeira sincronização tem null (não -1) em tudo que depende de vídeo
    const bf = byId(view({ sort: 'vpd' }, W.obs), W.bf)
    expect([bf.valor.active, bf.valor.vpd, bf.valor.outliers, bf.valor.swaps]).toEqual([null, null, null, null])
    // o canal próprio não tem trocas aqui (elas ficam no A/B Lab): null, não 0
    expect(byId(view({ sort: 'swaps' }, W.obs), W.propria).valor.swaps).toBeNull()
  })
  it('o "de N" é o de quem tem o valor: com 2 sem medida em 14, a frase diz "de 12"', () => {
    const w = a3World(ds => {
      const [a, b] = outrosConc(ds)
      ds.channels.find(c => c.id === a)!.subs = null
      ds.channels.find(c => c.id === b)!.subs = null
    })
    const n = w.obs.channels.length
    const v = view({ sort: 'subs' }, w.obs)
    expect(v.list.unranked.length).toBe(2)
    for (const r of v.list.ranked) expect(r.pos!.de).toBe(n - 2)
    expect(cheia(v, w.owns[0]!).frase).toContain(` de ${n - 2} no geral, em inscritos`)
    // em um nicho, o "de N" conta só os do nicho que têm o valor
    const viagem = view({ sort: 'subs', niche: 'viagem' }, w.obs)
    const nViagem = w.obs.channels.filter(c => c.niche === 'viagem' && c.subs != null).length
    for (const r of viagem.list.ranked) expect(r.pos!.de).toBe(nViagem)
  })
  it('divisor: "Ainda sem medida para ordenar (N)" com a nota do que falta; null quando todos têm medida', () => {
    const v = view({ sort: 'vpd', scale: 'per-mil' }, W.obs)
    expect(v.list.divisor).toEqual({
      titulo: `Ainda sem medida para ordenar (${v.list.unranked.length})`,
      nota: 'sem views/dia por mil inscritos nos longos; ficam no fim em qualquer direção',
    })
    expect(view({ sort: 'vpd', scale: 'abs', fmt: 'shorts' }, W.obs).list.divisor!.nota).toBe('sem views/dia nos Shorts; ficam no fim em qualquer direção')
    expect(view({ sort: 'subs' }, W.obs).list.divisor!.nota).toBe('sem inscritos; ficam no fim em qualquer direção')
    // todos têm medida: sem divisor
    const limpo = view({ sort: 'subs' })
    expect(limpo.list.unranked).toEqual([])
    expect(limpo.list.divisor).toBeNull()
  })
})

describe('A3.2 bloco "Seus canais"', () => {
  it('bloco: uma linha cheia por canal próprio com vídeos, com a frase da posição, o número e os vizinhos ("Logo acima: …" / "É o último da lista.")', () => {
    const obs = BASE.obs
    const v = view({ sort: 'subs', dir: 'desc' })
    const b = v.own.block!
    expect(b.linhas.map(l => l.id)).toEqual(ownIds(obs)) // a ordem do motor
    for (const l of b.linhas) {
      expect(l.tipo).toBe('cheia')
      const r = byId(v, l.id)
      if (l.tipo !== 'cheia') continue
      expect(r.pos).not.toBeNull()
      expect(l.frase).toBe(`${r.pos!.pos}º de ${r.pos!.de} no geral, em inscritos, com ${r.subs}.`)
      const fila = v.list.ranked.filter(x => x.pos) // os vizinhos são os do conjunto da posição
      const i = fila.findIndex(x => x.id === l.id)
      const ac = fila[i - 1], ab = fila[i + 1]
      const esperado = (ac ? `Logo acima: ${ac.name} (${ac.subs}).` : 'É o primeiro da lista.') + ' ' + (ab ? `Logo abaixo: ${ab.name} (${ab.subs}).` : 'É o último da lista.')
      expect(l.vizinhos).toBe(esperado)
      expect({ name: l.name, avatar: l.avatar, ini: l.ini, color: l.color }).toEqual({ name: r.name, avatar: r.avatar, ini: r.ini, color: r.color })
    }
    // nas pontas: o maior e o menor
    const asc = view({ sort: 'subs', dir: 'asc' }), ult = asc.list.ranked[asc.list.ranked.length - 1]!
    expect(ult.name.length).toBeGreaterThan(0)
    // um próprio no meio tem os dois vizinhos; o último da lista diz "É o último da lista."
    const w = a3World(ds => { ds.channels.find(c => c.own)!.subs = 1 }) // o menor de todos
    const vv = view({ sort: 'subs' }, w.obs)
    expect(cheia(vv, w.owns[0]!).vizinhos).toMatch(/^Logo acima: .+\. É o último da lista\.$/)
    const w2 = a3World(ds => { ds.channels.find(c => c.own)!.subs = 99_000_000 }) // o maior de todos
    expect(cheia(view({ sort: 'subs' }, w2.obs), w2.owns[0]!).vizinhos).toMatch(/^É o primeiro da lista\. Logo abaixo: .+\.$/)
  })
  it('bloco: trocar a ordenação troca a frase (todas as ordenações × formatos × escalas do fixture)', () => {
    const obs = BASE.obs, id = ownIds(obs)[0]!
    const vistas = new Map<string, string>()
    for (const scale of SCALES) for (const fmt of FMTS) for (const sort of SORTS) {
      const v = view({ sort, scale, fmt })
      const l = cheia(v, id)
      expect(l.frase, `${sort}/${scale}/${fmt}`).not.toMatch(/undefined|NaN|null|-1\b|-99/)
      expect(l.frase.length).toBeGreaterThan(10)
      vistas.set(`${sort}/${scale}/${fmt}`, l.frase)
      if (sort === 'subs') expect(l.frase).toContain(', em inscritos, com ')
      if (sort === 'vpd' && scale === 'per-mil') expect(l.frase).toContain(fmt === 'shorts' ? 'views/dia por mil inscritos nos Shorts' : 'views/dia por mil inscritos nos longos')
      if (sort === 'vpd' && scale === 'abs') expect(l.frase).toContain(fmt === 'shorts' ? 'views/dia nos Shorts' : 'views/dia nos longos')
    }
    // a frase de Inscritos não muda com formato nem escala; a de Views/dia muda com os dois
    expect(new Set(['longos', 'todos', 'shorts'].flatMap(f => ['per-mil', 'abs'].map(s => vistas.get(`subs/${s}/${f}`)))).size).toBe(1)
    expect(vistas.get('vpd/per-mil/longos')).not.toBe(vistas.get('vpd/abs/longos'))
    expect(vistas.get('vpd/per-mil/longos')).not.toBe(vistas.get('vpd/per-mil/shorts'))
    expect(vistas.get('vpd/per-mil/longos')).toBe(vistas.get('vpd/per-mil/todos')) // Todos segue os longos
    expect(vistas.get('subs/abs/longos')).not.toBe(vistas.get('vpd/abs/longos'))
  })
  it('bloco: canal próprio sem vídeos vira linha fina, sem "Abrir meu canal"', () => {
    const w = a3World(ds => { const id = ds.channels.filter(c => c.own)[1]!.id; ds.videos = ds.videos.filter(x => x.ch !== id) })
    const sem = w.owns[1]!, nome = w.obs.channel(sem)!.name
    for (const sort of SORTS) {
      const v = view({ sort }, w.obs)
      const l = v.own.block!.linhas.find(x => x.id === sem)!
      expect(l).toEqual({ tipo: 'fina', id: sem, texto: `${nome}: sem vídeos, fora das posições por vídeo.` })
      expect('abrirHref' in l).toBe(false)
      expect(all(v).map(r => r.id)).toContain(sem) // a linha fina aponta para uma linha que existe
    }
    // sem vídeos: fora de tudo o que é por vídeo, mas os inscritos existem
    const vs = view({ sort: 'subs' }, w.obs), vv = view({ sort: 'vpd' }, w.obs)
    expect(byId(vs, sem).pos).not.toBeNull()
    expect(byId(vv, sem).pos).toBeNull()
    expect(byId(vv, sem).semMedida).toBe('sem-videos')
    // o outro canal próprio continua com linha cheia
    expect(view({}, w.obs).own.block!.linhas.find(x => x.id === w.owns[0])!.tipo).toBe('cheia')
  })
  it('bloco: canal próprio sem views por dia na ordenação padrão diz a frase do spec 15.2, sem posição', () => {
    const w = a3World(ds => { for (const v of ds.videos) if (ds.channels.find(c => c.id === v.ch)!.own) semDiario(v) })
    const v = view({}, w.obs)
    expect(v.sort).toBe('vpd')
    for (const id of w.owns) {
      const l = cheia(v, id)
      expect(l.frase).toBe('Ainda sem views por dia medidas: a coleta diária do seu canal começa em breve. Sem posição nesta ordenação.')
      expect(l.vizinhos).toBeNull()
      expect(byId(v, id).pos).toBeNull()
      expect(v.list.unranked.map(r => r.id)).toContain(id)
    }
    expect(v.pe!.texto).toBe('seu canal · ' + cheia(v, v.pe!.canalId).frase)
  })
  it('título "Seu canal" com um e "Seus canais" com mais de um; site sem canal próprio: block e pe são null', () => {
    expect(view({}, a3World(undefined, '1').obs).own.block!.titulo).toBe('Seu canal')
    expect(view({}, a3World(undefined, '2').obs).own.block!.titulo).toBe('Seus canais')
    expect(view({}).own.block!.titulo).toBe('Seus canais')
    const w = a3World(ds => {
      const own = new Set(ds.channels.filter(c => c.own).map(c => c.id))
      ds.channels = ds.channels.filter(c => !own.has(c.id)); ds.videos = ds.videos.filter(x => !own.has(x.ch))
    })
    const v = view({}, w.obs)
    expect(w.obs.ownChannels()).toEqual([])
    expect(v.own.block).toBeNull()
    expect(v.pe).toBeNull()
    expect(all(v).length).toBe(w.obs.channels.length)
    // as posições existem sem canal próprio
    expect(view({ sort: 'subs' }, w.obs).list.ranked[0]!.pos).toEqual({ pos: 1, de: w.obs.channels.length, empate: false })
  })
  it('13 (I-11c-1): a linha presa continua no pé quando o canal principal fica fora da lista pelo filtro de nicho; ela fala de um canal que está na lista, com o porquê de não ter posição', () => {
    // dois canais próprios em nichos diferentes; o de Viagem publica por último (é o principal); o filtro é IA
    const w = a3World(ds => {
      const [a, b] = ds.channels.filter(c => c.own)
      a!.niche = 'viagem'; b!.niche = 'ia'
      const ultimo = (id: string) => Math.max(...ds.videos.filter(v => v.ch === id).map(v => v.pub))
      const recuo = ultimo(b!.id) - ultimo(a!.id) + 3 * 86_400_000 // a passa a ter publicado 3 dias depois de b
      if (recuo > 0) for (const v of ds.videos) if (v.ch === b!.id) v.pub -= recuo
    })
    const [a, b] = w.owns
    const principal = w.obs.channel(principalDoMotor(w.obs, null)!)!
    expect(principal.niche).toBe('viagem') // o ponto de partida do cenário: o principal é de Viagem
    const v = view({ niche: 'ia', sort: 'subs' }, w.obs)
    expect(all(v).map(r => r.id)).not.toContain(principal.id) // fora da lista pelo filtro
    expect(all(v).map(r => r.id)).toContain(b === principal.id ? a : b) // o outro canal próprio está na lista
    expect(v.pe, 'a linha presa não pode sumir').not.toBeNull()
    expect(all(v).map(r => r.id)).toContain(v.pe!.canalId) // "Ir até a linha" tem para onde ir
    expect(v.pe!.canalId).not.toBe(principal.id)
    expect(v.pe!.texto).toBe('seu canal · ' + cheia(v, v.pe!.canalId).frase)
    // o botão "Comparar" continua com o principal global (outra pergunta, outra regra)
    const conc = all(v).find(r => !r.own)!
    expect(conc.comparar!.href).toBe(link.comparar(principal.id, conc.id))
    // o outro canal próprio sem nicho: a linha presa fala dele e diz por que não tem posição (a frase do motivo, nunca vazia)
    const semNicho = a3World(ds => {
      const [x, y] = ds.channels.filter(c => c.own)
      x!.niche = 'viagem'; y!.niche = null
      const ultimo = (id: string) => Math.max(...ds.videos.filter(vv => vv.ch === id).map(vv => vv.pub))
      const recuo = ultimo(y!.id) - ultimo(x!.id) + 3 * 86_400_000
      if (recuo > 0) for (const vv of ds.videos) if (vv.ch === y!.id) vv.pub -= recuo
    })
    const vn = view({ niche: 'ia', sort: 'subs' }, semNicho.obs)
    const yId = semNicho.ds.channels.find(c => c.own && c.niche == null)!.id
    expect(vn.pe, 'a linha presa não pode sumir').not.toBeNull()
    expect(vn.pe!.canalId).toBe(yId)
    expect(byId(vn, yId).pos).toBeNull()
    expect(vn.pe!.texto).toBe('seu canal · ' + cheia(vn, yId).frase)
    expect(vn.pe!.texto.length).toBeGreaterThan('seu canal · '.length)
    // o teste que apaga o filtro: sem nicho a linha volta a falar do principal
    expect(view({ niche: 'todos', sort: 'subs' }, w.obs).pe!.canalId).toBe(principal.id)
  })
  it('a linha presa fala do primeiro canal próprio com vídeos (D16), com a frase curta', () => {
    const obs = BASE.obs
    const v = view({ sort: 'subs' })
    const primeiro = ownIds(obs)[0]!
    expect(v.pe!.canalId).toBe(primeiro)
    const r = byId(v, primeiro)
    expect(v.pe!.texto).toBe(`seu canal · ${r.pos!.pos}º de ${r.pos!.de} no geral, em inscritos, com ${r.subs}.`)
    expect(v.pe!.texto).not.toContain('Logo acima')
    // o primeiro sem vídeos passa a vez para o segundo
    const w = a3World(ds => { const id = ds.channels.filter(c => c.own)[0]!.id; ds.videos = ds.videos.filter(x => x.ch !== id) })
    const vw = view({ sort: 'subs' }, w.obs)
    expect(vw.pe!.canalId).toBe(w.obs.ownChannels().find(c => c.id !== w.owns[0])!.id)
    // em um nicho, a linha diz o nicho
    const nv = view({ sort: 'subs', niche: 'viagem' })
    expect(nv.pe!.texto).toMatch(/^seu canal · \d+º de \d+ em Viagem, em inscritos, com /)
  })
})

describe('A3.2 formato, filtro e busca', () => {
  it('Todos (formato): posição e frase seguem os longos; Shorts: seguem os Shorts', () => {
    const obs = BASE.obs
    const L = view({ sort: 'vpd', fmt: 'longos' }), T = view({ sort: 'vpd', fmt: 'todos' }), S = view({ sort: 'vpd', fmt: 'shorts' })
    for (const r of all(L)) expect(byId(T, r.id).pos).toEqual(r.pos)
    expect(all(T).map(r => r.id)).toEqual(all(L).map(r => r.id))
    const oraS = oraculo(obs.channels.map(c => c.id), vpdDe(obs, true, 'short'), n => obs.fmt.dec1(n))
    for (const r of all(S)) expect(r.pos).toEqual(oraS(r.id))
    const id = ownIds(obs)[0]!
    expect(cheia(T, id).frase).toBe(cheia(L, id).frase)
    expect(cheia(S, id).frase).toContain('nos Shorts')
    expect(cheia(L, id).frase).toContain('nos longos')
  })
  it('filtro "só com problema" e busca não mudam a posição de ninguém', () => {
    const w = a3World(ds => { const [a, b] = outrosConc(ds); for (const id of [a, b]) { const s = ds.channels.find(c => c.id === id)!.sync; s.state = 'erro'; s.msg = 'falhou' } })
    for (const sort of ['subs', 'vpd'] as const) {
      const cheio = view({ sort }, w.obs), prob = view({ sort, filter: 'problemas' }, w.obs)
      expect(prob.list.ranked.length + prob.list.unranked.length).toBeLessThan(all(cheio).length)
      for (const r of all(prob)) expect(r.pos, `${sort} ${r.id}`).toEqual(byId(cheio, r.id).pos)
      // o bloco fala da lista inteira, não da filtrada: a frase e os vizinhos são os mesmos
      for (const id of w.owns) { expect(cheia(prob, id).frase).toBe(cheia(cheio, id).frase); expect(cheia(prob, id).vizinhos).toBe(cheia(cheio, id).vizinhos) }
      expect(prob.pe).toEqual(cheio.pe)
      // a linha de cada canal próprio continua na lista (o bloco aponta para ela)
      for (const id of w.owns) expect(all(prob).map(r => r.id)).toContain(id)
    }
    // a busca é do navegador: o modelo só diz o que a tela escreve
    expect(view({}).buscaNota).toBe('Posição na lista inteira, não só nos resultados da busca.')
  })
})

describe('A3.2 invariantes', () => {
  it('invariante: toda linha cheia do bloco tem abrirHref = ownChannelHref(id) e o canal existe em list', () => {
    const mundos: Array<[string, OwnPreset]> = [['1', '1'], ['2', '2'], ['5', '5'], ['mix', 'mix'], ['zero', 'zero']]
    expect(ownChannelHref('abc')).toBe(link.canais({ channel: 'abc' }))
    let linhas = 0
    for (const [, preset] of mundos) {
      const obs = a3World(undefined, preset).obs
      for (const niche of ['todos', 'viagem', 'ia'] as const) for (const sort of SORTS) for (const fmt of FMTS) {
        const v = view({ niche, sort, fmt }, obs)
        if (!v.own.block) { expect(obs.ownChannels().length).toBe(0); continue }
        for (const l of v.own.block.linhas) {
          expect(all(v).map(r => r.id)).toContain(l.id)
          if (l.tipo === 'cheia') { expect(l.abrirHref).toBe(ownChannelHref(l.id)); linhas++ }
        }
        if (v.pe) expect(all(v).map(r => r.id)).toContain(v.pe.canalId)
      }
    }
    expect(linhas).toBeGreaterThan(100)
  })
  it('frase de posição só aparece com valor medido; frase de motivo só sem posição', () => {
    const w = mundoSemMedida()
    for (const sort of SORTS) for (const fmt of FMTS) for (const scale of SCALES) for (const niche of ['todos', 'viagem'] as const) {
      const v = view({ sort, fmt, scale, niche }, w.obs)
      for (const l of v.own.block?.linhas ?? []) {
        if (l.tipo !== 'cheia') continue
        const r = byId(v, l.id)
        if (r.pos) { expect(r.valor[sort]).not.toBeNull(); expect(l.frase).toMatch(/^\d+º de \d+ (no geral|em .+)( \(empate\))?, em /) }
        else { expect(l.frase).not.toMatch(/^\d+º de /); expect(l.vizinhos).toBeNull(); expect(r.semMedida).not.toBeNull() }
      }
    }
  })
  it('nenhum texto do bloco, do divisor ou da linha presa traz palavra interna (lista das Restrições globais)', () => {
    const w = mundoSemMedida()
    const textos: string[] = (['sem-videos', 'sem-shorts', 'sem-views-dia-proprio', 'aguarda-2o-registro', 'buscando-videos', 'inscritos-ocultos', 'sem-nicho', 'ordenacao-sem-posicao'] as const).map(motivoTexto)
    expect(new Set(textos).size).toBe(8) // cada motivo tem a sua frase
    // 11c, D-B.1 itens 5 e 6: "primeira sincronização" é o nome da busca inicial em toda tela; "busca" fica só para o campo de busca
    expect(motivoTexto('buscando-videos')).toBe('A primeira sincronização ainda não terminou: a medida aparece quando ela terminar. Sem posição nesta ordenação.')
    expect(motivoTexto('ordenacao-sem-posicao')).toBe('Esta ordenação não mostra posição. Ordene por Inscritos ou por Views/dia para ver a do seu canal.')
    for (const t of textos) expect(t.length).toBeGreaterThan(10)
    const mix = a3World(undefined, 'mix').obs
    for (const obs of [w.obs, mix]) for (const niche of ['todos', 'viagem', 'ia'] as const) for (const sort of SORTS) for (const fmt of FMTS) for (const scale of SCALES) {
      const v = view({ niche, sort, fmt, scale }, obs)
      if (v.conjuntoAviso) textos.push(v.conjuntoAviso)
      textos.push(v.buscaNota)
      if (v.list.divisor) textos.push(v.list.divisor.titulo, v.list.divisor.nota)
      if (v.pe) textos.push(v.pe.texto)
      for (const l of v.own.block?.linhas ?? []) textos.push(l.tipo === 'cheia' ? l.frase : l.texto, ...(l.tipo === 'cheia' && l.vizinhos ? [l.vizinhos] : []))
      for (const p of v.own.block?.partes ?? []) textos.push(p.text)
    }
    expect(textos.length).toBeGreaterThan(500)
    for (const t of textos) { expect(t).not.toMatch(PALAVRAS_INTERNAS); expect(t).not.toMatch(/undefined|NaN|\bnull\b|Infinity/) }
  })
  it('sortNote não promete mais que os canais próprios ficam no topo; o resto da frase fica', () => {
    const v = view({ sort: 'vpd' })
    expect(v.sortNote).toBe('Ordenado por Views/dia por mil inscritos, maior primeiro')
    expect(v.sortNote).not.toContain('topo')
  })
  it('as estruturas antigas saíram (groups, rows, own.rows, own.group, sortKeys): a tela desenha só list e own.block', () => {
    const v = view({})
    expect(Object.keys(v)).not.toContain('groups')
    expect(Object.keys(v)).not.toContain('rows')
    expect(Object.keys(v.own).sort()).toEqual(['block', 'many'])
    expect(Object.keys(v.list.ranked[0]!)).not.toContain('sortKeys')
    expect(v.own.block!.linhas.map(l => l.id)).toEqual(ownIds(BASE.obs))
    expect(v.own.many).toBe(true)
    expect(all(v).length).toBe(BASE.obs.channels.length)
    expect(compIds(BASE.obs).every(id => all(v).some(r => r.id === id))).toBe(true)
  })
})

/* ---------------------------------------------------------------- A3 Tarefa 3, acréscimo da revisão da Tarefa 2 */
/** Oráculo pelo valor ESCRITO: 1 + quantos têm valor maior e se escrevem diferente; empate = outro com o mesmo texto. */
function oraculoEscrito(ids: string[], x: (id: string) => number | null, txt: (n: number) => string) {
  const com = ids.filter(id => x(id) != null)
  return (id: string) => {
    const v = x(id)
    if (v == null) return null
    return {
      pos: 1 + com.filter(o => x(o)! > v && txt(x(o)!) !== txt(v)).length, de: com.length,
      empate: com.filter(o => o !== id && txt(x(o)!) === txt(v)).length > 0,
    }
  }
}
const COMBOS: Array<{ sort: 'subs' | 'vpd'; scale: 'per-mil' | 'abs'; fmt: 'longos' | 'shorts' | 'todos' }> = [
  { sort: 'subs', scale: 'per-mil', fmt: 'longos' }, { sort: 'vpd', scale: 'per-mil', fmt: 'longos' }, { sort: 'vpd', scale: 'abs', fmt: 'longos' },
  { sort: 'vpd', scale: 'per-mil', fmt: 'shorts' }, { sort: 'vpd', scale: 'abs', fmt: 'shorts' }, { sort: 'vpd', scale: 'abs', fmt: 'todos' },
]
const celulaTxt = (r: CanaisRow, sort: 'subs' | 'vpd') => (sort === 'subs' ? r.subs : r.vpd)
const escrito = (obs: Observatory, sort: 'subs' | 'vpd', scale: 'per-mil' | 'abs') => (n: number) => (sort === 'subs' ? obs.fmt.subs(n) : scale === 'per-mil' ? obs.fmt.dec1(n) : obs.fmt.num(n))
const valorDe = (obs: Observatory, sort: 'subs' | 'vpd', scale: 'per-mil' | 'abs', fmt: string) =>
  (sort === 'subs' ? subsDe(obs) : vpdDe(obs, scale === 'per-mil', fmt === 'shorts' ? 'short' : 'long'))
const vizinhosDe = (txt: string) => ({
  acima: /Logo acima: (.+?) \(([^)]*)\)\./.exec(txt)?.slice(1) ?? null,
  abaixo: /Logo abaixo: (.+?) \(([^)]*)\)\./.exec(txt)?.slice(1) ?? null,
})

describe('A3.3 acréscimos da revisão: ordem crescente, texto da célula, empate escrito, "de N"', () => {
  it('I1: ordenar em ordem CRESCENTE não inverte a posição: mesma posição e mesmo total em asc e desc, contra o oráculo; os vizinhos trocam de lado', () => {
    const obs = BASE.obs
    let vizinhosComparados = 0
    for (const niche of ['todos', 'viagem'] as const) for (const { sort, scale, fmt } of COMBOS) {
      const d = view({ niche, sort, scale, fmt, dir: 'desc' }), a = view({ niche, sort, scale, fmt, dir: 'asc' })
      const ids = obs.channels.filter(c => niche === 'todos' || c.niche === niche).map(c => c.id)
      const esperado = oraculoEscrito(ids, valorDe(obs, sort, scale, fmt), escrito(obs, sort, scale))
      for (const id of ids) {
        expect(byId(d, id).pos, `${niche} ${sort} ${scale} ${fmt} desc ${id}`).toEqual(esperado(id))
        expect(byId(a, id).pos, `${niche} ${sort} ${scale} ${fmt} asc ${id}`).toEqual(esperado(id))
      }
      for (const l of d.own.block!.linhas) {
        if (l.tipo !== 'cheia') continue
        const la = cheia(a, l.id)
        expect(la.frase, `${niche} ${sort} ${fmt}`).toBe(l.frase)
        if (l.pos && l.vizinhos && la.vizinhos) {
          const vd = vizinhosDe(l.vizinhos), va = vizinhosDe(la.vizinhos)
          expect(va.acima?.[0] ?? null).toBe(vd.abaixo?.[0] ?? null)
          expect(va.abaixo?.[0] ?? null).toBe(vd.acima?.[0] ?? null)
          // null === null passaria sem comparar nada: só conta quando ao menos um vizinho foi lido de verdade
          if (vd.acima || vd.abaixo) vizinhosComparados++
        }
      }
    }
    expect(vizinhosComparados, 'vizinhos realmente lidos e trocados de lado').toBeGreaterThan(10)
  })
  it('I2: o valor da frase do bloco e dos vizinhos é o texto que a CÉLULA mostra (Inscritos e Views/dia, nas duas escalas, em Longos, Shorts e Todos)', () => {
    let conferidos = 0
    for (const { sort, scale, fmt } of COMBOS) for (const dir of ['desc', 'asc'] as const) {
      const v = view({ sort, scale, fmt, dir })
      for (const l of v.own.block!.linhas) {
        if (l.tipo !== 'cheia' || !l.pos) continue
        const r = byId(v, l.id)
        expect(l.frase.endsWith(`com ${celulaTxt(r, sort)}.`), `${sort} ${scale} ${fmt}: ${l.frase} / célula ${celulaTxt(r, sort)}`).toBe(true)
        expect(v.pe!.texto.endsWith(`com ${celulaTxt(byId(v, v.pe!.canalId), sort)}.`)).toBe(true)
        const viz = vizinhosDe(l.vizinhos ?? '')
        for (const lado of [viz.acima, viz.abaixo]) {
          if (!lado) continue
          const vizinha = all(v).find(x => x.name === lado[0])!
          expect(lado[1], `${sort} ${scale} ${fmt}: vizinho ${lado[0]}`).toBe(celulaTxt(vizinha, sort))
          conferidos++
        }
      }
    }
    expect(conferidos).toBeGreaterThan(10)
  })
  it('M1: duas linhas com o mesmo valor ESCRITO têm a mesma posição e "(empate)": nenhuma combinação mostra "9º e 10º com 0,2"', () => {
    const w = a3World(ds => {
      const [a, b] = ds.channels.filter(c => !c.own && c.subs != null)
      a!.subs = 777000; b!.subs = 777400 // números diferentes, "777 mil" nos dois
    })
    const obs = w.obs
    const v = view({ sort: 'subs' }, w.obs)
    const dois = all(v).filter(r => r.subs.replace(/\u00a0/g, ' ') === '777 mil')
    expect(dois).toHaveLength(2)
    expect(dois[0]!.pos).toEqual(dois[1]!.pos)
    expect(dois[0]!.pos!.empate).toBe(true)
    // vale para o mundo todo, em todas as combinações
    for (const world of [obs, BASE.obs]) for (const { sort, scale, fmt } of COMBOS) for (const dir of ['desc', 'asc'] as const) {
      const vv = view({ sort, scale, fmt, dir }, world)
      const porTexto = new Map<string, Set<number>>()
      for (const r of all(vv)) if (r.pos) porTexto.set(celulaTxt(r, sort), (porTexto.get(celulaTxt(r, sort)) ?? new Set()).add(r.pos.pos))
      for (const [t, ps] of porTexto) expect(ps.size, `${sort} ${scale} ${fmt} "${t}"`).toBe(1)
    }
    // o canal próprio no empate diz "(empate)" na frase
    const dono = all(view({ sort: 'subs' }, w.obs)).find(r => r.own)!
    expect(dono).toBeDefined()
    const w2 = a3World(ds => { const own = ds.channels.find(c => c.own)!; const o = ds.channels.find(c => !c.own && c.subs != null)!; o.subs = 12300; own.subs = 12340 })
    const f = cheia(view({ sort: 'subs' }, w2.obs), w2.owns[0]!)
    expect(f.pos!.empate).toBe(true)
    expect(f.frase).toContain('(empate)')
  })
  it('"de N": a tela diz o conjunto que conta quando a lista mostra outra coisa (canal próprio sem nicho num nicho; "só com problema")', () => {
    const mix = a3World(undefined, 'mix')
    const noNicho = view({ niche: 'viagem', sort: 'subs' }, mix.obs)
    expect(noNicho.posicaoNota).toBe('A posição conta só os canais de Viagem; o seu canal sem nicho aparece na lista, sem posição.')
    const rankedComPos = noNicho.list.ranked.filter(r => r.pos).length
    expect(noNicho.list.ranked.length).toBe(rankedComPos + 1) // a diferença que a nota explica
    // dois sem nicho: plural
    const dois = a3World(ds => { for (const c of ds.channels.filter(x => x.own).slice(0, 2)) c.niche = null }, 'mix')
    expect(view({ niche: 'viagem' }, dois.obs).posicaoNota).toBe('A posição conta só os canais de Viagem; os seus 3 canais sem nicho aparecem na lista, sem posição.')
    // sob "só com problema" a lista é menor que o "de N"
    const prob = view({ filter: 'problemas' })
    expect(prob.posicaoNota).toBe('Posição na lista inteira, não só nos canais com problema.')
    expect(prob.list.ranked.length).toBeLessThan(prob.list.ranked.find(r => r.pos)!.pos!.de)
    // os dois juntos
    expect(view({ niche: 'viagem', filter: 'problemas' }, mix.obs).posicaoNota).toBe(
      'A posição conta só os canais de Viagem; o seu canal sem nicho aparece na lista, sem posição. Posição na lista inteira, não só nos canais com problema.')
    // nada a explicar: null (nicho Todos, ou nicho sem canal próprio sem nicho)
    expect(view({}).posicaoNota).toBeNull()
    expect(view({ niche: 'viagem' }).posicaoNota).toBeNull()
    expect(view({ sort: 'subs' }, mix.obs).posicaoNota).toBeNull()
  })
})

describe('A3.2 o motivo nunca é inventado (revisão da Tarefa 4, M-4)', () => {
  it('todo canal próprio sem posição carrega o motivo: em nenhuma ordenação × formato × escala × direção × nicho o modelo devolve pos nulo com semMedida nulo', () => {
    const mundos = [BASE, mundoSemMedida(), a3World(ds => { for (const v of ds.videos) semDiario(v) })]
    let semPosicao = 0
    for (const w of mundos) for (const niche of ['todos', 'viagem', 'ia'] as const) for (const scale of SCALES) for (const fmt of FMTS) for (const sort of SORTS) for (const dir of ['desc', 'asc'] as const) {
      const v = view({ niche, scale, fmt, sort, dir } as Partial<CanaisParams>, w.obs)
      for (const r of all(v)) {
        if (!r.own || r.pos) continue
        semPosicao++
        expect(r.semMedida, `${niche} ${scale} ${fmt} ${sort} ${dir}: ${r.name} sem posição precisa de um motivo`).not.toBeNull()
      }
      // a frase do bloco e a da linha presa dizem o motivo do modelo, nunca um padrão
      for (const l of v.own.block?.linhas ?? []) if (l.tipo === 'cheia') expect(l.frase.length).toBeGreaterThan(0)
      if (v.pe) expect(v.pe.texto.length).toBeGreaterThan(0)
    }
    expect(semPosicao, 'a prova só vale se houve canal próprio sem posição').toBeGreaterThan(20)
  }, 60_000)
  it('fraseSeuCanal sem posição e sem motivo é vazia: não escolhe um motivo por conta própria', () => {
    expect(fraseSeuCanal(null, { tipo: 'geral' } as never, null)).toBe('')
    expect(fraseSeuCanal(null, { tipo: 'geral' } as never, undefined)).toBe('')
    expect(fraseSeuCanal(null, { tipo: 'geral' } as never, 'sem-views-dia-proprio')).toBe(motivoTexto('sem-views-dia-proprio'))
  })
})
