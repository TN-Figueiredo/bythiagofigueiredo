// @vitest-environment node
// apps/web/test/youtube/observatorio/numeros-nao-mudam-e5a.test.ts
// E5a Tarefa 0b: o retrato "antes" dos números que a E5a não pode mudar. O JSON é gravado uma vez e nunca regravado;
// a partir da Tarefa 6a a comparação vira campo a campo, com as exceções declaradas por extenso.
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { buildCanalHeader } from '@/app/cms/(authed)/youtube/competitors/_canal/header-model'
import { numerosDoCanal, NUMEROS } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'

const obs = createObservatory(datasetFromOracle(loadOracle()))
const ESCOPOS = ['todos', 'viagem', 'ia'] as const
const TIPOS = ['title', 'thumb', 'desc'] as const
const J = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

export function montarRetrato() {
  const abas = Object.fromEntries(ESCOPOS.map(n => [n, obs.tabCounts(n)]))
  const mudancasPorTipo = Object.fromEntries(ESCOPOS.map(n => {
    const lista = obs.changesIn({ days: 30, niche: n })
    return [n, Object.fromEntries(TIPOS.map(t => [t, lista.filter(c => c.type === t).length]))]
  }))
  const canais = obs.channels.map(c => {
    const lista = (fmt: 'longos' | 'shorts' | 'todos') => {
      const v = buildCanaisView(obs, { niche: 'todos', limit: 75, fmt })
      const r = [...v.list.ranked, ...v.list.unranked].find(x => x.id === c.id)
      return r ? { vpd: r.vpd, pw: r.pw, growth: r.growth, growthTitle: r.growthTitle, mud: r.changes.n, out: r.outliers.n, cells: r.cells } : null
    }
    const painel = buildCanaisView(obs, { niche: 'todos', limit: 75, channel: c.id, tab: 'trocas' }).drawer
    const cab = buildCanalHeader(obs, c.id)
    const comparar = Object.fromEntries(NUMEROS.map(id => [id, numerosDoCanal(obs, c.id)[id]]))
    return {
      id: c.id,
      lista: { longos: lista('longos'), shorts: lista('shorts'), todos: lista('todos') },
      painel: painel ? { stats: painel.stats, swaps: { count: painel.swaps.count, intro: painel.swaps.intro, note: painel.swaps.note } } : null,
      cabecalho: cab ? { faixa: cab.faixa, todos: cab.todos } : null,
      comparar,
    }
  })
  return J({ abas, mudancasPorTipo, canais })
}

describe('E5a T0b: o retrato antes dos números', () => {
  const retrato = montarRetrato()
  it('mud é 18, 8 e 10 e as contagens por tipo são as do plano', () => {
    expect(retrato.abas.todos.mud).toBe(18); expect(retrato.abas.viagem.mud).toBe(8); expect(retrato.abas.ia.mud).toBe(10)
    expect(retrato.mudancasPorTipo.todos).toEqual({ title: 7, thumb: 8, desc: 3 })
    expect(retrato.mudancasPorTipo.viagem).toEqual({ title: 3, thumb: 4, desc: 1 })
    expect(retrato.mudancasPorTipo.ia).toEqual({ title: 4, thumb: 4, desc: 2 })
  })
  it('o retrato gravado é o do código de hoje (arquivo inteiro, só até a Tarefa 6a)', async () => {
    await expect(JSON.stringify(retrato, null, 2)).toMatchFileSnapshot('./fixtures/e5a-retrato-antes.json')
  })
})
