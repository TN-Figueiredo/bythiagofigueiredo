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
      // A5 2ª leva T1 (D1b): roundingText corrigido para o sentido da doc oficial (este ou um pouco maior), e o texto curto do motor
      // só TEXTO, número não.
      .replace(/arredondamento do YouTube: ±[^"]*?(?=")/g, 'arredondamento do YouTube: <ARRED>')
      // (o "+N (±unit)" do ganho NÃO dobra: é o erro da diferença, 1 passo, Phil M-3)
      // A5 2ª leva D1 (dono aprovou no mockup 17, 15/10): o ±N do "dentro do arredondamento" dobra (1 passo -> 2 passos)
      .replace(/(?<!\+[\d.,]+(?:\u00a0| )?(?:mil|mi)? )(\(|arredondamento do YouTube, )±(\d+(?:,\d+)?)((?:\u00a0| )(?:mil|mi))?/g, (_m, pre: string, n: string, un: string | undefined) => `${pre}±${String(Number(n.replace(',', '.')) * 2).replace('.', ',')}${un ?? ''}`)
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
    // só cells.growth.tip sai; um campo futuro chamado tip em outro lugar continua comparado
    const semTipDoCrescimento = (o: unknown): void => {
      if (Array.isArray(o)) { o.forEach(semTipDoCrescimento); return }
      if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>
        if (r.cells && typeof r.cells === 'object') { const g = (r.cells as Record<string, unknown>).growth; if (g && typeof g === 'object') delete (g as Record<string, unknown>).tip }
        Object.values(r).forEach(semTipDoCrescimento)
      }
    }
    const atual = JSON.parse(JSON.stringify(retrato).replace(/arredondamento do YouTube: o número real é este ou um pouco maior, em menos de [^"]*?(?=")/g, 'arredondamento do YouTube: <ARRED>')) as typeof retrato
    semTipDoCrescimento(atual)
    // Desvio 16 (decisão 75): campo NOVO `ausencia` (estado tipado da ausência) em `Numero` e nas células da lista; nenhum número nem texto muda.
    const semAusencia = (o: unknown): void => {
      if (Array.isArray(o)) { o.forEach(semAusencia); return }
      if (o && typeof o === 'object') { const r = o as Record<string, unknown>; delete r.ausencia; Object.values(r).forEach(semAusencia) }
    }
    semAusencia(atual)
    // A5 2ª leva T4 (mockup 17): forma e texto da célula de Crescimento mudaram (sem setas, "sem variação", + e −, campos novos para a dica); NÚMERO não.
    // Compara-se o `kind` normalizado (flat/ok/na), o percentual escrito (`big`) e o texto das células sem medida. O canal PRÓPRIO passa a ser medido pelos
    // retratos diários (MG20) que a página já lê: o oráculo não os tem, então a célula dele vira "sem registro"; ele sai da comparação do Crescimento (desvio declarado).
    const donos = new Set(obs.channels.filter(c => c.own).map(c => c.id))
    type Linha = { cells: { growth: { kind: string; big?: string; text?: string } }; growth?: string; growthTitle?: string }
    const soNumeroDoCrescimento = (r: typeof retrato) => {
      // I-1 (Phil/Yannis): o Comparar do canal PRÓPRIO passa a ler os retratos MG20 pelo motor; o retrato antigo dizia "sem contagem". O caso novo é provado em own-crescimento-fonte.test.ts
      for (const c of r.canais) if (donos.has(c.id)) delete (c.comparar as Record<string, unknown>).inscritos30
      for (const c of r.canais) for (const l of Object.values(c.lista)) {
        const linha = l as unknown as Linha | null
        if (!linha) continue
        if (donos.has(c.id)) { delete (linha.cells as Partial<Linha['cells']>).growth; delete linha.growth; delete linha.growthTitle; continue }
        const g = linha.cells.growth
        linha.cells.growth = g.kind === 'na' ? { kind: 'na', text: g.text } : g.kind === 'flat' ? { kind: 'flat' } : { kind: 'ok', big: g.big }
        if (linha.growth && /^≈\s0$/u.test(linha.growth)) linha.growth = 'sem variação'
        delete linha.growthTitle
      }
      return r
    }
    // Desvio 15 (trem 5.1, Gio b): "desde o último vídeo" do cabeçalho passa a contar dias completos de 24 h (floor, a regra do ponteiro do Ritmo), não
    // arredondados: o N de "há N dias" pode cair 1. O número é provado em medidas-canal-cabecalho.test.ts; aqui só esse valor sai da comparação.
    const diasCompletos = (o: unknown): void => {
      if (Array.isArray(o)) { o.forEach(diasCompletos); return }
      if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>
        if (r.key === 'ultimoVideo' && typeof r.value === 'string' && /^há \d+ dias$/.test(r.value)) r.value = 'há <N> dias'
        Object.values(r).forEach(diasCompletos)
      }
    }
    // Nota do ritmo (19/10): a célula de cadência ganhou o campo `nota`, null enquanto a base é a cheia de 13 semanas; só o campo novo sai da comparação.
    const semNotaNula = (o: unknown): void => {
      if (Array.isArray(o)) { o.forEach(semNotaNula); return }
      if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>
        if (r.kind === 'ok' && 'weeks' in r && r.nota === null) delete r.nota
        Object.values(r).forEach(semNotaNula)
      }
    }
    diasCompletos(atual); diasCompletos(novo); semNotaNula(atual)
    expect(soNumeroDoCrescimento(atual)).toEqual(soNumeroDoCrescimento(novo))
  })

  // A5 2ª leva D1, parte NÚMERO da exceção: quem muda de "dentro/fora" é calculado aqui pelas duas regras; um id que mude e não caia no predicado falha.
  it('A5 2ª leva D1: os canais que mudam de dentro/fora são exatamente os que as duas regras separam (id inexplicado falha)', () => {
    const DIA = 86_400_000
    const passo = (n: number) => (n < 1000 ? 0 : Math.pow(10, Math.floor(Math.log10(n)) - 2))
    const mudaram: string[] = []
    const deveriam: string[] = []
    for (const c of obs.channels) {
      const sn = c.snapshots
      if (!sn.length || c.subs == null) continue
      const fim = sn[sn.length - 1]!
      const ini = [...sn].reverse().find(x => x.t <= fim.t - 30 * DIA)
      if (!ini) continue
      const dias = (fim.t - ini.t) / DIA
      if (dias < 29) continue
      const g = fim.subs - ini.subs
      const antigo = c.subs < 1000 ? Math.abs(g) <= 1 : Math.abs(g) <= passo(c.subs)
      const pn = passo(Math.max(ini.subs, fim.subs))
      const novo = dias > 33 ? null : pn > 0 ? Math.abs(g) < 2 * pn : g === 0
      if (novo === null || antigo !== novo) deveriam.push(c.id)
      const cel = obs.channelStats(c.id, 'long').growth30
      if (cel.withinRounding !== antigo || cel.pending) mudaram.push(c.id)
    }
    expect(mudaram.sort()).toEqual(deveriam.sort())
    console.info(`D1: ${mudaram.length} de ${obs.channels.length} canais do oráculo mudam de célula`)
  })
})
