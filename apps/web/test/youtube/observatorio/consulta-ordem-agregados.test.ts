// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { ordenar } from '@/lib/youtube/observatorio/consulta/ordem'
import { agregar } from '@/lib/youtube/observatorio/consulta/agregados'
import { montarConjunto } from '@/lib/youtube/observatorio/consulta/conjunto'
import { chaveDeVpd } from '@/lib/youtube/observatorio/outliers'
import { engajamentoDoCanal, type VideoParaEngajamento } from '@/lib/youtube/observatorio/medidas/engajamento'
import { median, quant } from '@/lib/youtube/observatorio/stats'
import { naoMedido, medido } from '@/lib/youtube/observatorio/medidas/tipos'
import { RULES } from '@/lib/youtube/observatorio/rules'
import type { CelulaDaConsulta, LinhaDaConsulta, MetricaDaConsulta } from '@/lib/youtube/observatorio/consulta/tipos'
import { J, m7Taxa, mundo, pedido } from './consulta-fixture'

const ok = (x: number, extra: Partial<CelulaDaConsulta> = {}): CelulaDaConsulta => ({ x, estado: x === 0 ? 'zero_medido' : 'medido', ...extra })
const sem: CelulaDaConsulta = { x: null, estado: 'nao_medido', causa: 'x' }
function lin(id: string, m: Partial<Record<MetricaDaConsulta, CelulaDaConsulta>>, o: Partial<LinhaDaConsulta> = {}): LinhaDaConsulta {
  return { id, ytId: id, titulo: id, canal: 'C', canalId: 'c1', publicadoEm: '2026-10-01', idadeDias: 10, formato: 'longos', formatoConfirmado: true, estado: 'ativo', medidoEm: null, lugares: null, celulas: m, multN: null, multMetodo: null, baseFraca: false, motivos: [], ...o }
}
const nenhum = { canalAtrasado: () => false }
const ids = (l: LinhaDaConsulta[]) => l.map(x => x.id)

describe('ordenar', () => {
  it('(§7 teste 16) asc com empate e nulo: nulo por último, empate na ordem do motor', () => {
    const l = [lin('a', { views: ok(5) }), lin('b', { views: sem }), lin('c', { views: ok(5) }), lin('d', { views: ok(1) })]
    expect(ids(ordenar(l, pedido({ ordenarPor: 'views', direcao: 'asc' }), nenhum))).toEqual(['d', 'a', 'c', 'b'])
    expect(ids(ordenar(l, pedido({ ordenarPor: 'views', direcao: 'desc' }), nenhum))).toEqual(['a', 'c', 'd', 'b'])
  })
  it('(§7 teste 16) multiplicador: base fraca depois das sólidas; com incluirBaseFraca fica na posição natural', () => {
    const l = [lin('s1', { multiplicador: ok(2) }), lin('f', { multiplicador: ok(8) }, { baseFraca: true }), lin('s2', { multiplicador: ok(4) })]
    expect(ids(ordenar(l, pedido({ ordenarPor: 'multiplicador' }), nenhum))).toEqual(['s2', 's1', 'f'])
    expect(ids(ordenar(l, pedido({ ordenarPor: 'multiplicador', incluirBaseFraca: true }), nenhum))).toEqual(['f', 's2', 's1'])
    expect(ids(ordenar(l, pedido({ ordenarPor: 'multiplicador', direcao: 'asc' }), nenhum))).toEqual(['s1', 's2', 'f'])
  })
  it('(g) engajamento: idade_30 primeiro e total_de_hoje depois, nunca intercalados', () => {
    const l = [lin('a', { engajamento: ok(50, { base: 'total_de_hoje' }) }), lin('b', { engajamento: ok(10, { base: 'idade_30' }) }), lin('c', { engajamento: ok(5, { base: 'idade_30' }) }), lin('n', { engajamento: sem })]
    expect(ids(ordenar(l, pedido({ ordenarPor: 'engajamento' }), nenhum))).toEqual(['b', 'c', 'a', 'n'])
    expect(ids(ordenar(l, pedido({ ordenarPor: 'engajamento', direcao: 'asc' }), nenhum))).toEqual(['c', 'b', 'a', 'n'])
  })
  it('(f) inscritos ordena pelo canal e, dentro do canal, mantém a ordem do motor', () => {
    const l = [lin('a', { inscritos: ok(100) }, { canalId: 'x' }), lin('b', { inscritos: ok(900) }, { canalId: 'y' }), lin('c', { inscritos: ok(100) }, { canalId: 'x' }), lin('d', { inscritos: sem }, { canalId: 'z' })]
    expect(ids(ordenar(l, pedido({ ordenarPor: 'inscritos' }), nenhum))).toEqual(['b', 'a', 'c', 'd'])
  })
  it('(i, Foco 7) vpd: 3 dias com vpd 5.000 e vpd7 nulo fica à frente de 40 dias com vpd7 800; canal atrasado no fim', () => {
    const l = [
      lin('velho', { vpd7: ok(800, { vpdBase: '7d' }) }, { idadeDias: 40 }),
      lin('atras', { vpd7: ok(99999, { vpdBase: '7d' }) }, { canalId: 'atrasado' }),
      lin('novo', { vpd7: ok(5000, { vpdBase: 'desde_publicacao' }) }, { idadeDias: 3 }),
      lin('nulo', { vpd7: sem }),
    ]
    const ctx = { canalAtrasado: (c: string) => c === 'atrasado' }
    expect(ids(ordenar(l, pedido({ ordenarPor: 'vpd7' }), ctx))).toEqual(['novo', 'velho', 'nulo', 'atras'])
    expect(ids(ordenar(l, pedido({ ordenarPor: 'vpd7', direcao: 'asc' }), ctx))).toEqual(['velho', 'novo', 'nulo', 'atras'])
  })
  it('(i2) paridade com orderedIds("vpd") da Outliers: a mesma sequência de chaves', () => {
    const { entrada, p, obs } = mundo()
    const o = obs.outliers({ niche: 'todos', fmt: 'long', ages: ['0-30', '31-90'], min: 2 })
    const da = ids(o.items.map(i => ({ id: i.id }) as LinhaDaConsulta))
    const conj = montarConjunto({ ...p, formato: 'longos', janelaIdade: ['0-30', '31-90'] }, entrada).longos.filter(l => da.includes(l.id))
    const ctx = { canalAtrasado: (c: string) => ['atrasado', 'erro'].includes(obs.channel(c)!.sync.state) }
    const minha = ordenar(conj, { ...p, ordenarPor: 'vpd7' }, ctx)
    const chave = (id: string) => { const v = obs.video(id)!; return chaveDeVpd(obs.channel(v.ch)!.sync.state, v) }
    expect(o.orderedIds('vpd').filter(id => da.includes(id)).map(chave)).toEqual(minha.map(l => chave(l.id)))
    expect(new Set(minha.map(l => l.id))).toEqual(new Set(o.orderedIds('vpd')))
  })
})

describe('agregar', () => {
  it('(§7 teste 9) o agregado é sobre todas as elegíveis, não sobre as linhas devolvidas (limite 3 de 40)', () => {
    const l = Array.from({ length: 40 }, (_, i) => lin('v' + i, { multiplicador: ok(1 + i), vpd7: ok(100 * (i + 1), { vpdBase: '7d' }) }))
    const { entrada } = mundo()
    const ag = agregar(l, pedido({ limite: 3, metricas: ['multiplicador', 'vpd7'] }), entrada)
    const xs = l.map(x => x.celulas.multiplicador!.x!)
    expect(ag.n).toBe(40); expect(ag.elegiveis).toBe(40)
    expect(ag.porMetrica.multiplicador).toMatchObject({ mediana: median(xs), q1: quant(xs, 0.25), q3: quant(xs, 0.75), n: 40 })
    expect(ag.porMetrica.vpd7!.n).toBe(40)
  })
  it('(§7 teste 19) base fraca fica fora do agregado do multiplicador, a menos que incluirBaseFraca; é contada', () => {
    const l = [lin('a', { multiplicador: ok(2) }), lin('b', { multiplicador: ok(4) }), lin('f', { multiplicador: ok(100) }, { baseFraca: true })]
    const { entrada } = mundo()
    const sem = agregar(l, pedido({ metricas: ['multiplicador'] }), entrada)
    expect(sem.porMetrica.multiplicador).toMatchObject({ mediana: 3, n: 2 }); expect(sem.baseFraca).toBe(1)
    expect(agregar(l, pedido({ metricas: ['multiplicador'], incluirBaseFraca: true }), entrada).porMetrica.multiplicador).toMatchObject({ mediana: 4, n: 3 })
  })
  it('agregado sem medido dá mediana null (sem medida), nunca 0', () => {
    const { entrada } = mundo()
    const ag = agregar([lin('a', { vpd7: sem, multiplicador: sem })], pedido({ metricas: ['vpd7', 'multiplicador'] }), entrada)
    expect(ag.porMetrica.vpd7).toMatchObject({ mediana: null, q1: null, q3: null, n: 0 })
    expect(ag.porMetrica.multiplicador!.mediana).toBeNull()
  })
  it('vpd7: só entram as células com base de 7 dias', () => {
    const { entrada } = mundo()
    const l = [lin('a', { vpd7: ok(100, { vpdBase: '7d' }) }), lin('b', { vpd7: ok(9999, { vpdBase: 'desde_publicacao' }) })]
    expect(agregar(l, pedido({ metricas: ['vpd7'] }), entrada).porMetrica.vpd7).toMatchObject({ mediana: 100, n: 1 })
  })
  it('views, likes e comentarios: mediana por faixa de idade, nunca misturada; com uma faixa só, a mediana é dela', () => {
    const { entrada } = mundo()
    const l = [lin('a', { views: ok(10) }, { idadeDias: 5 }), lin('b', { views: ok(30) }, { idadeDias: 20 }), lin('c', { views: ok(1000) }, { idadeDias: 60 }), lin('d', { views: sem }, { idadeDias: 60 })]
    const todas = agregar(l, pedido({ metricas: ['views'], janelaIdade: 'todas' }), entrada).porMetrica.views!
    expect(todas.mediana).toBeNull()
    expect(todas.porFaixa).toEqual([{ faixa: '0-30', mediana: 20, n: 2 }, { faixa: '31-90', mediana: 1000, n: 1 }])
    const uma = agregar(l.slice(0, 2), pedido({ metricas: ['views'], janelaIdade: ['0-30'] }), entrada).porMetrica.views!
    expect(uma.mediana).toBe(20)
  })
  it('(§7 teste 22) agendado fica fora do engajamento com agendadosFora; falhou é contado à parte e lista os vídeos', () => {
    const w = mundo(undefined, obs => {
      const vs = obs.videos.filter(v => v.ch === 'luke-damant' && v.fmt === 'long').slice(0, 8)
      return {
        m7: { [vs[0]!.id]: m7Taxa(0.01), [vs[1]!.id]: m7Taxa(0.02), [vs[2]!.id]: m7Taxa(0.03), [vs[3]!.id]: m7Taxa(0.04), [vs[4]!.id]: naoMedido('fecha_em'), [vs[5]!.id]: naoMedido('leitura_falhou'), [vs[6]!.id]: m7Taxa(0.9) },
        info: { [vs[6]!.id]: { wasLive: true } },
      }
    }, { canalIds: ['luke-damant'], formato: 'longos', metricas: ['engajamento'] })
    const l = montarConjunto(w.p, w.entrada).longos
    const ag = agregar(l, w.p, w.entrada)
    expect(ag.engajamento!.agendadosFora).toBe(2)
    expect(ag.engajamento!.falhou).toBe(1)
    expect(ag.engajamento!.resultado).toMatchObject({ estado: 'medido', valor: median([0.01, 0.02, 0.03, 0.04]), n: 4 })
    expect(ag.porMetrica.engajamento!.semOsVideos).toHaveLength(1)
    expect(ag.porMetrica.engajamento!.mediana).toBeCloseTo(25)
  })
  it('(§7 teste 9) engajamento nunca mistura idade_30 com total_de_hoje; menos de weakBase medidos é poucos_videos', () => {
    const mk = (n30: number, nHoje: number) => mundo(undefined, obs => {
      const vs = obs.videos.filter(v => v.ch === 'luke-damant' && v.fmt === 'long').slice(0, n30 + nHoje)
      const m7: Record<string, ReturnType<typeof m7Taxa>> = {}
      vs.forEach((v, i) => { m7[v.id] = i < n30 ? m7Taxa(0.01 * (i + 1)) : m7Taxa(0.5, 'total_de_hoje') })
      return { m7 }
    }, { canalIds: ['luke-damant'], formato: 'longos', metricas: ['engajamento'] })
    const a = mk(4, 3)
    const ag = agregar(montarConjunto(a.p, a.entrada).longos, a.p, a.entrada)
    expect(ag.engajamento!.resultado).toMatchObject({ estado: 'medido', n: 4, valor: median([0.01, 0.02, 0.03, 0.04]) })
    expect(ag.engajamento!.grupo).toBe('base')
    const b = mk(RULES.weakBase - 1, 0)
    const ab = agregar(montarConjunto(b.p, b.entrada).longos, b.p, b.entrada)
    expect(ab.engajamento!.resultado).toMatchObject({ estado: 'nao_medido', motivo: 'poucos_videos' })
    expect(ab.porMetrica.engajamento).toMatchObject({ mediana: null, n: 0 })
  })
  it('(§7 teste 3) engajamento de canal_ids:[X] igual ao m7 de longos que a tela Canal de X calcularia', () => {
    const w = mundo(undefined, obs => {
      const vs = obs.videos.filter(v => v.ch === 'luke-damant' && v.fmt === 'long').slice(0, 10)
      const m7: Record<string, ReturnType<typeof m7Taxa>> = {}
      vs.forEach((v, i) => { m7[v.id] = i === 9 ? naoMedido('poucas_views') : m7Taxa(0.005 * (i + 1), i % 4 === 3 ? 'total_de_hoje' : 'idade_30') })
      return { m7 }
    }, { canalIds: ['luke-damant'], formato: 'longos', janelaIdade: 'todas', metricas: ['engajamento'] })
    const l = montarConjunto(w.p, w.entrada).longos
    const doCanal = w.entrada.medidas.porCanal.get('luke-damant') as unknown as { porVideo: Map<string, { m7: ReturnType<typeof m7Taxa>; formato: 'long' | 'short' | null }> }
    const tela = engajamentoDoCanal(l.map((x): VideoParaEngajamento => ({ formato: doCanal.porVideo.get(x.id)!.formato, wasLive: false, agendadoOuNoAr: false, engajamento: doCanal.porVideo.get(x.id)!.m7 })), { formato: 'long', agoraMs: w.entrada.agoraMs })
    const ag = agregar(l, w.p, w.entrada)
    expect(tela.estado).toBe('medido')
    expect(ag.engajamento!.resultado).toEqual(tela)
    if (tela.estado === 'medido') expect(ag.porMetrica.engajamento!.mediana).toBeCloseTo(tela.valor * 1000)
    void medido; void J
  })
  it('conta os canais com sync atrasado ou erro (distintos) nas linhas', () => {
    const w = mundo()
    const l = montarConjunto({ ...w.p, formato: 'longos' }, w.entrada).longos
    const esperado = new Set(l.filter(x => ['atrasado', 'erro'].includes(w.obs.channel(x.canalId)!.sync.state)).map(x => x.canalId)).size
    expect(esperado).toBeGreaterThan(0)
    expect(agregar(l, w.p, w.entrada).sincAtrasado).toBe(esperado)
  })
  it('canal que não carregou: o agregado de curtidas diz "sem os canais X" e não conta o canal', () => {
    const w = mundo(undefined, { naoCarregou: { 'luke-damant': 'tempo_esgotado' } }, { metricas: ['likes'], formato: 'longos', janelaIdade: ['0-30'] })
    const l = montarConjunto(w.p, w.entrada).longos
    const ag = agregar(l, w.p, w.entrada).porMetrica.likes!
    expect(ag.semOsCanais).toEqual(['luke-damant'])
  })
  it('(Yannis M1) canal ausente de porCanal (medidas não carregadas): o agregado de curtidas também diz "sem os canais"', () => {
    const w = mundo(undefined, {}, { metricas: ['likes'], formato: 'longos', janelaIdade: ['0-30'] })
    const entrada = { ...w.entrada, medidas: { ...w.entrada.medidas, porCanal: new Map() } }
    const l = montarConjunto(w.p, entrada).longos
    expect(l.length).toBeGreaterThan(0)
    expect(agregar(l, w.p, entrada).porMetrica.likes!.semOsCanais.sort()).toEqual([...new Set(l.map(x => x.canalId))].sort())
  })
  it('(Yannis M2) ordenar por métrica fora de `metricas` ordena igual a quando ela entra na lista', () => {
    const w = mundo(undefined, {}, { formato: 'longos', ordenarPor: 'vpd7', metricas: ['views'] })
    const w2 = mundo(undefined, {}, { formato: 'longos', ordenarPor: 'vpd7', metricas: ['views', 'vpd7'] })
    const ctx = { canalAtrasado: (id: string) => ['atrasado', 'erro'].includes(w.obs.channel(id)!.sync.state) }
    const fora = ids(ordenar(montarConjunto(w.p, w.entrada).longos, w.p, ctx))
    const dentro = ids(ordenar(montarConjunto(w2.p, w2.entrada).longos, w2.p, ctx))
    expect(fora.length).toBeGreaterThan(3)
    expect(fora).toEqual(dentro)
    expect(fora).not.toEqual(ids(montarConjunto(w.p, w.entrada).longos))
  })
})
