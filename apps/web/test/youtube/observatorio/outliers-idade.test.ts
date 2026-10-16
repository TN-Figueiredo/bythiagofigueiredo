// @vitest-environment node
// E5a T8 (mockup 17b): views aos 7 e aos 30 dias nos Outliers. Primeiro o módulo puro, depois o modelo da tela com dados sintéticos sobre o oráculo.
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { medido, naoMedido, type Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import type { ValorM1 } from '@/lib/youtube/observatorio/medidas/m1'
import { buildOutliersView, type DadosDeIdade, type OutliersView } from '@/app/cms/(authed)/youtube/competitors/_outliers/view-model'
import type { MedidasDoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import { dadosDeIdade } from '@/app/cms/(authed)/youtube/competitors/_outliers/idade-dados'
import {
  celulaDeIdade, cobertura, fraseDaOrdem, motivosAgrupados, ordenarPorIdade, quandoFecham, type Celula,
} from '@/app/cms/(authed)/youtube/competitors/_outliers/idade-model'

const obs = createObservatory(datasetFromOracle(loadOracle()))
const JAN = { de: '2026-10-01', ate: '2026-10-08', dias: 7 }
const ok = (views: number): Medida<ValorM1> => medido({ views, gapHoras: 12, fonte: 'marca' }, 1, JAN)
const HOJE = '2026-10-16'

describe('celulaDeIdade', () => {
  it('zero medido é medido com valor 0, nunca não medido', () => {
    expect(celulaDeIdade(ok(0), 7)).toEqual({ estado: 'medido', valor: 0 })
  })
  it('motivos de não medido com a frase curta do mockup', () => {
    const c = celulaDeIdade(naoMedido('leitura_comecou_depois'), 30)
    expect(c).toMatchObject({ estado: 'nao_medido', grupo: 'antes', curta: 'antes de 03/10' })
    expect(celulaDeIdade(naoMedido('descoberto_tarde'), 7)).toMatchObject({ grupo: 'tarde', curta: 'descoberto tarde' })
    expect(celulaDeIdade(naoMedido('fecha_em', { fechaEm: '2026-11-03' }), 30)).toMatchObject({ grupo: 'fecha', curta: 'fecha em 03/11', fechaEm: '2026-11-03' })
    expect(celulaDeIdade(naoMedido('leituras_distantes'), 7)).toMatchObject({ grupo: 'distantes', curta: 'leituras distantes' })
  })
  it('canal sem medida ou leitura que falhou é "não carregou", nunca "não medido" nem 0', () => {
    expect(celulaDeIdade(undefined, 7)).toEqual({ estado: 'nao_carregou' })
    expect(celulaDeIdade(naoMedido('leitura_falhou'), 7)).toEqual({ estado: 'nao_carregou' })
    expect(celulaDeIdade(naoMedido('calculo_falhou'), 30)).toEqual({ estado: 'nao_carregou' })
  })
})

describe('ordenarPorIdade e cobertura', () => {
  const c = (valor: number): Celula => ({ estado: 'medido', valor })
  const nm = celulaDeIdade(naoMedido('descoberto_tarde'), 7)
  it('medidos por valor decrescente (zero por último entre eles); os sem medida ficam no fim, na ordem recebida', () => {
    const itens = [{ id: 'a', celula: nm }, { id: 'b', celula: c(0) }, { id: 'c', celula: c(50) }, { id: 'd', celula: { estado: 'nao_carregou' } as Celula }, { id: 'e', celula: c(900) }]
    const r = ordenarPorIdade(itens)
    expect(r.medidos.map(x => x.id)).toEqual(['e', 'c', 'b'])
    expect(r.resto.map(x => x.id)).toEqual(['a', 'd'])
  })
  it('empate de valor mantém a ordem do multiplicador', () => {
    expect(ordenarPorIdade([{ id: 'x', celula: c(5) }, { id: 'y', celula: c(5) }, { id: 'z', celula: c(5) }]).medidos.map(x => x.id)).toEqual(['x', 'y', 'z'])
  })
  it('a cobertura conta zero como medido, e erro não é nem medido nem não medido', () => {
    const cob = cobertura([c(10), c(0), nm, { estado: 'nao_carregou' }])
    expect(cob).toMatchObject({ medidos: 2, total: 4, zeros: 1, erros: 1 })
    expect(cob.casas).toEqual(['cheia', 'zero', 'nao', 'erro'])
  })
})

describe('motivosAgrupados e quandoFecham', () => {
  const f = (d: string) => celulaDeIdade(naoMedido('fecha_em', { fechaEm: d }), 30)
  it('os motivos saem com contagem e data, na ordem do NOTAS (antes, fecham, descoberto tarde, leituras distantes)', () => {
    const cs = [celulaDeIdade(naoMedido('descoberto_tarde'), 7), f('2026-10-18'), celulaDeIdade(naoMedido('leitura_comecou_depois'), 7), f('2026-10-16'), celulaDeIdade(naoMedido('leitura_comecou_depois'), 7), celulaDeIdade(naoMedido('leituras_distantes'), 7)]
    expect(motivosAgrupados(cs).map(m => m.texto)).toEqual(['2 antes de 03/10', '2 fecham em 16/10 e 18/10', '1 descoberto tarde', '1 com leitura distante'])
  })
  it('uma data só no singular, três ou mais em intervalo', () => {
    expect(motivosAgrupados([f('2026-10-16')]).map(m => m.texto)).toEqual(['1 fecha em 16/10'])
    expect(motivosAgrupados([f('2026-10-16'), f('2026-10-20'), f('2026-10-25')]).map(m => m.texto)).toEqual(['3 fecham de 16/10 a 25/10'])
  })
  it('a régua "Quando fecham" só existe se alguém ainda fecha', () => {
    expect(quandoFecham([celulaDeIdade(naoMedido('descoberto_tarde'), 7), { estado: 'medido', valor: 3 }], HOJE)).toBeNull()
    expect(quandoFecham([f('2026-11-03'), f('2026-10-20')], HOJE)).toMatchObject({ primeira: '2026-10-20', ultima: '2026-11-03', faltam: 4 })
  })
})

describe('fraseDaOrdem (texto do NOTAS)', () => {
  const txt = (p: ReturnType<typeof fraseDaOrdem>) => p.map(x => (typeof x === 'string' ? x : x.b)).join('')
  it('padrão, com zero medido, singular e nenhum medido', () => {
    expect(txt(fraseDaOrdem(7, { medidos: 3, total: 11, zeros: 0 }, null))).toBe('Do maior para o menor número de views aos 7 dias: 3 de 11 outliers já têm essa medida; os outros 8 ficam no fim, na ordem do multiplicador.')
    expect(txt(fraseDaOrdem(7, { medidos: 13, total: 14, zeros: 2 }, null))).toBe('Do maior para o menor número de views aos 7 dias: 13 de 14 outliers já têm essa medida (2 com zero medido); o outro 1 fica no fim, na ordem do multiplicador.')
    expect(txt(fraseDaOrdem(30, { medidos: 1, total: 4, zeros: 0 }, null))).toContain('1 de 4 outliers já tem essa medida')
    expect(txt(fraseDaOrdem(30, { medidos: 0, total: 11, zeros: 0 }, { datas: ['2026-11-03'], primeira: '2026-11-03', ultima: '2026-11-03', faltam: 18 })))
      .toBe('Nenhum dos 11 outliers tem views aos 30 dias ainda: a primeira medida fecha em 03/11 (faltam 18 dias). Enquanto isso, a lista segue o multiplicador.')
    expect(txt(fraseDaOrdem(30, { medidos: 0, total: 11, zeros: 0 }, { datas: ['2026-11-03'], primeira: '2026-11-03', ultima: '2026-11-03', faltam: 1 }))).toContain('(falta 1 dia)')
  })
})

// ───── o modelo da tela

const base = buildOutliersView(obs, {})
const ids = base.groups.flatMap(g => g.cards.map(c => c.id))
const porMult = (v: OutliersView) => v.groups.flatMap(g => g.cards.map(c => c.id))
/** A ordem do multiplicador, plana (a da lista inteira, com os de base fraca). */
const idsPorMultiplicador = obs.outliers({ includeWeak: true }).items.map(i => i.id)

/** Dados sintéticos: a posição `i` de `ids` recebe `v7[i]`/`v30[i]` (Medida) e `live[i]`. */
function dados(o: { v7?: Array<Medida<ValorM1>>; v30?: Array<Medida<ValorM1>>; live?: Array<boolean | null>; fora?: number } = {}): DadosDeIdade {
  const m1 = new Map<string, Record<7 | 30, Medida<ValorM1>>>()
  const videos = new Map<string, { wasLive: boolean | null; missingSince: number | null }>()
  ids.forEach((id, i) => {
    m1.set(id, { 7: o.v7?.[i] ?? naoMedido('leitura_comecou_depois'), 30: o.v30?.[i] ?? naoMedido('fecha_em', { fechaEm: '2026-11-03' }) })
    videos.set(id, { wasLive: o.live && i in o.live ? o.live[i]! : false, missingSince: null })
  })
  const fora = new Map<string, { long: number; short: number }>()
  if (o.fora) for (const c of obs.channels) fora.set(c.id, { long: 0, short: 0 })
  if (o.fora) fora.set(obs.channels.find(c => !c.own)!.id, { long: o.fora, short: 0 })
  return { hojeSP: HOJE, m1, videos, foraDoNormal: fora }
}

describe('Outliers view model: colunas de idade (T8)', () => {
  it('sem os dados a tela é a de antes: sem idade, sem as duas opções, e sort=v7 cai no multiplicador', () => {
    expect(base.idade).toBeNull()
    expect(base.sortOptions.map(o => o.value)).toEqual(['mult', 'vpd', 'recent'])
    expect(base.groups.every(g => g.cards.every(c => c.idade === null))).toBe(true)
    expect(buildOutliersView(obs, { sort: 'v7' }).query.sort).toBe('mult')
  })

  it('item 247: com sort padrão e dados, a lista, a ordem e os textos são os de antes', () => {
    const v = buildOutliersView(obs, {}, dados())
    expect(porMult(v)).toEqual(porMult(base))
    expect(v.groups.map(g => [g.id, g.label, g.why])).toEqual(base.groups.map(g => [g.id, g.label, g.why]))
    expect(v.baseText).toBe(base.baseText)
    expect(v.pageIds).toEqual(base.pageIds)
  })

  it('v7: medidos por valor decrescente, zero entre os medidos por último, os sem medida no fim na ordem do multiplicador', () => {
    const v7 = ids.map(() => naoMedido('descoberto_tarde') as Medida<ValorM1>)
    v7[5] = ok(900); v7[2] = ok(40_000); v7[8] = ok(0)
    const v = buildOutliersView(obs, { sort: 'v7' }, dados({ v7 }))
    const g = v.groups
    expect(g.map(x => x.id)).toEqual(['idade-med', 'idade-sem'])
    expect(g[0]!.cards.map(c => c.id)).toEqual([ids[2], ids[5], ids[8]])
    expect(g[1]!.cards.map(c => c.id)).toEqual(idsPorMultiplicador.filter(id => ![ids[2], ids[5], ids[8]].includes(id)))
    expect(g[0]!.label).toBe('Do maior para o menor: views aos 7 dias')
    expect(g[1]!.label).toBe('Sem a medida')
    expect(v.query.view).toBe('list')
    expect(v.baseText).toContain('3 de 11 outliers já têm essa medida (1 com zero medido)')
    expect(v.idade!.colunas[0]).toMatchObject({ idade: 7, ordenada: true, medidos: 3, total: 11, zeros: 1 })
    expect(v.idade!.colunas[0]!.casas.slice(0, 3)).toEqual(['cheia', 'cheia', 'zero'])
    expect(v.sortOptions.find(o => o.value === 'v7')).toMatchObject({ label: 'Ordenar: views aos 7 dias (3 de 11 medidos)', disabled: false })
    expect(v.sortOptions.find(o => o.value === 'v7')!.href).toContain('sort=v7')
    // nenhuma célula não medida mostra 0
    for (const c of g[1]!.cards) { expect(c.idade!.c7.kind).toBe('nao'); expect(c.idade!.c7.texto).toBeNull() }
    expect(g[0]!.cards[2]!.idade!.c7).toMatchObject({ kind: 'zero', texto: '0' })
  })

  it('0 medidos aos 30 dias: a ordem não muda, a frase diz quando fecha e há o botão de voltar ao multiplicador', () => {
    const v = buildOutliersView(obs, { sort: 'v30' }, dados())
    expect(v.groups.map(g => g.label)).toEqual(['Na ordem do multiplicador'])
    expect(v.groups[0]!.cards.map(c => c.id)).toEqual(idsPorMultiplicador)
    expect(v.baseText).toBe('Nenhum dos 11 outliers tem views aos 30 dias ainda: a primeira medida fecha em 03/11 (faltam 18 dias). Enquanto isso, a lista segue o multiplicador.')
    expect(v.idade!.voltar).toMatchObject({ texto: 'Voltar ao multiplicador (padrão)' })
    expect(v.idade!.voltar!.href).not.toContain('sort=')
    expect(v.idade!.quando).toMatchObject({ hoje: '16/10' })
    expect(v.idade!.colunas[1]!.motivos).toEqual(['11 fecham em 03/11'])
  })

  it('a régua "Quando fecham" não existe quando ninguém mais fecha', () => {
    const v30 = ids.map(() => naoMedido('descoberto_tarde') as Medida<ValorM1>)
    expect(buildOutliersView(obs, { sort: 'v30' }, dados({ v30 })).idade!.quando).toBeNull()
  })

  it('marcas não carregaram: as duas opções ficam desligadas, as células dizem "não carregou" e o multiplicador segue', () => {
    const v = buildOutliersView(obs, { sort: 'v7' }, 'erro')
    expect(v.idade).toMatchObject({ erro: true, ordem: null, colunas: [] })
    expect(v.query.sort).toBe('mult')
    expect(porMult(v)).toEqual(porMult(base))
    expect(v.sortOptions.filter(o => o.disabled).map(o => o.value)).toEqual(['v7', 'v30'])
    expect(v.sortOptions.find(o => o.value === 'v7')!.label).toBe('Ordenar: views aos 7 dias (indisponível agora)')
    expect(v.groups.every(g => g.cards.every(c => c.idade!.c7.kind === 'erro' && c.idade!.c30.kind === 'erro'))).toBe(true)
  })

  it('canal que não carregou: o vídeo dele é "não carregou" e os demais seguem medidos', () => {
    const d = dados({ v7: ids.map(() => ok(10)) })
    const m1 = new Map(d.m1); m1.delete(ids[0]!)
    const v = buildOutliersView(obs, { sort: 'v7' }, { ...d, m1 })
    const c0 = v.groups.flatMap(g => g.cards).find(c => c.id === ids[0])!
    expect(c0.idade!.c7.kind).toBe('erro')
    expect(v.groups[0]!.id).toBe('idade-med')
    expect(v.idade!.colunas[0]!.casas.filter(k => k === 'erro')).toHaveLength(1)
  })

  it('ao vivo ou estreia: selo na linha, linha do topo com o total do canal e "was_live" nulo sem selo (o ⓘ conta)', () => {
    const live = ids.map(() => false as boolean | null); live[1] = true; live[4] = null; live[6] = null
    const v = buildOutliersView(obs, {}, dados({ live, fora: 2 }))
    expect(v.groups.flatMap(g => g.cards).filter(c => c.idade!.aoVivo).map(c => c.id)).toEqual([ids[1]])
    expect(v.idade!.aoVivo).toMatchObject({ fora: 2, naLista: 1 })
    expect(v.idade!.aoVivo!.texto).toBe('2 vídeos ao vivo ou estreia ficaram fora do cálculo do normal do canal; um aparece na lista com o selo.')
    expect(v.idade!.info.join(' ')).toContain('2 vídeos da lista estão sem a informação de ao vivo ou estreia')
    expect(buildOutliersView(obs, {}, dados()).idade!.aoVivo).toBeNull()
  })

  it('vídeo que saiu do YouTube fica na lista, com a marca e sem ligação (item 57)', () => {
    const d = dados(); const videos = new Map(d.videos); videos.set(ids[3]!, { wasLive: false, missingSince: 1 })
    const c = buildOutliersView(obs, {}, { ...d, videos }).groups.flatMap(g => g.cards).find(x => x.id === ids[3])!
    expect(c.idade!.saiu).toBe(true)
  })

  it('"N de M" conta a lista inteira, não a página', () => {
    const v = buildOutliersView(obs, { age: 'all', sort: 'v7' }, dados())
    const todos = obs.outliers({ ages: 'all', includeWeak: true }).countWithWeak
    expect(v.idade!.colunas[0]!.total).toBe(todos)
  })

  it('sort=v7 vai para a URL; sort=xyz cai no padrão e avisa', () => {
    const v = buildOutliersView(obs, { sort: 'v30' }, dados())
    expect(v.sortOptions.find(o => o.value === 'v30')!.href).toContain('sort=v30')
    expect(v.sortOptions.find(o => o.value === 'mult')!.href).not.toContain('sort=')
    const bad = buildOutliersView(obs, { sort: 'xyz' }, dados())
    expect(bad.query.sort).toBe('mult')
    expect(bad.chips.some(c => c.key === 'sort' && c.invalid)).toBe(true)
  })

  it('escolher a Grade com ordem por idade volta ao multiplicador (a visão Lista é a da idade)', () => {
    const v = buildOutliersView(obs, { sort: 'v7' }, dados({ v7: ids.map(() => ok(5)) }))
    expect(v.viewLinks.find(x => x.value === 'grid')!.href).not.toContain('sort=v7')
  })

  it('a barra de cada coluna tem a sua escala (o maior da lista naquela idade) e o zero não tem barra', () => {
    const v7 = ids.map(() => naoMedido('descoberto_tarde') as Medida<ValorM1>); v7[0] = ok(1000); v7[1] = ok(500); v7[2] = ok(0)
    const cards = buildOutliersView(obs, { sort: 'v7' }, dados({ v7 })).groups[0]!.cards
    expect(cards[0]!.idade!.c7.pct).toBe(100)
    expect(cards[1]!.idade!.c7.pct).toBe(50)
    expect(cards[2]!.idade!.c7.pct).toBeNull()
  })
})

describe('dadosDeIdade (do conjunto das medidas do site aos dados da tela)', () => {
  const canal = (nota: number): MedidasDoCanal => ({
    porFormato: {
      long: { m1: { 1: naoMedido('sem_leitura'), 7: medido(1, 1, JAN, nota ? [{ tipo: 'ao_vivo_fora', n: nota }] : []), 30: naoMedido('sem_leitura') } },
      short: { m1: { 1: naoMedido('sem_leitura'), 7: naoMedido('sem_leitura'), 30: naoMedido('sem_leitura') } },
    },
    porVideo: new Map([['v1', { m1: { 1: naoMedido('sem_leitura'), 7: ok(9), 30: naoMedido('fecha_em', { fechaEm: '2026-11-03' }) } }]]),
  } as unknown as MedidasDoCanal)

  it('nenhum canal carregou: a leitura inteira falhou ("erro")', () => {
    const m = { porCanal: new Map([['a', { naoCarregou: 'erro_do_banco' as const }]]), extras: { lido: false, causa: 'tempo_esgotado' } , falhas: [], esgotou: 0 } as unknown as MedidasDoSite
    expect(dadosDeIdade(m, HOJE)).toBe('erro')
  })
  it('canal que não carregou fica de fora (o vídeo dele vira "não carregou"), o resto entra, com o total de ao vivo fora do normal', () => {
    const m = { porCanal: new Map<string, MedidasDoCanal | { naoCarregou: 'erro_do_banco' }>([['a', canal(2)], ['b', { naoCarregou: 'erro_do_banco' }]]), falhas: [], esgotou: 0, videos: new Map([['v1', { wasLive: true, missingSince: null }]]) } as unknown as MedidasDoSite
    const d = dadosDeIdade(m, HOJE) as DadosDeIdade
    expect([...d.m1.keys()]).toEqual(['v1'])
    expect(d.foraDoNormal.get('a')).toEqual({ long: 2, short: 0 })
    expect(d.foraDoNormal.has('b')).toBe(false)
    expect(d.videos.get('v1')!.wasLive).toBe(true)
  })
  it('conjunto sem a leitura dos vídeos: ninguém recebe selo (was_live desconhecido)', () => {
    const m = { porCanal: new Map([['a', canal(0)]]), falhas: [], esgotou: 0 } as unknown as MedidasDoSite
    expect((dadosDeIdade(m, HOJE) as DadosDeIdade).videos.size).toBe(0)
  })
})
