// @vitest-environment node
// apps/web/test/youtube/observatorio/numeros-nao-mudam-e5a.test.ts
// E5a Tarefa 0b: o retrato "antes" dos números que a E5a não pode mudar. O JSON é gravado uma vez e nunca regravado;
// a partir da Tarefa 6a a comparação vira campo a campo, com as exceções declaradas por extenso.
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { buildCanalHeader } from '@/app/cms/(authed)/youtube/competitors/_canal/header-model'
import { numerosDoCanal, NUMEROS } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { medidasDoOraculo } from './canais-e5a-fixture'

const obs = createObservatory(datasetFromOracle(loadOracle()))
const medidas = medidasDoOraculo(obs)
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
      const v = buildCanaisView(obs, { niche: 'todos', limit: 75, fmt, medidas })
      const r = [...v.list.ranked, ...v.list.unranked].find(x => x.id === c.id)
      return r ? { vpd: r.vpd, pw: r.pw, growth: r.growth, growthTitle: r.growthTitle, mud: r.changes.n, out: r.outliers.n, cells: r.cells } : null
    }
    const painel = buildCanaisView(obs, { niche: 'todos', limit: 75, channel: c.id, tab: 'trocas', medidas }).drawer
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
  it('mud é 15, 7 e 8 (eram 18, 8 e 10) e as contagens por tipo são as do plano', () => {
    expect(retrato.abas.todos.mud).toBe(15); expect(retrato.abas.viagem.mud).toBe(7); expect(retrato.abas.ia.mud).toBe(8)
    expect(retrato.mudancasPorTipo.todos).toEqual({ title: 7, thumb: 8, desc: 3 })
    expect(retrato.mudancasPorTipo.viagem).toEqual({ title: 3, thumb: 4, desc: 1 })
    expect(retrato.mudancasPorTipo.ia).toEqual({ title: 4, thumb: 4, desc: 2 })
  })
  it('o retrato de hoje é o gravado antes, campo a campo, com as exceções declaradas: abas.*.mud (desvio 12), texto (13) e o canal que a regra nova de parado solta (14)', () => {
    const antes = JSON.parse(readFileSync(new URL('./fixtures/e5a-retrato-antes.json', import.meta.url), 'utf8')) as typeof retrato
    const esperado = J(antes)
    esperado.abas.todos.mud = 15; esperado.abas.viagem.mud = 7; esperado.abas.ia.mud = 8
    // Desvio 13 (A5 E5a T5, Naksu/Logan 14/10): só TEXTO mudou, nunca número: frase de outlier ausente mais curta, "(±N)" no crescimento
    // dentro do arredondamento (a explicação completa foi para o title) e "Sem Shorts/longos em 90 d.".
    // Desvio 14 (A5 E5a, portão de Phil, I2): a fixture agora calcula o M8 pela regra NOVA (parado se os dias sem publicar passam de
    // max(28, 4 × intervalo mediano das 13 semanas)), sem copiar o `activity.state` de 30 dias do motor. Os dois discordam em UM canal:
    // 'bald-and-bankrupt' (último vídeo há 35 dias, mas publica a cada ~14 dias: o limite novo é 56). Para ele, e só para ele, somem os textos de
    // "parado" (célula de cadência, cauda do views/dia, subtítulos do painel); nenhum número muda.
    const discordam = obs.channels.filter(c => !c.own && c.activity.state === 'parado' && (() => { const m = medidas.porCanal.get(c.id); return m !== undefined && !('naoCarregou' in m) && m.m8.estado.estado === 'medido' && m.m8.estado.valor !== 'parado' })()).map(c => c.id)
    expect(discordam).toEqual(['bald-and-bankrupt'])
    const bb = esperado.canais.find(c => c.id === 'bald-and-bankrupt')!
    type Cel = { cadence: { paused: string | null; sub: string | null }; vpd: { tail: string | null } }
    for (const f of ['longos', 'shorts', 'todos'] as const) {
      const cel = (bb.lista[f] as unknown as { cells: Cel }).cells
      cel.cadence.paused = null; cel.vpd.tail = f === 'shorts' ? cel.vpd.tail : null
    }
    ;(bb.lista.longos as unknown as { cells: Cel }).cells.cadence.sub = 'sem Shorts'
    ;(bb.lista.shorts as unknown as { cells: Cel }).cells.cadence.sub = 'e 0,5 longos/sem'
    const st = (bb.painel as unknown as { stats: Array<{ sub: string; subWeak: boolean }> }).stats
    st[0]!.sub = 'longos + Shorts por semana'; st[0]!.subWeak = false
    st[1]!.sub = st[1]!.sub.replace(/\s+até o registro diário de .*$/u, '') // sai só a cauda do "parado"
    const texto = JSON.stringify(esperado)
      .replace(/Nenhum (?:vídeo longo|Short) com 2× ou mais em 90\u00a0d\. Maior:/g, 'Nenhum com 2×. Maior:')
      .replace(/Nenhum (?:vídeo longo|Short) com 2× ou mais em 90 d\. Maior:/g, 'Nenhum com 2×. Maior:')
      .replace(/Não publicou (longos|Shorts) em 90(\u00a0| )d\./g, 'Sem $1 em 90$2d.')
      .replace(/("(?:cap|growthTitle)":"?\s*")\(dentro do arredondamento do YouTube, (±[^)]*)\)/g, '$1($2)')
    const novo = JSON.parse(texto) as typeof retrato
    const comTitle = (o: unknown): void => {
      if (Array.isArray(o)) { o.forEach(comTitle); return }
      if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>
        if (r.kind === 'flat' && typeof r.cap === 'string') r.title = `≈ 0 (dentro do arredondamento do YouTube, ${(r.cap.match(/±[^)]*/) ?? [''])[0]})`
        Object.values(r).forEach(comTitle)
      }
    }
    comTitle(novo)
    // a dica do Crescimento (campo tip, lote rápido de 14/10) é texto novo da tela, não número: fora da comparação
    expect(JSON.parse(JSON.stringify(retrato, (k, v) => (k === 'tip' ? undefined : v)))).toEqual(novo)
  })
})
